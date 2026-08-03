// Hashnode publishing via the public GraphQL API and a Personal Access Token
// (hashnode.com/settings/developer → Generate New Token). No OAuth.
//
// IMPORTANT: every write mutation, publishPost included, is gated behind an
// active Hashnode **Pro** plan on the target publication. A free account can
// authenticate and read fine, then get FORBIDDEN on publish — so the Pro check
// is surfaced explicitly rather than left as a bare GraphQL error.
//
// Shapes here come from Hashnode's own published schema
// (github.com/Hashnode/gql-skill), not from prose docs.

const GQL = "https://gql.hashnode.com";

// PublishPostInput allows up to 15 tags.
const MAX_TAGS = 15;

interface GqlError {
  message?: string;
  extensions?: { code?: string };
}

async function gql<T>(
  pat: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${pat}` },
    body: JSON.stringify({ query, variables }),
  });

  // Observed in practice: this endpoint can answer with an HTML page instead of
  // GraphQL when it's unavailable or fronted by a challenge. Say that plainly
  // rather than dying in JSON.parse.
  const text = await res.text();
  let payload: { data?: T; errors?: GqlError[] };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `Hashnode's API returned a non-JSON response (${res.status}) — the endpoint may be unavailable right now.`
    );
  }

  const first = payload.errors?.[0];
  if (first) {
    const message = first.message ?? "Hashnode rejected the request";
    if (/pro plan/i.test(message) || first.extensions?.code === "FORBIDDEN") {
      throw new Error(
        `${message} — Hashnode gates all API publishing behind an active Pro plan on the publication.`
      );
    }
    throw new Error(`Hashnode: ${message}`);
  }
  if (!res.ok || !payload.data) {
    throw new Error(`Hashnode request failed (${res.status})`);
  }
  return payload.data;
}

interface MeResponse {
  me?: {
    id: string;
    username: string;
    publications: { edges: { node: { id: string; title: string; url: string } }[] };
  };
}

// Validate by reading the token's own user and publications. Read-only.
export async function validateHashnode(rawToken: string): Promise<{
  username: string;
  publicationId: string;
  publicationTitle: string;
}> {
  const pat = rawToken.trim();
  if (!pat) throw new Error("Enter your Hashnode personal access token");

  const data = await gql<MeResponse>(
    pat,
    `query { me { id username publications(first: 5) { edges { node { id title url } } } } }`
  );
  if (!data.me) {
    throw new Error(
      "Hashnode didn't recognise that token. Generate one at hashnode.com/settings/developer."
    );
  }
  const publications = data.me.publications?.edges?.map((e) => e.node) ?? [];
  if (publications.length === 0) {
    throw new Error(
      `Hashnode account @${data.me.username} has no publication — create your blog on Hashnode first.`
    );
  }
  // First publication wins; multi-blog accounts are rare and the composer has
  // nowhere to choose one.
  const pub = publications[0];
  return { username: data.me.username, publicationId: pub.id, publicationTitle: pub.title };
}

// PublishPostTagInput is { slug: String!, name: String }.
// Requires a word boundary before the '#', so a URL fragment doesn't become a
// tag — same rule as devtoTags and the Bluesky facet detector.
function hashnodeTags(text: string): { slug: string; name: string }[] {
  const found = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)];
  const seen = new Map<string, string>();
  for (const match of found) {
    const name = match[1];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slug && !seen.has(slug)) seen.set(slug, name);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen].map(([slug, name]) => ({ slug, name }));
}

export interface HashnodePublishInput {
  token: string;
  publicationId: string;
  title: string;
  contentMarkdown: string;
}

export async function publishToHashnode(
  input: HashnodePublishInput
): Promise<{ url: string; externalId: string }> {
  const { token, publicationId, title, contentMarkdown } = input;
  if (!title.trim()) throw new Error("Hashnode posts need a title");
  // contentMarkdown is non-null in the schema, and an empty body is rejected
  // server-side — fail here with a message that names the real problem.
  if (!contentMarkdown.trim()) throw new Error("Hashnode posts need a body");

  const data = await gql<{ publishPost: { post: { id: string; slug: string; url: string } } }>(
    token,
    `mutation Publish($input: PublishPostInput!) {
       publishPost(input: $input) { post { id slug url } }
     }`,
    {
      input: {
        publicationId,
        title,
        contentMarkdown,
        tags: hashnodeTags(`${title} ${contentMarkdown}`),
      },
    }
  );

  const post = data.publishPost?.post;
  if (!post?.id) throw new Error("Hashnode accepted the request but returned no post");
  return { url: post.url, externalId: post.id };
}
