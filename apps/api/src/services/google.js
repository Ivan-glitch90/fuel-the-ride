import { OAuth2Client } from 'google-auth-library';

/**
 * Verifies a Google ID token (the `credential` from Google Identity Services):
 * signature from Google's public keys, issuer, expiry, and that it was issued to one of our client IDs.
 * Returns null when Google sign-in isn't configured (no GOOGLE_CLIENT_ID).
 * @returns {null | ((idToken: string) => Promise<{ sub: string, email?: string, email_verified?: boolean, name?: string }>)}
 */
export function createGoogleVerifier(clientIds) {
  if (!clientIds?.length) return null;
  const client = new OAuth2Client();
  return async (idToken) => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientIds });
    return ticket.getPayload();
  };
}
