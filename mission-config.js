/**
 * Static hosts (4EVERLAND, Pages, etc.) only serve files — AI keys run on a Worker.
 *
 * Mission API: from repo root run `npx wrangler deploy` using ./wrangler.toml (Worker name yabbai-mission-api).
 * Then set your deployed URL:
 *
 *   window.YABBAI_MISSION_API = 'https://yabbai-mission-api.<account>.workers.dev';
 *
 * Leave empty to disable AI missions until configured.
 *
 * Payout API (optional): deploy workers/payout (`cd workers/payout && npx wrangler deploy`), add secret
 * TREASURY_SECRET_KEY (must be the keypair for the same **public** receiver users see — default pubkey is `DEFAULT_TREASURY` in `yabbai/index.html`; never commit the secret), then set:
 *
 *   window.YABBAI_PAYOUT_API = 'https://yabbai-payout.<account>.workers.dev';
 *
 * Worker optional plain var `YABBAI_TREASURY_RECEIVER` (wrangler.toml [vars]) should match
 * `window.YABBAI_TREASURY_RECEIVER` here so GET can verify treasuryMatchesEnv.
 */
window.YABBAI_MISSION_API = '/api/mission';

/** Optional: treasury SOL payout Worker URL (HTTPS). Empty disables on-chain withdraw. */
window.YABBAI_PAYOUT_API = '';

/**
 * On-chain deposit receiver (Solana pubkey, base58). Leave empty to use the built-in site treasury in
 * `yabbai/index.html` (`DEFAULT_TREASURY`). Use the same name as server/Worker env `YABBAI_TREASURY_RECEIVER`
 * so ops can grep one string across static + backend configs when overriding.
 * Alias: `window.YABBAI_TREASURY_ADDRESS` (either wins if set).
 * Optional HTML: `<meta name="yabbai-treasury-receiver" content="YourPubkey...">` in `index.html`
 * overrides both (useful for forks / host-specific injects).
 */
window.YABBAI_TREASURY_RECEIVER = '';
window.YABBAI_TREASURY_ADDRESS = '';

/**
 * Extra SPL mints (comma-separated base58) to show balances for in the wallet chip (RPC read only).
 * The $YABBAI mint is always watched. Users can add more from the Deposit tab ("paste mint").
 * The same list is summarized (truncated) to the YABBAI AI Brain when MISSION_API is set — helps the model
 * reason about holdings the user asked to track, without moving keys or signing.
 */
window.YABBAI_SPL_WATCHLIST = '';

/**
 * SPL transfers from this static page are not built in-app (no @solana/spl-token bundle): users
 * send SPL via Phantom/Solflare to the treasury pubkey; SOL deposits use wallet-signed SystemProgram.transfer.
 */

/**
 * **Mainnet only** (Solana mainnet-beta). Must be `https://` and must not be devnet/testnet/local —
 * the app ignores non-mainnet URLs so a wallet switched to devnet cannot poison balance/deposit RPC.
 *
 * If unset, the page cycles public mainnet mirrors (PublicNode, Ankr, dRPC, …). Official
 * `https://api.mainnet-beta.solana.com` is often **rate-limited** from browsers and static/IPFS hosts;
 * responses may be blocked by CORS from some gateways — that is why the Live Engine may log
 * intermittent "Balance fetch failed" until you set a dedicated endpoint below.
 *
 * **Reliable balance (pick one):**
 * - Helius (example): `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`
 * - Alchemy / QuickNode: Solana **mainnet** HTTPS URL from the provider dashboard.
 *
 * Same variable is used for `Connection` in balance, SPL reads, and SOL deposits (`yabbai/index.html`).
 */
window.YABBAI_SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=ef97adf5-e2b0-4870-a115-7d979424d895';

/**
 * **Preferred path for reliable SOL balance** when set: the page calls this Worker first (GET), then falls back to browser RPC.
 * Cloudflare Worker + D1: `workers/balance-api`. Deploy (`npx wrangler deploy` in that folder), then set base URL (trailing slash optional).
 * GET /balance?wallet=<pubkey> returns { ok, lamports, sol } using server-side mainnet RPC + cache.
 * Example: window.YABBAI_BALANCE_API = 'https://yabbai-balance-api.<account>.workers.dev';
 *
 * Empty string `''` means **no Worker** — balance uses `YABBAI_SOLANA_RPC` if set, else rotating public mainnet HTTPS endpoints (often rate-limited / CORS from static hosts). First balance fetch logs a **one-time** browser console tip when this stays empty.
 * Set this URL before pinning static/IPFS builds if the Live Engine should not depend on public browser RPC alone.
 */
window.YABBAI_BALANCE_API = '/api';

/**
 * Phantom / wallet note: SOL and SPL balances on this page use Solana JSON-RPC and/or YABBAI_BALANCE_API,
 * not the extension’s internal display. If the chip is wrong, set YABBAI_BALANCE_API (Worker) and/or YABBAI_SOLANA_RPC.
 * Balance does not depend on Sign Message (SIWS): `connect()` exposes the pubkey; SIWS is optional off-chain proof only.
 */
