import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { AuthService, type LoginRequest, type RegisterRequest } from './auth-service.ts';
import { UserDatabase } from '../database/users.ts';

export class AuthRoutes {
  private authService: AuthService;
  private userDb: UserDatabase;

  constructor(runtime: IAgentRuntime) {
    this.userDb = new UserDatabase(runtime);
    this.authService = new AuthService(this.userDb);
  }

  // Handle registration endpoint
  async handleRegister(body: any): Promise<{ status: number; data: any }> {
    try {
      const request: RegisterRequest = {
        username: body.username,
        email: body.email,
        password: body.password
      };

      const result = await this.authService.register(request);

      if (result.success) {
        return {
          status: 201,
          data: {
            success: true,
            message: result.message,
            user: result.user,
            token: result.token
          }
        };
      } else {
        return {
          status: 400,
          data: {
            success: false,
            message: result.message
          }
        };
      }
    } catch (error) {
      elizaLogger.error('Register endpoint error:', error);
      return {
        status: 500,
        data: {
          success: false,
          message: 'Internal server error'
        }
      };
    }
  }

  // Handle login endpoint
  async handleLogin(body: any): Promise<{ status: number; data: any }> {
    try {
      const request: LoginRequest = {
        email: body.email,
        password: body.password
      };

      const result = await this.authService.login(request);

      if (result.success) {
        return {
          status: 200,
          data: {
            success: true,
            message: result.message,
            user: result.user,
            token: result.token
          }
        };
      } else {
        return {
          status: 401,
          data: {
            success: false,
            message: result.message
          }
        };
      }
    } catch (error) {
      elizaLogger.error('Login endpoint error:', error);
      return {
        status: 500,
        data: {
          success: false,
          message: 'Internal server error'
        }
      };
    }
  }

  // Handle token verification endpoint
  async handleVerifyToken(token: string): Promise<{ status: number; data: any }> {
    try {
      const userId = await this.authService.verifyToken(token);

      if (userId) {
        const user = await this.userDb.getUserById(userId);
        if (user) {
          return {
            status: 200,
            data: {
              success: true,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
              }
            }
          };
        }
      }

      return {
        status: 401,
        data: {
          success: false,
          message: 'Invalid or expired token'
        }
      };
    } catch (error) {
      elizaLogger.error('Verify token endpoint error:', error);
      return {
        status: 500,
        data: {
          success: false,
          message: 'Internal server error'
        }
      };
    }
  }

  // Get auth service for middleware use
  getAuthService(): AuthService {
    return this.authService;
  }

  // Get user database for other operations
  getUserDatabase(): UserDatabase {
    return this.userDb;
  }
} 