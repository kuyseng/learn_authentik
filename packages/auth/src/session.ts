import type { Context } from "hono";
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import type { AuthSession } from "./types";

const SESSION_COOKIE_NAME = "ak_lab_session";
const STATE_COOKIE_NAME = "ak_lab_state";
const DEFAULT_SECRET = "authentik-lab-dev-secret-key-32-chars-long!";

export class SessionManager {
  constructor(private secret: string = DEFAULT_SECRET) {}

  async getSession(c: Context): Promise<AuthSession | null> {
    const raw = await getSignedCookie(c, this.secret, SESSION_COOKIE_NAME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  async setSession(c: Context, session: AuthSession): Promise<void> {
    const serialized = JSON.stringify(session);
    await setSignedCookie(c, SESSION_COOKIE_NAME, serialized, this.secret, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 86400 * 7, // 7 days
    });
  }

  deleteSession(c: Context): void {
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
