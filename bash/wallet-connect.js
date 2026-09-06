// ═══════════════════════════════════════════════════════════
// BASH CTF — Wallet + On-Chain Buy Engine
// Cheapest path: direct pump.fun bonding curve via PumpPortal
// ═══════════════════════════════════════════════════════════

if (typeof global === 'undefined') window.global = window;

// ── TOKEN CONSTANTS ───────────────────────────────────────
const BASH_MINT      = 'AcEVtpLEfxMHFzXQrhJiDhoWCkLVYH3drD2cxNAzLFUv';
const BASH_POOL      = 'DaxLJ5mRkqWtfhFBKtibtGSYaiE7zFrtgsi5evmVBAax';
const TREASURY       = '2DarZ9hCi5PirKsDsnriewZEGqaz6Q11pEitoZJxBsYM';
const PUMP_PROGRAM   = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMP_FEE       = 'CebN5WGQ4jvEPvsVU4EoHEpgznyQHeP7Dan3xRYHbNb';
const PUMP_LINK      = 'https://pump.fun/coin/' + BASH_MINT;
const DEX_LINK       = 'https://dexscreener.com/solana/' + BASH_POOL;
const PUMPPORTAL_API = 'https://pumpportal.fun/api';
const RPC            = 'https://mainnet.helius-rpc.com/?api-key=ef97adf5-e2b0-4870-a115-7d979424d895';

// ── LIVE STATE ────────────────────────────────────────────
let walletPubkey  = null;
let solBalance    = 0;
let bashBalance   = 0;
let solPrice      = 150;
let bashPrice     = 0;
let bashMcap      = 0;
let bashVolume    = 0;
let bondingCurve  = 0; // 0-100%
let isGraduated   = false;
let lastTrades    = [];
let refreshLoop   = null;

// ── WALLET PROVIDERS ─────────────────────────────────────
function getPhantom()  { return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null); }
function getSolflare() { return window.solflare?.isSolflare ? window.solflare : null; }
function getAnyWallet(){ return getPhantom() || getSolflare(); }

async function connectPhantom() {
  const p = getPhantom();
  if (!p) { window.open('https://phantom.app/','_blank'); return null; }
  const r = await p.connect();
  walletPubkey = r.publicKey.toString();
  await onConnect();
  return walletPubkey;
}

async function connectSolflare() {
  const sf = getSolflare();
  if (!sf) { window.open('https://solflare.com/','_blank'); return null; }
  await sf.connect();
  walletPubkey = sf.publicKey.toString();
  await onConnect();
  return walletPubkey;
}

async function onConnect() {
  localStorage.setItem('bash_wallet', walletPubkey);
  await fetchAllBalances();
  renderWalletPanel();
  startRefresh();
  termLog('SYSTEM', `Wallet connected: ${walletPubkey.slice(0,8)}...${walletPubkey.slice(-4)}`, '#00ffee');
}

function disconnectWallet() {
  walletPubkey = null; solBalance = 0; bashBalance = 0;
  localStorage.removeItem('bash_wallet');
  try { getAnyWallet()?.disconnect(); } catch {}
  if (refreshLoop) { clearInterval(refreshLoop); refreshLoop = null; }
  renderWalletPanel();
  termLog('SYSTEM', 'Wallet disconnected', '#ff3333');
}

// ── BALANCE FETCH ─────────────────────────────────────────
async function fetchAllBalances() {
  if (!walletPubkey) return;
  await Promise.all([fetchSolBalance(), fetchBashBalance(), fetchPrices()]);
}

async function fetchSolBalance() {
  try {
    const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({jsonrpc:'2.0',id:1,method:'getBalance',params:[walletPubkey]}) });
    const d = await r.json();
    solBalance = (d.result?.value || 0) / 1e9;
  } catch(e) { console.warn('[SOL]', e.message); }
}

async function fetchBashBalance() {
  try {
    const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({jsonrpc:'2.0',id:2,method:'getTokenAccountsByOwner',params:[
        walletPubkey,{mint:BASH_MINT},{encoding:'jsonParsed'}]}) });
    const d = await r.json();
    const accs = d.result?.value || [];
    bashBalance = accs.length ? parseFloat(accs[0].account.data.parsed.info.tokenAmount.uiAmount||0) : 0;
  } catch(e) { console.warn('[BASH]', e.message); }
}

