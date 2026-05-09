-- Cached SOL balances (lamports) keyed by wallet pubkey (base58).
CREATE TABLE IF NOT EXISTS balance_cache (
  wallet TEXT PRIMARY KEY NOT NULL,
  lamports INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
