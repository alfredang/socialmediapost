// Thrown by platform publishers when the stored OAuth token is expired or
// revoked. publishPost catches it and flips the SocialAccount to needs_reauth
// so the UI prompts the user to reconnect.
export class TokenExpiredError extends Error {
  constructor(platformName: string) {
    super(`${platformName} token expired or revoked — reconnect the account on the Users page`);
    this.name = "TokenExpiredError";
  }
}
