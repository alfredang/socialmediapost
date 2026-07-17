# SocialPost for VS Code

Post to 22 social platforms without leaving the editor.

## Install (local)

```bash
cd sdks/vscode
npx -y @vscode/vsce package        # produces socialpost-vscode-1.0.0.vsix
code --install-extension socialpost-vscode-1.0.0.vsix
```

## Setup

Settings → SocialPost:
- `socialpost.apiKey` — from your SocialPost API Keys page
- `socialpost.baseUrl` — e.g. `http://localhost:3000`
- `socialpost.defaultUser` — your profile name
- `socialpost.defaultPlatforms` — e.g. `["linkedin", "x"]`

## Commands (⇧⌘P)

- **SocialPost: Post Selection as Text** — highlights → multi-platform text post
- **SocialPost: Upload Current File** — pick a video/image, add a caption, ship it
- **SocialPost: Show Upload History** — recent posts; select to open the live URL
