# Platform Credentials — Setup Manual (draft)

How to obtain the client IDs/secrets (and connect the webhook/token platforms)
for every platform SocialPost currently integrates. All app-level secrets go in
`.env` and are read via `process.env`; per-user credentials (Discord/Slack/
Telegram) are entered in the app's **Users** page, not `.env`.

> **Draft** — developer-portal wording changes often; the env var names,
> redirect paths, and scopes below are the source of truth (they match the code).

---

## 0. Before you start

Every OAuth platform redirects back to **`{PUBLIC_BASE_URL}/api/auth/<platform>/callback`**.

1. Set **`PUBLIC_BASE_URL`** in `.env` to the exact public origin the app is
   reached at — in local dev that's your tunnel (e.g.
   `https://<sub>.ngrok-free.dev`), in prod your domain. No trailing slash.
2. **Restart the app after editing `.env`** — env vars load at boot.
3. When you register a redirect URI in a developer console it must match the
   callback URL **character-for-character** (scheme, host, path, no trailing
   slash, no `www` unless your `PUBLIC_BASE_URL` has it).
4. Most platforms start in a **Testing / unverified** state where only accounts
   you've added as **testers** can connect. Going public requires the vendor's
   **App Review** (see each section).

### Quick reference

| Platform | `.env` variables | Developer console | Redirect URI to register |
|----------|------------------|-------------------|--------------------------|
| Google login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | console.cloud.google.com | `…/api/auth/google/callback` |
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (+ `YOUTUBE_PRIVACY`) | console.cloud.google.com | `…/api/auth/youtube/callback` |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | developers.facebook.com | `…/api/auth/facebook/callback` |
| Instagram | `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` | developers.facebook.com | `…/api/auth/instagram/callback` |
| Threads | `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET` | developers.facebook.com | `…/api/auth/threads/callback` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | developer.linkedin.com | `…/api/auth/linkedin/callback` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` (+ `TIKTOK_REDIRECT_BASE`) | developers.tiktok.com | `…/api/auth/tiktok/callback` |
| Discord | — (per-user webhook URL) | — | — |
| Slack | — (per-user webhook URL) | — | — |
| Telegram | — (per-user bot token + chat id) | @BotFather | — |
| Bluesky | — (per-user handle + app password) | — | — |

The Meta platforms (Facebook, Instagram, Threads) also reference two shared
data-callback endpoints this app already serves:
`…/api/meta/deauthorize` and `…/api/meta/data-deletion`.

---

## 1. Google — powers both **Google login** and **YouTube**

One Google Cloud OAuth client serves both. `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET`.

1. Go to **console.cloud.google.com** → create (or pick) a **project**.
2. **APIs & Services → Enabled APIs & Services → + Enable APIs** → enable
   **YouTube Data API v3** (needed for uploads; login alone doesn't need it).
3. **APIs & Services → OAuth consent screen** (a.k.a. **Google Auth Platform**):
   - User type **External**.
   - Fill **App name**, **User support email**, **Developer contact email**
     (the form won't save without these).
   - Under **Audience → Test users**, add every Google account you'll connect
     with (sensitive scopes like `youtube.upload` only work for listed testers
     until verification). *Tip: if "Save" silently fails, disable ad-blockers /
     use Incognito.*
4. **APIs & Services → Credentials → + Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - **Authorized redirect URIs** → add **both**:
     - `{PUBLIC_BASE_URL}/api/auth/google/callback`
     - `{PUBLIC_BASE_URL}/api/auth/youtube/callback`
5. Copy the **Client ID** and **Client secret** →
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.

- **You do NOT configure scopes in the Cloud console.** Enabling YouTube Data API
  v3 (step 2) is all that's needed on the API side. The app requests the scopes
  it needs at authorization time (login → `openid email profile`; YouTube →
  `youtube.upload`, `youtube.readonly`). In **Testing** mode those just work for
  your listed test users; only when you **publish/verify** the app for the public
  does Google make you list + justify sensitive scopes on the consent screen.
- Optional: `YOUTUBE_PRIVACY` (`public` default). Note Google forces
  API-uploaded videos to **private** until the app passes YouTube API
  compliance review.

---

## 2. Facebook (Pages)

`FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`. Posts to **Pages** only.

1. **developers.facebook.com → My Apps → Create App** → type **Business**.
2. Add the **Facebook Login** product.
3. **Facebook Login → Settings → Valid OAuth Redirect URIs** →
   `{PUBLIC_BASE_URL}/api/auth/facebook/callback`.
4. **App Roles → Roles/Testers** → add the Facebook account (that manages the
   Page) as a tester and accept the invite.
5. **Settings → Basic** → copy **App ID** → `FACEBOOK_CLIENT_ID`, **App Secret**
   → `FACEBOOK_CLIENT_SECRET`. Also set **Privacy Policy URL** and, under
   advanced/data-deletion, the **deauthorize / data-deletion** callbacks
   (`…/api/meta/deauthorize`, `…/api/meta/data-deletion`).
6. Scopes requested: `pages_manage_posts`, `pages_read_engagement`,
   `pages_read_user_content`, `pages_manage_engagement`, `pages_show_list`,
   `read_insights`. The last three (comment read/reply, insights) are advanced →
   need **App Review** for non-tester users.

The connect flow ends with a **Page picker** — the API can only post to Pages,
never a personal profile.

---

## 3. Instagram (professional accounts)

`INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET`. Uses **Instagram API with
Instagram Login** (a single OAuth against instagram.com — no Facebook Page link).

1. **developers.facebook.com → Create App** → add the **Instagram** product /
   use case.
2. In the Instagram product settings, set the **OAuth redirect URI** →
   `{PUBLIC_BASE_URL}/api/auth/instagram/callback`.
3. Copy the **Instagram app ID** and **Instagram app secret** →
   `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET`.
4. **Roles → Instagram testers** → add the IG account; **accept the invite in
   the Instagram app** (Settings → Apps and websites → Tester invites).
5. The connected account must be a **professional (Business/Creator)** account.
6. Scopes: `instagram_business_basic`, `instagram_business_content_publish`,
   `instagram_business_manage_insights`, `instagram_business_manage_comments`.
   Advanced ones need **App Review** for the public.

---

## 4. Threads

`THREADS_CLIENT_ID` / `THREADS_CLIENT_SECRET`. Threads authenticates via the
linked Instagram account.

1. **developers.facebook.com → Create App** → add the **Threads API** use case.
2. In the Threads use case **Settings**:
   - **Redirect Callback URLs** → `{PUBLIC_BASE_URL}/api/auth/threads/callback`
     (type it, then press **Enter** so it's registered as an entry).
   - **Uninstall Callback URL** → `{PUBLIC_BASE_URL}/api/meta/deauthorize`
   - **Delete Callback URL** → `{PUBLIC_BASE_URL}/api/meta/data-deletion`
     *(Meta expects these for a complete app and the app already serves both. Note:
     when "Form can't be saved" appeared in practice, the actual cause was the
     redirect URI not being committed — see the next line — so fix that first.)*
3. Enable the permissions `threads_basic` and `threads_content_publish` in the
   use case.
4. Copy the **Threads app ID / secret** → `THREADS_CLIENT_ID` /
   `THREADS_CLIENT_SECRET`.
5. **Add or Remove Threads Testers** → add the Threads account (must be
   **public**); accept the invite on the Threads side. Threads testers are
   **separate** from Instagram testers.
6. When connecting, use **"Log in with Instagram"** — that path carries the
   grant through to the redirect.

---

## 5. LinkedIn (member posts)

`LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.

