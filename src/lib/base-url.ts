// Public base URL for links/redirects the outside world will follow.
// Behind a tunnel or reverse proxy (ngrok, Coolify) the request origin resolves
// to the internal address (localhost:3000), so PUBLIC_BASE_URL wins when set.
export function appBaseUrl(origin: string): string {
  return (process.env.PUBLIC_BASE_URL || origin).replace(/\/$/, "");
}

// Normalises a base URL the USER typed — a Mastodon instance, a WordPress
// site, a Listmonk install. Adds https:// when the scheme is
// missing, drops query/hash/trailing slash, keeps any path (installs commonly
// live in a subdirectory). Callers must still fetch it via safeFetch: this
// tidies the string, it does not make the destination safe.
export function normalizeExternalBaseUrl(raw: string, label = "URL"): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`Enter your ${label}`);
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`"${raw}" isn't a valid ${label}`);
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
