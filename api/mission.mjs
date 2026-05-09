/**
 * Vercel serverless function — AI mission proxy.
 * Shared logic lives in /lib/mission-logic.mjs (also used by Netlify Functions and Cloudflare Workers).
 *
 * Set the same env vars you would on any other host:
 *   ANTHROPIC_API_KEY   (required for Claude)
 *   MOONSHOT_API_KEY    (required for Kimi/Moonshot)
 *   ANTHROPIC_MODEL     (optional override, default: claude-sonnet-4-20250514)
 *   MOONSHOT_MODEL      (optional override, default: moonshot-v1-8k)
 *   MOONSHOT_API_BASE   (optional override, default: https://api.moonshot.cn/v1)
 *
 * Endpoint mounts at:  /api/mission
 *   GET  → status + key configuration
 *   POST → { prompt, system?, modelChoice? }  →  { text, provider, model, route }
 */

import { dispatchMission, keysStatus, corsHeaders } from '../lib/mission-logic.mjs';

export default async function handler(req, res) {
  // CORS preflight
  for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ ok: true, ...keysStatus(process.env) });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Vercel parses JSON automatically when content-type is application/json,
  // but we defensively parse strings too in case of edge cases.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }
  body = body || {};

  try {
    const out = await dispatchMission(process.env, body);
    res.status(200).json(out);
  } catch (err) {
    const code = err.statusCode || 502;
    const status = code >= 400 && code < 600 ? code : 502;
    res.status(status).json({ error: err.message || 'AI request failed' });
  }
}
