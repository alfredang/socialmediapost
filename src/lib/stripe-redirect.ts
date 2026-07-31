// Navigating to a URL that came back over the wire is only safe while that URL
// is guaranteed to be Stripe's. Rather than rely on the checkout/portal routes
// staying well-behaved forever, every Stripe redirect is re-checked here at the
// point of navigation: https only, and a real *.stripe.com host. A javascript:
// or attacker-chosen destination therefore cannot be reached even if a route
// were later changed to echo a URL from somewhere less trustworthy.
export function assertStripeUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Billing service returned a malformed URL.");
  }
  const host = parsed.hostname.toLowerCase();
  const isStripeHost = host === "stripe.com" || host.endsWith(".stripe.com");
  if (parsed.protocol !== "https:" || !isStripeHost) {
    throw new Error(`Refusing to redirect to a non-Stripe URL (${parsed.protocol}//${host}).`);
  }
  return parsed;
}

// Throws rather than navigating when the URL fails the check, so callers
// surface the error to the user instead of silently going nowhere.
export function redirectToStripe(url: string): void {
  const safe = assertStripeUrl(url);
  window.location.assign(safe.toString());
}
