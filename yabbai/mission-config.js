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
 * TREASURY_SECRET_KEY (must be the keypair for this same **public** receiver), then set:
 *
 *   window.YABBAI_PAYOUT_API = 'https://yabbai-payout.<account>.workers.dev';
 *
 * Worker optional plain var `YABBAI_TREASURY_RECEIVER` (wrangler.toml [vars]) should match
 * `window.YABBAI_TREASURY_RECEIVER` here so GET can verify treasuryMatchesEnv.
 */
window.YABBAI_MISSION_API = '';

/** Optional: treasury SOL payout Worker URL (HTTPS). Empty disables on-chain withdraw. */
window.YABBAI_PAYOUT_API = '';

/**
 * On-chain deposit receiver (Solana pubkey, base58). Use the same name as server/Worker env
 * `YABBAI_TREASURY_RECEIVER` so ops can grep one string across static + backend configs.
 * Alias: `window.YABBAI_TREASURY_ADDRESS` (either wins if set).
 * Optional HTML: `<meta name="yabbai-treasury-receiver" content="YourPubkey...">` in `index.html`
 * overrides both (useful for host-specific injects).
 */
window.YABBAI_TREASURY_RECEIVER = '';
window.YABBAI_TREASURY_ADDRESS = '';

/**
 * Extra SPL mints (comma-separated base58) to show balances for in the wallet chip (RPC read only).
 * The $YABBAI mint is always watched. Users can add more from the Deposit tab ("paste mint").
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
 * If unset, the page tries `https://api.mainnet-beta.solana.com` first, then public mainnet mirrors
 * (browser/IPFS often hits rate limits — chip may show "—" until you set a private RPC).
 *
 * Helius (example — use your key): `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`
 * Alchemy / QuickNode: use their Solana **mainnet** HTTPS endpoint from the dashboard.
 */
window.YABBAI_SOLANA_RPC = '';

/**
 * Optional: Cloudflare Worker + D1 balance API (`workers/balance-api`). Deploy then set base URL (no trailing slash needed).
 * GET /balance?wallet=<pubkey> returns { ok, lamports, sol } using server-side RPC + SQLite cache.
 * Example: window.YABBAI_BALANCE_API = 'https://yabbai-balance-api.<account>.workers.dev';
 *
 * IPFS / static-only hosts: leave this empty and the page relies on browser → public Solana RPC (often rate-limited).
 * Set this Worker URL **before** pinning to IPFS if users should see reliable SOL without a private YABBAI_SOLANA_RPC.
 */
window.YABBAI_BALANCE_API = '';

/**
 * Phantom / wallet note: SOL and SPL balances on this page use Solana JSON-RPC and/or YABBAI_BALANCE_API,
 * not the extension’s internal display. If the chip is wrong, set YABBAI_BALANCE_API (Worker) and/or YABBAI_SOLANA_RPC.
 * Balance does not depend on Sign Message (SIWS): `connect()` exposes the pubkey; SIWS is optional off-chain proof only.
 */
