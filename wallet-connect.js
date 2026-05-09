// YABBAI Universal Phantom Wallet Connection
// Include this script on every page

// ── BROWSER POLYFILLS ────────────────────────────────────
// Ensure global context exists
if (typeof global === 'undefined') window.global = window;

// Load Buffer polyfill for @solana/web3.js
if (!globalThis.Buffer) {
  try {
    // Attempt dynamic import of buffer module
    import('https://cdn.jsdelivr.net/npm/buffer@6.0.3/+esm').then(mod => {
      globalThis.Buffer = mod.Buffer;
      console.log('[INIT] Buffer polyfill loaded from CDN');
    }).catch(e => {
      console.warn('[INIT] Buffer polyfill failed to load — some @solana/web3.js features may not work', e);
    });
  } catch (e) {
    console.warn('[INIT] Buffer polyfill import error:', e);
  }
}

const YABBAI_MINT = 'AcEVtpLEfxMHFzXQrhJiDhoWCkLVYH3drD2cxNAzLFUv';
const YABBAI_POOL = 'DaxLJ5mRkqWtfhFBKtibtGSYaiE7zFrtgsi5evmVBAax';
const TREASURY   = '2DarZ9hCi5PirKsDsnriewZEGqaz6Q11pEitoZJxBsYM';

// ── DYNAMIC RPC URL (AVOIDS RATE LIMITING) ───────────────
// Try environment variables first, fallback to public RPC
const getRpcUrl = () => {
  // For Vite/modern bundlers
  try {
    if (typeof import?.meta?.env?.VITE_SOLANA_RPC_URL !== 'undefined') {
      const url = import.meta.env.VITE_SOLANA_RPC_URL;
      if (url && url.trim()) {
        console.log('[INIT] Using private RPC from VITE_SOLANA_RPC_URL');
        return url;
      }
    }
  } catch (e) { /* ignore */ }
  
  // For Node/process environments
  if (typeof process !== 'undefined' && process.env?.VITE_SOLANA_RPC_URL) {
    console.log('[INIT] Using private RPC from process.env.VITE_SOLANA_RPC_URL');
    return process.env.VITE_SOLANA_RPC_URL;
  }
  
  // Check window global (for runtime injection)
  if (window.VITE_SOLANA_RPC_URL) {
    console.log('[INIT] Using private RPC from window.VITE_SOLANA_RPC_URL');
    return window.VITE_SOLANA_RPC_URL;
  }
  
  // Fallback to public RPC
  console.warn('[INIT] ⚠️ No private RPC configured — using public RPC (rate-limit risk). Set VITE_SOLANA_RPC_URL to optimize.');
  return 'https://api.mainnet-beta.solana.com';
};

const RPC = getRpcUrl();
const PUMP_LINK  = 'https://pump.fun/coin/'+YABBAI_MINT;
const DEX_LINK   = 'https://dexscreener.com/solana/'+YABBAI_POOL;

let walletPubkey = null;
let solBalance   = 0;
let yabBalance   = 0;
let solPrice     = 88;
let yabPrice     = 0;
let balanceRefreshInterval = null;

// ── WALLET CONNECTION ────────────────────────────────────
async function connectPhantom() {
  try {
    const provider = getProvider();
    if (!provider) {
      console.log('[PHANTOM] Phantom not found, opening install page');
      window.open('https://phantom.app/', '_blank');
      return null;
    }
    const resp = await provider.connect();
    walletPubkey = resp.publicKey.toString();
    console.log('[PHANTOM] ✓ Connected:', walletPubkey);
    localStorage.setItem('yabbai_wallet', walletPubkey);
    
    // Immediately fetch balances
    await fetchBalances();
    renderWalletUI();
    
    // Start balance refresh loop
    startBalanceRefresh();
    
    return walletPubkey;
  } catch(e) {
    console.error('[PHANTOM] Connection failed:', e);
    return null;
  }
}

async function connectSolflare() {
  try {
    if (!window.solflare) {
      console.log('[SOLFLARE] Solflare not found, opening install page');
      window.open('https://solflare.com/', '_blank');
      return null;
    }
    await window.solflare.connect();
    walletPubkey = window.solflare.publicKey.toString();
    console.log('[SOLFLARE] ✓ Connected:', walletPubkey);
    localStorage.setItem('yabbai_wallet', walletPubkey);
    
    await fetchBalances();
    renderWalletUI();
    
    // Start balance refresh loop
    startBalanceRefresh();
    
    return walletPubkey;
  } catch(e) {
    console.error('[SOLFLARE] Connection failed:', e);
    return null;
  }
}

function getProvider() {
  if ('phantom' in window) return window.phantom?.solana;
  return window.solana?.isPhantom ? window.solana : null;
}

