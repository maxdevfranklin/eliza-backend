import { IAgentRuntime, elizaLogger } from "@elizaos/core";

export interface User {
  id: string;
  username: string;
  email: string;
  password: string; // This will be hashed
  createdAt: Date;
  updatedAt: Date;
}

export class UserDatabase {
  private db: any;

  constructor(databaseAdapter: any) {
    this.db = databaseAdapter.db || databaseAdapter;
    this.initializeUsersTable();
  }

  private async initializeUsersTable() {
    try {
      // Create users table if it doesn't exist
      const sql = `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      if (this.db && this.db.exec) {
        await this.db.exec(sql);
        elizaLogger.info("Users table initialized successfully");
      } else {
        elizaLogger.error("Database connection not available");
        throw new Error("Database connection not available");
      }
    } catch (error) {
      elizaLogger.error("Error initializing users table:", error);
      throw error;
    }
  }

  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const id = this.generateUserId();
      const now = new Date();
      
      const sql = `
        INSERT INTO users (id, username, email, password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      if (this.db && this.db.prepare) {
        await this.db.prepare(sql).run(
          id,
          user.username,
          user.email,
          user.password,
          now.toISOString(),
          now.toISOString()
        );
      } else {
        throw new Error("Database connection not available");
      }

      return {
        id,
        username: user.username,
        email: user.email,
        password: user.password,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      elizaLogger.error("Error creating user:", error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const sql = `SELECT * FROM users WHERE email = ?`;
      if (!this.db || !this.db.prepare) {
        throw new Error("Database connection not available");
      }
      
      const row = await this.db.prepare(sql).get(email);
      
      if (!row) return null;
      
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        password: row.password,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      elizaLogger.error("Error getting user by email:", error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const sql = `SELECT * FROM users WHERE username = ?`;
      if (!this.db || !this.db.prepare) {
        throw new Error("Database connection not available");
      }
      
      const row = await this.db.prepare(sql).get(username);
      
      if (!row) return null;
      
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        password: row.password,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      elizaLogger.error("Error getting user by username:", error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const sql = `SELECT * FROM users WHERE id = ?`;
      if (!this.db || !this.db.prepare) {
        throw new Error("Database connection not available");
      }
      
      const row = await this.db.prepare(sql).get(id);
      
      if (!row) return null;
      
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        password: row.password,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      elizaLogger.error("Error getting user by ID:", error);
      throw error;
    }
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
} 