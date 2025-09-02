import { elizaLogger, IAgentRuntime } from "@elizaos/core";

export class AgentsRoutes {
  private runtime: IAgentRuntime;
  private isPostgres: boolean;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.isPostgres = !!(runtime.databaseAdapter as any).query || !!(runtime.databaseAdapter as any).connectionString;
  }

  private async query(sql: string, params: any[] = []) {
    const dbAdapter: any = this.runtime.databaseAdapter as any;

    try {
      if (this.isPostgres) {
        if (dbAdapter.query) {
          elizaLogger.info(`Executing PostgreSQL query with ${params.length} parameters`);
          return await dbAdapter.query(sql, params);
        }
        if (dbAdapter.db && dbAdapter.db.query) {
          elizaLogger.info(`Executing PostgreSQL query via db.query with ${params.length} parameters`);
          return await dbAdapter.db.query(sql, params);
        }
        throw new Error("PostgreSQL query method not found");
      }

      // SQLite not supported for agents table by default
      throw new Error("Agents endpoints require PostgreSQL database");
    } catch (error) {
      elizaLogger.error("Database query error:", error);
      elizaLogger.error("SQL:", sql);
      elizaLogger.error("Parameters:", params);
      throw error;
    }
  }

  async handleGetByName(name: string): Promise<{ status: number; data: any }> {
    try {
      const sql = `SELECT id, enabled, created_at, updated_at, "name", username, "action", "system", bio, message_examples, post_examples, topics, adjectives, knowledge, plugins, settings, "style", grand_info FROM public.agents WHERE name = $1 LIMIT 1`;
      const result = await this.query(sql, [name]);
      const row = result.rows?.[0] || result[0];

      if (!row) {
        return { status: 404, data: { success: false, message: "Agent not found" } };
      }

      return { status: 200, data: { success: true, agent: row } };
    } catch (error) {
      elizaLogger.error("Get agent by name error:", error);
      return { status: 500, data: { success: false, message: "Internal server error" } };
    }
  }

  async handleUpdateByName(name: string, updates: Record<string, any>): Promise<{ status: number; data: any }> {
    try {
      elizaLogger.info(`=== HANDLING AGENT UPDATE BY NAME ===`);
      elizaLogger.info(`Agent name: ${name}`);
      elizaLogger.info(`Updates: ${JSON.stringify(updates, null, 2)}`);
      
      // Validate input
      if (!name || typeof name !== 'string') {
        return { status: 400, data: { success: false, message: "Invalid agent name" } };
      }
      
      if (!updates || typeof updates !== 'object') {
        return { status: 400, data: { success: false, message: "Invalid updates object" } };
      }
      
      // Allowed columns to update
      const allowed = new Set([
        "enabled",
        "action",
        "system",
        "bio",
        "message_examples",
        "post_examples",
        "topics",
        "adjectives",
        "knowledge",
        "plugins",
        "settings",
        "style",
        "username",
        "grand_info",
      ]);

      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (!allowed.has(key)) {
          elizaLogger.warn(`Skipping disallowed field: ${key}`);
          continue;
        }
        
        // Validate value types
        if (key === 'grand_info' && value !== null && value !== undefined) {
          if (typeof value !== 'string') {
            elizaLogger.warn(`Invalid grand_info type: ${typeof value}, converting to string`);
            updates[key] = String(value);
          }
        }
        
        idx++;
        setClauses.push(`${key.includes('"') ? key : `"${key}"`} = $${idx}`);
        
        // Handle different data types properly
        let processedValue = value;
        if (typeof value === 'object' && value !== null) {
          // Serialize objects and arrays to JSON for database storage
          processedValue = JSON.stringify(value);
          elizaLogger.info(`Field ${key}: Object serialized to JSON: ${processedValue.substring(0, 100)}...`);
        } else if (key === 'grand_info' && typeof value === 'string') {
          // grand_info should be stored as a plain string, not parsed as JSON
          processedValue = value;
          elizaLogger.info(`Field ${key}: Storing as plain string (length: ${value.length})`);
          elizaLogger.info(`Field ${key} content preview: ${value.substring(0, 100)}...`);
        } else {
          elizaLogger.info(`Field ${key}: Storing as-is (type: ${typeof value})`);
        }
        
        values.push(processedValue);
      }

      if (setClauses.length === 0) {
        elizaLogger.warn("No valid fields to update");
        return { status: 400, data: { success: false, message: "No valid fields to update" } };
      }

      // First parameter is name in WHERE clause
      values.unshift(name);

      const sql = `UPDATE public.agents SET ${setClauses.join(", ")}, updated_at = NOW() WHERE name = $1 RETURNING id, enabled, created_at, updated_at, "name", username, "action", "system", bio, message_examples, post_examples, topics, adjectives, knowledge, plugins, settings, "style", grand_info`;
      
      elizaLogger.info(`SQL Query: ${sql}`);
      elizaLogger.info(`SQL Parameters: ${JSON.stringify(values, null, 2)}`);
      
      const result = await this.query(sql, values);
      const row = result.rows?.[0] || result[0];

      elizaLogger.info(`Update successful for agent: ${name}`);
      return { status: 200, data: { success: true, agent: row } };
    } catch (error) {
      elizaLogger.error("Update agent by name error:", error);
      elizaLogger.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: name,
        updates: updates
      });
      
      // Provide more specific error messages
      let errorMessage = "Internal server error";
      if (error.message && error.message.includes("invalid input syntax for type json")) {
        errorMessage = "Invalid data format detected. Please check the content being saved.";
      } else if (error.message && error.message.includes("Token")) {
        errorMessage = "Data format error. The content contains invalid characters.";
      }
      
      return { status: 500, data: { success: false, message: errorMessage } };
    }
  }
} 