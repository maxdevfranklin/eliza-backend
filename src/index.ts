import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { createNodePlugin } from "@elizaos/plugin-node";
import { solanaPlugin } from "@elizaos/plugin-solana";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDbCache } from "./cache/index.ts";
import { character } from "./character.ts";
import { startChat } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import {
  getTokenForProvider,
  loadCharacters,
  parseArguments,
} from "./config/index.ts";
import { initializeDatabase } from "./database/index.ts";

import { grandVillaDiscoveryAction } from "./actions/grand-villa-discovery.ts";
// import { newsAction } from "./actions/news-actions.ts";
// import { grandvillaAction } from "./actions/grand-villa.ts";
import { discoveryStateProvider } from "./providers/discovery-state.ts";
import { AuthServer } from "./server/auth-server.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

let nodePlugin: any | undefined;

export function createAgent(
  character: Character,
  db: any,
  cache: any,
  token: string
) {
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character.name,
  );

  nodePlugin ??= createNodePlugin();

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    plugins: [
      // Remove or comment out plugins that might have competing actions
      // bootstrapPlugin,  // <-- Comment this out temporarily
      nodePlugin,
      character.settings?.secrets?.WALLET_PUBLIC_KEY ? solanaPlugin : null,
    ].filter(Boolean),
    providers: [discoveryStateProvider],
    // ONLY register YOUR action - no other actions
    actions: [grandVillaDiscoveryAction],
    services: [],
    managers: [],
    cacheManager: cache,
  });
}

