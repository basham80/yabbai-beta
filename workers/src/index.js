/**
 * Treasury → user SOL payout (Cloudflare Worker).
 * Requires wallet-signed message so random callers cannot drain treasury.
 *
 * Ops alignment (static app `yabbai/`):
 * - Browser deposits use the **public** receiver: meta / `window.YABBAI_TREASURY_RECEIVER` if set, else
 *   `DEFAULT_TREASURY` in `yabbai/index.html` — same optional Worker var name `YABBAI_TREASURY_RECEIVER` below.
 * - This Worker signs sends with **TREASURY_SECRET_KEY**; its **public key must match** that
 *   receiver, or payouts debit the wrong account. Optional: set plain var `YABBAI_TREASURY_RECEIVER`
 *   to the same base58 pubkey; GET/POST will report or enforce a mismatch (see fetch handler).
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function verifyWalletSignature(walletStr, messageUtf8, signatureBase58) {
  try {
    const pubkey = new PublicKey(walletStr);
    const sig = bs58.decode(signatureBase58);
    const msg =
      typeof messageUtf8 === 'string'
        ? new TextEncoder().encode(messageUtf8)
        : messageUtf8;
    return nacl.sign.detached.verify(msg, sig, pubkey.toBytes());
  } catch {
    return false;
  }
}

function loadTreasuryKeypair(secretB58) {
  const raw = bs58.decode(String(secretB58).trim());
  if (raw.length !== 64) {
    throw new Error('TREASURY_SECRET_KEY must decode to 64 bytes (base58 secret key)');
  }
  return Keypair.fromSecretKey(raw);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'GET') {
      const secretRaw = env.TREASURY_SECRET_KEY && String(env.TREASURY_SECRET_KEY).trim();
      let treasuryPubkey = null;
      if (secretRaw) {
        try {
          treasuryPubkey = loadTreasuryKeypair(secretRaw).publicKey.toBase58();
        } catch (_) {
          /* invalid secret — omit pubkey */
        }
      }
      const expectedRecv =
        env.YABBAI_TREASURY_RECEIVER && String(env.YABBAI_TREASURY_RECEIVER).trim();
      let treasuryMatchesEnv;
      if (treasuryPubkey && expectedRecv) {
        treasuryMatchesEnv = treasuryPubkey === expectedRecv;
      }
      return json(200, {
        ok: true,
        service: 'yabbai-payout',
        treasuryConfigured: !!treasuryPubkey,
        treasuryPubkey: treasuryPubkey || undefined,
        treasuryReceiverEnvSet: !!expectedRecv,
        treasuryMatchesEnv,
      });
    }

    if (request.method !== 'POST') {
      return json(405, { error: 'Use POST for payout' });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }

    const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : '';
    const amountSol = Number(body.amountSol);
    const message = typeof body.message === 'string' ? body.message : '';
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';

    if (!wallet || !Number.isFinite(amountSol) || amountSol <= 0) {
      return json(400, { error: 'wallet and positive amountSol required' });
    }
    if (!message || !signature) {
      return json(400, {
        error: 'message and signature required — client must sign withdrawal intent',
      });
    }

    const maxSol = Number(env.MAX_WITHDRAW_SOL || 50);
    if (amountSol > maxSol) {
      return json(400, { error: `Per-request max is ${maxSol} SOL` });
    }

    const prefix = `YABBAI_WITHDRAW_V1|wallet=${wallet}|amountSol=`;
    if (!message.startsWith(prefix)) {
      return json(400, { error: 'Invalid message prefix' });
    }

    const afterAmt = message.slice(prefix.length);
    const tsIdx = afterAmt.indexOf('|ts=');
    if (tsIdx < 0) {
      return json(400, { error: 'Invalid message (missing ts)' });
    }

    const amtStr = afterAmt.slice(0, tsIdx);
    const amountFromMsg = Number(amtStr);
    if (
      !Number.isFinite(amountFromMsg) ||
      Math.abs(amountFromMsg - amountSol) > 1e-9
    ) {
      return json(400, { error: 'amountSol does not match signed message' });
    }

    const tsMatch = message.match(/\|ts=(\d+)/);
    if (!tsMatch) {
      return json(400, { error: 'missing timestamp' });
    }
    const ts = Number(tsMatch[1]);
    const skewMs = 5 * 60 * 1000;
    if (Math.abs(Date.now() - ts) > skewMs) {
      return json(400, { error: 'signed message expired — try again' });
    }

    if (!verifyWalletSignature(wallet, message, signature)) {
      return json(401, { error: 'signature verification failed' });
    }

    const secret = env.TREASURY_SECRET_KEY;
    if (!secret || !String(secret).trim()) {
      return json(503, { error: 'TREASURY_SECRET_KEY not set on worker' });
    }

    let treasury;
    try {
      treasury = loadTreasuryKeypair(secret);
    } catch (e) {
      return json(503, { error: 'treasury key invalid: ' + e.message });
    }

    const expectedRecv =
      env.YABBAI_TREASURY_RECEIVER && String(env.YABBAI_TREASURY_RECEIVER).trim();
    if (expectedRecv && treasury.publicKey.toBase58() !== expectedRecv) {
      return json(503, {
        error:
          'TREASURY_SECRET_KEY public key does not match YABBAI_TREASURY_RECEIVER — fix secrets/vars',
      });
    }

    const rpc = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpc, 'confirmed');
    const toPubkey = new PublicKey(wallet);
    const lamports = Math.round(amountSol * 1e9);
    if (lamports < 1) {
      return json(400, { error: 'amount too small after conversion' });
    }

    const latest = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({
      feePayer: treasury.publicKey,
      recentBlockhash: latest.blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey,
        lamports,
      })
    );

    tx.sign(treasury);

    const rawSig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction(
      {
        signature: rawSig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed'
    );

    return json(200, {
      ok: true,
      signature: rawSig,
      explorer: `https://solscan.io/tx/${rawSig}`,
    });
  },
};
