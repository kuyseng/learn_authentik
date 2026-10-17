/**
 * PKCE (Proof Key for Code Exchange — RFC 7636) Utilities for the Browser
 * Uses the standard Web Crypto API available in all modern browsers.
 */

/**
 * Generate a cryptographically secure random string for code_verifier and state.
 * Characters allowed by RFC 7636: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
 */
export function generateRandomString(length: number = 64): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

/**
 * Convert an ArrayBuffer into a Base64-URL string (without padding "=", and using "-" and "_").
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Compute the SHA-256 hash of the code_verifier and return the Base64-URL encoded code_challenge.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}