async function startAgent(character: Character, directClient: DirectClient) {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = initializeDatabase(dataDir);

    await db.init();

    const cache = initializeDbCache(character, db);
    const runtime = createAgent(character, db, cache, token);

    await runtime.initialize();

    runtime.clients = await initializeClients(character, runtime);

    directClient.registerAgent(runtime);

    // report to console
    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

    return runtime;
  } catch (error) {
    elizaLogger.error(
      `Error starting agent for character ${character.name}:`,
      error,
    );
    console.error(error);
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const startAgents = async () => {
  const directClient = new DirectClient();
  let serverPort = parseInt(settings.SERVER_PORT || "3000");
  const args = parseArguments();

  let charactersArg = args.characters || args.character;
  let characters = [character];

  console.log("charactersArg", charactersArg);
  if (charactersArg) {
    characters = await loadCharacters(charactersArg);
  }
  console.log("characters", characters);
  
  let firstRuntime: any = null;
  
  try {
    for (const character of characters) {
      const runtime = await startAgent(character, directClient as DirectClient);
      if (!firstRuntime) {
        firstRuntime = runtime;
      }
    }
  } catch (error) {
    elizaLogger.error("Error starting agents:", error);
  }

  while (!(await checkPortAvailable(serverPort))) {
    elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
    serverPort++;
  }

  // upload some agent functionality into directClient
  directClient.startAgent = async (character: Character) => {
    // wrap it so we don't have to inject directClient later
    return startAgent(character, directClient);
  };

  // Start DirectClient on an internal port (serverPort + 1000 to avoid conflicts)
  const directClientPort = serverPort + 1000;
  while (!(await checkPortAvailable(directClientPort))) {
    elizaLogger.warn(`Internal port ${directClientPort} is in use, trying ${directClientPort + 1}`);
  }
  directClient.start(directClientPort);
  elizaLogger.info(`DirectClient started on internal port ${directClientPort}`);

  // Create integrated server with auth and message proxying
  if (firstRuntime) {
    const authServer = new AuthServer(firstRuntime);
    const { createServer, request } = await import('http');
    
    // Helper function to proxy requests
    const proxyRequest = (req: any, res: any) => {
      const options = {
        hostname: 'localhost',
        port: directClientPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      };

      const proxyReq = request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', (error) => {
        elizaLogger.error('Proxy error:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });

      req.pipe(proxyReq, { end: true });
    };

    // Helper function to handle OpenAI API calls using Grand Villa Discovery system
    const handleOpenAIMessage = async (req: any, res: any) => {
      try {
        // Parse request body
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            const { text, userId, userName } = JSON.parse(body);
            
            if (!text) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Text is required' }));
              return;
            }

            // Get OpenAI API key from environment
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (!openaiApiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'OpenAI API key not configured' }));
              return;
            }

            // Import and use the Grand Villa Discovery system
            const { DiscoveryOrchestrator } = await import('./message/discovery-orchestrator.js');
            const discoveryOrchestrator = new DiscoveryOrchestrator(openaiApiKey);
            
            // Generate unique userId if not provided
            const finalUserId = userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            elizaLogger.info(`🎯 Processing message with Discovery Orchestrator`);
            elizaLogger.info(`User ID: ${finalUserId}, Message: "${text}", User Name: ${userName || 'N/A'}`);
            
            // Process the message through the discovery system
            const discoveryResponse = await discoveryOrchestrator.processMessage(finalUserId, text, userName);
            
            elizaLogger.info(`✅ Discovery response generated:`, discoveryResponse);

            // Return response in the same format as the original API
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            
            res.end(JSON.stringify([{
              text: discoveryResponse.text,
              sender: 'grace',
              timestamp: new Date().toISOString(),
              metadata: {
                responseStatus: discoveryResponse.metadata.responseStatus,
                source: 'grand-villa-discovery',
                stage: discoveryResponse.metadata.stage,
                actionName: discoveryResponse.metadata.actionName,
                reliability: discoveryResponse.metadata.reliability
              }
            }]));

          } catch (error) {
            elizaLogger.error('Error processing OpenAI message:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      } catch (error) {
        elizaLogger.error('Error in handleOpenAIMessage:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    };

    // Create main integrated server
    const integratedServer = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathname = url.pathname;

      elizaLogger.debug(`Request: ${req.method} ${pathname}`);

      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.end();
        return;
      }

      // Handle new OpenAI direct message endpoint
      if (pathname === '/message' && req.method === 'POST') {
        elizaLogger.debug(`Handling OpenAI direct message: ${pathname}`);
        await handleOpenAIMessage(req, res);
        return;
      }

      // Handle auth and agents requests with AuthServer middleware
      if (pathname.startsWith('/auth/') || pathname.startsWith('/agents/')) {
        elizaLogger.debug(`Routing to middleware: ${pathname}`);
        const authMiddleware = authServer.createMiddleware();
        await authMiddleware(req, res);
      } else {
        elizaLogger.debug(`Proxying to DirectClient: ${pathname}`);
        // Proxy all other requests to DirectClient
        proxyRequest(req, res);
      }
    });
    
    integratedServer.listen(serverPort, () => {
      elizaLogger.info(`Integrated server started on port ${serverPort}`);
      elizaLogger.info("Available endpoints:");
      elizaLogger.info(`  Message API: http://localhost:${serverPort}/{agentId}/message`);
      elizaLogger.info(`  Message API: http://localhost:${serverPort}/message`);
      elizaLogger.info(`  POST http://localhost:${serverPort}/auth/register`);
      elizaLogger.info(`  POST http://localhost:${serverPort}/auth/login`);
      elizaLogger.info(`  POST http://localhost:${serverPort}/auth/verify`);
      elizaLogger.info(`  GET/PUT http://localhost:${serverPort}/agents/by-name`);
      elizaLogger.info(`  GET http://localhost:${serverPort}/auth/admin/users`);
      elizaLogger.info(`  GET http://localhost:${serverPort}/auth/admin/chat-history`);
    });
  }

  if (serverPort !== parseInt(settings.SERVER_PORT || "3000")) {
    elizaLogger.log(`Server started on alternate port ${serverPort}`);
  }

  const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
  if(!isDaemonProcess) {
    elizaLogger.log("Chat started. Type 'exit' to quit.");
    const chat = startChat(characters);
    chat();
  }
};

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});
