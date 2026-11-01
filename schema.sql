-- Cloudflare D1 / SQLite Schema for Thai 3D AI Studio (Tripo-style Platform)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  provider TEXT NOT NULL DEFAULT 'google',
  google_sub TEXT,
  credits_balance INTEGER NOT NULL DEFAULT 5,
  total_generated INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generation_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stage TEXT NOT NULL, -- 'preview_2d' | 'draft_3d' | 'refine_pbr' | 'remesh_rig'
  engine TEXT NOT NULL, -- 'triposg' | 'hunyuan3d_2_1' | 'trellis_pbr'
  mode TEXT NOT NULL, -- 'text_to_3d' | 'image_to_3d'
  prompt_th TEXT NOT NULL,
  prompt_en TEXT NOT NULL,
  input_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'completed', -- 'queued' | 'processing' | 'completed' | 'failed'
  cost_credits INTEGER NOT NULL,
  refunded INTEGER NOT NULL DEFAULT 0,
  target_poly_count INTEGER NOT NULL DEFAULT 15000,
  topology TEXT NOT NULL DEFAULT 'quad', -- 'triangle' | 'quad'
  has_pbr INTEGER NOT NULL DEFAULT 1,
  has_rig INTEGER NOT NULL DEFAULT 0,
  preset_type TEXT NOT NULL DEFAULT 'sword', -- 'sword' | 'mecha' | 'dragon' | 'potion' | 'vehicle' | 'crystal'
  primary_color TEXT NOT NULL DEFAULT '#6366f1',
  accent_color TEXT NOT NULL DEFAULT '#f59e0b',
  roughness REAL NOT NULL DEFAULT 0.3,
  metalness REAL NOT NULL DEFAULT 0.7,
  output_glb_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'signup_bonus' | 'topup' | 'spend_generate' | 'refund'
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS topup_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  amount_thb INTEGER NOT NULL,
  credits_granted INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'promptpay_qr',
  status TEXT NOT NULL DEFAULT 'paid', -- 'pending' | 'paid' | 'expired'
  slip_ref TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

