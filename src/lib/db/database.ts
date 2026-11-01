import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  provider: string;
  google_sub: string | null;
  credits_balance: number;
  total_generated: number;
  role: string;
  created_at: string;
}

export interface GenerationTaskRecord {
  id: string;
  user_id: string;
  stage: "preview_2d" | "draft_3d" | "refine_pbr" | "remesh_rig";
  engine: "triposg" | "hunyuan3d_2_1" | "trellis_pbr";
  mode: "text_to_3d" | "image_to_3d";
  prompt_th: string;
  prompt_en: string;
  input_image_url: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  cost_credits: number;
  refunded: number;
  target_poly_count: number;
  topology: "triangle" | "quad";
  has_pbr: number;
  has_rig: number;
  preset_type: "sword" | "mecha" | "dragon" | "potion" | "vehicle" | "crystal";
  primary_color: string;
  accent_color: string;
  roughness: number;
  metalness: number;
  output_glb_url: string | null;
  created_at: string;
}

export interface CreditTransactionRecord {
  id: string;
  user_id: string;
  type: "signup_bonus" | "topup" | "spend_generate" | "refund";
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string | null;
  created_at: string;
}

export interface TopupOrderRecord {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  amount_thb: number;
  credits_granted: number;
  payment_method: string;
  status: string;
  slip_ref: string | null;
  created_at: string;
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "studio.db");
  const db = new DatabaseSync(dbPath);

  const schemaPath = path.join(process.cwd(), "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schemaSql);
  }

  dbInstance = db;
  return db;
}

export function getAppSetting(key: string): string | null {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setAppSetting(key: string, value: string): void {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value.trim());
}

export function getGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  isConfigured: boolean;
} {
  const clientId =
    getAppSetting("google_client_id") || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const clientSecret =
    getAppSetting("google_client_secret") || process.env.GOOGLE_CLIENT_SECRET || "";
  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    isConfigured: clientId.trim().length > 10,
  };
}


export function findOrCreateGoogleUser(params: {
  email: string;
  name: string;
  avatar_url?: string | null;
  google_sub?: string | null;
}): { user: UserRecord; isNewUser: boolean } {
  const db = getDb();
  const normalizedEmail = params.email.trim().toLowerCase();

  const existing = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail) as unknown as UserRecord | undefined;

  if (existing) {
    db.prepare(
      "UPDATE users SET name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = datetime('now') WHERE id = ?"
    ).run(params.name, params.avatar_url ?? null, existing.id);

    const updated = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(existing.id) as unknown as UserRecord;
    return { user: updated, isNewUser: false };
  }

  const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
  const initialCredits = 15; // แจกฟรี 15 เครดิตสำหรับสมาชิกใหม่ที่ล็อกอินด้วย Gmail (ทดลองปั้นครบทุกขั้นได้ 1 ชิ้นเต็ม!)

  db.prepare(
    `INSERT INTO users (id, email, name, avatar_url, provider, google_sub, credits_balance, total_generated, role)
     VALUES (?, ?, ?, ?, 'google', ?, ?, 0, 'user')`
  ).run(
    userId,
    normalizedEmail,
    params.name,
    params.avatar_url ?? null,
    params.google_sub ?? null,
    initialCredits
  );

  const txId = `tx_${crypto.randomBytes(8).toString("hex")}`;
  db.prepare(
    `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
     VALUES (?, ?, 'signup_bonus', ?, ?, ?, ?)`
  ).run(
    txId,
    userId,
    initialCredits,
    initialCredits,
    "โบนัสต้อนรับสมาชิกใหม่ (ยืนยันบัญชี Gmail)",
    "WELCOME_BONUS"
  );

  // สร้างโมเดลตัวอย่างเริ่มต้นให้ในคลัง 1 ชิ้น
  const sampleTaskId = `task_${crypto.randomBytes(6).toString("hex")}`;
  db.prepare(
    `INSERT INTO generation_tasks (
      id, user_id, stage, engine, mode, prompt_th, prompt_en,
      status, cost_credits, target_poly_count, topology, has_pbr, has_rig,
      preset_type, primary_color, accent_color, roughness, metalness
    ) VALUES (?, ?, 'refine_pbr', 'trellis_pbr', 'text_to_3d', ?, ?, 'completed', 0, 12400, 'quad', 1, 1, 'sword', '#6366f1', '#f59e0b', 0.22, 0.85)`
  ).run(
    sampleTaskId,
    userId,
    "ดาบอัศวินมังกรทองคำ สไตล์เกมแฟนตาซี RPG",
    "Golden dragon knight greatsword, ornate hilt, glowing runes, stylized fantasy RPG game asset, PBR material, clean quad topology"
  );

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as unknown as UserRecord;

  return { user, isNewUser: true };
}

export function getUserById(userId: string): UserRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as unknown as UserRecord | undefined;
  return row ?? null;
}

