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
 * Strongly recommended on IPFS / 4EVERLAND: public mainnet RPC often blocks or rate-limits browser `fetch`,
 * so the wallet chip shows "—" until this is set. Use a free Helius / Alchemy / QuickNode mainnet HTTPS URL.
 * Example: window.YABBAI_SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY';
 */
window.YABBAI_SOLANA_RPC = '';

/**
 * Phantom / wallet note: SOL and SPL balances on this page come from Solana JSON-RPC
 * (`getBalance`, `getParsedTokenAccountsByOwner`), not from the extension UI. Phantom does not
 * grant a separate "token balance permission"; if balances stay blank, set YABBAI_SOLANA_RPC above.
 */