1. **developer.linkedin.com → Create app** (link it to a LinkedIn Page you
   control).
2. **Products** → request **Share on LinkedIn** and **Sign In with LinkedIn
   using OpenID Connect**.
3. **Auth** tab → **Authorized redirect URLs** →
   `{PUBLIC_BASE_URL}/api/auth/linkedin/callback`.
4. **Auth** tab → copy **Client ID** / **Client Secret** →
   `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
5. Scopes: `openid`, `profile`, `w_member_social` (posts as the authenticated
   member; organization Pages need extra Marketing Developer Platform access).
6. Access tokens last ~60 days; there's no self-service refresh, so on expiry the
   account flips to `needs_reauth` and the user reconnects.

---

## 6. TikTok

`TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` (note: **KEY**, not ID).

1. **developers.tiktok.com → Manage apps → Create an app**.
2. Add the **Login Kit** and **Content Posting API** products.
3. **Redirect URI** → `{PUBLIC_BASE_URL}/api/auth/tiktok/callback`.
   - Pre-review TikTok apps often only accept **localhost** redirect URIs; if so,
     set **`TIKTOK_REDIRECT_BASE=http://localhost:3000`** to override the tunnel
     URL, and remove it after review approves your domain.
4. Copy **Client key** → `TIKTOK_CLIENT_KEY`, **Client secret** →
   `TIKTOK_CLIENT_SECRET`.
