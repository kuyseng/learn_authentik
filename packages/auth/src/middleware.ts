import type { Context, MiddlewareHandler } from "hono";
import type { SessionManager } from "./session";
import type { AuthSession, UserClaims } from "./types";

declare module "hono" {
  interface ContextVariableMap {
    session: AuthSession | null;
    user: UserClaims | null;
    jwtUser?: any;
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
 * Helper to get user claims from either SSR session or JWT context.
 */
export function getEffectiveUser(c: Context): UserClaims | null {
  return c.get("user") || c.get("jwtUser") || null;
}

/**
 * Route guard that redirects unauthenticated users to the login route.
 */
export function requireAuth(loginPath: string = "/auth/login"): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = getEffectiveUser(c);
    if (!user) {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
      }
      return c.redirect(loginPath);
    }
    await next();
  };
}

/**
 * Helper to render a clean 403 Forbidden HTML error page.
 */
function renderForbiddenHtml(c: Context, user: UserClaims, requirement: string, currentAssigned: string[]) {
  return c.html(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>403 Forbidden - Access Denied</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
        <div class="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div class="w-16 h-16 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            ⛔
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">403 Forbidden</h1>
          <p class="text-slate-400 text-sm mb-6 leading-relaxed">
            Your account <strong class="text-white">${user.preferred_username || user.name || "User"}</strong> lacks the required permission:
            <span class="block mt-2 bg-rose-500/20 text-rose-300 px-3 py-1 rounded-lg font-mono text-xs font-semibold border border-rose-500/30">
              Required: ${requirement}
            </span>
          </p>
          <div class="bg-slate-950 p-4 rounded-xl text-left text-xs text-slate-400 mb-6 font-mono border border-slate-800 space-y-1">
            <div class="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Your Assigned Claims:</div>
            <div class="text-indigo-400 break-words">${JSON.stringify(currentAssigned)}</div>
          </div>
          <div class="flex items-center justify-center gap-3">
            <a href="/" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg text-xs transition border border-slate-700">
              Return Home
            </a>
            <a href="/auth/logout" class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium px-4 py-2 rounded-lg text-xs transition border border-rose-500/30">
              Switch Account
            </a>
          </div>
        </div>
      </body>
    </html>`,
    403
  );
}

/**
 * Route guard that requires membership in a specific Authentik group.
 */
export function requireGroup(groupName: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = getEffectiveUser(c);
    if (!user) {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
      }
      return c.redirect("/auth/login");
    }

    const groups = (user.groups as string[]) || [];
    if (!groups.includes(groupName)) {
      if (c.req.path.startsWith("/api/")) {
        return c.json(
          {
            error: "Forbidden",
            message: `Access denied. Group '${groupName}' required.`,
            userGroups: groups,
          },
          403
        );
      }
      return renderForbiddenHtml(c, user, `Group: ${groupName}`, groups);
    }

    await next();
  };
}

/**
 * Route guard that requires one specific role.
 */
export function requireRole(role: string): MiddlewareHandler {
  return requireAnyRole([role]);
}

/**
 * Route guard that requires at least one of the specified roles (OR logic).
 */
export function requireAnyRole(roles: string[]): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = getEffectiveUser(c);
    if (!user) {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
      }
      return c.redirect("/auth/login");
    }

    const userRoles = (user.roles as string[]) || [];
    const hasRole = roles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      if (c.req.path.startsWith("/api/")) {
        return c.json(
          {
            error: "Forbidden",
            message: `Access denied. Requires one of roles: [${roles.join(", ")}]`,
            userRoles,
          },
          403
        );
      }
      return renderForbiddenHtml(c, user, `Role: ${roles.join(" or ")}`, userRoles);
    }

    await next();
  };
}

/**
 * Route guard that requires all of the specified roles (AND logic).
 */
export function requireAllRoles(roles: string[]): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = getEffectiveUser(c);
    if (!user) {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
      }
      return c.redirect("/auth/login");
    }

    const userRoles = (user.roles as string[]) || [];
    const hasAll = roles.every((r) => userRoles.includes(r));

    if (!hasAll) {
      if (c.req.path.startsWith("/api/")) {
        return c.json(
          {
            error: "Forbidden",
            message: `Access denied. Requires all roles: [${roles.join(", ")}]`,
            userRoles,
          },
          403
        );
      }
      return renderForbiddenHtml(c, user, `Roles: ${roles.join(" and ")}`, userRoles);
    }

    await next();
  };
}

/**
 * Route guard that requires a specific permission.
 */
export function requirePermission(permission: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = getEffectiveUser(c);
    if (!user) {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
      }
      return c.redirect("/auth/login");
    }

    const permissions = (user.permissions as string[]) || [];
    if (!permissions.includes(permission)) {
      if (c.req.path.startsWith("/api/")) {
        return c.json(
          {
            error: "Forbidden",
            message: `Access denied. Missing permission: '${permission}'`,
            userPermissions: permissions,
          },
          403
        );
      }
      return renderForbiddenHtml(c, user, `Permission: ${permission}`, permissions);
    }

    await next();
  };
}
