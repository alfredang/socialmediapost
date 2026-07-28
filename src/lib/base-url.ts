// Public base URL for links/redirects the outside world will follow.
// Behind a tunnel or reverse proxy (ngrok, Coolify) the request origin resolves
// to the internal address (localhost:3000), so PUBLIC_BASE_URL wins when set.
export function appBaseUrl(origin: string): string {
  return (process.env.PUBLIC_BASE_URL || origin).replace(/\/$/, "");
}