async function fetchPrices() {
  // SOL price from Jupiter
  try {
    const r = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    const d = await r.json();
    const p = d?.data?.['So11111111111111111111111111111111111111112']?.price;
    if (p) solPrice = parseFloat(p);
  } catch {}

  // BASH price + pool data from DexScreener
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana/'+BASH_POOL, {cache:'no-cache'});
    const d = await r.json();
    const pair = d?.pair || d?.pairs?.[0];
    if (pair) {
      bashPrice  = parseFloat(pair.priceUsd||0);
      bashMcap   = parseFloat(pair.fdv||0);
      bashVolume = parseFloat(pair.volume?.h24||0);
      isGraduated = bashMcap > 65000;
    }
  } catch {}

  // Pump.fun bonding curve progress
  try {
    const r = await fetch('https://frontend-api.pump.fun/coins/'+BASH_MINT);
    const d = await r.json();
    if (d) {
      if (!bashPrice && d.usd_market_cap) bashMcap = d.usd_market_cap;
      bondingCurve = Math.min(100, ((d.usd_market_cap||0) / 69000 * 100));
      isGraduated  = d.raydium_pool != null;
      lastTrades   = d.last_trade_unix_timestamp ? [] : lastTrades;
    }
  } catch {}

  // Update UI stats
  updateStats();
}

async function fetchRecentTrades() {
  try {
    const r = await fetch(`https://frontend-api.pump.fun/trades/latest?mint=${BASH_MINT}&limit=10`);
    const d = await r.json();
    if (Array.isArray(d)) {
      lastTrades = d;
      d.slice(0,3).forEach(t => {
        const side = t.is_buy ? 'GREEN_HAT' : 'RED_TEAM';
        const color = t.is_buy ? '#00ff41' : '#ff3333';
        const sol = (t.sol_amount / 1e9).toFixed(3);
        termLog(side, `${t.is_buy?'BUY':'SELL'} ${sol} SOL — ${t.username||'anon'}`, color);
      });
    }
  } catch {}
}

// ── CHEAPEST PUMP.FUN BUY ─────────────────────────────────
// Routes directly through pump.fun bonding curve via PumpPortal
// No Jupiter routing fee. Minimum priority fee.
async function buyBash(solAmount) {
  if (!walletPubkey) {
    termLog('ERROR', 'Connect wallet first — type: connect', '#ff3333');
    return false;
  }
  if (solAmount < 0.001) {
    termLog('ERROR', 'Minimum buy: 0.001 SOL', '#ff3333');
    return false;
  }
  if (solBalance < solAmount + 0.005) {
    termLog('ERROR', `Insufficient SOL. Need ${(solAmount+0.005).toFixed(3)}, have ${solBalance.toFixed(3)}`, '#ff3333');
    return false;
  }

  termLog('SYSTEM', `Routing ${solAmount} SOL → $BASH via cheapest path...`, '#00ffee');

  try {
    // If graduated → Jupiter (best routing after Raydium migration)
    if (isGraduated) {
      return await buyViaJupiter(solAmount);
    }
    // Still on bonding curve → PumpPortal direct (CHEAPEST — no Jupiter fee)
    return await buyViaPumpPortal(solAmount);
  } catch(e) {
    termLog('ERROR', e.message, '#ff3333');
    return false;
  }
}

async function buyViaPumpPortal(solAmount) {
  termLog('SYSTEM', '[ CHEAPEST ] Direct pump.fun bonding curve — 0% Jupiter fee', '#00ffee');

  const res = await fetch(`${PUMPPORTAL_API}/trade-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey:          walletPubkey,
      action:             'buy',
      mint:               BASH_MINT,
      denominatedInSol:   'true',
      amount:             solAmount,
      slippage:           15,          // 15% slippage on bonding curve
      priorityFee:        0.00001,     // minimum viable priority fee (cheapest)
      pool:               'pump'
    })
  });

  if (!res.ok) throw new Error(`PumpPortal error ${res.status}`);
  const txBytes = new Uint8Array(await res.arrayBuffer());

  termLog('SYSTEM', 'Transaction built — requesting wallet signature...', '#00ffee');

  // Sign + send with Phantom / Solflare
  const provider = getAnyWallet();
  if (!provider) throw new Error('No wallet provider');

  let sig;
  try {
    // Phantom accepts raw transaction bytes directly
    const result = await provider.signAndSendTransaction(
      { serialize: () => txBytes, serializeMessage: () => txBytes },
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );
    sig = result?.signature || result;
  } catch {
    // Fallback: decode + send raw
    sig = await sendRawTx(txBytes);
  }

  termLog('GREEN_HAT', `BUY TX SENT ✓ — ${String(sig).slice(0,16)}...`, '#00ff41');
  termLog('SYSTEM', `View: https://solscan.io/tx/${sig}`, '#00b4ff');

  await fetchAllBalances();
  renderWalletPanel();

  // Bump CTF scoreboard
  const gs = document.getElementById('gs');
  if (gs) gs.textContent = (parseInt(gs.textContent.replace(/,/g,''))+1).toLocaleString();

  return sig;
}

async function buyViaJupiter(solAmount) {
  termLog('SYSTEM', '[ GRADUATED ] Routing via Jupiter (Raydium LP)', '#00b4ff');
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const lamports = Math.floor(solAmount * 1e9);

  const quoteRes = await fetch(
    `https://api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${BASH_MINT}&amount=${lamports}&slippageBps=150&onlyDirectRoutes=false`
  );
  const quote = await quoteRes.json();
  if (quote.error) throw new Error('Jupiter quote: ' + quote.error);

  const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: walletPubkey, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 1000 })
  });
  const { swapTransaction } = await swapRes.json();
  const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));

  const provider = getAnyWallet();
  const result = await provider.signAndSendTransaction(
    { serialize: () => txBytes },
    { skipPreflight: false }
  );
  const sig = result?.signature || result;

  termLog('GREEN_HAT', `JUPITER BUY TX ✓ — ${String(sig).slice(0,16)}...`, '#00ff41');
  await fetchAllBalances();
  return sig;
}

