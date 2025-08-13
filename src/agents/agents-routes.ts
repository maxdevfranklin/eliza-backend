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

    if (this.isPostgres) {
      if (dbAdapter.query) {
        return await dbAdapter.query(sql, params);
      }
      if (dbAdapter.db && dbAdapter.db.query) {
        return await dbAdapter.db.query(sql, params);
      }
      throw new Error("PostgreSQL query method not found");
    }

    // SQLite not supported for agents table by default
    throw new Error("Agents endpoints require PostgreSQL database");
  }

  async handleGetByName(name: string): Promise<{ status: number; data: any }> {
    try {
      const sql = `SELECT id, enabled, created_at, updated_at, "name", username, "system", bio, message_examples, post_examples, topics, adjectives, knowledge, plugins, settings, "style" FROM public.agents WHERE name = $1 LIMIT 1`;
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
      // Allowed columns to update
      const allowed = new Set([
        "enabled",
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
      ]);

      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (!allowed.has(key)) continue;
        idx++;
        setClauses.push(`${key.includes('"') ? key : `"${key}"`} = $${idx}`);
        
        // Handle different data types properly
        let processedValue = value;
        if (typeof value === 'object' && value !== null) {
          // Serialize objects and arrays to JSON for database storage
          processedValue = JSON.stringify(value);
        } else {
          elizaLogger.info(`@chris:agent personality update successfully`);
        }
        
        values.push(processedValue);
      }

      if (setClauses.length === 0) {
        return { status: 400, data: { success: false, message: "No valid fields to update" } };
      }

      // First parameter is name in WHERE clause
      values.unshift(name);

      const sql = `UPDATE public.agents SET ${setClauses.join(", ")}, updated_at = NOW() WHERE name = $1 RETURNING id, enabled, created_at, updated_at, "name", username, "system", bio, message_examples, post_examples, topics, adjectives, knowledge, plugins, settings, "style"`;
      const result = await this.query(sql, values);
      const row = result.rows?.[0] || result[0];

      return { status: 200, data: { success: true, agent: row } };
    } catch (error) {
      elizaLogger.error("Update agent by name error:", error);
      return { status: 500, data: { success: false, message: "Internal server error" } };
    }
  }
} 