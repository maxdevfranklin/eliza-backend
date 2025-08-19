// src/auth/passwordReset.ts
import { createHash, randomBytes, pbkdf2Sync } from "crypto";
import { elizaLogger } from "@elizaos/core";

const isPg = (adapter: any) => !!(adapter.query || adapter.connectionString);
const q = async (adapter: any, sql: string, params: any[] = []) => {
  if (isPg(adapter)) {
    const exec = adapter.query ?? adapter.db?.query;
    if (!exec) throw new Error("PostgreSQL query method not found");
    return exec.call(adapter, sql, params);
  }
  const db = adapter.db || adapter;
  const s = sql.replace(/\$(\d+)/g, "?");
  if (db.prepare) return db.prepare(s).run(...params);
  if (db.run) return db.run(s, params);
  throw new Error("SQLite query method not found");
};

export async function ensurePasswordResetTable(adapter: any) {
  const sql = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_prt_user_id   ON password_reset_tokens(user_id);
  `;
  // harmless if extensions already exist
  try {
    await q(adapter, sql);
  } catch {
    /* table already exists or extensions pre-created */
  }
}

export async function requestPasswordReset(
  adapter: any,
  email: string,
  appOrigin: string
) {
  const lower = email.trim().toLowerCase();

  // 1) Look up user (quietly)
  const sel = isPg(adapter)
  ? `SELECT id FROM users WHERE lower(email) = lower($1)`
  : `SELECT id FROM users WHERE lower(email) = lower(?)`;
  let userId: string | null = null;

  try {
    if (isPg(adapter)) {
      const res = (await (adapter.query ?? adapter.db.query).call(
        adapter,
        sel,
        [lower]
      )) as { rows: any[] };
      userId = res.rows?.[0]?.id ?? null;
    } else {
      const db = adapter.db || adapter;
      const row = db.prepare(sel.replace(/\$(\d+)/g, "?")).get(lower);
      userId = row?.id ?? null;
    }
  } catch (e) {
    elizaLogger.error("Error looking up user for reset:", e);
  }

  // 2) If user exists, store a hashed token
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30m

  if (userId) {
    const ins = isPg(adapter)
      ? `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`
      : `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)`;
    await q(adapter, ins, [userId, tokenHash, expires]);
  }

  const link = `${appOrigin.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
  elizaLogger.info(`[DEV] Password reset link for ${lower}: ${link}`);

  // Always generic response (no account enumeration)
  return {
    success: true,
    message: "If an account exists for this email, you will receive a reset link.",
  };
}

export async function performPasswordReset(
  adapter: any,
  rawToken: string,
  newPassword: string
) {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const sel = isPg(adapter)
    ? `SELECT * FROM password_reset_tokens 
         WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW() 
         LIMIT 1`
    : `SELECT * FROM password_reset_tokens 
         WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP 
         LIMIT 1`;

  let row: any = null;
  if (isPg(adapter)) {
    const res = (await (adapter.query ?? adapter.db.query).call(adapter, sel, [
      tokenHash,
    ])) as { rows: any[] };
    row = res.rows?.[0] ?? null;
  } else {
    const db = adapter.db || adapter;
    row = db.prepare(sel.replace(/\$(\d+)/g, "?")).get(tokenHash);
  }

  if (!row) return { success: false, message: "Invalid or expired token" };

  // Hash new password the same way your AuthService does
  const salt = randomBytes(32).toString("hex");
  const hash = pbkdf2Sync(newPassword, salt, 10000, 64, "sha512").toString("hex");
  const stored = `${salt}:${hash}`;

  const updUser = isPg(adapter)
    ? `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`
    : `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await q(adapter, updUser, [stored, row.user_id]);

  const consume = isPg(adapter)
    ? `UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1`
    : `UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await q(adapter, consume, [row.id]);

  return { success: true, message: "Password updated" };
}
