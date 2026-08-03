import { lookup } from "dns/promises";
import net from "net";

// Media URLs are supplied by API callers and fetched by the server, which makes
// a naive fetch() a way to reach anything the container can reach — cloud
// metadata (169.254.169.254), the database on localhost, internal-only admin
// services. Everything the server fetches on a caller's behalf goes through
// here: scheme allowlist, DNS resolution checked against private ranges, and
// redirects followed manually so a public host cannot bounce into the internal
// network on hop two.

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

function isBlockedIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone id
  if (addr === "::" || addr === "::1") return true; // unspecified / loopback
  // IPv4-mapped (::ffff:a.b.c.d) inherits the IPv4 verdict.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (addr.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(addr)) return true; // unique local fc00::/7
  if (addr.startsWith("ff")) return true; // multicast
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true; // not a resolvable literal — refuse rather than guess
}

// Resolves the host and rejects it if ANY returned address is private. A host
// that resolves to both a public and a private address is refused too: which
// one fetch() ends up using is not ours to predict.
async function assertPublicHost(hostname: string): Promise<void> {
  const literal = net.isIP(hostname);
  if (literal) {
    if (isBlockedAddress(hostname)) {
      throw new BlockedUrlError(`Refusing to fetch a private or reserved address (${hostname}).`);
    }
    return;
  }
  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedUrlError(`Could not resolve host "${hostname}".`);
  }
  if (records.length === 0) throw new BlockedUrlError(`Could not resolve host "${hostname}".`);
  for (const r of records) {
    if (isBlockedAddress(r.address)) {
      throw new BlockedUrlError(`Refusing to fetch "${hostname}" — it resolves to a private address.`);
    }
  }
}

export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("Media URL is not a valid absolute URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Unsupported URL scheme "${url.protocol}" — use http or https.`);
  }
  return url;
}

const MAX_REDIRECTS = 5;

// Same contract as fetch() for the caller, minus redirect handling: each hop is
// re-validated, because only checking the first URL leaves an open door — a
// public URL answering 302 to http://169.254.169.254/ would otherwise be
// followed automatically.
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let url = assertFetchableUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    const res = await fetch(url, { ...init, redirect: "manual" });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      url = assertFetchableUrl(new URL(location, url).toString());
      continue;
    }
    return res;
  }
  throw new BlockedUrlError(`Too many redirects (more than ${MAX_REDIRECTS}).`);
}

// safeFetch for a host the USER typed (a WordPress site, a Mastodon or Listmonk
// install), with BlockedUrlError turned into a message naming the thing they
// entered. Every such adapter should call this rather than fetch or safeFetch
// directly — it is the single place the SSRF guard is applied, so forgetting it
// is a visible omission rather than a silent hole.
export async function fetchUserHost(
  url: string,
  init: RequestInit,
  label: string
): Promise<Response> {
  try {
    return await safeFetch(url, init);
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      throw new Error(`Can't reach that ${label} — ${err.message}`);
    }
    throw err;
  }
}
