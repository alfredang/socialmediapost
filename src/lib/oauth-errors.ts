// Thrown by platform publishers when the stored OAuth token is expired or
// revoked. publishPost catches it and flips the SocialAccount to needs_reauth
// so the UI prompts the user to reconnect.
export class TokenExpiredError extends Error {
  constructor(platformName: string) {
    super(`${platformName} token expired or revoked — reconnect the account on the Users page`);
    this.name = "TokenExpiredError";
  }
}

// Thrown when the stored token is valid but lacks a permission the request needs
// (e.g. Facebook Graph error #10 when reading comments without
// pages_read_user_content). The fix is a reconnect to grant the new scope — or,
// for advanced permissions, completing Meta App Review.
export class MissingPermissionError extends Error {
  constructor(platformName: string, detail?: string) {
    super(
      `${platformName} is missing a permission for this action — reconnect the account on the Users page to grant it${detail ? ` (${detail})` : ""}`
    );
    this.name = "MissingPermissionError";
  }
}
