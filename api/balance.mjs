/**
 * Vercel serverless balance endpoint — server-side Solana getBalance.
 *
 * Why this exists:
 *   The browser-side @solana/web3.js bundle fails to initialize on some CDNs
 *   (uuid.v4 null bug). This route does the JSON-RPC call from the server
 *   so the page never has to load web3.js just to read SOL balance.
 *
 * The page calls:  GET /api/balance?wallet=<pubkey>
 * Returns:         { ok: true, lamports: <number>, sol: <number> }
 *                  or { ok: false, error: '...' }
 *
 * Env vars (set in Vercel dashboard):
 *   SOLANA_RPC_URL   Mainnet HTTPS URL (Helius, Alchemy, QuickNode...).
 *                    Falls back to public mainnet-beta if unset (rate-limited).
 */

const PUBLIC_FALLBACK = 'https://api.mainnet-beta.solana.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function isValidBase58Pubkey(s) {
  // 32-byte base58 = 32–44 chars, alphabet excludes 0OIl
  return typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const wallet = (req.query?.wallet || '').toString().trim();
  if (!isValidBase58Pubkey(wallet)) {
    return res.status(400).json({ ok: false, error: 'Invalid wallet pubkey' });
  }

  const rpcUrl = (process.env.SOLANA_RPC_URL || PUBLIC_FALLBACK).trim();

  try {
    const r = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [wallet, { commitment: 'confirmed' }],
      }),
    });

    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        error: `RPC HTTP ${r.status}`,
        rpcHost: new URL(rpcUrl).host,
      });
    }

    const data = await r.json().catch(() => null);
    if (!data || data.error) {
      return res.status(502).json({
        ok: false,
        error: data?.error?.message || 'RPC returned no data',
        rpcHost: new URL(rpcUrl).host,
      });
    }

    // Solana getBalance returns { result: { context, value } } where value is lamports
    const raw = data.result;
    let lamports = null;
    if (typeof raw === 'number') lamports = raw;
    else if (raw && typeof raw.value === 'number') lamports = raw.value;
    else if (raw && typeof raw === 'object' && typeof raw === 'string') {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) lamports = n;
    }

    if (lamports == null || !Number.isFinite(lamports) || lamports < 0) {
      return res.status(502).json({
        ok: false,
        error: 'RPC response missing lamports',
        rpcHost: new URL(rpcUrl).host,
      });
    }

    return res.status(200).json({
      ok: true,
      lamports,
      sol: lamports / 1e9,
      rpcHost: new URL(rpcUrl).host,
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err?.message || 'RPC fetch failed',
    });
  }
}