export function getUserHistory(userId: string): {
  tasks: GenerationTaskRecord[];
  transactions: CreditTransactionRecord[];
  orders: TopupOrderRecord[];
} {
  const db = getDb();
  const tasks = db
    .prepare("SELECT * FROM generation_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
    .all(userId) as unknown as GenerationTaskRecord[];
  const transactions = db
    .prepare("SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
    .all(userId) as unknown as CreditTransactionRecord[];
  const orders = db
    .prepare("SELECT * FROM topup_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(userId) as unknown as TopupOrderRecord[];

  return { tasks, transactions, orders };
}

export function holdAndSpendCredits(params: {
  userId: string;
  cost: number;
  description: string;
  referenceId: string;
}): { ok: boolean; newBalance: number; error?: string } {
  const db = getDb();
  const user = getUserById(params.userId);
  if (!user) {
    return { ok: false, newBalance: 0, error: "ไม่พบบัญชีผู้ใช้งาน กรุณาเข้าสู่ระบบด้วย Gmail ก่อน" };
  }
  if (user.credits_balance < params.cost) {
    return {
      ok: false,
      newBalance: user.credits_balance,
      error: `เครดิตไม่เพียงพอ (ต้องใช้ ${params.cost} เครดิต แต่คุณมี ${user.credits_balance} เครดิต)`,
    };
  }

  const newBalance = user.credits_balance - params.cost;
  db.prepare(
    "UPDATE users SET credits_balance = ?, total_generated = total_generated + 1, updated_at = datetime('now') WHERE id = ?"
  ).run(newBalance, params.userId);

  const txId = `tx_${crypto.randomBytes(8).toString("hex")}`;
  db.prepare(
    `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
     VALUES (?, ?, 'spend_generate', ?, ?, ?, ?)`
  ).run(
    txId,
    params.userId,
    -params.cost,
    newBalance,
    params.description,
    params.referenceId
  );

  return { ok: true, newBalance };
}

export function refundCredits(params: {
  userId: string;
  amount: number;
  reason: string;
  taskId: string;
}): number {
  const db = getDb();
  const user = getUserById(params.userId);
  if (!user) return 0;

  const newBalance = user.credits_balance + params.amount;
  db.prepare("UPDATE users SET credits_balance = ?, updated_at = datetime('now') WHERE id = ?").run(
    newBalance,
    params.userId
  );
  db.prepare("UPDATE generation_tasks SET status = 'failed', refunded = 1 WHERE id = ?").run(
    params.taskId
  );

  const txId = `tx_${crypto.randomBytes(8).toString("hex")}`;
  db.prepare(
    `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
     VALUES (?, ?, 'refund', ?, ?, ?, ?)`
  ).run(txId, params.userId, params.amount, newBalance, params.reason, params.taskId);

  return newBalance;
}

export function topupUserCredits(params: {
  userId: string;
  packageId: string;
  packageName: string;
  amountThb: number;
  creditsGranted: number;
  slipRef: string;
}): { ok: boolean; newBalance: number; orderId?: string; error?: string } {
  const db = getDb();
  const user = getUserById(params.userId);
  if (!user) {
    return { ok: false, newBalance: 0, error: "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนเติมเครดิต" };
  }

  // ป้องกันการใช้สลิปซ้ำ
  const duplicateSlip = db
    .prepare("SELECT id FROM topup_orders WHERE slip_ref = ?")
    .get(params.slipRef) as { id: string } | undefined;

  if (duplicateSlip) {
    return {
      ok: false,
      newBalance: user.credits_balance,
      error: "สลิปโอนเงินนี้ถูกใช้งานไปแล้ว (ระบบป้องกันสลิปซ้ำทำงาน)",
    };
  }

  const orderId = `ord_${crypto.randomBytes(7).toString("hex")}`;
  const newBalance = user.credits_balance + params.creditsGranted;

  db.prepare(
    `INSERT INTO topup_orders (id, user_id, package_id, package_name, amount_thb, credits_granted, payment_method, status, slip_ref)
     VALUES (?, ?, ?, ?, ?, ?, 'promptpay_qr', 'paid', ?)`
  ).run(
    orderId,
    params.userId,
    params.packageId,
    params.packageName,
    params.amountThb,
    params.creditsGranted,
    params.slipRef
  );

  db.prepare("UPDATE users SET credits_balance = ?, updated_at = datetime('now') WHERE id = ?").run(
    newBalance,
    params.userId
  );

  const txId = `tx_${crypto.randomBytes(8).toString("hex")}`;
  db.prepare(
    `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
     VALUES (?, ?, 'topup', ?, ?, ?, ?)`
  ).run(
    txId,
    params.userId,
    params.creditsGranted,
    newBalance,
    `เติมเครดิตแพ็กเกจ ${params.packageName} (฿${params.amountThb} PromptPay QR)`,
    orderId
  );

  return { ok: true, newBalance, orderId };
}
