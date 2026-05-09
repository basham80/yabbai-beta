// YABBAI Universal Phantom Wallet Connection
// Include this script on every page

const YABBAI_MINT = 'AcEVtpLEfxMHFzXQrhJiDhoWCkLVYH3drD2cxNAzLFUv';
const YABBAI_POOL = 'DaxLJ5mRkqWtfhFBKtibtGSYaiE7zFrtgsi5evmVBAax';
const TREASURY   = '8e6ogxfUnj6YXHp1tR4Kj1ytSkmEhLhi2fbKqRVxUHPi';
const RPC        = 'https://api.mainnet-beta.solana.com';
const PUMP_LINK  = 'https://pump.fun/coin/'+YABBAI_MINT;
const DEX_LINK   = 'https://dexscreener.com/solana/'+YABBAI_POOL;

let walletPubkey = null;
let solBalance   = 0;
let yabBalance   = 0;
let solPrice     = 88;
let yabPrice     = 0;

// ── WALLET CONNECTION ────────────────────────────────────
async function connectPhantom() {
  try {
    const provider = getProvider();
    if (!provider) {
      window.open('https://phantom.app/', '_blank');
      return null;
    }
    const resp = await provider.connect();
    walletPubkey = resp.publicKey.toString();
    localStorage.setItem('yabbai_wallet', walletPubkey);
    await fetchBalances();
    renderWalletUI();
    return walletPubkey;
  } catch(e) {
    console.error('Phantom connect failed:', e);
    return null;
  }
}

async function connectSolflare() {
  try {
    if (!window.solflare) {
      window.open('https://solflare.com/', '_blank');
      return null;
    }
    await window.solflare.connect();
    walletPubkey = window.solflare.publicKey.toString();
    localStorage.setItem('yabbai_wallet', walletPubkey);
    await fetchBalances();
    renderWalletUI();
    return walletPubkey;
  } catch(e) {
    console.error('Solflare connect failed:', e);
    return null;
  }
}

function getProvider() {
  if ('phantom' in window) return window.phantom?.solana;
  return window.solana?.isPhantom ? window.solana : null;
}

function disconnectWallet() {
  walletPubkey = null;
  solBalance = 0;
  yabBalance = 0;
  localStorage.removeItem('yabbai_wallet');
  try { getProvider()?.disconnect(); } catch {}
  renderWalletUI();
}

// ── BALANCE FETCH ────────────────────────────────────────
async function fetchBalances() {
  if (!walletPubkey) return;

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
      solBalance = data.result.value / 1e9;
    }
  } catch {}

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
    }
  } catch {}

  // SOL price from Jupiter
  try {
    const res = await fetch(
      'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112'
    );
    const data = await res.json();
    const p = data?.data?.['So11111111111111111111111111111111111111112']?.price;
    if (p) solPrice = parseFloat(p);
  } catch {}

  // YABBAI price from Dexscreener
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/pairs/solana/'+YABBAI_POOL,
      { cache: 'no-cache' }
    );
    const data = await res.json();
    const pair = data?.pair || data?.pairs?.[0];
    if (pair?.priceUsd) yabPrice = parseFloat(pair.priceUsd);
  } catch {}
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
  // Render initial UI
  renderWalletUI();
  renderIncomeCalc();

  // Auto-reconnect if previously connected
  const saved = localStorage.getItem('yabbai_wallet');
  if (saved) {
    const provider = getProvider();
    if (provider?.isConnected) {
      walletPubkey = saved;
      await fetchBalances();
      renderWalletUI();
    }
  }

  // Refresh balances every 60 seconds
  setInterval(async () => {
    if (walletPubkey) {
      await fetchBalances();
      renderWalletUI();
    }
  }, 60000);
});
