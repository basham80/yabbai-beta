# YABBAI Beta — full stack

Monorepo for the **YABBAI hub** (multi-token ecosystem home), the **main Solana app** under `yabbai/`, optional **Netlify functions**, and **Cloudflare Workers** for AI missions and SOL payouts.

## What to deploy where

| Piece | What it is | How you deploy it |
|--------|------------|-------------------|
| **Website (hub + apps)** | Static HTML: root `index.html` → hub; `yabbai/` → main app; `bash/`, `yabbie/`, etc. | Publish **repository root** `.` so `/` loads `index.html` and `/yabbai/` loads the app. **Do not** set the site root to `workers/payout` or any Worker folder. |
| **Vercel deploy** | Static site + serverless `/api/mission` | Connect repo to Vercel — build settings auto-detected from `vercel.json`. Add env vars `ANTHROPIC_API_KEY` and/or `MOONSHOT_API_KEY` in Vercel project settings. AI missions live at `/api/mission` (already wired in `mission-config.js`). |
| **Mission AI API** | Cloudflare Worker `yabbai-mission-api` (alternative to Vercel) | From repo root: `npx wrangler deploy` (uses `./wrangler.toml`). Set secrets per `wrangler.toml` comments. |
| **SOL payout** | Cloudflare Worker `yabbai-payout` | `cd workers/payout && npm install && npx wrangler deploy`. `npx wrangler secret put TREASURY_SECRET_KEY`. |

After Workers are live, edit **`yabbai/mission-config.js`** (or your hosted copy) and set `window.YABBAI_MISSION_API` and optionally `window.YABBAI_PAYOUT_API` to those HTTPS URLs.

## Layout

- `index.html` — ecosystem hub / navigation.
- `yabbai/` — main dashboard (`index.html`, `mission-config.js`, `wallet-connect.js`, `lp-network.html`).
- `api/mission.mjs` — Vercel serverless function (AI mission proxy).
- `lib/mission-logic.mjs` — shared AI handler used by Vercel, Netlify Functions, and Cloudflare Workers.
- `netlify/functions/mission.js` — Netlify Functions shim (imports from `lib/mission-logic.mjs`).
- `workers/mission.js` — mission Worker entry (imported by root `wrangler.toml`).
- `workers/payout/` — payout Worker (has its own `wrangler.toml`).
- `vercel.json` — Vercel build + functions config.

See **`BUILD_INSTRUCTIONS.md`** for RPC env vars, wallet behaviour, and troubleshooting.
