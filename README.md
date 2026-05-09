# YABBAI Beta — full stack

Monorepo for the **YABBAI hub** (multi-token ecosystem home), the **main Solana app** under `yabbai/`, optional **Netlify functions**, and **Cloudflare Workers** for AI missions and SOL payouts.

## What to deploy where

| Piece | What it is | How you deploy it |
|--------|------------|-------------------|
| **Website (hub + apps)** | Static HTML: root `index.html` → hub; `yabbai/` → main app; `bash/`, `yabbie/`, etc. | Publish **repository root** `.` so `/` loads `index.html` and `/yabbai/` loads the app. **Do not** set the site root to `workers/payout` or any Worker folder. |
| **Mission AI API** | Cloudflare Worker `yabbai-mission-api` | From repo root: `npx wrangler deploy` (uses `./wrangler.toml`). Set secrets per `wrangler.toml` comments. |
| **SOL payout** | Cloudflare Worker `yabbai-payout` | `cd workers/payout && npm install && npx wrangler deploy`. `npx wrangler secret put TREASURY_SECRET_KEY`. |

After Workers are live, edit **`yabbai/mission-config.js`** (or your hosted copy) and set `window.YABBAI_MISSION_API` and optionally `window.YABBAI_PAYOUT_API` to those HTTPS URLs.

## Layout

- `index.html` — ecosystem hub / navigation.
- `yabbai/` — main dashboard (`index.html`, `mission-config.js`, `wallet-connect.js`, `lp-network.html`).
- `api/mission-logic.mjs` — shared AI handler used by the mission Worker.
- `workers/mission.js` — mission Worker entry (imported by root `wrangler.toml`).
- `workers/payout/` — payout Worker (has its own `wrangler.toml`).

See **`BUILD_INSTRUCTIONS.md`** for RPC env vars, wallet behaviour, and troubleshooting.
