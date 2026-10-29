import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Allow local development with self-signed TLS certificates (*.local.dev)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface M2MTokenPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  scopes?: string[];
  is_machine?: boolean;
  [key: string]: any;
}

type Variables = {
  m2m: M2MTokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

// ---------------------------------------------------------------------------
// OIDC & JWKS Configuration for the API Microservice
// ---------------------------------------------------------------------------
const API_CONFIG = {
  issuer: "https://auth.local.dev/application/o/api/",
  jwksUrl: "https://auth.local.dev/application/o/api/jwks/",
  audience: "api-service-client",
};

// Remote Key Set cached automatically by jose
const JWKS = createRemoteJWKSet(new URL(API_CONFIG.jwksUrl));

// ---------------------------------------------------------------------------
// Middleware: M2M Machine Token & Scope Verification
// ---------------------------------------------------------------------------
export function requireM2MAuth(requiredScopes: string[] = []) {
  return async (c: any, next: any) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Missing or invalid Authorization header. Expected Bearer <token>",
        },
        401
      );
    }

    const token = authHeader.substring(7);

    try {
      // 1. Verify digital signature, expiration, issuer, and audience
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: API_CONFIG.issuer,
        audience: API_CONFIG.audience,
      });

      const m2mPayload = payload as unknown as M2MTokenPayload;
      c.set("m2m", m2mPayload);

      // 2. Verify Scopes / Permissions if required
      if (requiredScopes.length > 0) {
        const tokenScopes: string[] = Array.isArray(m2mPayload.scopes)
          ? m2mPayload.scopes
          : typeof m2mPayload.scope === "string"
          ? (m2mPayload.scope as string).split(" ")
          : [];

        const hasRequiredScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));
        if (!hasRequiredScopes) {
          return c.json(
            {
              error: "Forbidden",
              message: `Insufficient permissions. Required scopes: [${requiredScopes.join(", ")}]`,
              grantedScopes: tokenScopes,
            },
            403
          );
        }
      }

      await next();
    } catch (err: any) {
      console.error("M2M JWT verification failed:", err.message);
      return c.json(
        {
          error: "Unauthorized",
          message: "Invalid or expired machine token",
          details: err.message,
        },
        401
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Route: Public Health & API Overview
// ---------------------------------------------------------------------------
app.get("/", (c) => {
  return c.json({
    service: "Internal Resource API",
    status: "healthy",
    description: "Protected microservice secured by Authentik Client Credentials M2M OAuth2 tokens",
    version: "1.0.0",
    auth: {
      provider: "api-provider",
      issuer: API_CONFIG.issuer,
      jwks: API_CONFIG.jwksUrl,
      grantType: "client_credentials",
    },
    endpoints: [
      {
        path: "/api/reports",
        method: "GET",
        scopeRequired: "service:read",
        description: "Fetch analytical performance reports",
      },
      {
        path: "/api/orders/sync",
        method: "POST",
        scopeRequired: "service:write",
        description: "Synchronize batch order payloads",
      },
      {
        path: "/api/system/metrics",
        method: "GET",
        scopeRequired: "system:metrics",
        description: "Retrieve cluster CPU and memory telemetry",
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// Route: Analytics Reports (Requires scope: service:read)
// ---------------------------------------------------------------------------
app.get("/api/reports", requireM2MAuth(["service:read"]), (c) => {
  const m2m = c.get("m2m");
  return c.json({
    status: "ok",
    caller: {
      clientId: m2m.azp || m2m.aud,
      subject: m2m.sub,
      scopes: m2m.scopes || [],
      isMachine: m2m.is_machine || true,
    },
    data: {
      reportId: `rep-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      activeTransactions: 1248,
      throughputRps: 420.5,
      successRate: "99.98%",
    },
  });
});

// ---------------------------------------------------------------------------
// Route: Order Synchronization (Requires scope: service:write)
// ---------------------------------------------------------------------------
app.post("/api/orders/sync", requireM2MAuth(["service:write"]), async (c) => {
  const m2m = c.get("m2m");
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = { note: "Default empty sync payload" };
  }

  return c.json({
    status: "processed",
    caller: m2m.azp || m2m.aud,
    syncId: `sync-${crypto.randomUUID()}`,
    receivedRecords: Array.isArray(body.orders) ? body.orders.length : 1,
    processedAt: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Route: System Metrics (Requires scope: system:metrics)
// ---------------------------------------------------------------------------
app.get("/api/system/metrics", requireM2MAuth(["system:metrics"]), (c) => {
  const m2m = c.get("m2m");
  return c.json({
    status: "ok",
    caller: m2m.azp || m2m.aud,
    metrics: {
      cpuUsage: "18.4%",
      memoryAllocatedMb: 342,
      activeConnections: 58,
      clusterHealth: "green",
      timestamp: Date.now(),
    },
  });
});

const PORT = 3002;
console.log(` Internal Resource API microservice running on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