function disconnectWallet() {
  console.log('[WALLET] Disconnecting...');
  walletPubkey = null;
  solBalance = 0;
  yabBalance = 0;
  localStorage.removeItem('yabbai_wallet');
  try { getProvider()?.disconnect(); } catch {}
  
  // Stop balance refresh
  if (balanceRefreshInterval) {
    clearInterval(balanceRefreshInterval);
    balanceRefreshInterval = null;
  }
  
  renderWalletUI();
}

// ── BALANCE SYNC (CRITICAL FOR LIVE UPDATES) ─────────────
function startBalanceRefresh() {
  // Clear existing interval to prevent duplicates
  if (balanceRefreshInterval) clearInterval(balanceRefreshInterval);
  
  console.log('[BALANCE] Starting refresh loop (30s interval)');
  
  // Refresh every 30 seconds
  balanceRefreshInterval = setInterval(async () => {
    if (walletPubkey) {
      try {
        await fetchBalances();
        renderWalletUI();
      } catch (e) {
        console.error('[BALANCE] Refresh failed:', e);
      }
    }
  }, 30000);
}

// ── BALANCE FETCH ────────────────────────────────────────
async function fetchBalances() {
  if (!walletPubkey) {
    console.warn('[BALANCE] No wallet connected');
    return;
  }

  console.log('[BALANCE] Fetching for', walletPubkey.slice(0, 8) + '...');

  // SOL balance via RPC
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getBalance',
        params: [walletPubkey],
      }),
    });
    const data = await res.json();
    if (data.result?.value !== undefined) {
      const oldBalance = solBalance;
      solBalance = data.result.value / 1000000000; // 1 SOL = 1,000,000,000 lamports
      console.log(`[SOL] ${oldBalance.toFixed(4)} → ${solBalance.toFixed(4)} SOL (${data.result.value} lamports)`);
    } else if (data.error) {
      console.error('[SOL] RPC error:', data.error);
    }
  } catch (e) {
    console.error('[SOL] Fetch failed:', e.message);
  }

  // $YABBAI token balance
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2,
        method: 'getTokenAccountsByOwner',
        params: [
          walletPubkey,
          { mint: YABBAI_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
    });
    const data = await res.json();
    const accounts = data.result?.value || [];
    if (accounts.length > 0) {
      yabBalance = parseFloat(
        accounts[0].account.data.parsed.info.tokenAmount.uiAmount || 0
      );
      console.log(`[$YABBAI] ${yabBalance.toLocaleString()} tokens`);
    } else {
      console.log(`[$YABBAI] 0 tokens (no accounts found)`);
    }
  } catch (e) {
    console.error('[$YABBAI] Fetch failed:', e.message);
  }

  // SOL price from Jupiter
  try {
    const res = await fetch(
      'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112'
    );
    const data = await res.json();
    const p = data?.data?.['So11111111111111111111111111111111111111112']?.price;
    if (p) {
      solPrice = parseFloat(p);
      console.log(`[PRICE] SOL = $${solPrice.toFixed(2)} AUD`);
    }
  } catch (e) {
    console.error('[PRICE] SOL fetch failed:', e.message);
  }

  // YABBAI price from Dexscreener
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/pairs/solana/'+YABBAI_POOL,
      { cache: 'no-cache' }
    );
    const data = await res.json();
    const pair = data?.pair || data?.pairs?.[0];
    if (pair?.priceUsd) {
      yabPrice = parseFloat(pair.priceUsd);
      console.log(`[PRICE] $YABBAI = $${yabPrice.toFixed(8)} AUD`);
    }
  } catch (e) {
    console.error('[PRICE] $YABBAI fetch failed:', e.message);
  }
}

// ── INCOME CALCULATOR ────────────────────────────────────
function calcIncome(audAmount) {
  const solAmt     = audAmount / (solPrice * 1.1);
  const newMcap    = 313 + (solAmt * solPrice * 800);
  const toGrad     = Math.max(0, 69000 - newMcap);
  const curveMove  = Math.min(100, (newMcap / 69000) * 100).toFixed(1);
  const yabBought  = yabPrice > 0 ? (audAmount / 1.1 / yabPrice).toFixed(0) : '—';
  return { solAmt: solAmt.toFixed(3), newMcap, toGrad, curveMove, yabBought };
}

// ── UI RENDERING ─────────────────────────────────────────
function shortAddr(addr) {
  return addr ? addr.slice(0,6)+'...'+addr.slice(-4) : '';
}
function fmtSol(n)  { return n.toFixed(4) + ' SOL'; }
function fmtUSD(n)  { return '$' + (n * solPrice).toFixed(2); }
function fmtYab(n)  { return n > 0 ? n.toLocaleString() + ' $YABBAI' : '—'; }

