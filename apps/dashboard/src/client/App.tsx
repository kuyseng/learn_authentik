import React, { useState, useEffect } from "react";
import { generateRandomString, generateCodeChallenge } from "./pkce";
import { ReactNavbar } from "@authentik-lab/ui/react";

// OIDC Configuration for the SPA
const AUTH_CONFIG = {
  issuer: "https://auth.local.dev/application/o/dashboard/",
  authorizeUrl: "https://auth.local.dev/application/o/authorize/",
  tokenUrl: "https://auth.local.dev/application/o/token/",
  clientId: "dashboard-client",
  redirectUri: "https://dashboard.local.dev/callback",
  scope: "openid profile email roles",
};

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface UserProfile {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  groups?: string[];
  roles?: string[];
  permissions?: string[];
  is_admin?: boolean;
  [key: string]: any;
}

export function App() {
  const [tokens, setTokens] = useState<TokenResponse | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [apiData, setApiData] = useState<any>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Parse JWT payload without external library
  function parseJwt(token: string): any {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  // Handle callback on page load
  useEffect(() => {
    async function handleAuth() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");

      if (code) {
        setLoading(true);
        const storedState = sessionStorage.getItem("pkce_state");
        const codeVerifier = sessionStorage.getItem("pkce_code_verifier");

        // Validate state
        if (!storedState || storedState !== state) {
          setError("CSRF state mismatch. The authentication request was rejected.");
          setLoading(false);
          return;
        }

        if (!codeVerifier) {
          setError("Missing code_verifier in sessionStorage. Cannot complete PKCE exchange.");
          setLoading(false);
          return;
        }

        try {
          // Exchange code + code_verifier for tokens directly from browser
          const body = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: AUTH_CONFIG.clientId,
            code,
            redirect_uri: AUTH_CONFIG.redirectUri,
            code_verifier: codeVerifier,
          });

          const res = await fetch(AUTH_CONFIG.tokenUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          });

          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Token exchange failed (${res.status}): ${errBody}`);
          }

          const tokenData: TokenResponse = await res.json();
          setTokens(tokenData);

          // Parse ID Token claims
          if (tokenData.id_token) {
            const claims = parseJwt(tokenData.id_token);
            setUser(claims);
          }

          // Clean up storage & URL bar
          sessionStorage.removeItem("pkce_state");
          sessionStorage.removeItem("pkce_code_verifier");
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }

    handleAuth();
  }, []);

  // Initiate PKCE Login
  async function handleLogin() {
    setLoading(true);
    setError(null);

    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Save for the return trip
    sessionStorage.setItem("pkce_state", state);
    sessionStorage.setItem("pkce_code_verifier", codeVerifier);

    const authUrl = new URL(AUTH_CONFIG.authorizeUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", AUTH_CONFIG.clientId);
    authUrl.searchParams.set("redirect_uri", AUTH_CONFIG.redirectUri);
    authUrl.searchParams.set("scope", AUTH_CONFIG.scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    window.location.href = authUrl.toString();
  }

  // Call Protected Hono API
  async function callProtectedApi() {
    if (!tokens) return;
    try {
      const res = await fetch("/api/stats", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      const data = await res.json();
      setApiData(data);
    } catch (err: any) {
      setError(`API call failed: ${err.message}`);
    }
  }

  // Call Admin-Only Hono API (Requires 'admin' role)
  async function callAdminApi() {
    if (!tokens) return;
    try {
      const res = await fetch("/api/admin/system", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      const data = await res.json();
      setAdminData(data);
    } catch (err: any) {
      setError(`Admin API call failed: ${err.message}`);
    }
  }

  // Local Logout
  function handleLogout() {
    setTokens(null);
    setUser(null);
    setApiData(null);
    setAdminData(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Unified Monorepo Navigation Bar */}
      <ReactNavbar
        currentApp="dashboard"
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        loading={loading}
      />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full space-y-8">
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-start space-x-3">
            <span className="font-bold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        {!user ? (
          /* Unauthenticated Hero */
          <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Public Client (No Client Secret)</span>
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
              OAuth2 PKCE in a React SPA
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              This Single Page Application authenticates directly with Authentik using the{" "}
              <strong className="text-white">Proof Key for Code Exchange (RFC 7636)</strong> flow.
              No client secrets are bundled into client code.
            </p>
            <div className="pt-4">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="inline-flex items-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 transition disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Sign in with Authentik (PKCE)"}
              </button>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Logged in as <strong className="text-slate-200">{user.preferred_username || user.email}</strong>
                </p>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-medium">
                PKCE Session Active
              </span>
            </div>

            {/* User Claims Card */}
            {/* User Claims Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
                <span className="text-xs text-slate-400 uppercase font-semibold">User Identity</span>
                <p className="text-lg font-bold text-white">{user.name || user.preferred_username}</p>
                <p className="text-xs text-slate-400 font-mono">{user.sub}</p>
              </div>
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
                <span className="text-xs text-slate-400 uppercase font-semibold">Email & Status</span>
                <p className="text-lg font-bold text-white">{user.email || "No email claim"}</p>
                <p className="text-xs text-emerald-400 font-medium">Verified Account</p>
              </div>
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
                <span className="text-xs text-slate-400 uppercase font-semibold">Authentik Groups & Roles</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {user.groups && user.groups.length > 0 ? (
                    user.groups.map((g) => (
                      <span
                        key={g}
                        className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium"
                      >
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No groups assigned</span>
                  )}
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map((r) => (
                      <span
                        key={r}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold"
                      >
                        role:{r}
                      </span>
                    ))
                  ) : null}
                </div>
              </div>
            </div>

            {/* Conditional Admin Operations Card (Section 6.5) */}
            {user.roles?.includes("admin") || user.groups?.includes("lab-admins") ? (
              <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-amber-400 font-bold">🛡️ Admin Operations Console</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                        role: admin
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      This panel is <strong className="text-white">conditionally rendered</strong> because you have the <strong className="text-amber-300">admin</strong> role.
                      Calls protected <code className="text-indigo-400">/api/admin/system</code>.
                    </p>
                  </div>
                  <button
                    onClick={callAdminApi}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition"
                  >
                    Call /api/admin/system
                  </button>
                </div>

                {adminData && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto">
                    <pre>{JSON.stringify(adminData, null, 2)}</pre>
                  </div>
                )}
              </div>
            ) : null}

            {/* API Test Section */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Protected REST API Test</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sends <code className="text-indigo-400">Authorization: Bearer &lt;access_token&gt;</code> to{" "}
                    <code className="text-slate-300">/api/stats</code> (requires <strong className="text-indigo-300">developer</strong> or <strong className="text-indigo-300">admin</strong>)
                  </p>
                </div>
                <button
                  onClick={callProtectedApi}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                >
                  Call /api/stats
                </button>
              </div>

              {apiData && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
                  <pre>{JSON.stringify(apiData, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* Token Claims Raw Inspection */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
              <h2 className="text-lg font-bold text-white">ID Token Claims (Decoded)</h2>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
                <pre>{JSON.stringify(user, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Authentik Lab — Chapter 4: React SPA with PKCE Flow &amp; Hono API
      </footer>
    </div>
  );
}
