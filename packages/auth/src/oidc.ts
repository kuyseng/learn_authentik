import * as jose from "jose";
import type { OIDCConfig, TokenResponse, UserClaims } from "./types";

export class OIDCClient {
  constructor(public config: OIDCConfig) {}

  /**
   * Generates the authorization URL to redirect the user to Authentik.
   */
  getAuthorizationUrl(state: string, nonce?: string): string {
    const scopes = (
      this.config.scopes ?? ["openid", "profile", "email", "offline_access"]
    ).join(" ");

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: scopes,
      state: state,
    });

    if (nonce) {
      params.set("nonce", nonce);
    }

    const authEndpoint = new URL("application/o/authorize/", this.getBaseUrl());
    return `${authEndpoint.toString()}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for tokens via POST to /application/o/token/.
   */
  async exchangeCode(code: string): Promise<TokenResponse> {
    const tokenUrl = new URL("application/o/token/", this.getBaseUrl());

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      // Allow local development self-signed certs
      // @ts-expect-error Bun-specific tls option
      tls: { rejectUnauthorized: false },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${errText}`);
    }

    return (await response.json()) as TokenResponse;
  }

  /**
   * Refreshes an expired access token using a refresh token.
   */
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const tokenUrl = new URL("application/o/token/", this.getBaseUrl());

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      // @ts-expect-error Bun-specific tls option
      tls: { rejectUnauthorized: false },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${errText}`);
    }

    return (await response.json()) as TokenResponse;
  }

  /**
   * Decodes claims from an ID token without signature verification.
   */
  decodeIdToken(idToken: string): UserClaims {
    const decoded = jose.decodeJwt(idToken);
    return decoded as UserClaims;
  }

  /**
   * Fetches latest user profile from the UserInfo endpoint.
   */
  async getUserInfo(accessToken: string): Promise<UserClaims> {
    const userInfoUrl = new URL("application/o/userinfo/", this.getBaseUrl());
    const response = await fetch(userInfoUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      // @ts-expect-error Bun-specific tls option
      tls: { rejectUnauthorized: false },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch userinfo (${response.status})`);
    }

    return (await response.json()) as UserClaims;
  }

  /**
   * Generates the end-session (logout) URL.
   */
  getEndSessionUrl(postLogoutRedirectUri?: string): string {
    const appSlug = this.getAppSlug();
    const logoutUrl = new URL(
      `application/o/${appSlug}/end-session/`,
      this.getBaseUrl()
    );
    if (postLogoutRedirectUri) {
      logoutUrl.searchParams.set(
        "post_logout_redirect_uri",
        postLogoutRedirectUri
      );
    }
    return logoutUrl.toString();
  }

  getBaseUrl(): string {
    const url = new URL(this.config.issuer);
    return `${url.protocol}//${url.host}/`;
  }

  getAppSlug(): string {
    const url = new URL(this.config.issuer);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "portal";
  }
}