function renderWalletUI() {
  const panel = document.getElementById('yabbai-wallet-panel');
  if (!panel) return;

  if (!walletPubkey) {
    panel.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button onclick="connectPhantom()" style="${btnStyle('#9945FF')}">
          👻 Connect Phantom
        </button>
        <button onclick="connectSolflare()" style="${btnStyle('#FC8423')}">
          🔆 Connect Solflare
        </button>
      </div>`;
    return;
  }

  const solUSD  = (solBalance * solPrice).toFixed(2);
  const yabUSD  = yabPrice > 0 ? (yabBalance * yabPrice).toFixed(4) : '—';
  const lowBal  = solBalance < 0.01;

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div style="background:rgba(20,241,149,0.08);border:1px solid rgba(20,241,149,0.2);
        border-radius:8px;padding:8px 14px;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:10px;color:#4a6080;letter-spacing:0.08em;text-transform:uppercase">
          Connected</span>
        <span style="font-size:12px;font-family:monospace;color:#14F195">${shortAddr(walletPubkey)}</span>
        <span style="font-size:11px;color:#888">${fmtSol(solBalance)} · $${solUSD}</span>
        ${yabBalance > 0 ? `<span style="font-size:11px;color:#9945FF">${fmtYab(yabBalance)}</span>` : ''}
      </div>
      ${lowBal ? `
        <div style="background:rgba(255,200,0,0.08);border:1px solid rgba(255,200,0,0.2);
          border-radius:8px;padding:8px 14px;font-size:12px;color:#ffc200;max-width:220px">
          ⚡ Low balance — even $8 AUD in SOL gets you started
          <br><a href="${PUMP_LINK}" target="_blank" 
            style="color:#14F195;text-decoration:none;font-size:11px">Buy $YABBAI →</a>
        </div>` : `
        <a href="${PUMP_LINK}" target="_blank" style="${btnStyle('#14F195')}">
          🦞 Buy $YABBAI
        </a>`}
      <button onclick="disconnectWallet()" 
        style="background:transparent;border:1px solid #333;border-radius:6px;
        padding:7px 12px;color:#666;font-size:11px;cursor:pointer">
        Disconnect
      </button>
    </div>`;

  // Also update income calc if it exists
  renderIncomeCalc();
}

function btnStyle(color) {
  return `background:${color}20;border:1px solid ${color}50;border-radius:6px;
    padding:8px 16px;color:${color};font-size:12px;cursor:pointer;
    font-family:monospace;letter-spacing:0.05em;white-space:nowrap`;
}

function renderIncomeCalc() {
  const calc = document.getElementById('yabbai-income-calc');
  if (!calc) return;

  const amounts = [8, 50, 100, 500, 1000];
  const rows = amounts.map(aud => {
    const r = calcIncome(aud);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;
      border-bottom:1px solid rgba(255,255,255,0.05);flex-wrap:wrap">
      <span style="color:#f0f0f0;font-weight:500;min-width:70px">$${aud} AUD</span>
      <span style="color:#888;font-size:12px;min-width:80px">${r.solAmt} SOL</span>
      <span style="color:#9945FF;font-size:12px;min-width:100px">~${r.yabBought} $YABBAI</span>
      <span style="color:#ffc200;font-size:12px;min-width:80px">Curve: ${r.curveMove}%</span>
      <span style="color:${r.toGrad < 1000 ? '#14F195' : '#888'};font-size:12px">
        ${r.toGrad < 1 ? '🎓 Graduate!' : '$'+Math.round(r.toGrad).toLocaleString()+' to grad'}</span>
    </div>`;
  }).join('');

  calc.innerHTML = `
    <div style="font-size:11px;color:#4a6080;letter-spacing:0.08em;
      text-transform:uppercase;margin-bottom:12px">
      Income Calculator — What Can You Do Right Now?
    </div>
    <div style="font-size:11px;color:#4a6080;margin-bottom:12px;display:flex;gap:16px">
      <span>Amount</span><span style="margin-left:16px">SOL</span>
      <span style="margin-left:16px">$YABBAI</span>
      <span style="margin-left:8px">Curve move</span>
    </div>
    ${rows}
    <div style="margin-top:14px;padding:12px;background:rgba(20,241,149,0.05);
      border:1px solid rgba(20,241,149,0.15);border-radius:8px;
      font-size:12px;color:#888;line-height:1.7">
      💡 After Raydium graduation: LP fees generate yield automatically.<br>
      Autopayout fires $50 AUD to PayPal every $110 earned or 30 minutes.
    </div>`;
}

// ── AUTO-INIT ────────────────────────────────────────────
window.addEventListener('load', async () => {
  console.log('[INIT] Page loaded, initializing wallet');
  
  // Render initial UI
  renderWalletUI();
  renderIncomeCalc();

  // Auto-reconnect if previously connected
  const saved = localStorage.getItem('yabbai_wallet');
  if (saved) {
    const provider = getProvider();
    if (provider?.isConnected) {
      console.log('[INIT] Auto-reconnecting to saved wallet:', saved.slice(0, 8) + '...');
      walletPubkey = saved;
      await fetchBalances();
      renderWalletUI();
      startBalanceRefresh();
    }
  }
});
