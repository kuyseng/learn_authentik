import { Hono } from "hono";
import {
  OIDCClient,
  SessionManager,
  createAuthMiddleware,
  requireAuth,
  requireGroup,
  requireRole,
  requireAnyRole,
  ClientCredentialsClient,
} from "@authentik-lab/auth";
import { Layout } from "./layout";

const app = new Hono();

// 1. Initialize OIDC Client and Session Manager
const oidc = new OIDCClient({
  issuer: "https://auth.local.dev/application/o/portal/",
  clientId: "portal-client",
  clientSecret: "portal-secret-123456",
  redirectUri: "https://portal.local.dev/auth/callback",
  scopes: ["openid", "profile", "email", "roles"],
});

const sessionManager = new SessionManager();

// Chapter 7: Machine-to-Machine Client Credentials Client
const apiClient = new ClientCredentialsClient({
  tokenUrl: "https://auth.local.dev/application/o/token/",
  clientId: "api-service-client",
  clientSecret: "api-service-secret-123456",
  scopes: ["service:read", "system:metrics"],
});

// 2. Attach global session middleware
app.use("*", createAuthMiddleware(sessionManager));

// ---------------------------------------------------------------------------
// Route: Home Page (Protected Dashboard)
// ---------------------------------------------------------------------------
app.get("/", requireAuth(), (c) => {
  const user = c.get("user")!;

  return c.html(
    <Layout user={user}>
      <div class="space-y-8">
        {/* Hero Section */}
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-950/40 to-slate-900 border border-indigo-500/20 p-8 sm:p-12">
          <div class="max-w-2xl">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono mb-4">
              <span>Chapter 3</span>
              <span>•</span>
              <span>Authorization Code Flow (SSR)</span>
            </div>
            <h1 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Enterprise Portal Application
            </h1>
            <p class="mt-3 text-slate-300 text-base leading-relaxed">
              This server-side rendered Hono application authenticates against Authentik using the classical
              <strong class="text-white"> Authorization Code Flow</strong>. Tokens are exchanged server-to-server and
              stored safely in secure <strong class="text-white">HttpOnly signed cookies</strong>.
            </p>

            <div class="mt-6 flex flex-wrap gap-4">
              <a
                href="/profile"
                class="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
              >
                <span>View User Profile & Claims</span>
                <span>→</span>
              </a>
              <a
                href="/developer"
                class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm px-5 py-2.5 rounded-lg border border-slate-700 transition"
              >
                Developer Console
              </a>
              <a
                href="/admin"
                class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm px-5 py-2.5 rounded-lg border border-slate-700 transition"
              >
                Admin Access
              </a>
            </div>
          </div>
        </div>

        {/* Status / Quick Overview */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Authenticated As</div>
            <div class="text-lg font-bold text-white">{user.name || user.preferred_username}</div>
            <div class="text-xs text-slate-400 font-mono mt-1">{user.email}</div>
          </div>

          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Authentik Groups (RBAC)</div>
            <div class="flex flex-wrap gap-1.5 mt-2">
              {(user.groups || []).map((grp) => (
                <span class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono">
                  {grp}
                </span>
              ))}
            </div>
          </div>

          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Session Security</div>
            <div class="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 mt-1">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              Server-Side Store + HttpOnly Cookie
            </div>
            <div class="text-xs text-slate-400 mt-2">Tokens never exposed to browser JS</div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// ---------------------------------------------------------------------------
// Route: Login Initiator
// ---------------------------------------------------------------------------
app.get("/auth/login", async (c) => {
  const returnTo = c.req.query("returnTo") || "/";
  await sessionManager.setReturnTo(c, returnTo);

  // Generate random state parameter to mitigate CSRF attacks
  const state = crypto.randomUUID();
  await sessionManager.setState(c, state);

  const authUrl = oidc.getAuthorizationUrl(state);
  return c.redirect(authUrl);
});

// ---------------------------------------------------------------------------
// Route: Callback Handler
// ---------------------------------------------------------------------------
app.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const errorDesc = c.req.query("error_description");

  if (error) {
    return c.html(
      <Layout>
        <div class="max-w-md mx-auto bg-slate-900 border border-rose-500/30 rounded-xl p-8 text-center">
          <div class="text-3xl mb-2">⚠️</div>
          <h2 class="text-xl font-bold text-rose-400 mb-2">Authentication Error</h2>
          <p class="text-sm text-slate-300 mb-4">{errorDesc || error}</p>
          <a href="/auth/login" class="text-xs text-indigo-400 hover:underline">Try again</a>
        </div>
      </Layout>,
      400
    );
  }

  if (!code || !state) {
    return c.text("Missing code or state parameter", 400);
  }

  // Verify state matches cookie to prevent CSRF
  const savedState = await sessionManager.getState(c);
  if (!savedState || savedState !== state) {
    console.warn("CSRF mismatch:", { savedState, queryState: state });
    return c.html(
      <Layout>
        <div class="max-w-md mx-auto bg-slate-900 border border-rose-500/30 rounded-xl p-8 text-center">
          <div class="text-3xl mb-2">⚠️</div>
          <h2 class="text-xl font-bold text-rose-400 mb-2">Authentication State Error</h2>
          <p class="text-sm text-slate-300 mb-4">
            Invalid state parameter (CSRF protection). This can happen if the page was refreshed after login, the session timed out, or login was initiated in multiple tabs.
          </p>
          <a
            href="/auth/login"
            class="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition shadow-lg shadow-indigo-600/30"
          >
            Restart Login
          </a>
        </div>
      </Layout>,
      403
    );
  }

  try {
    // 1. Exchange authorization code with Authentik backend
    const tokens = await oidc.exchangeCode(code);

    // 2. Decode claims from ID token
    let userClaims: any = {};
    if (tokens.id_token) {
      userClaims = oidc.decodeIdToken(tokens.id_token);
    } else {
      userClaims = await oidc.getUserInfo(tokens.access_token);
    }

    // 3. Store tokens & user claims in signed HttpOnly cookie
    await sessionManager.setSession(c, {
      user: userClaims,
      tokens: {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      },
    });

    // 4. Retrieve returnTo destination and clean up cookies
    const returnTo = await sessionManager.getReturnTo(c);
    sessionManager.deleteState(c);
    sessionManager.deleteReturnTo(c);

    // 5. Redirect user to destination page (Home by default or returnTo)
    return c.redirect(returnTo);
  } catch (err: any) {
    console.error("Callback error:", err);
    return c.text(`Authentication failed: ${err.message}`, 500);
  }
});

// ---------------------------------------------------------------------------
// Route: Logout Handler
// ---------------------------------------------------------------------------
app.get("/auth/logout", async (c) => {
  // Clear local session in server store and cookie
  await sessionManager.deleteSession(c);

  // Redirect to Authentik Global SLO (Invalidation Flow)
  return c.redirect("https://auth.local.dev/if/flow/default-invalidation-flow/");
});

// ---------------------------------------------------------------------------
// Route: User Profile (Protected Route)
// ---------------------------------------------------------------------------
app.get("/profile", requireAuth(), (c) => {
  const user = c.get("user")!;
  const session = c.get("session")!;

  return c.html(
    <Layout user={user} title="User Profile — Developer Portal">
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white">User Profile</h1>
            <p class="text-slate-400 text-sm mt-0.5">Authenticated user claims received from Authentik OIDC</p>
          </div>
          <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-medium">
            Active Session
          </span>
        </div>

        {/* Claims Table */}
        <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h2 class="font-semibold text-sm text-white">Decoded OIDC Claims</h2>
            <span class="text-xs font-mono text-slate-500">scope=openid profile email</span>
          </div>
          <div class="divide-y divide-slate-800/80 font-mono text-xs">
            {Object.entries(user).map(([key, val]) => (
              <div class="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span class="text-indigo-400 font-semibold">{key}</span>
                <span class="text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800/60 max-w-xl truncate">
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tokens Breakdown Card */}
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 class="font-semibold text-sm text-white">Stored Tokens (Server-Side)</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div class="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
              <div class="text-slate-400 font-bold uppercase text-[10px]">Access Token (first 40 chars)</div>
              <div class="text-emerald-400 truncate">{session.tokens.accessToken.slice(0, 40)}...</div>
              <div class="text-[10px] text-slate-500">Used for calling downstream Resource APIs</div>
            </div>

            <div class="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
              <div class="text-slate-400 font-bold uppercase text-[10px]">Token Expiration</div>
              <div class="text-amber-400">{new Date(session.tokens.expiresAt).toLocaleTimeString()}</div>
              <div class="text-[10px] text-slate-500">Managed via Refresh Token rotation</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// ---------------------------------------------------------------------------
// Route: Developer Console (RBAC: requires role 'developer' or 'admin')
// ---------------------------------------------------------------------------
app.get("/developer", requireAnyRole(["developer", "admin"]), (c) => {
  const user = c.get("user")!;

  return c.html(
    <Layout user={user} title="Developer Console — Developer Portal">
      <div class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xl font-bold">
            💻
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white">Developer Console</h1>
            <p class="text-slate-400 text-sm mt-0.5">
              Guarded by <code class="text-indigo-400">requireAnyRole(["developer", "admin"])</code> middleware
            </p>
          </div>
        </div>

        <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-emerald-300 text-sm">
          ✅ <strong>Access Granted!</strong> You are authenticated as <strong class="text-white">{user.preferred_username}</strong>.
          Your mapped roles include: <code class="bg-emerald-950 px-2 py-0.5 rounded text-emerald-200">{JSON.stringify(user.roles || [])}</code>.
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <h3 class="text-base font-semibold text-white">Developer Tools & Diagnostics</h3>
          <p class="text-slate-400 text-xs leading-relaxed">
            Both <strong class="text-white">ben3k</strong> (Admin) and <strong class="text-white">alice</strong> (Developer) can access this page.
            Regular users like <strong class="text-white">bob</strong> are intercepted with 403 Forbidden!
          </p>
        </div>
      </div>
    </Layout>
  );
});

// ---------------------------------------------------------------------------
// Route: Admin Console (RBAC: requires role 'admin')
// ---------------------------------------------------------------------------
app.get("/admin", requireRole("admin"), (c) => {
  const user = c.get("user")!;

  return c.html(
    <Layout user={user} title="Admin Console — Developer Portal">
      <div class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl font-bold">
            🛡️
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white">Admin Management Console</h1>
            <p class="text-slate-400 text-sm mt-0.5">
              Guarded by <code class="text-indigo-400">requireRole("admin")</code> middleware
            </p>
          </div>
        </div>

        <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-emerald-300 text-sm">
          ✅ <strong>Access Granted!</strong> You are authenticated as <strong class="text-white">{user.preferred_username}</strong>, and Authentik confirms you have the <code class="bg-emerald-950 px-2 py-0.5 rounded text-emerald-200">admin</code> role.
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 class="text-base font-semibold text-white">Simulated Admin Controls</h3>
          <p class="text-slate-400 text-xs leading-relaxed">
            Try logging out and logging in as <code class="text-indigo-300">alice</code> (who is a <code class="text-indigo-300">developer</code>, but NOT an <code class="text-indigo-300">admin</code>).
            When Alice visits this page, the middleware will intercept her request and render a custom 403 Forbidden page!
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <button class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-3 rounded-lg border border-slate-700 text-left">
              <div class="font-bold text-white mb-0.5">Flush App Cache</div>
              <div class="text-[10px] text-slate-400">Clear Redis session pool</div>
            </button>
            <button class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-3 rounded-lg border border-slate-700 text-left">
              <div class="font-bold text-white mb-0.5">Sync OIDC Providers</div>
              <div class="text-[10px] text-slate-400">Refresh JWKS public keys</div>
            </button>
            <button class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-3 rounded-lg border border-slate-700 text-left">
              <div class="font-bold text-white mb-0.5">Audit Log Export</div>
              <div class="text-[10px] text-slate-400">Download security trail</div>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// ---------------------------------------------------------------------------
// Route: M2M Services (Chapter 7: Client Credentials Demonstration)
// ---------------------------------------------------------------------------
app.get("/services", requireAuth(), async (c) => {
  const user = c.get("user")!;
  let apiData: any = null;
  let metricsData: any = null;
  let fetchError: string | null = null;
  let tokenPreview: string = "";

  try {
    const token = await apiClient.getAccessToken();
    tokenPreview = `${token.slice(0, 32)}...${token.slice(-16)}`;

    // 1. Fetch analytical reports (requires service:read)
    const reportRes = await apiClient.fetchWithAuth("https://api.local.dev/api/reports");
    if (reportRes.ok) {
      apiData = await reportRes.json();
    } else {
      fetchError = `Reports Error (${reportRes.status}): ${await reportRes.text()}`;
    }

    // 2. Fetch cluster telemetry (requires system:metrics)
    const metricsRes = await apiClient.fetchWithAuth("https://api.local.dev/api/system/metrics");
    if (metricsRes.ok) {
      metricsData = await metricsRes.json();
    }
  } catch (err: any) {
    fetchError = err.message;
  }

  return c.html(
    <Layout user={user} title="M2M Internal Services — Developer Portal">
      <div class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl font-bold">
            ⚡
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white">Machine-to-Machine (M2M) Microservice Call</h1>
            <p class="text-slate-400 text-sm mt-0.5">
              Demonstrating OAuth2 Client Credentials Flow (<code class="text-emerald-400">RFC 6749 §4.4</code>)
            </p>
          </div>
        </div>

        {/* Informational banner */}
        <div class="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-6 text-sm text-slate-300 space-y-2">
          <div class="font-semibold text-white flex items-center gap-2">
            <span>ℹ️</span>
            <span>How This Request Works</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            The browser authenticated you (<strong class="text-white">{user.preferred_username}</strong>) using
            an OIDC Authorization Code session. Then, when rendering this page, the <strong class="text-white">Portal Backend</strong> contacted Authentik directly using its own
            <strong class="text-white"> Service Account credentials</strong> (<code class="text-indigo-300 font-mono">api-service-client</code>) to obtain an RS256 machine token, and queried the internal microservice at <code class="text-indigo-300 font-mono">https://api.local.dev/</code>.
          </p>
          <div class="pt-2 text-xs font-mono text-emerald-400 flex items-center gap-2">
            <span class="text-slate-500">Active M2M Token:</span>
            <span class="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{tokenPreview || "Loading..."}</span>
          </div>
        </div>

        {fetchError && (
          <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-xs font-mono">
            ⚠️ <strong>Microservice Error:</strong> {fetchError}
          </div>
        )}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Reports Data */}
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 class="font-bold text-sm text-white">Analytics Report Payload</h2>
              <span class="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                Scope: service:read
              </span>
            </div>
            {apiData ? (
              <pre class="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-xs font-mono text-emerald-300 overflow-x-auto">
                {JSON.stringify(apiData, null, 2)}
              </pre>
            ) : (
              <div class="text-xs text-slate-500 font-mono italic">No report data received</div>
            )}
          </div>

          {/* Card 2: Metrics Data */}
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 class="font-bold text-sm text-white">Cluster Telemetry Payload</h2>
              <span class="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                Scope: system:metrics
              </span>
            </div>
            {metricsData ? (
              <pre class="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-xs font-mono text-cyan-300 overflow-x-auto">
                {JSON.stringify(metricsData, null, 2)}
              </pre>
            ) : (
              <div class="text-xs text-slate-500 font-mono italic">No metrics data received</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
});

export default {
  port: 3000,
  fetch: app.fetch,
};
