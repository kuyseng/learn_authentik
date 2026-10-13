import type { Context, MiddlewareHandler } from "hono";
import type { SessionManager } from "./session";
import type { AuthSession, UserClaims } from "./types";

declare module "hono" {
  interface ContextVariableMap {
    session: AuthSession | null;
    user: UserClaims | null;
  }
}

/**
 * Global middleware that extracts the current session and attaches `user` to the Hono context.
 */
export function createAuthMiddleware(sessionManager: SessionManager): MiddlewareHandler {
  return async (c: Context, next) => {
    const session = await sessionManager.getSession(c);
    c.set("session", session);
    c.set("user", session ? session.user : null);
    await next();
  };
}

/**
 * Route guard that redirects unauthenticated users to the login route.
 */
export function requireAuth(loginPath: string = "/auth/login"): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get("user");
    if (!user) {
      return c.redirect(loginPath);
    }
    await next();
  };
}

/**
 * Route guard that requires membership in a specific Authentik group.
 */
export function requireGroup(groupName: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get("user");
    if (!user) {
      return c.redirect("/auth/login");
    }

    const groups = user.groups || [];
    if (!groups.includes(groupName)) {
      return c.html(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>403 Forbidden - Access Denied</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
            <div class="max-w-md w-full bg-slate-800 border border-red-500/30 rounded-xl p-8 shadow-2xl text-center">
              <div class="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">⛔</div>
              <h1 class="text-2xl font-bold text-red-400 mb-2">403 Forbidden</h1>
              <p class="text-slate-300 text-sm mb-6">
                Your account <strong class="text-white">${user.preferred_username || user.name}</strong> does not belong to the required group <span class="bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-mono text-xs">${groupName}</span>.
              </p>
              <div class="bg-slate-950/60 p-3 rounded-lg text-left text-xs text-slate-400 mb-6 font-mono">
                <div>Your current groups:</div>
                <div class="text-emerald-400 mt-1">${JSON.stringify(groups)}</div>
              </div>
              <a href="/" class="inline-block bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition">
                Return to Home
              </a>
            </div>
          </body>
        </html>`,
        403
      );
    }

    await next();
  };
}