5. Scopes: `user.info.basic`, `user.info.stats`, `video.publish`, `video.list`
   (override with `TIKTOK_SCOPES` for debugging). Unaudited apps may only publish
   **SELF_ONLY** (private) — the app reads the creator's allowed privacy levels
   rather than forcing PUBLIC.
6. Access tokens last ~24h with a 365-day refresh token (auto-refreshed).

---

## 7. Credential platforms (no app registration — entered in the app)

These need **no `.env` secret**. In the app's **Users** page, click the
platform's Connect button and paste the credential; it's validated before it's
stored.

### Discord
- In your server: **Server Settings → Integrations → Webhooks → New Webhook →
  Copy Webhook URL**. Paste it. (Text + media attachments up to 8 MB.)

### Slack
- **api.slack.com/apps → Create New App →** the **Blank app** option (not "From a
  manifest") → pick your workspace. **Incoming Webhooks → toggle On → Add New
  Webhook to Workspace →** pick a channel → **Allow → copy the URL.** Connecting
  posts a test message to confirm. (Text only.)

### Bluesky
- In the Bluesky app: **Settings → Privacy and security → App passwords → Add
  App Password** → copy the `xxxx-xxxx-xxxx-xxxx` value.
- Paste it with your **full handle including the domain** (`you.bsky.social`).
  Connecting signs in to verify the credential; it posts nothing.
- Use an **app password**, never your account password — the form rejects
  anything that isn't in app-password format, and an app password can be revoked
  without changing your login.
- Text, photos and video. Links and hashtags are sent as rich-text facets so
  they stay clickable.
- **Photos:** ≤4 images, **1 MB each** — bsky.social's PDS rejects larger blobs
  outright. JPEG/PNG/GIF/WebP.
- **Video:** ≤3 minutes, one per post, uploaded to Bluesky's separate
  transcoding service (`video.bsky.app`) — publish blocks while it processes.
  Bluesky requires a **verified account email** for video and enforces a daily
  per-account video quota; both are checked up front and reported clearly.
  Install **ffprobe** (or set `FFPROBE_PATH`) to have the aspect ratio and
  duration read from the file — without it video still publishes, but clients
  render it at a default aspect ratio.

### Telegram
- Create a bot with **@BotFather** in Telegram → copy the **bot token**.
- **Add the bot to your channel as an admin.**
- **Channel/chat id:** public channel → use its `@username`. Private → forward
  any channel message to **@userinfobot** for the numeric `-100…` id, or click
  **↻ Detect my channels** in the connect modal to pick it automatically.

---

## 8. Common gotchas

- **`redirect_uri` mismatch** → the provider refuses to redirect back (you stay
  on the login site). Fix `PUBLIC_BASE_URL`, restart, and match the registered
  URI exactly.
- **Test-user gate** → `access_denied` / "app not verified" means the connecting
  account isn't an accepted tester. Add + accept it.
- **Meta "Form can't be saved"** → the confirmed cause in practice was the
  **redirect URI not being committed** — type it and press **Enter** so it
  becomes a registered entry (a URL just sitting in the input doesn't count).
  Also fill Privacy Policy URL and the deauthorize + data-deletion callbacks (the
  app serves them) for a complete app.
- **Instagram security checkpoint** → during a Threads/Instagram login you may
  land on "Choose a way to confirm it's you" and never get redirected back. It's
  an Instagram account-security gate, not an app/config problem — complete the
  verification, or clear it by logging into that account directly first. For
  Threads specifically, use the **"Log in with Instagram"** option.
- **Tunnel down** → all OAuth redirects target `PUBLIC_BASE_URL`, so keep the
  tunnel + app running or the round-trip can't complete.
- **Sensitive/advanced permissions** (comments, insights, publishing to the
  public) require the vendor's **App Review**; testers work without it.