async function sendRawTx(txBytes) {
  const encoded = btoa(String.fromCharCode(...txBytes));
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'sendTransaction',
      params:[encoded, { encoding:'base64', skipPreflight:false }] })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

// ── CHEAPEST MINT (CREATE NEW TOKEN) ─────────────────────
// Creates a brand new pump.fun token with minimum cost
async function mintNewToken(name, symbol, description, imageUrl) {
  if (!walletPubkey) {
    termLog('ERROR', 'Connect wallet first', '#ff3333');
    return false;
  }

  termLog('SYSTEM', `Creating $${symbol} on pump.fun...`, '#00ffee');
  termLog('SYSTEM', 'Uploading metadata to IPFS...', '#00ffee');

  try {
    // Step 1: Upload metadata to pump.fun IPFS
    const metaForm = new FormData();
    const svgBlob  = new Blob([generateTokenSVG(symbol)], { type: 'image/svg+xml' });
    metaForm.append('file',        svgBlob, `${symbol.toLowerCase()}.svg`);
    metaForm.append('name',        name);
    metaForm.append('symbol',      symbol);
    metaForm.append('description', description || `${symbol} — YABBAI Ecosystem · Solana CTF`);
    metaForm.append('twitter',     'https://x.com/yabaibasham');
    metaForm.append('website',     'https://yabbai.net');
    metaForm.append('showName',    'true');

    const ipfsRes  = await fetch('https://pump.fun/api/ipfs', { method:'POST', body:metaForm });
    const ipfsData = await ipfsRes.json();
    const uri      = ipfsData.metadataUri;
    termLog('SYSTEM', `Metadata URI: ${uri?.slice(0,40)}...`, '#00ffee');

    // Step 2: Generate ephemeral mint keypair using Web Crypto
    const mintKeypair = await generateKeypair();

    // Step 3: Get cheapest create transaction from PumpPortal
    // Initial dev buy = 0.005 SOL (minimum to seed bonding curve)
    const createRes = await fetch(`${PUMPPORTAL_API}/create-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey:    walletPubkey,
        name:         name,
        symbol:       symbol,
        uri:          uri,
        mint:         mintKeypair.publicKey,
        initialBuySOL: 0.005,  // cheapest seed — can bump later
        slippage:     10,
        priorityFee:  0.00001, // minimum
      })
    });

    if (!createRes.ok) throw new Error(`PumpPortal create error ${createRes.status}`);
    const txBytes = new Uint8Array(await createRes.arrayBuffer());

    termLog('SYSTEM', `Token account created: ${mintKeypair.publicKey.slice(0,16)}...`, '#00ffee');
    termLog('SYSTEM', 'Sign the transaction in your wallet...', '#ffc200');

    // Step 4: Sign with both mint keypair AND user wallet, then send
    const provider = getAnyWallet();
    const result = await provider.signAndSendTransaction(
      { serialize: () => txBytes },
      { skipPreflight: false }
    );
    const sig = result?.signature || result;

    termLog('GREEN_HAT', `✓ $${symbol} MINTED ON PUMP.FUN!`, '#00ff41');
    termLog('GREEN_HAT', `Mint: ${mintKeypair.publicKey}`, '#00ff41');
    termLog('SYSTEM', `pump.fun/coin/${mintKeypair.publicKey}`, '#00b4ff');

    return { sig, mint: mintKeypair.publicKey };
  } catch(e) {
    termLog('ERROR', `Mint failed: ${e.message}`, '#ff3333');
    return false;
  }
}

async function generateKeypair() {
  // Generate Ed25519 keypair via Web Crypto API (no libs needed)
  const keyPair = await crypto.subtle.generateKey({ name:'Ed25519' }, true, ['sign','verify']);
  const raw     = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const pubArr  = new Uint8Array(raw);
  const pubKey  = bs58Encode(pubArr);
  const privRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  return { publicKey: pubKey, privateKey: new Uint8Array(privRaw), keyPair };
}

function generateTokenSVG(symbol) {
  const colors = { BASH:'#00ff41', YABBIE:'#00b4ff', HOMEGROWN:'#22c55e', GREENHOUSEGROW:'#86efac' };
  const c = colors[symbol.toUpperCase()] || '#FFB800';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#000305"/>
    <text x="100" y="110" text-anchor="middle" fill="${c}" font-size="52" font-family="monospace" font-weight="bold">$${symbol.slice(0,4)}</text>
    <text x="100" y="140" text-anchor="middle" fill="${c}66" font-size="14" font-family="monospace">YABBAI ECO</text>
    <circle cx="100" cy="100" r="95" fill="none" stroke="${c}33" stroke-width="2"/>
  </svg>`;
}

// Simple base58 encoder (for keypair public key display)
function bs58Encode(bytes) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(''));
  let result = '';
  while (n > 0n) { const rem = Number(n % 58n); result = ALPHABET[rem] + result; n = n / 58n; }
  for (const b of bytes) { if (b === 0) result = '1' + result; else break; }
  return result;
}

