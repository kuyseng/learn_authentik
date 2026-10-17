import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";

// In local development with self-signed TLS certs (*.local.dev)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

type Variables = {
  jwtUser: any;
};

const app = new Hono<{ Variables: Variables }>();

// ---------------------------------------------------------------------------
// OIDC & JWKS Configuration
// ---------------------------------------------------------------------------
const AUTH_CONFIG = {
  issuer: "https://auth.local.dev/application/o/dashboard/",
  jwksUrl: "https://auth.local.dev/application/o/dashboard/jwks/",
  audience: "dashboard-client",
};

// Remote Key Set cached automatically by jose
const JWKS = createRemoteJWKSet(new URL(AUTH_CONFIG.jwksUrl));

// ---------------------------------------------------------------------------
// Middleware: JWT Verification via Authentik JWKS
// ---------------------------------------------------------------------------
const requireJwtAuth = () => {
  return async (c: any, next: any) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header. Expected Bearer <token>" }, 401);
    }

    const token = authHeader.substring(7);
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: AUTH_CONFIG.issuer,
        audience: AUTH_CONFIG.audience,
      });
      c.set("jwtUser", payload);
      await next();
    } catch (err: any) {
      console.error("JWT verification failed:", err.message);
      return c.json({ error: "Invalid token", details: err.message }, 401);
    }
  };
};

// ---------------------------------------------------------------------------
// Route: Bundle and serve React SPA client JavaScript
// ---------------------------------------------------------------------------
app.get("/app.js", async (c) => {
  try {
    const result = await Bun.build({
      entrypoints: [`${import.meta.dir}/client/index.tsx`],
      target: "browser",
      minify: false,
    });

    if (!result.success) {
      console.error("Bundle errors:", result.logs);
      return c.text(`Build error: ${result.logs.join("\n")}`, 500);
    }

    const code = await result.outputs[0].text();
    return c.body(code, 200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    });
  } catch (err: any) {
    console.error("Build exception:", err);
    return c.text(`Build error: ${err.message}`, 500);
  }
});

// ---------------------------------------------------------------------------
// HTML Shell for the Single Page Application
// ---------------------------------------------------------------------------
const htmlShell = `<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-950">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard — Authentik Lab (PKCE SPA)</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="h-full bg-slate-950 text-slate-100 antialiased">
    <div id="root"></div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;

app.get("/", (c) => c.html(htmlShell));
app.get("/callback", (c) => c.html(htmlShell));

// ---------------------------------------------------------------------------
// Route: Protected REST API (Secured with JWT Middleware)
// ---------------------------------------------------------------------------
app.get("/api/stats", requireJwtAuth(), (c) => {
  const user = c.get("jwtUser");
  return c.json({
    status: "ok",
    message: `Hello ${user.preferred_username || user.name || "User"}, authenticated via Authentik JWT!`,
    timestamp: new Date().toISOString(),
    user: {
      sub: user.sub,
      username: user.preferred_username,
      email: user.email,
      groups: user.groups || [],
    },
    metrics: {
      uptime: "99.99%",
      activeClusters: 4,
      totalDeployments: 42,
    },
  });
});

const PORT = 3001;
console.log(` Dashboard SPA server running at http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
