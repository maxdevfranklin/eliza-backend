import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { AuthRoutes } from '../auth/auth-routes.ts';
import { AgentsRoutes } from '../agents/agents-routes.ts';

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