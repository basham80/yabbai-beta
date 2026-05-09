# YABBAI Ecosystem — Build & Deploy Instructions
## Version: Full Update — May 2026

---

## MASTER ADDRESSES (DO NOT CHANGE)

Treasury (Solflare): 8e6ogxfUnj6YXHp1tR4Kj1ytSkmEhLhi2fbKqRVxUHPi
YABBAI Mint:         AcEVtpLEfxMHFzXQrhJiDhoWCkLVYH3drD2cxNAzLFUv
YABBAI Pool:         DaxLJ5mRkqWtfhFBKtibtGSYaiE7zFrtgsi5evmVBAax
PayPal:              basham_x@protonmail.com

---

## DOMAIN & HOSTING

Domain:   yabbai.network (Netlify DNS — active)
SSL:      *.yabbai.network wildcard (Let's Encrypt — expires Aug 5 2026)
Site:     yabbaiproject (Netlify)
Vercel:   yabbai-vercel-y27x.vercel.app (LP Dashboard)

---

## 5 TOKEN SITES

| Token         | URL                                    | Folder          |
|---------------|----------------------------------------|-----------------|
| $YABBAI       | yabbai.network/yabbai/                 | /yabbai/        |
| $BASH         | yabbai.network/bash/                   | /bash/          |
| $YABBIE       | yabbai.network/yabbie/                 | /yabbie/        |
| $HOMEGROWN    | yabbai.network/homegrown/              | /homegrown/     |
| $GREENHOUSEGROW | yabbai.network/greenhousegrow/       | /greenhousegrow/|
| Hub           | yabbai.network                         | hub.html        |

---

## NEW IN THIS UPDATE

### LiquidNet — Multi-Token LP Manager
File: /yabbai/lp-network.html
URL:  yabbai.network/yabbai/lp-network.html

Features:
- Animated token network canvas
- All 5 tokens in one dashboard
- LP Router — remove from one token, inject into another
- Mandatory announcement system for LP migrations
- Token creation wizard
- LP history log
- Phantom/Solflare wallet connect

### Phantom/Solflare Wallet Connect
File: wallet-connect.js (in every token folder)

Features:
- Connect Phantom or Solflare on every page
- Real SOL balance from Solana RPC
- Real YABBAI token balance
- Income calculator ($8 entry point)
- Auto-reconnect on page load
- Low balance detection

### Live Mainnet Data
- $YABBAI stats pull from Dexscreener API
- Price fallback to Jupiter API
- Refreshes every 30 seconds
- No fake/simulated stats

---

## DEPLOY TO NETLIFY

### Option A — Netlify Agent (recommended)
Paste the full agent prompt into your Netlify Agent
with this zip attached.

### Option B — Netlify Drop
1. Unzip this file
2. Go to app.netlify.com/projects/yabbaiproject/deploys
3. Drag the unzipped folder onto the drop zone

### Option C — Netlify CLI
```
netlify deploy --prod --dir=. --no-build --site=yabbaiproject
```

---

## IMPORTANT: DEPLOY CONFIG

Every folder has:
- netlify.toml: publish=".", command="", NODE_VERSION=18
- _redirects: /* → /index.html 200

Root _redirects: /* → /hub.html 200

---

## PAYPAL AUTOPAYOUT

Trigger:    Every $110 earned OR 30 minutes
Amount:     $50 AUD per trigger
Destination: basham_x@protonmail.com
Engine:     yabbai-payment-engine.html
Status:     Awaiting live PayPal credentials

---

## SECURITY

Treasury lock password: SHA256 hashed server-side
Wallet: Solflare only — 8e6ogxfUnj6YXHp1tR4Kj1ytSkmEhLhi2fbKqRVxUHPi
Old compromised wallets: COMPLETELY REMOVED from all files
