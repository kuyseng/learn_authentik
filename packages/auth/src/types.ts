export interface OIDCConfig {
  issuer: string; // e.g. "https://auth.local.dev/application/o/portal/"
  clientId: string; // e.g. "portal-client"
  clientSecret: string; // e.g. "portal-secret-123456"
  redirectUri: string; // e.g. "https://portal.local.dev/auth/callback"
  scopes?: string[]; // e.g. ["openid", "profile", "email", "offline_access"]
  sessionSecret?: string; // Secret used to sign session cookies
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface UserClaims {
  sub: string;
  name?: string;
  preferred_username?: string;
  nickname?: string;
  email?: string;
  email_verified?: boolean;
  groups?: string[];
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface AuthSession {
  user: UserClaims;
  tokens: {
    accessToken: string;
    idToken?: string;
    refreshToken?: string;
    expiresAt: number;
  };
}
