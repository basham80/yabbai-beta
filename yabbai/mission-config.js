/**
 * 4EVERLAND serves static files only — AI keys live on a separate API (Worker/Vercel/etc.).
 *
 * After deploying the Cloudflare Worker (see workers/wrangler.toml), set your Worker URL:
 *
 *   window.YABBAI_MISSION_API = 'https://yabbai-mission-api.<your-subdomain>.workers.dev';
 *
 * Leave empty to disable AI calls until configured.
 */
window.YABBAI_MISSION_API = '';

/** Optional: POST JSON { wallet, amountSol } — Worker signs treasury → wallet payout */
window.YABBAI_PAYOUT_API = '';
