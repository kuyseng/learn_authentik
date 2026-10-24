import type { Context } from "hono";
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import { Database } from "bun:sqlite";
import type { AuthSession } from "./types";

const SESSION_COOKIE_NAME = "ak_lab_session";
const STATE_COOKIE_NAME = "ak_lab_state";
const DEFAULT_SECRET = "authentik-lab-dev-secret-key-32-chars-long!";

/**
 * Server-side session store interface.
 * Stores tokens and user claims safely server-side so cookies remain lightweight (~60-80 bytes)
 * and never exceed the browser RFC 6265 4KB limit.
 */
export interface SessionStore {
  get(sessionId: string): Promise<AuthSession | null> | AuthSession | null;
  set(sessionId: string, session: AuthSession, ttlSeconds: number): Promise<void> | void;
  delete(sessionId: string): Promise<void> | void;
}

/**
 * In-memory session store using globalThis to survive Bun hot-reloads.
 */
export class MemorySessionStore implements SessionStore {
  private store: Map<string, { session: AuthSession; expiresAt: number }>;

  constructor() {
    const g = globalThis as unknown as {
      __ak_sessions__?: Map<string, { session: AuthSession; expiresAt: number }>;
    };
    g.__ak_sessions__ ??= new Map();
    this.store = g.__ak_sessions__;
  }

  get(sessionId: string): AuthSession | null {
    const entry = this.store.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(sessionId);
      return null;
    }
    return entry.session;
  }

  set(sessionId: string, session: AuthSession, ttlSeconds: number): void {
    this.store.set(sessionId, {
      session,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }
}

/**
 * SQLite session store using Bun's native embedded SQLite.
 * Persists sessions across server restarts without external services.
 */
export class SqliteSessionStore implements SessionStore {
  private db: Database;

  constructor(dbPath: string = process.env.SESSION_DB_PATH || "/tmp/authentik_lab_sessions.db") {
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  get(sessionId: string): AuthSession | null {
    try {
      const row = this.db
        .query("SELECT data, expires_at FROM sessions WHERE id = ?")
        .get(sessionId) as { data: string; expires_at: number } | null;

      if (!row) return null;
      if (row.expires_at < Date.now()) {
        this.db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
        return null;
      }
      return JSON.parse(row.data) as AuthSession;
    } catch {
      return null;
    }
  }

  set(sessionId: string, session: AuthSession, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.db.run(
      "INSERT OR REPLACE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      [sessionId, JSON.stringify(session), expiresAt]
    );
  }

  delete(sessionId: string): void {
    try {
      this.db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
    } catch {
      // ignore
    }
  }
}

export class SessionManager {
  private store: SessionStore;
  private secret: string;

  constructor(secret: string = DEFAULT_SECRET, store?: SessionStore) {
    this.secret = secret;
    if (store) {
      this.store = store;
    } else {
      try {
        this.store = new SqliteSessionStore();
      } catch {
        this.store = new MemorySessionStore();
      }
    }
  }

  async getSession(c: Context): Promise<AuthSession | null> {
    const raw = await getSignedCookie(c, this.secret, SESSION_COOKIE_NAME);
    if (!raw) return null;

    // 1. Resolve session ID from server-side store
    const session = await this.store.get(raw);
    if (session) return session;

    // 2. Backward compatibility: if cookie previously stored serialized JSON directly
    if (raw.startsWith("{")) {
      try {
        return JSON.parse(raw) as AuthSession;
      } catch {
        return null;
      }
    }

    return null;
  }

  async setSession(c: Context, session: AuthSession, maxAge: number = 86400 * 7): Promise<string> {
    const sessionId = crypto.randomUUID();
    await this.store.set(sessionId, session, maxAge);

    await setSignedCookie(c, SESSION_COOKIE_NAME, sessionId, this.secret, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge,
    });

    return sessionId;
  }

  async deleteSession(c: Context): Promise<void> {
    const sessionId = await getSignedCookie(c, this.secret, SESSION_COOKIE_NAME);
    if (sessionId) {
      await this.store.delete(sessionId);
    }
    deleteCookie(c, SESSION_COOKIE_NAME, {
      path: "/",
      secure: true,
    });
  }

  async setState(c: Context, state: string): Promise<void> {
    await setSignedCookie(c, STATE_COOKIE_NAME, state, this.secret, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 600, // 10 minutes
    });
  }

  async getState(c: Context): Promise<string | false> {
    return await getSignedCookie(c, this.secret, STATE_COOKIE_NAME);
  }

  deleteState(c: Context): void {
    deleteCookie(c, STATE_COOKIE_NAME, {
      path: "/",
      secure: true,
    });
  }
}
