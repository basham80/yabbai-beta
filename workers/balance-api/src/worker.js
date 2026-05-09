/**
 * Cloudflare Worker: server-side getBalance + optional D1 cache.
 * GET /balance?wallet=<base58> returns JSON.
 * GET / and GET /index.html return HTML (same content as public/index.html).
 */
const CACHE_TTL_SEC = 45;

const HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YABBAI Balance API</title>
<style>
body{font-family:system-ui,sans-serif;background:#0a0f1c;color:#e8f4ff;margin:0;padding:2rem;line-height:1.6;max-width:560px;}
code{background:#162030;padding:2px 8px;border-radius:4px;font-size:0.88em;}
a{color:#14F195;}
h1{font-size:1.25rem;}
</style>
</head>
<body>
  <h1>YABBAI balance API (Worker)</h1>
  <p>This URL is the <strong>backend</strong> for wallet SOL reads — not the main YABBAI site.</p>
  <p>Open your static hub at <a href="https://github.com/basham80/yabbai-beta">the repo</a> / your IPFS domain.</p>
  <p>JSON API: <code>GET /balance?wallet=&lt;Solana_pubkey&gt;</code></p>
</body>
</html>`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function htmlPage() {
  return new Response(HOME_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function parseLamports(result) {
  if (result == null) return null;
  if (typeof result === 'number' && Number.isFinite(result)) return Math.floor(result);
  if (typeof result === 'object' && result.value != null) {
    const v = result.value;
    if (typeof v === 'number') return Math.floor(v);
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (request.method === 'GET' && (path === '/' || path === '/index.html')) {
      return htmlPage();
    }

    if (request.method === 'GET' && (path === '/balance' || path.endsWith('/balance'))) {
      const wallet = (url.searchParams.get('wallet') || '').trim();
      if (!wallet) return json(400, { ok: false, error: 'missing_wallet' });

      const rpc = (env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com').trim();
      const now = Math.floor(Date.now() / 1000);

      if (env.DB) {
        try {
          const row = await env.DB.prepare(
            'SELECT lamports, updated_at FROM balance_cache WHERE wallet = ?',
          )
            .bind(wallet)
            .first();
          if (row && now - Number(row.updated_at) < CACHE_TTL_SEC) {
            const lamports = Number(row.lamports);
            return json(200, {
              ok: true,
              wallet,
              lamports,
              sol: lamports / 1e9,
              source: 'd1_cache',
              cached_at: row.updated_at,
            });
          }
        } catch (e) {
          console.warn('[balance-api] cache read', e);
        }
      }

      try {
        const body = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [wallet, { commitment: 'confirmed' }],
        });
        const r = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const d = await r.json();
        if (d.error) {
          return json(502, { ok: false, error: 'rpc_error', detail: d.error });
        }
        const lamports = parseLamports(d.result);
        if (lamports == null || lamports < 0) {
          return json(502, { ok: false, error: 'bad_rpc_response' });
        }

        if (env.DB) {
          try {
            await env.DB.prepare(
              `INSERT INTO balance_cache (wallet, lamports, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(wallet) DO UPDATE SET
                 lamports = excluded.lamports,
                 updated_at = excluded.updated_at`,
            )
              .bind(wallet, lamports, now)
              .run();
          } catch (e) {
            console.warn('[balance-api] cache write', e);
          }
        }

        return json(200, {
          ok: true,
          wallet,
          lamports,
          sol: lamports / 1e9,
          source: 'rpc',
        });
      } catch (e) {
        return json(502, { ok: false, error: String(e?.message || e) });
      }
    }

    return json(404, { ok: false, error: 'not_found' });
  },
};