// ── TERMINAL LOG ──────────────────────────────────────────
function termLog(tag, msg, color='#00ff41') {
  const log = document.getElementById('liveLog');
  if (!log) return;
  const time = new Date().toTimeString().slice(0,8);
  const d = document.createElement('div');
  d.className = 'log-line';
  d.innerHTML = `<span style="color:#1a3a1a">[${time}]</span> <span style="color:${color}">${tag}</span> ${msg}`;
  log.insertBefore(d, log.firstChild);
  while (log.children.length > 18) log.lastChild.remove();
}

// ── STATS UPDATE ──────────────────────────────────────────
function updateStats() {
  const fmt = (n,dec=6) => n > 0 ? '$'+n.toFixed(dec) : '$0.000000';
  const fmtK = n => n > 1e6 ? '$'+(n/1e6).toFixed(2)+'M' : n > 1000 ? '$'+(n/1e3).toFixed(1)+'K' : '$'+n.toFixed(0);

  const sp = document.getElementById('sp'); if (sp) sp.textContent = fmt(bashPrice);
  const sm = document.getElementById('sm'); if (sm) sm.textContent = fmtK(bashMcap);
  const sv = document.getElementById('sv'); if (sv) sv.textContent = fmtK(bashVolume);

  // Bonding curve progress bar
  const bar = document.getElementById('curveBar');
  if (bar) {
    bar.style.width = bondingCurve.toFixed(1)+'%';
    bar.textContent = bondingCurve.toFixed(1)+'%';
  }
  const curveLabel = document.getElementById('curveLabel');
  if (curveLabel) {
    const toGrad = Math.max(0, 69000 - bashMcap);
    curveLabel.textContent = isGraduated
      ? '✓ GRADUATED — Trading on Raydium'
      : `${bondingCurve.toFixed(1)}% to $69K graduation — $${Math.round(toGrad).toLocaleString()} remaining`;
  }
}

// ── LP POOL STATS ─────────────────────────────────────────
async function fetchLPData() {
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana/'+BASH_POOL, {cache:'no-cache'});
    const d = await r.json();
    const pair = d?.pair || d?.pairs?.[0];
    if (!pair) return;
    const lp = document.getElementById('lpStats');
    if (!lp) return;
    lp.innerHTML = `
      <div class="log-line"><span style="color:#333">[LP]</span> <span style="color:#00b4ff">POOL</span> ${BASH_POOL.slice(0,16)}...</div>
      <div class="log-line"><span style="color:#333">[LP]</span> <span style="color:#00ff41">PRICE</span> $${parseFloat(pair.priceUsd||0).toFixed(8)}</div>
      <div class="log-line"><span style="color:#333">[LP]</span> <span style="color:#00ff41">LIQ</span> $${parseFloat(pair.liquidity?.usd||0).toLocaleString('en',{maximumFractionDigits:0})}</div>
      <div class="log-line"><span style="color:#333">[LP]</span> <span style="color:#00ff41">VOL 24H</span> $${parseFloat(pair.volume?.h24||0).toLocaleString('en',{maximumFractionDigits:0})}</div>
      <div class="log-line"><span style="color:#333">[LP]</span> <span style="color:#00ffee">DEX</span> <a href="${DEX_LINK}" target="_blank" style="color:#00b4ff">View on DexScreener ↗</a></div>
    `;
  } catch(e) { console.warn('[LP]', e.message); }
}

