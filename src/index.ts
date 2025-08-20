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
import { AuthRoutes } from './auth/auth-routes.ts';

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
function setCors(res: import('http').ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
import type { IncomingMessage } from 'http';

async function readJson(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as Uint8Array);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
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
  let directClientPort = serverPort + 1000;
  while (!(await checkPortAvailable(directClientPort))) {
    elizaLogger.warn(`Internal port ${directClientPort} is in use, trying ${directClientPort + 1}`);
    directClientPort++;
  }
  directClient.start(directClientPort);
  
  elizaLogger.info(`DirectClient started on internal port ${directClientPort}`);

  // Create integrated server with auth and message proxying
  if (firstRuntime) {
    const authServer = new AuthServer(firstRuntime);
    const { createServer, request } = await import('http');
    const auth = new AuthRoutes(firstRuntime);
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

    // Create main integrated server
    const integratedServer = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathname = url.pathname;
// CORS preflight only for auth endpoints
if (
  req.method === "OPTIONS" &&
  (pathname.startsWith("/api/auth/") || pathname.startsWith("/auth/"))
) {
  setCors(res);
  res.statusCode = 204;
  res.end();
  return;
}

// Forgot password
if (
  req.method === "POST" &&
  (pathname === "/api/auth/forgot-password" || pathname === "/auth/forgot-password")
) {
  setCors(res);
  const body = await readJson(req);
  const r = await auth.handleForgotPassword(body);
  res.statusCode = r.status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(r.data));
  return;
}

// Reset password
if (
  req.method === "POST" &&
  (pathname === "/api/auth/reset-password" || pathname === "/auth/reset-password")
) {
  setCors(res);
  const body = await readJson(req);
  const r = await auth.handleResetPassword(body);
  res.statusCode = r.status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(r.data));
  return;
}

      elizaLogger.debug(`Request: ${req.method} ${pathname}`);

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
      elizaLogger.info(`  POST http://localhost:${serverPort}/auth/register`);
      elizaLogger.info(`  POST http://localhost:${serverPort}/auth/login`);
      elizaLogger.info(`  POST http://localhost:${serverPort}/auth/verify`);
      elizaLogger.info(`  GET/PUT http://localhost:${serverPort}/agents/by-name`);
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
