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
  private dbAdapter: any;
  private isPostgres: boolean;

  constructor(databaseAdapter: any) {
    this.dbAdapter = databaseAdapter;
    // Check if this is a PostgreSQL adapter
    this.isPostgres = !!databaseAdapter.query || !!databaseAdapter.connectionString;
  }

  async initialize() {
    await this.initializeUsersTable();
  }

  private async initializeUsersTable() {
    try {
      // Create users table if it doesn't exist
      const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id TEXT NOT NULL,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT users_username_unique UNIQUE (username),
            CONSTRAINT users_email_unique UNIQUE (email),
            CONSTRAINT users_pk PRIMARY KEY (id)
        );
      `;
      
      await this.executeQuery(sql);
      elizaLogger.info("Users table initialized successfully");
    } catch (error) {
      // If table already exists, that's OK
      if (error.message && (error.message.includes('already exists') || error.message.includes('relation') && error.message.includes('already exists'))) {
        elizaLogger.info("Users table already exists");
        return;
      }
      elizaLogger.error("Error initializing users table:", error);
      throw error;
    }
  }

  private async executeQuery(sql: string, params: any[] = []): Promise<any> {
    try {
      if (this.isPostgres) {
        // For PostgreSQL adapter
        if (this.dbAdapter.query) {
          return await this.dbAdapter.query(sql, params);
        } else if (this.dbAdapter.db && this.dbAdapter.db.query) {
          return await this.dbAdapter.db.query(sql, params);
        } else {
          throw new Error("PostgreSQL query method not found");
        }
      } else {
        // For SQLite adapter
        const db = this.dbAdapter.db || this.dbAdapter;
        if (db.prepare) {
          return await db.prepare(sql).run(...params);
        } else if (db.run) {
          return await db.run(sql, params);
        } else {
          throw new Error("SQLite query method not found");
        }
      }
    } catch (error) {
      elizaLogger.error("Error executing query:", error);
      throw error;
    }
  }

  private async queryRow(sql: string, params: any[] = []): Promise<any> {
    try {
      if (this.isPostgres) {
        // For PostgreSQL adapter
        let result;
        if (this.dbAdapter.query) {
          result = await this.dbAdapter.query(sql, params);
        } else if (this.dbAdapter.db && this.dbAdapter.db.query) {
          result = await this.dbAdapter.db.query(sql, params);
        } else {
          throw new Error("PostgreSQL query method not found");
        }
        return result.rows && result.rows.length > 0 ? result.rows[0] : null;
      } else {
        // For SQLite adapter
        const db = this.dbAdapter.db || this.dbAdapter;
        if (db.prepare) {
          return await db.prepare(sql).get(...params);
        } else if (db.get) {
          return await db.get(sql, params);
        } else {
          throw new Error("SQLite query method not found");
        }
      }
    } catch (error) {
      elizaLogger.error("Error querying row:", error);
      throw error;
    }
  }

  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const id = this.generateUserId();
      const now = new Date();
      
      // Use parameterized query
      const sql = `
        INSERT INTO users (id, username, email, password, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const params = [
        id,
        user.username,
        user.email,
        user.password,
        now.toISOString(),
        now.toISOString()
      ];

      // For SQLite, convert $1, $2, etc. to ? placeholders
      const sqliteSQL = this.isPostgres ? sql : sql.replace(/\$(\d+)/g, '?');
      
      await this.executeQuery(sqliteSQL, params);

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
      const sql = this.isPostgres ? 
        `SELECT * FROM users WHERE email = $1` :
        `SELECT * FROM users WHERE email = ?`;
      
      const row = await this.queryRow(sql, [email]);
      
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
      const sql = this.isPostgres ?
        `SELECT * FROM users WHERE username = $1` :
        `SELECT * FROM users WHERE username = ?`;
      
      const row = await this.queryRow(sql, [username]);
      
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
      const sql = this.isPostgres ?
        `SELECT * FROM users WHERE id = $1` :
        `SELECT * FROM users WHERE id = ?`;
      
      const row = await this.queryRow(sql, [id]);
      
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