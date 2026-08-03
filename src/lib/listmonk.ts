// Listmonk publishing — a self-hosted newsletter rather than a social network.
// A "post" is a campaign: created as a draft, then switched to running, which
// is what actually sends it to the list.
//
// Credential is an API user + token (Listmonk admin → Users → API users), sent
// as HTTP Basic. The base URL is user-supplied, so requests go through
// safeFetch — a Listmonk install is very often on a private network, and this
// server must not be usable as a probe for one.

import { safeFetch, BlockedUrlError } from "./safe-fetch";
import { normalizeExternalBaseUrl } from "./base-url";

export const normalizeListmonkUrl = (raw: string) =>
  normalizeExternalBaseUrl(raw, "Listmonk URL");

function authHeader(apiUser: string, token: string): string {
  return `Basic ${Buffer.from(`${apiUser}:${token}`).toString("base64")}`;
}

async function lmFetch(
  base: string,
  auth: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  try {
    return await safeFetch(`${base}/api${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), accept: "application/json", authorization: auth },
    });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      throw new Error(`Can't reach that Listmonk install — ${err.message}`);
    }
    throw err;
  }
}

// Validate by reading the lists and confirming the target one exists — a bad
// list id would otherwise only surface as a campaign that goes nowhere.
export async function validateListmonk(
  rawUrl: string,
  apiUser: string,
  token: string,
  rawListId: string
): Promise<{ base: string; listId: number; listName: string }> {
  const base = normalizeListmonkUrl(rawUrl);
  if (!apiUser.trim()) throw new Error("Enter your Listmonk API user");
  if (!token.trim()) throw new Error("Enter your Listmonk API token");

  const listId = Number(String(rawListId).trim());
  if (!Number.isInteger(listId) || listId <= 0) {
    throw new Error("The Listmonk list ID must be a number (see Lists in the admin UI)");
  }

  const auth = authHeader(apiUser.trim(), token.trim());
  const res = await lmFetch(base, auth, "/lists?per_page=all");
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Listmonk rejected those credentials — create an API user under Admin → Users → API users."
    );
  }
  if (res.status === 404) {
    throw new Error(`No Listmonk API found at ${base}/api — check the URL.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Listmonk rejected the request (${res.status})`);

  const lists: { id: number; name: string }[] = data.data?.results ?? data.data ?? [];
  const match = lists.find((l) => Number(l.id) === listId);
  if (!match) {
    const available = lists.map((l) => `${l.id} (${l.name})`).join(", ") || "none";
    throw new Error(`Listmonk has no list with ID ${listId}. Available: ${available}`);
  }
  return { base, listId, listName: match.name };
}

export interface ListmonkPublishInput {
  base: string;
  apiUser: string;
  token: string;
  listId: number;
  subject: string;
  body: string;
}

export async function publishToListmonk(
  input: ListmonkPublishInput
): Promise<{ url: string; externalId: string }> {
  const base = normalizeListmonkUrl(input.base);
  const { apiUser, token, listId, subject, body } = input;
  if (!subject.trim()) throw new Error("A Listmonk campaign needs a subject");

  const auth = authHeader(apiUser, token);

  const created = await lmFetch(base, auth, "/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: subject,
      subject,
      lists: [listId],
      type: "regular",
      content_type: "markdown",
      body,
    }),
  });
  const createdData = await created.json().catch(() => ({}));
  const id = createdData.data?.id;
  if (!created.ok || !id) {
    throw new Error(createdData.message || `Listmonk rejected the campaign (${created.status})`);
  }

  // Creating leaves it as a draft — this is the step that actually sends.
  const started = await lmFetch(base, auth, `/campaigns/${id}/status`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "running" }),
  });
  if (!started.ok) {
    const err = await started.json().catch(() => ({}));
    throw new Error(
      `Listmonk created campaign ${id} but wouldn't start it (${started.status})${
        err.message ? ` — ${err.message}` : ""
      }. It's saved as a draft in your admin.`
    );
  }

  return { url: `${base}/admin/campaigns/${id}`, externalId: String(id) };
}
