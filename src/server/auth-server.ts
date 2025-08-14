import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { AuthRoutes } from '../auth/auth-routes.ts';
import { AgentsRoutes } from '../agents/agents-routes.ts';
import { getUserResponses } from '../providers/discovery-state.js';

export class AuthServer {
  private authRoutes: AuthRoutes;
  private agentsRoutes: AgentsRoutes;
  private server: any;

  constructor(runtime: IAgentRuntime) {
    this.authRoutes = new AuthRoutes(runtime);
    this.agentsRoutes = new AgentsRoutes(runtime);
  }

  // Parse JSON body from request
  private parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          if (body) {
            resolve(JSON.parse(body));
          } else {
            resolve({});
          }
        } catch (error) {
          reject(error);
        }
      });
      
      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Set CORS headers
  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '3600');
  }

  // Send JSON response
  private sendJsonResponse(res: ServerResponse, status: number, data: any): void {
    this.setCorsHeaders(res);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }

  // Handle authentication and agents requests
  private async handleAuthRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    this.setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return true;
    }

    try {
      // Auth endpoints
      if (pathname === '/auth/register' && req.method === 'POST') {
        const body = await this.parseBody(req);
        const result = await this.authRoutes.handleRegister(body);
        this.sendJsonResponse(res, result.status, result.data);
        return true;
      }

      if (pathname === '/auth/login' && req.method === 'POST') {
        const body = await this.parseBody(req);
        const result = await this.authRoutes.handleLogin(body);
        this.sendJsonResponse(res, result.status, result.data);
        return true;
      }

      if (pathname === '/auth/verify' && req.method === 'POST') {
        const body = await this.parseBody(req);
        const token = body.token || req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          this.sendJsonResponse(res, 401, { success: false, message: 'Token required' });
          return true;
        }
        const result = await this.authRoutes.handleVerifyToken(token);
        this.sendJsonResponse(res, result.status, result.data);
        return true;
      }

      if (pathname === '/auth/delete-history' && req.method === 'DELETE') {
        const body = await this.parseBody(req);
        const result = await this.authRoutes.handleDeleteHistory(body);
        this.sendJsonResponse(res, result.status, result.data);
        return true;
      }

      // Comprehensive record endpoint
      if (pathname === '/auth/comprehensive-record' && req.method === 'GET') {
        const urlObj = new URL(req.url || '/', `http://${req.headers.host}`);
        const roomId = urlObj.searchParams.get('roomId');
        const username = urlObj.searchParams.get('userId'); // This is actually username
        const agentId = urlObj.searchParams.get('agentId');
        
        if (!roomId || !username || !agentId) {
          this.sendJsonResponse(res, 400, { success: false, message: 'roomId, userId (username), and agentId are required' });
          return true;
        }

        try {
          // First, get the actual user ID from the username
          const user = await this.authRoutes.getUserDatabase().getUserByUsername(username);
          if (!user) {
            this.sendJsonResponse(res, 404, { success: false, message: 'User not found' });
            return true;
          }

          const actualUserId = user.id;
          elizaLogger.info(`Found user ID: ${actualUserId} for username: ${username}`);

          const userResponses = await getUserResponses(this.authRoutes.getRuntime(), {
            roomId,
            userId: actualUserId, // Use the actual user ID
            agentId,
            content: { text: '' },
            createdAt: new Date()
          } as any);

          // Get comprehensive record data
          let comprehensiveRecord = null;
          if (userResponses.comprehensive_record && userResponses.comprehensive_record.length > 0) {
            // Merge all comprehensive records
            let mergedRecord = {
              contact_info: { collected_at: new Date().toISOString() },
              situation_discovery: [],
              lifestyle_discovery: [],
              readiness_discovery: [],
              priorities_discovery: [],
              last_updated: new Date().toISOString()
            };

            for (const recordString of userResponses.comprehensive_record) {
              try {
                const record = JSON.parse(recordString);
                
                // Merge contact info
                if (record.contact_info) {
                  const contactUpdate: any = {};
                  if (record.contact_info.name !== null && record.contact_info.name !== undefined) {
                    contactUpdate.name = record.contact_info.name;
                  }
                  if (record.contact_info.phone !== null && record.contact_info.phone !== undefined) {
                    contactUpdate.phone = record.contact_info.phone;
                  }
                  if (record.contact_info.loved_one_name !== null && record.contact_info.loved_one_name !== undefined) {
                    contactUpdate.loved_one_name = record.contact_info.loved_one_name;
                  }
                  if (record.contact_info.collected_at !== null && record.contact_info.collected_at !== undefined) {
                    contactUpdate.collected_at = record.contact_info.collected_at;
                  }
                  mergedRecord.contact_info = { ...mergedRecord.contact_info, ...contactUpdate };
                }

                // Merge Q&A arrays
                if (record.situation_discovery) {
                  for (const entry of record.situation_discovery) {
                    const exists = mergedRecord.situation_discovery.some(existing => existing.question === entry.question);
                    if (!exists) {
                      mergedRecord.situation_discovery.push(entry);
                    }
                  }
                }

                if (record.lifestyle_discovery) {
                  for (const entry of record.lifestyle_discovery) {
                    const exists = mergedRecord.lifestyle_discovery.some(existing => existing.question === entry.question);
                    if (!exists) {
                      mergedRecord.lifestyle_discovery.push(entry);
                    }
                  }
                }

                if (record.readiness_discovery) {
                  for (const entry of record.readiness_discovery) {
                    const exists = mergedRecord.readiness_discovery.some(existing => existing.question === entry.question);
                    if (!exists) {
                      mergedRecord.readiness_discovery.push(entry);
                    }
                  }
                }

                if (record.priorities_discovery) {
                  for (const entry of record.priorities_discovery) {
                    const exists = mergedRecord.priorities_discovery.some(existing => existing.question === entry.question);
                    if (!exists) {
                      mergedRecord.priorities_discovery.push(entry);
                    }
                  }
                }
              } catch (parseError) {
                elizaLogger.error("Error parsing comprehensive record:", parseError);
              }
            }

            comprehensiveRecord = mergedRecord;
          }

          // Get visit info
          let visitInfo = null;
          if (userResponses.visit_info && userResponses.visit_info.length > 0) {
            try {
              const latestVisitInfo = userResponses.visit_info[userResponses.visit_info.length - 1];
              let cleanJsonString = latestVisitInfo;
              
              if (typeof cleanJsonString === 'string' && cleanJsonString.includes('[Discovery Response]')) {
                const jsonStart = cleanJsonString.indexOf('{');
                if (jsonStart !== -1) {
                  cleanJsonString = cleanJsonString.substring(jsonStart);
                }
              }
              
              visitInfo = JSON.parse(cleanJsonString);
            } catch (error) {
              elizaLogger.error("Error parsing visit info:", error);
            }
          }

          this.sendJsonResponse(res, 200, { 
            success: true, 
            data: {
              comprehensiveRecord,
              visitInfo,
              userResponses
            }
          });
          return true;
        } catch (error) {
          elizaLogger.error("Error getting comprehensive record:", error);
          this.sendJsonResponse(res, 500, { success: false, message: 'Internal server error' });
          return true;
        }
      }

      // Agents endpoints
      if (pathname.startsWith('/agents/by-name') && req.method === 'GET') {
        const urlObj = new URL(req.url || '/', `http://${req.headers.host}`);
        const name = urlObj.searchParams.get('name') || 'GraceFletcher';
        const result = await this.agentsRoutes.handleGetByName(name);
        this.sendJsonResponse(res, result.status, result.data);
        return true;
      }

      if (pathname.startsWith('/agents/by-name') && req.method === 'PUT') {
        const urlObj = new URL(req.url || '/', `http://${req.headers.host}`);
        const name = urlObj.searchParams.get('name') || 'GraceFletcher';
        const body = await this.parseBody(req);
        elizaLogger.info(`Name update request body: ${body}`);
        const result = await this.agentsRoutes.handleUpdateByName(name, body || {});
        this.sendJsonResponse(res, result.status, result.data);
        return true;
      }

      if (pathname.startsWith('/auth/') || pathname.startsWith('/agents/')) {
        this.sendJsonResponse(res, 404, { success: false, message: 'Endpoint not found' });
        return true;
      }
    } catch (error) {
      elizaLogger.error('Request error:', error);
      this.sendJsonResponse(res, 500, { success: false, message: 'Internal server error' });
      return true;
    }

    return false; // Not handled here
  }

  // Create middleware function that can be used with existing server
  createMiddleware() {
    return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathname = url.pathname;

      const handled = await this.handleAuthRequest(req, res, pathname);
      
      if (!handled && next) {
        next();
      }
    };
  }

  getAuthService() {
    return this.authRoutes.getAuthService();
  }

  getUserDatabase() {
    return this.authRoutes.getUserDatabase();
  }
} 