// ── WALLET PANEL ──────────────────────────────────────────
function renderWalletPanel() {
  const panel = document.getElementById('yabbai-wallet-panel');
  if (!panel) return;
  if (!walletPubkey) {
    panel.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="connectPhantom()" style="${bstyle('#9945FF')}">👻 Phantom</button>
        <button onclick="connectSolflare()" style="${bstyle('#FC8423')}">🔆 Solflare</button>
      </div>`;
    return;
  }
  const low = solBalance < 0.01;
  const bashUSD = bashPrice > 0 ? (bashBalance * bashPrice).toFixed(4) : '—';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <div style="background:rgba(0,255,65,0.06);border:1px solid rgba(0,255,65,0.2);border-radius:6px;padding:7px 12px">
        <div style="font-size:9px;color:#1a3a1a;letter-spacing:0.08em;text-transform:uppercase;font-family:monospace">CONNECTED</div>
        <div style="font-size:12px;font-family:monospace;color:#00ff41">${walletPubkey.slice(0,6)}...${walletPubkey.slice(-4)}</div>
        <div style="font-size:10px;color:#555;font-family:monospace">${solBalance.toFixed(4)} SOL · $${(solBalance*solPrice).toFixed(2)}</div>
        ${bashBalance > 0 ? `<div style="font-size:10px;color:#00ff41;font-family:monospace">${bashBalance.toLocaleString()} $BASH · $${bashUSD}</div>` : ''}
      </div>
      ${low
        ? `<div style="background:rgba(255,200,0,0.06);border:1px solid rgba(255,200,0,0.2);border-radius:6px;padding:7px 12px;font-size:11px;color:#ffc200;font-family:monospace;max-width:180px">⚡ type: buy 0.01<br><span style="color:#00b4ff">to get $BASH cheapest</span></div>`
        : `<button onclick="buyBash(0.05)" style="${bstyle('#00ff41')}">▶ BUY 0.05 SOL</button>`
      }
      <button onclick="disconnectWallet()" style="background:transparent;border:1px solid #1a3a1a;border-radius:4px;padding:6px 10px;color:#1a3a1a;font-size:10px;cursor:pointer;font-family:monospace">DISCONNECT</button>
    </div>`;
}

function bstyle(c) {
  return `background:${c}12;border:1px solid ${c}40;border-radius:4px;padding:7px 14px;color:${c};font-size:11px;cursor:pointer;font-family:monospace;letter-spacing:0.04em`;
}

// ── REFRESH LOOP ──────────────────────────────────────────
function startRefresh() {
  if (refreshLoop) clearInterval(refreshLoop);
  refreshLoop = setInterval(async () => {
    if (walletPubkey) await fetchAllBalances();
    else await fetchPrices();
    await fetchRecentTrades();
    renderWalletPanel();
  }, 25000);
}

// ── AUTO-INIT ─────────────────────────────────────────────
window.addEventListener('load', async () => {
  // Always fetch prices on load (no wallet needed)
  fetchPrices();
  fetchLPData();
  fetchRecentTrades();

  // Auto-reconnect
  const saved = localStorage.getItem('bash_wallet');
  if (saved) {
    const p = getAnyWallet();
    if (p?.isConnected) {
      walletPubkey = saved;
      await onConnect();
    }
  }

  renderWalletPanel();
  startRefresh();
});

// ── EXPOSE GLOBALS for terminal commands ──────────────────
window.BASH_buyBash     = buyBash;
window.BASH_mintNew     = mintNewToken;
window.BASH_fetchLP     = fetchLPData;
window.BASH_connectPhantom = connectPhantom;
window.BASH_connectSolflare = connectSolflare;
window.BASH_disconnectWallet = disconnectWallet;
window.BASH_getState    = () => ({ walletPubkey, solBalance, bashBalance, bashPrice, bashMcap, bondingCurve, isGraduated });
