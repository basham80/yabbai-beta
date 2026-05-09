/**
 * Cloudflare Worker — deploy separately; point yabbai/mission-config.js at this URL.
 *
 * wrangler.toml + secrets:
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler secret put MOONSHOT_API_KEY
 *
 * Optional vars (wrangler.toml [vars]):
 *   ANTHROPIC_MODEL, MOONSHOT_MODEL, MOONSHOT_API_BASE
 */

import { handleFetch } from '../api/mission-logic.mjs';

export default {
  async fetch(request, env, ctx) {
    return handleFetch(env, request);
  },
};
