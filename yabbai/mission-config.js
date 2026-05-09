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
 * TREASURY_SECRET_KEY, then set:
 *
 *   window.YABBAI_PAYOUT_API = 'https://yabbai-payout.<account>.workers.dev';
 */
window.YABBAI_MISSION_API = '';

/** Optional: treasury SOL payout Worker URL (HTTPS). Empty disables on-chain withdraw. */
window.YABBAI_PAYOUT_API = '';

/** Optional: dedicated Solana RPC for balance + deposits (recommended — public RPC rate-limits browsers). */
window.YABBAI_SOLANA_RPC = '';
