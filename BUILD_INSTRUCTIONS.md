# YABBAI Beta Build Instructions

## Setup

### 1. Environment Configuration

Create a `.env.local` file in the project root:

```bash
VITE_SOLANA_RPC_URL=https://your-private-rpc-url.com
```

#### Private RPC Providers (Recommended)

**Free tiers available:**
- **Alchemy**: https://www.alchemy.com/ (best for Solana)
- **QuickNode**: https://www.quicknode.com/ (generous free tier)
- **Helius**: https://www.helius.dev/ (Solana-native)
- **Magic Eden**: https://www.magiceden.io/rpc (community RPC)

#### Why Private RPC?
Public Solana RPC (`api.mainnet-beta.solana.com`) has aggressive rate limiting:
- ~600 requests/min
- Your app will hit limits with multiple connected wallets
- Private RPC gives 10,000+ req/min on free tiers

---

### 2. Netlify/4EVERLAND Deployment

#### Add Environment Variable

1. Go to your deployment dashboard
2. Navigate to **Settings → Environment Variables**
3. Add:
   ```
   VITE_SOLANA_RPC_URL = https://your-private-rpc-url.com
   ```
4. Redeploy

#### For Netlify Specifically

The `netlify.toml` file is already configured. Just add the env var above.

---

### 3. Wallet Connection Features

#### ✅ Working Features

- **Phantom Wallet**: Full integration with connection, balance sync, and token fetching
- **Solflare Wallet**: Alternative wallet provider support
- **Balance Sync Loop**: Updates every 30 seconds (not just on connect)
- **Private RPC**: Automatically uses `VITE_SOLANA_RPC_URL` if set
- **Buffer Polyfill**: Loads from CDN to support @solana/web3.js in browser
- **Console Debugging**: Detailed logs for troubleshooting

#### Balance Updates

When wallet is connected:
1. **Immediate fetch** on connect (you'll see balance right away)
2. **Auto-refresh every 30 seconds** (balance stays live)
3. **Console logs** show each update:
   ```
   [SOL] 0.0000 → 3.0000 SOL (3000000000 lamports)
   [PRICE] SOL = $88.50 AUD
   [$YABBAI] 1,234,567 tokens
   ```

---

### 4. Troubleshooting

#### "solBalance stays at 0"

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Look for:**
   - `[INIT] Using private RPC from...` — confirms RPC is loaded
   - `[SOL] 0.0000 → X.XXXX SOL` — balance is being fetched
   - `[SOL] RPC error:` — if you see this, RPC URL is wrong

4. **Verify:**
   ```javascript
   // In console, type:
   console.log(RPC)
   // Should show your private RPC URL, not the public one
   ```

#### "Rate limit errors"

1. Check if `VITE_SOLANA_RPC_URL` is set:
   ```javascript
   console.log(import.meta.env.VITE_SOLANA_RPC_URL)
   ```
2. If undefined, set it in `.env.local` or deploy settings
3. Redeploy and test

#### "Buffer polyfill not loading"

This is non-critical but will show a warning. To fix:
- The code attempts to load from CDN automatically
- If it fails, console will show: `[INIT] Buffer polyfill failed to load`
- This only affects advanced @solana/web3.js features; basic RPC calls work fine

---

### 5. Testing

#### Local Development

```bash
# Install dependencies (if using a bundler)
npm install

# Start dev server
npm run dev

# Open http://localhost:5173
```

#### Manual Testing

1. Open the page
2. Click "👻 Connect Phantom"
3. Approve in Phantom wallet
4. Open DevTools → Console
5. Should see:
   ```
   [PHANTOM] ✓ Connected: 9Zqq...
   [BALANCE] Starting refresh loop (30s interval)
   [SOL] 0 → 3 SOL (3000000000 lamports)
   ```

---

### 6. Architecture

#### Files Updated

- `wallet-connect.js` — Main wallet connection script
- `bash/wallet-connect.js` — Mirror of main
- `greenhousegrow/wallet-connect.js` — Mirror of main
- `.env.local` — Environment variables (local only)
- `netlify.toml` — Deploy config

#### Key Functions

| Function | Purpose |
|----------|----------|
| `connectPhantom()` | Initiate Phantom wallet connection |
| `startBalanceRefresh()` | Start 30s auto-refresh loop |
| `fetchBalances()` | Pull SOL + $YABBAI + prices from RPC |
| `renderWalletUI()` | Display connected wallet panel |

#### RPC Method Detection

```javascript
const getRpcUrl = () => {
  // Priority order:
  // 1. import.meta.env.VITE_SOLANA_RPC_URL (Vite dev/build)
  // 2. process.env.VITE_SOLANA_RPC_URL (Node.js)
  // 3. window.VITE_SOLANA_RPC_URL (runtime injection)
  // 4. Fallback: public RPC
}
```

---

### 7. What's Fixed

| Issue | Fix |
|-------|-----|
| Balance stays at 0 | Added balance refresh loop (every 30s) |
| Rate limiting on public RPC | Private RPC support via `VITE_SOLANA_RPC_URL` |
| Missing Buffer polyfill | CDN-based polyfill loader |
| No debugging info | Detailed console logs for each step |
| Auto-reconnect broken | Checks wallet connection on page load |

---

## Quick Start

1. **Get a private RPC:**
   - Go to https://www.alchemy.com/ (recommended)
   - Create free account
   - Create an "Solana" app
   - Copy the RPC URL

2. **Add to .env.local:**
   ```
   VITE_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
   ```

3. **Deploy:**
   - Add same `VITE_SOLANA_RPC_URL` to Netlify env vars
   - Push to main branch
   - Test in browser

4. **Verify:**
   - Open DevTools Console
   - Connect Phantom
   - Should see: `[SOL] 0 → X SOL`

✅ Done! Balance will now update every 30 seconds.
