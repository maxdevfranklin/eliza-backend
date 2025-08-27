import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { AuthService, type LoginRequest, type RegisterRequest } from './auth-service.ts';
import { UserDatabase } from '../database/users.ts';

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
    
    // Initialize database synchronously to avoid race conditions
    this.initializeUserDatabaseSync();
  }

  // Getter method to access runtime
  getRuntime(): IAgentRuntime {
    return this.runtime;
  }

  private initializeUserDatabaseSync() {
    try {
      // For synchronous initialization, we'll call it immediately
      this.userDb.initialize().then(() => {
        elizaLogger.info("User database initialized successfully");
      }).catch((error) => {
        elizaLogger.error("Failed to initialize user database:", error);
      });
    } catch (error) {
      elizaLogger.error("Failed to start user database initialization:", error);
    }
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

      // First, find the actual account ID from the username
      const account = await this.userDb.getAccountByUsername(userId);
      if (!account) {
        return {
          status: 404,
          data: {
            success: false,
            message: 'User not found'
          }
        };
      }

      const actualUserId = account.id;
      elizaLogger.info(`Found account ID: ${actualUserId} for username: ${userId}`);

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

        elizaLogger.info(`Successfully deleted ${deletedCount} messages for user ${userId} (Account ID: ${actualUserId})`);

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

  // Get auth service for middleware use
  getAuthService(): AuthService {
    return this.authService;
  }

  // Get user database for other operations
  getUserDatabase(): UserDatabase {
    return this.userDb;
  }

  // Handle get all users endpoint (admin)
  async handleGetAllUsers(): Promise<{ status: number; data: any }> {
    try {
      elizaLogger.info('Admin: Getting all users...');
      
      // Ensure database is initialized
      try {
        await this.userDb.initialize();
      } catch (initError) {
        elizaLogger.warn('Database already initialized or initialization failed:', initError);
      }
      
      const users = await this.userDb.getAllUsers();
      elizaLogger.info(`Admin: Found ${users.length} users`);
      
      return {
        status: 200,
        data: {
          success: true,
          users: users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }))
        }
      };
    } catch (error) {
      elizaLogger.error('Get all users endpoint error:', error);
      return {
        status: 500,
        data: {
          success: false,
          message: 'Internal server error'
        }
      };
    }
  }

  // Handle get chat history endpoint (admin)
  async handleGetChatHistory(username: string): Promise<{ status: number; data: any }> {
    try {
      elizaLogger.info(`Admin: Getting chat history for user: ${username}`);
      
      // Ensure database is initialized
      try {
        await this.userDb.initialize();
      } catch (initError) {
        elizaLogger.warn('Database already initialized or initialization failed:', initError);
      }
      
      // First, find the account ID from the accounts table (this has the correct UUID format)
      const account = await this.userDb.getAccountByUsername(username);
      if (!account) {
        elizaLogger.warn(`Admin: Account not found: ${username}`);
        return {
          status: 404,
          data: {
            success: false,
            message: 'User not found'
          }
        };
      }

      const accountId = account.id;
      elizaLogger.info(`Admin: Found account ID: ${accountId} for username: ${username}`);

      // Also get the user info from the users table for display
      const user = await this.userDb.getUserByUsername(username);

      try {
        // Use database adapter directly to get chat messages
        const dbAdapter = this.runtime.databaseAdapter as any;
        let messages: any[] = [];
        
        if (this.isPostgres) {
          // PostgreSQL adapter - use exact UUID match
          let result;
          if (dbAdapter.query) {
            result = await dbAdapter.query(
              'SELECT * FROM memories WHERE "userId" = $1 ORDER BY "createdAt" ASC',
              [accountId]
            );
          } else if (dbAdapter.db && dbAdapter.db.query) {
            result = await dbAdapter.db.query(
              'SELECT * FROM memories WHERE "userId" = $1 ORDER BY "createdAt" ASC',
              [accountId]
            );
          } else {
            throw new Error("PostgreSQL query method not found");
          }
          messages = result.rows || [];
        } else {
          // SQLite adapter
          const db = dbAdapter.db || dbAdapter;
          if (db.prepare) {
            const stmt = db.prepare('SELECT * FROM memories WHERE userId = ? ORDER BY createdAt ASC');
            messages = stmt.all(accountId);
          } else if (db.all) {
            messages = await db.all('SELECT * FROM memories WHERE userId = ? ORDER BY createdAt ASC', [accountId]);
          } else {
            throw new Error("SQLite query method not found");
          }
        }

        elizaLogger.info(`Admin: Found ${messages.length} total messages for user ${username}`);

        // Filter only chat messages (exclude system messages and other data)
        let filteredCount = 0;
        const chatMessages = messages.filter(msg => {
          try {
            if (!msg.content) {
              return false;
            }
            
            const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            const hasText = content && content.text;
            
            if (!hasText) {
              return false;
            }
            
            // Skip system messages and discovery responses
            const text = content.text;
            if (text.startsWith('[Discovery Response]') || 
                text.startsWith('STAGE_TRANSITION') ||
                text.includes('[Discovery Response]') ||
                text.includes('STAGE_TRANSITION')) {
              return false;
            }
            
            filteredCount++;
            return true;
          } catch (parseError) {
            return false;
          }
        }).map(msg => {
          try {
            const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            
            // Determine if this is a user message or Grace message
            // User messages have "source": "direct", Grace messages have "metadata"
            const isUserMessage = content.source === 'direct';
            const isGraceMessage = content.metadata && content.metadata.stage;
            
            return {
              id: msg.id,
              text: content.text,
              role: isUserMessage ? 'user' : 'assistant', // user or Grace
              timestamp: msg.createdAt,
              roomId: msg.roomId,
              agentId: msg.agentId
            };
          } catch (parseError) {
            return null;
          }
        }).filter(Boolean);

        elizaLogger.info(`Admin: Processed ${chatMessages.length} chat messages for user ${username}`);

        return {
          status: 200,
          data: {
            success: true,
            messages: chatMessages,
            user: {
              id: accountId,
              username: username,
              email: user?.email || '',
              createdAt: user?.createdAt || new Date()
            }
          }
        };
      } catch (dbError) {
        elizaLogger.error('Database query error:', dbError);
        return {
          status: 500,
          data: {
            success: false,
            message: 'Failed to retrieve chat history from database',
            error: dbError.message
          }
        };
      }
    } catch (error) {
      elizaLogger.error('Get chat history endpoint error:', error);
      return {
        status: 500,
        data: {
          success: false,
          message: 'Internal server error',
          error: error.message
        }
      };
    }
  }
} 