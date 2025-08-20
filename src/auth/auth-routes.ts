import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { AuthService, type LoginRequest, type RegisterRequest } from './auth-service.ts';
import { UserDatabase } from '../database/users.ts';
import { ensurePasswordResetTable, requestPasswordReset, performPasswordReset } from './passwordReset.ts';

export class AuthRoutes {
  private authService: AuthService;
  private userDb: UserDatabase;
  private runtime: IAgentRuntime;
  private isPostgres: boolean;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.userDb = new UserDatabase(runtime.databaseAdapter);
    this.authService = new AuthService(this.userDb);
    // Check if this is a PostgreSQL adapter
    this.isPostgres = !!(runtime.databaseAdapter as any).query || !!(runtime.databaseAdapter as any).connectionString;
    
    this.initializeUserDatabase();
    ensurePasswordResetTable(this.runtime.databaseAdapter).catch(err =>
      elizaLogger.error("ensurePasswordResetTable error:", err)
    );
  }

  // Getter method to access runtime
  getRuntime(): IAgentRuntime {
    return this.runtime;
  }

  private async initializeUserDatabase() {
    try {
      await this.userDb.initialize();
      elizaLogger.info("User database initialized successfully");
    } catch (error) {
      elizaLogger.error("Failed to initialize user database:", error);
    }
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

  // Handle delete history endpoint
  async handleDeleteHistory(body: any): Promise<{ status: number; data: any }> {
    try {
      const { userId } = body;

      if (!userId) {
        return {
          status: 400,
          data: {
            success: false,
            message: 'User ID is required'
          }
        };
      }

      elizaLogger.info(`Deleting conversation history for username: ${userId}`);

      // First, find the actual user ID from the username
      const user = await this.userDb.getUserByUsername(userId);
      if (!user) {
        return {
          status: 404,
          data: {
            success: false,
            message: 'User not found'
          }
        };
      }

      const actualUserId = user.id;
      elizaLogger.info(`Found user ID: ${actualUserId} for username: ${userId}`);

      // Use database adapter directly for bulk deletion
      const dbAdapter = this.runtime.databaseAdapter as any;
      
      try {
        // Check if this is PostgreSQL or SQLite and execute appropriate delete query
        let deletedCount = 0;
        
        if (this.isPostgres) {
          // PostgreSQL adapter
          let result;
          if (dbAdapter.query) {
            result = await dbAdapter.query(
              'DELETE FROM memories WHERE "userId" = $1',
              [actualUserId]
            );
          } else if (dbAdapter.db && dbAdapter.db.query) {
            result = await dbAdapter.db.query(
              'DELETE FROM memories WHERE "userId" = $1',
              [actualUserId]
            );
          } else {
            throw new Error("PostgreSQL query method not found");
          }
          deletedCount = result.rowCount || 0;
        } else {
          // SQLite adapter
          const db = dbAdapter.db || dbAdapter;
          if (db.prepare) {
            const stmt = db.prepare('DELETE FROM memories WHERE userId = ?');
            const result = stmt.run(actualUserId);
            deletedCount = result.changes || 0;
          } else if (db.run) {
            const result = await db.run('DELETE FROM memories WHERE userId = ?', [actualUserId]);
            deletedCount = result.changes || 0;
          } else {
            throw new Error("SQLite query method not found");
          }
        }

        elizaLogger.info(`Successfully deleted ${deletedCount} messages for user ${userId} (ID: ${actualUserId})`);

        return {
          status: 200,
          data: {
            success: true,
            message: `Deleted ${deletedCount} messages from conversation history`,
            deletedCount
          }
        };
      } catch (dbError) {
        elizaLogger.error('Database deletion error:', dbError);
        return {
          status: 500,
          data: {
            success: false,
            message: 'Failed to delete messages from database'
          }
        };
      }
    } catch (error) {
      elizaLogger.error('Delete history endpoint error:', error);
      return {
        status: 500,
        data: {
          success: false,
          message: 'Internal server error'
        }
      };
    }
  }
  async handleForgotPassword(body: any): Promise<{ status: number; data: any }> {
    const email = String(body?.email ?? "").trim().toLowerCase();
    const origin = process.env.FRONTEND_URL || "http://localhost:3001";
    await requestPasswordReset(this.runtime.databaseAdapter, email, origin);
    return { status: 200, data: { success: true, message: "If an account exists, a reset link has been sent." } };
  }
  
  async handleResetPassword(body: any): Promise<{ status: number; data: any }> {
    const token = String(body?.token ?? "");
    const password = String(body?.password ?? "");
    if (!token || !password) {
      return { status: 400, data: { success: false, message: "token and password are required" } };
    }
    const out = await performPasswordReset(this.runtime.databaseAdapter, token, password);
    return out.success
      ? { status: 200, data: out }
      : { status: 400, data: out };
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