export interface ClientCredentialsConfig {
  tokenUrl: string; // e.g. "https://auth.local.dev/application/o/token/"
  clientId: string; // e.g. "api-service-client"
  clientSecret: string; // e.g. "api-service-secret-123456"
  scopes?: string[]; // e.g. ["service:read", "service:write"]
}

export interface MachineToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
  tokenType: string;
}

/**
 * Enterprise Client Credentials token manager.
 * Caches machine tokens in memory and automatically refreshes them before expiration.
 */
export class ClientCredentialsClient {
  private tokenCache: MachineToken | null = null;

  constructor(private config: ClientCredentialsConfig) {}

  /**
   * Acquires a valid M2M access token.
   * Reuses unexpired tokens from cache; fetches a fresh token when near expiration.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Return cached token if valid for at least 30 more seconds
    if (this.tokenCache && this.tokenCache.expiresAt - 30000 > now) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    if (this.config.scopes && this.config.scopes.length > 0) {
      body.set("scope", this.config.scopes.join(" "));
    }

    const res = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Client Credentials grant failed (${res.status}): ${err}`);
    }

    const data: any = await res.json();
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: now + expiresIn * 1000,
      tokenType: data.token_type || "Bearer",
    };

    return this.tokenCache.accessToken;
  }

  /**
   * Executes an authenticated HTTP fetch request with Bearer token automatically attached.
   */
  async fetchWithAuth(url: string | URL, init?: RequestInit): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(url, {
      ...init,
      headers,
    });
  }

  /**
   * Clears cached token forcing next call to fetch fresh token from Authentik.
   */
  clearCache(): void {
    this.tokenCache = null;
  }
}
