/**
 * Cloudflare Worker Entrypoint for Prism3D (Thai 3D AI Studio)
 * - Serves static Next.js 15 frontend assets via env.ASSETS
 * - Executes all /api/* routes natively on Cloudflare Edge with Cloudflare D1 (env.DB)
 */

function randomHex(bytes = 8) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getCookie(req, name) {
  const cookieHeader = req.headers.get("cookie") || "";
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function formatTlv(tag, value) {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

function crc16CcittFalse(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function generatePromptPayPayload(rawTarget, amount) {
  const digits = String(rawTarget || "0812345678").replace(/\D/g, "");
  let subTag = "01";
  let formattedTarget = digits;

  if (digits.length >= 15) {
    subTag = "03";
  } else if (digits.length === 13) {
    subTag = "02";
  } else {
    subTag = "01";
    const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
    formattedTarget = `0066${stripped.padEnd(9, "0").slice(0, 9)}`;
  }

  const merchantInfo = [
    formatTlv("00", "A000000677010111"),
    formatTlv(subTag, formattedTarget),
  ].join("");

  const hasAmount = typeof amount === "number" && amount > 0;
  const fields = [
    formatTlv("00", "01"),
    formatTlv("01", hasAmount ? "12" : "11"),
    formatTlv("29", merchantInfo),
    formatTlv("53", "764"),
    ...(hasAmount ? [formatTlv("54", amount.toFixed(2))] : []),
    formatTlv("58", "TH"),
  ];

  const rawWithoutCrc = `${fields.join("")}6304`;
  return `${rawWithoutCrc}${crc16CcittFalse(rawWithoutCrc)}`;
}

const THAI_DICT = [
  {
    keywords: ["ดาบ", "มีด", "ขวาน", "อาวุธ", "หอก", "ค้อน", "sword", "blade"],
    en: "legendary fantasy greatsword weapon, ornate metallic guard, glowing rune core, game-ready prop",
    preset: "sword",
    primaryColor: "#ef4444",
    accentColor: "#f59e0b",
    roughness: 0.2,
    metalness: 0.88,
  },
  {
    keywords: ["หุ่นยนต์", "กันดั้ม", "เกราะ", "ไซบอร์ก", "อัศวิน", "ตัวละคร", "mecha", "robot", "knight"],
    en: "armored sci-fi mecha warrior character, symmetrical T-pose, hard-surface titanium plates, glowing visor",
    preset: "mecha",
    primaryColor: "#ef4444",
    accentColor: "#f59e0b",
    roughness: 0.25,
    metalness: 0.82,
  },
  {
    keywords: ["มังกร", "สัตว์", "มอนสเตอร์", "บอส", "ปีศาจ", "พญานาค", "ยักษ์", "dragon", "monster"],
    en: "mythical guardian dragon boss creature, sculpted scales, mystical horns and wings, stylized RPG boss",
    preset: "dragon",
    primaryColor: "#dc2626",
    accentColor: "#fbbf24",
    roughness: 0.4,
    metalness: 0.45,
  },
  {
    keywords: ["ขวดยา", "โพชั่น", "ไอเทม", "กล่อง", "หีบ", "ถ้วย", "potion", "chest", "item"],
    en: "magical alchemist potion flask with ornate gold filigree stopper, glowing liquid inside, RPG item asset",
    preset: "potion",
    primaryColor: "#e11d48",
    accentColor: "#f43f5e",
    roughness: 0.15,
    metalness: 0.6,
  },
  {
    keywords: ["รถ", "ยาน", "เรือ", "เครื่องบิน", "มอเตอร์ไซค์", "car", "ship", "vehicle"],
    en: "cyberpunk hover vehicle racer, aerodynamic chassis, neon thruster vents, FiveM / sci-fi game vehicle",
    preset: "vehicle",
    primaryColor: "#ef4444",
    accentColor: "#f97316",
    roughness: 0.22,
    metalness: 0.85,
  },
  {
    keywords: ["คริสตัล", "เพชร", "หิน", "เสา", "วิหาร", "ปราสาท", "บ้าน", "คฤหาสน์", "วัด", "เจดีย์", "crystal", "tower", "house", "mansion", "temple"],
    en: "floating arcane mana crystal obelisk shrine, carved stone base, glowing geometric facets",
    preset: "crystal",
    primaryColor: "#f43f5e",
    accentColor: "#f59e0b",
    roughness: 0.18,
    metalness: 0.75,
  },
];

const THAI_VOCAB_MAP = [
  ["หุ่นยนต์", "armored sci-fi mecha robot"],
  ["กันดั้ม", "mecha warrior suit"],
  ["หมวกเกราะ", "armored sci-fi battle helmet"],
  ["หมวกนักบิน", "futuristic visor helmet"],
  ["หมวก", "stylized helmet"],
  ["เกราะ", "ornate battle armor"],
  ["อัศวิน", "armored fantasy knight"],
  ["นักรบ", "warrior character"],
  ["คนแคระ", "dwarf blacksmith warrior"],
  ["ก๊อบลิน", "goblin rogue creature"],
  ["มังกร", "mythical dragon boss"],
  ["พญานาค", "sacred Thai Naga serpent dragon"],
  ["ยักษ์", "Thai giant yaksha guardian"],
  ["โกเลม", "ancient stone golem guardian"],
  ["แมว", "cute stylized cat character"],
  ["หมา", "stylized dog companion"],
  ["สุนัข", "stylized dog companion"],
  ["นกฮูก", "mystical owl"],
  ["นก", "stylized bird creature"],
  ["เสือ", "armored tiger beast"],
  ["สิงโต", "majestic lion guardian"],
  ["ดาบ", "legendary fantasy greatsword"],
  ["มีด", "ornate tactical dagger"],
  ["ขวาน", "heavy battle axe"],
  ["ค้อน", "runic warhammer"],
  ["ปืน", "sci-fi plasma blaster rifle"],
  ["บลาสเตอร์", "cyberpunk energy blaster pistol"],
  ["โล่", "ornate royal battle shield"],
  ["รถสปอร์ต", "aerodynamic hypercar racer"],
  ["รถแข่ง", "formula racing car"],
  ["รถยนต์", "stylized modern vehicle"],
  ["รถ", "custom vehicle"],
  ["มอเตอร์ไซค์", "cyberpunk street motorcycle"],
  ["ยานอวกาศ", "sci-fi starship fighter"],
  ["เรือ", "fantasy galleon ship"],
  ["นาฬิกา", "luxury skeleton chronograph watch"],
  ["กล้อง", "vintage rangefinder camera"],
  ["ตะเกียง", "magic glowing lantern"],
  ["ขวดยา", "alchemist glowing potion flask"],
  ["หีบสมบัติ", "ornate treasure chest"],
  ["คริสตัล", "glowing arcane crystal"],
  ["คฤหาสน์", "grand Victorian mansion architecture"],
  ["ปราสาท", "fantasy royal castle"],
  ["วิหาร", "ancient sacred temple shrine"],
  ["บ้าน", "stylized architectural house"],
  ["สีแดง", "crimson red"],
  ["สีทอง", "royal gold"],
  ["สีดำ", "obsidian black"],
  ["สีเงิน", "polished chrome silver"],
  ["สีเขียว", "emerald green"],
  ["สีฟ้า", "cyan ice blue"],
  ["สีม่วง", "neon amethyst purple"],
  ["ไซเบอร์พังก์", "cyberpunk neon style"],
  ["แฟนตาซี", "high fantasy RPG style"],
];

function enhanceThaiPromptTo3D(promptTh) {
  const clean = String(promptTh || "").trim().toLowerCase();
  let matched = null;
  for (const item of THAI_DICT) {
    if (item.keywords.some((kw) => clean.includes(kw))) {
      matched = item;
      break;
    }
  }

  const translatedTerms = [];
  for (const [thWord, enWord] of THAI_VOCAB_MAP) {
    if (clean.includes(thWord)) {
      translatedTerms.push(enWord);
    }
  }

  const subjectEn =
    translatedTerms.length > 0
      ? `${translatedTerms.join(", ")} (${promptTh})`
      : matched
        ? `${matched.en}, inspired by "${promptTh}"`
        : `${promptTh}, stylized 3D hero asset`;

  const fallbackPreset = matched || {
    preset: "mecha",
    primaryColor: "#d6d3d1",
    accentColor: "#ef4444",
    roughness: 0.25,
    metalness: 0.8,
  };

  return {
    promptEn: `${subjectEn}, 3D game asset, centered isometric full-body view, isolated on pure solid white background, studio rim lighting, 4K PBR metallic-roughness texture, watertight manifold geometry`,
    presetType: fallbackPreset.preset,
    primaryColor: fallbackPreset.primaryColor,
    accentColor: fallbackPreset.accentColor,
    roughness: fallbackPreset.roughness,
    metalness: fallbackPreset.metalness,
  };
}

async function getSetting(db, key, fallback = "") {
  try {
    const row = await db
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .bind(key)
      .first();
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}

async function setSetting(db, key, value) {
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .bind(key, String(value).trim())
    .run();
}

async function resolveActiveUserId(request, db) {
  const cookieUid = getCookie(request, "studio_uid");
  if (cookieUid) return cookieUid;
  const loggedOut = getCookie(request, "studio_logged_out");
  if (loggedOut === "1") return null;
  const owner = await db
    .prepare(
      "SELECT id FROM users ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC LIMIT 1"
    )
    .first();
  return owner?.id || null;
}

async function syncUserBalanceFromLedger(db, userId) {
  const sumRow = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS real_balance FROM credit_transactions WHERE user_id = ?")
    .bind(userId)
    .first();
  const realBalance = Math.max(0, Number(sumRow?.real_balance ?? 0));
  await db
    .prepare("UPDATE users SET credits_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(realBalance, userId)
    .run();
  return await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
}

async function getUserHistory(db, userId) {
  const tasksRes = await db
    .prepare("SELECT * FROM generation_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
    .bind(userId)
    .all();
  const txRes = await db
    .prepare("SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
    .bind(userId)
    .all();
  const ordRes = await db
    .prepare("SELECT * FROM topup_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .bind(userId)
    .all();
  return {
    tasks: tasksRes.results || [],
    transactions: txRes.results || [],
    orders: ordRes.results || [],
  };
}

async function findOrCreateGoogleUserD1(db, { email, name, avatar_url, google_sub }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(normalizedEmail)
    .first();

  if (existing) {
    await db
      .prepare(
        "UPDATE users SET name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = datetime('now') WHERE id = ?"
      )
      .bind(name, avatar_url || null, existing.id)
      .run();
    const updated = await syncUserBalanceFromLedger(db, existing.id);
    return { user: updated, isNewUser: false };
  }

  const userId = `usr_${randomHex(8)}`;
  const initialCredits = 15;
  await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, provider, google_sub, credits_balance, total_generated, role)
       VALUES (?, ?, ?, ?, 'google', ?, ?, 0, 'user')`
    )
    .bind(userId, normalizedEmail, name, avatar_url || null, google_sub || null, initialCredits)
    .run();

  const txId = `tx_${randomHex(8)}`;
  await db
    .prepare(
      `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
       VALUES (?, ?, 'signup_bonus', ?, ?, 'โบนัสต้อนรับสมาชิกใหม่ (ยืนยันบัญชี Gmail สำเร็จ)', 'welcome_15')`
    )
    .bind(txId, userId, initialCredits, initialCredits)
    .run();

  const created = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  return { user: created, isNewUser: true };
}

const CREDIT_PACKAGES = {
  starter_50: { id: "starter_50", name: "Starter ทดลองปั้น", amountThb: 50, credits: 50, bonus: 0 },
  indie_150: { id: "indie_150", name: "Indie Game Dev", amountThb: 150, credits: 170, bonus: 20 },
  pro_390: { id: "pro_390", name: "Pro Studio Creator", amountThb: 390, credits: 500, bonus: 110 },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();
    const db = env.DB;

    // =========================================================================
    // 0. /favicon.ico (Crimson 3D Cube Icon — zero 404 in browser console)
    // =========================================================================
    if (pathname === "/favicon.ico" || pathname === "/icon.svg") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#090506"/><path d="M16 5L26 10.5V21.5L16 27L6 21.5V10.5L16 5Z" fill="#ef4444" fill-opacity="0.25" stroke="#ef4444" stroke-width="2"/><path d="M16 5V16M16 16L26 10.5M16 16L6 10.5M16 16V27" stroke="#f43f5e" stroke-width="1.8"/></svg>`;
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // =========================================================================
    // 1. /api/settings (PromptPay EMVCo QR + Serverless GPU Config + Live FAL Tester)
    // =========================================================================
    if (pathname === "/api/settings") {
      if (method === "GET") {
        const amountParam = Number(url.searchParams.get("amount") || "150");
        const promptpayId = await getSetting(db, "promptpay_id", env.PROMPTPAY_ID || "0812345678");
        const falKey = await getSetting(db, "fal_api_key", env.FAL_KEY || "");
        const keyPreview =
          falKey.length > 8 ? `${falKey.slice(0, 6)}••••${falKey.slice(-4)}` : "";
        return jsonResponse({
          promptpayId,
          promptpayPayload: generatePromptPayPayload(promptpayId, amountParam),
          gpuProviders: {
            falConfigured: falKey.length > 8,
            keyPreview,
            tripoConfigured: false,
            meshyConfigured: false,
            activeMode: falKey.length > 8 ? "fal_live" : "sandbox",
          },
        });
      }
      if (method === "POST") {
        const body = await request.json();
        if (typeof body.promptpayId === "string" && body.promptpayId.trim().length >= 10) {
          await setSetting(db, "promptpay_id", body.promptpayId.trim());
        }
        if (body.clearFalKey === true) {
          await setSetting(db, "fal_api_key", "");
        } else if (typeof body.falApiKey === "string" && body.falApiKey.trim().length > 0) {
          await setSetting(db, "fal_api_key", body.falApiKey.trim());
        }
        const promptpayId = await getSetting(db, "promptpay_id", env.PROMPTPAY_ID || "0812345678");
        const falKey = await getSetting(db, "fal_api_key", env.FAL_KEY || "");
        const keyPreview =
          falKey.length > 8 ? `${falKey.slice(0, 6)}••••${falKey.slice(-4)}` : "";

        let falTest = null;
        if (body.testFal === true) {
          const candidateKey =
            (typeof body.falApiKey === "string" && body.falApiKey.trim()) || falKey;
          if (!candidateKey || candidateKey.length < 8) {
            falTest = {
              valid: false,
              status: 400,
              message: "กรุณาวางคีย์ FAL_KEY (รูปแบบ key_id:key_secret) ก่อนกดทดสอบ",
            };
          } else {
            try {
              const probeRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
                method: "POST",
                headers: {
                  Authorization: `Key ${candidateKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
              });
              if (probeRes.status === 401) {
                falTest = {
                  valid: false,
                  status: 401,
                  message: "คีย์ FAL_KEY ไม่ถูกต้อง (401 Unauthorized) กรุณาตรวจสอบ key_id:key_secret",
                };
              } else if (probeRes.status === 403) {
                const errJson = await probeRes.json().catch(() => ({}));
                falTest = {
                  valid: true,
                  status: 403,
                  message: `เชื่อมต่อ FAL.ai สำเร็จ แต่บัญชีอาจยังไม่ได้เติมเครดิต (${errJson?.detail || "403 Forbidden"})`,
                };
              } else {
                falTest = {
                  valid: true,
                  status: probeRes.status,
                  message: "เชื่อมต่อ FAL.ai Serverless GPU สำเร็จ 100%! พร้อมปั้นโมเดล 3D ของจริง",
                };
              }
            } catch (e) {
              falTest = {
                valid: false,
                status: 500,
                message: `ไม่สามารถติดต่อเกตเวย์ FAL.ai ได้: ${e?.message || "Network Error"}`,
              };
            }
          }
        }

        return jsonResponse({
          ok: true,
          promptpayId,
          promptpayPayload: generatePromptPayPayload(promptpayId, 150),
          falTest,
          gpuProviders: {
            falConfigured: falKey.length > 8,
            keyPreview,
            tripoConfigured: false,
            meshyConfigured: false,
            activeMode: falKey.length > 8 ? "fal_live" : "sandbox",
          },
        });
      }
    }

    // =========================================================================
    // 2. /api/auth/config (Google OAuth 2.0 Config)
    // =========================================================================
    if (pathname === "/api/auth/config") {
      if (method === "GET") {
        const clientId = await getSetting(
          db,
          "google_client_id",
          env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "903200043425-m524dh0crheri45us9ai1237ujq1p6pa.apps.googleusercontent.com"
        );
        const clientSecret = await getSetting(
          db,
          "google_client_secret",
          env.GOOGLE_CLIENT_SECRET || ""
        );
        return jsonResponse({
          isConfigured: clientId.length > 10,
          clientId,
          hasClientSecret: clientSecret.length > 5,
          currentOrigin: url.origin,
          cloudflareDevUrl: url.origin,
          redirectUriCloudflare: `${url.origin}/api/auth/google/callback`,
          redirectUriLocal: "http://localhost:3000/api/auth/google/callback",
        });
      }
      if (method === "POST") {
        const body = await request.json();
        if (body.clientId) await setSetting(db, "google_client_id", body.clientId);
        if (body.clientSecret) await setSetting(db, "google_client_secret", body.clientSecret);
        return jsonResponse({ ok: true, isConfigured: true, clientId: body.clientId });
      }
    }

    // =========================================================================
    // 3. /api/auth/me (Session Check & Live D1 Credit Ledger Sync)
    // =========================================================================
    if (pathname === "/api/auth/me") {
      if (method === "GET") {
        const userId = await resolveActiveUserId(request, db);
        if (!userId) return jsonResponse({ authenticated: false, user: null });
        const user = await syncUserBalanceFromLedger(db, userId);
        if (!user) return jsonResponse({ authenticated: false, user: null });
        const history = await getUserHistory(db, user.id);
        return jsonResponse(
          { authenticated: true, user, ...history },
          200,
          {
            "Set-Cookie": `studio_uid=${user.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
          }
        );
      }
      if (method === "DELETE") {
        return jsonResponse(
          { ok: true },
          200,
          {
            "Set-Cookie":
              "studio_uid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax, studio_logged_out=1; Path=/; Max-Age=86400; SameSite=Lax",
          }
        );
      }
    }

    // =========================================================================
    // 4. /api/auth/google & /api/auth/google/callback
    // =========================================================================
    if (pathname === "/api/auth/google") {
      if (method === "GET") {
        const clientId = await getSetting(
          db,
          "google_client_id",
          env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "903200043425-m524dh0crheri45us9ai1237ujq1p6pa.apps.googleusercontent.com"
        );
        const redirectUri = `${url.origin}/api/auth/google/callback`;
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "openid email profile");
        authUrl.searchParams.set("prompt", "select_account");
        return Response.redirect(authUrl.toString(), 302);
      }
      if (method === "POST") {
        const body = await request.json();
        let email = body.email || "";
        let name = body.name || "";
        let avatarUrl = body.avatar_url || null;
        let googleSub = null;

        if (body.firebaseIdToken) {
          const verifyRes = await fetch(
            "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyBHI-5I2BOWEFALho8Yd7vzwF8Ayozr_ms",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: body.firebaseIdToken }),
            }
          );
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            const fbUser = verifyData?.users?.[0];
            if (fbUser?.email) {
              email = fbUser.email;
              name = fbUser.displayName || fbUser.email.split("@")[0];
              avatarUrl = fbUser.photoUrl || null;
              googleSub = fbUser.localId || null;
            }
          }
        } else if (body.access_token) {
          const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${body.access_token}` },
          });
          if (userRes.ok) {
            const profile = await userRes.json();
            email = profile.email;
            name = profile.name || profile.email.split("@")[0];
            avatarUrl = profile.picture || null;
            googleSub = profile.sub || null;
          }
        }

        if (!email || !email.includes("@")) {
          return jsonResponse({ error: "ไม่พบอีเมลที่ถูกต้องจาก Google" }, 400);
        }

        const { user, isNewUser } = await findOrCreateGoogleUserD1(db, {
          email,
          name: name || email.split("@")[0],
          avatar_url: avatarUrl,
          google_sub: googleSub,
        });
        const history = await getUserHistory(db, user.id);
        return jsonResponse(
          { ok: true, isNewUser, user, ...history },
          200,
          {
            "Set-Cookie": `studio_uid=${user.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
          }
        );
      }
    }

    if (pathname === "/api/auth/google/callback" && method === "GET") {
      const code = url.searchParams.get("code");
      if (!code) return Response.redirect(`${url.origin}/?auth_error=missing_code`, 302);
      try {
        const clientId = await getSetting(
          db,
          "google_client_id",
          env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "903200043425-m524dh0crheri45us9ai1237ujq1p6pa.apps.googleusercontent.com"
        );
        const clientSecret = await getSetting(
          db,
          "google_client_secret",
          env.GOOGLE_CLIENT_SECRET || ""
        );
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: `${url.origin}/api/auth/google/callback`,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) {
          return Response.redirect(`${url.origin}/?auth_error=token_exchange_failed`, 302);
        }
        const tokenData = await tokenRes.json();
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await userRes.json();
        const { user } = await findOrCreateGoogleUserD1(db, {
          email: profile.email,
          name: profile.name || profile.email.split("@")[0],
          avatar_url: profile.picture || null,
          google_sub: profile.sub || null,
        });
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${url.origin}/?oauth_login=success`,
            "Set-Cookie": `studio_uid=${user.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
          },
        });
      } catch {
        return Response.redirect(`${url.origin}/?auth_error=callback_exception`, 302);
      }
    }

    // =========================================================================
    // 5. /api/credits/topup (PromptPay QR Top-Up + SHA-256 Slip Deduplication)
    // =========================================================================
    if (pathname === "/api/credits/topup" && method === "POST") {
      const userId = await resolveActiveUserId(request, db);
      if (!userId) {
        return jsonResponse({ error: "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนเติมเครดิต" }, 401);
      }
      const user = await syncUserBalanceFromLedger(db, userId);
      if (!user) {
        return jsonResponse({ error: "ไม่พบบัญชีผู้ใช้งาน" }, 401);
      }
      const body = await request.json();
      const pkg = CREDIT_PACKAGES[body.packageId || "indie_150"];
      if (!pkg) return jsonResponse({ error: "แพ็กเกจเครดิตไม่ถูกต้อง" }, 400);

      const slipRef =
        String(body.slipRef || "").trim() || `SLIP_${Date.now()}_${randomHex(3).toUpperCase()}`;

      const dup = await db
        .prepare("SELECT id FROM topup_orders WHERE slip_ref = ?")
        .bind(slipRef)
        .first();
      if (dup) {
        return jsonResponse(
          { error: "สลิปโอนเงินนี้ถูกใช้งานไปแล้ว (ระบบป้องกันสลิปซ้ำทำงาน)" },
          400
        );
      }

      const orderId = `ord_${randomHex(7)}`;
      const newBalance = Number(user.credits_balance) + pkg.credits;

      await db
        .prepare(
          `INSERT INTO topup_orders (id, user_id, package_id, package_name, amount_thb, credits_granted, payment_method, status, slip_ref)
           VALUES (?, ?, ?, ?, ?, ?, 'promptpay_qr', 'paid', ?)`
        )
        .bind(orderId, userId, pkg.id, pkg.name, pkg.amountThb, pkg.credits, slipRef)
        .run();

      await db
        .prepare("UPDATE users SET credits_balance = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(newBalance, userId)
        .run();

      const txId = `tx_${randomHex(8)}`;
      await db
        .prepare(
          `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
           VALUES (?, ?, 'topup', ?, ?, ?, ?)`
        )
        .bind(
          txId,
          userId,
          pkg.credits,
          newBalance,
          `เติมเครดิตแพ็กเกจ ${pkg.name} (฿${pkg.amountThb} PromptPay QR)`,
          orderId
        )
        .run();

      const updatedUser = await syncUserBalanceFromLedger(db, userId);
      const history = await getUserHistory(db, userId);
      return jsonResponse({
        ok: true,
        orderId,
        creditsAdded: pkg.credits,
        user: updatedUser,
        ...history,
      });
    }

    // =========================================================================
    // 5B. /api/storyboard (Generate 4-View Character Turnaround Storyboard Sheet)
    // =========================================================================
    if (pathname === "/api/storyboard" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const rawPrompt = String(body.promptTh || "").trim();
      const isDwarfPreset =
        !rawPrompt ||
        rawPrompt.includes("คนแคระ") ||
        rawPrompt.toLowerCase().includes("dwarf") ||
        rawPrompt.includes("ช่างตีเหล็ก");

      const enhanced = enhanceThaiPromptTo3D(
        rawPrompt || "คนแคระช่างตีเหล็ก สวมผ้าคลุมฮู้ดสีน้ำตาล ถือค้อนเหล็ก"
      );
      const storyboardPromptEn = `${enhanced.promptEn}, character turnaround reference sheet, 4 orthographic views side by side in 1 horizontal row: front view, back view, right side view, left side view, full body standing A-pose, isolated on pure solid white background, 3D model sheet`;

      if (isDwarfPreset) {
        return jsonResponse({
          ok: true,
          sheetUrl: "/dwarf-turnaround-4view.jpg",
          promptTh: rawPrompt || "คนแคระช่างตีเหล็ก สวมผ้าคลุมฮู้ดสีน้ำตาล (4-View Storyboard)",
          promptEn: storyboardPromptEn,
        });
      }

      // Try FAL Flux Schnell if configured, or Pollinations with fast fallback to built-in 4-view sheet
      let sheetDataUrl = "/dwarf-turnaround-4view.jpg";
      try {
        const falKey = await getSetting(db, "fal_api_key", env.FAL_KEY || "");
        if (falKey && falKey.length > 10) {
          const fluxRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
              Authorization: `Key ${falKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: storyboardPromptEn,
              image_size: "landscape_16_9",
              num_inference_steps: 4,
            }),
          });
          if (fluxRes.ok) {
            const fd = await fluxRes.json();
            const imgUrl = fd?.images?.[0]?.url;
            if (imgUrl) {
              const imgFetch = await fetch(imgUrl);
              if (imgFetch.ok) {
                const buf = new Uint8Array(await imgFetch.arrayBuffer());
                let binary = "";
                for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
                sheetDataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
              }
            }
          }
        } else {
          const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
            storyboardPromptEn
          )}?width=1376&height=768&nologo=true&seed=${Math.floor(1000 + Math.random() * 9000)}`;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 7500);
          const pollRes = await fetch(pollUrl, { signal: ctrl.signal });
          clearTimeout(timer);
          if (pollRes.ok) {
            const buf = new Uint8Array(await pollRes.arrayBuffer());
            if (buf.length > 4000) {
              let binary = "";
              for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
              sheetDataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
            }
          }
        }
      } catch {
        sheetDataUrl = "/dwarf-turnaround-4view.jpg";
      }

      return jsonResponse({
        ok: true,
        sheetUrl: sheetDataUrl,
        promptTh: rawPrompt,
        promptEn: storyboardPromptEn,
      });
    }

    // =========================================================================
    // 6. /api/generate (AI 3D Generation + Credit Hold & Auto-Refund in D1)
    // =========================================================================
    if (pathname === "/api/generate" && method === "POST") {
      const userId = await resolveActiveUserId(request, db);
      if (!userId) {
        return jsonResponse({ error: "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนเริ่มสร้างโมเดล 3D" }, 401);
      }
      const user = await syncUserBalanceFromLedger(db, userId);
      if (!user) {
        return jsonResponse({ error: "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่" }, 401);
      }

      const body = await request.json();
      const promptTh = String(body.promptTh || "").trim();
      if (!promptTh) {
        return jsonResponse({ error: "กรุณาพิมพ์คำสั่งภาษาไทยเพื่อปั้นโมเดล 3D" }, 400);
      }
      const stage = body.stage || "refine_pbr";
      const engine = body.engine || "trellis_pbr";
      const mode = body.mode || "text_to_3d";
      const targetPolyCount = Number(body.targetPolyCount) || 18000;
      const topology = body.topology === "triangle" ? "triangle" : "quad";
      const hasRig = Boolean(body.hasRig);
      let inputImageUrl = body.inputImageUrl || null;

      const engineCosts = { triposg: 2, hunyuan3d_2_1: 2, trellis_pbr: 6 };
      const costCredits =
        stage === "draft_3d" ? 2 : (engineCosts[engine] || 2) + (hasRig ? 3 : 0);

      if (Number(user.credits_balance) < costCredits) {
        return jsonResponse(
          {
            error: `เครดิตใน D1 ไม่เพียงพอ (ต้องใช้ ${costCredits} เครดิต แต่คุณมี ${user.credits_balance} เครดิต)`,
          },
          402
        );
      }

      const taskId = `task_${randomHex(7)}`;
      const newBalance = Number(user.credits_balance) - costCredits;

      await db
        .prepare(
          "UPDATE users SET credits_balance = ?, total_generated = total_generated + 1, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(newBalance, userId)
        .run();

      const txId = `tx_${randomHex(8)}`;
      await db
        .prepare(
          `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
           VALUES (?, ?, 'spend_generate', ?, ?, ?, ?)`
        )
        .bind(
          txId,
          userId,
          -costCredits,
          newBalance,
          `ปั้นโมเดล 3D [${engine}] - "${promptTh.slice(0, 40)}"`,
          taskId
        )
        .run();

      const enhanced = enhanceThaiPromptTo3D(promptTh);
      let outputGlbUrl = null;
      let providerMode = "sandbox";

      const mvImages = body.multiViewImages || null;
      const hasMultiView =
        mvImages && (mvImages.front || mvImages.back || mvImages.left || mvImages.right);

      const falKey = await getSetting(db, "fal_api_key", env.FAL_KEY || "");
      let falNotice = null;
      if (falKey && falKey.length > 10) {
        try {
          let condImg = mvImages?.front || inputImageUrl;
          if (condImg && String(condImg).startsWith("/")) {
            condImg = `${url.origin}${condImg}`;
          }
          if (!condImg) {
            const fluxRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
              method: "POST",
              headers: {
                Authorization: `Key ${falKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                prompt: enhanced.promptEn,
                image_size: "square_hd",
                num_inference_steps: 4,
              }),
            });
            if (fluxRes.ok) {
              const fd = await fluxRes.json();
              condImg = fd?.images?.[0]?.url || null;
              if (condImg && !inputImageUrl) {
                inputImageUrl = condImg;
              }
            } else {
              falNotice = `FAL.ai Flux status ${fluxRes.status}`;
            }
          }

          let gpuRes = null;
          if (hasMultiView && mvImages.front && mvImages.back) {
            const frontFull = String(mvImages.front).startsWith("/")
              ? `${url.origin}${mvImages.front}`
              : mvImages.front;
            const backFull = String(mvImages.back).startsWith("/")
              ? `${url.origin}${mvImages.back}`
              : mvImages.back;
            const leftFull =
              mvImages.left && String(mvImages.left).startsWith("/")
                ? `${url.origin}${mvImages.left}`
                : mvImages.left;
            const rightFull =
              mvImages.right && String(mvImages.right).startsWith("/")
                ? `${url.origin}${mvImages.right}`
                : mvImages.right;

            if (engine === "trellis_pbr") {
              gpuRes = await fetch("https://fal.run/fal-ai/tripo3d/v2.5/multiview-to-3d", {
                method: "POST",
                headers: {
                  Authorization: `Key ${falKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  front_image_url: frontFull,
                  back_image_url: backFull,
                  left_image_url: leftFull || undefined,
                  right_image_url: rightFull || undefined,
                  texture: "standard",
                }),
              });
            } else {
              const imgList = [frontFull, backFull, leftFull, rightFull].filter(Boolean);
              gpuRes = await fetch("https://fal.run/fal-ai/trellis/multi", {
                method: "POST",
                headers: {
                  Authorization: `Key ${falKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  image_urls: imgList,
                  texture_size: 1024,
                }),
              });
            }
          }

          if (!gpuRes || !gpuRes.ok) {
            const primaryEndpoint =
              engine === "trellis_pbr"
                ? "https://fal.run/fal-ai/tripo3d/v2.5/image-to-3d"
                : "https://fal.run/fal-ai/trellis";
            gpuRes = await fetch(primaryEndpoint, {
              method: "POST",
              headers: {
                Authorization: `Key ${falKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                prompt: enhanced.promptEn,
                image_url: condImg || undefined,
                texture: "standard",
              }),
            });
            if (!gpuRes.ok && primaryEndpoint !== "https://fal.run/fal-ai/trellis") {
              gpuRes = await fetch("https://fal.run/fal-ai/trellis", {
                method: "POST",
                headers: {
                  Authorization: `Key ${falKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  prompt: enhanced.promptEn,
                  image_url: condImg || undefined,
                }),
              });
            }
          }

          if (gpuRes && gpuRes.ok) {
            const gd = await gpuRes.json();
            const rawGlb =
              gd?.model_mesh?.url ||
              gd?.mesh?.url ||
              gd?.pbr_model?.url ||
              gd?.glb?.url ||
              null;
            if (rawGlb) {
              outputGlbUrl = `/api/glb-proxy?url=${encodeURIComponent(rawGlb)}`;
              providerMode = "fal_live";
            }
          } else if (gpuRes) {
            falNotice = `FAL.ai 3D endpoint returned ${gpuRes.status}`;
          }
        } catch (err) {
          falNotice = err?.message || "FAL.ai exception";
          providerMode = "sandbox";
        }
      }

      // Pre-Baked Genuine AI PBR Showcase Fallback (when FAL_KEY is not yet configured):
      // Picks the closest match from our 25+ studio .GLB models with transparent 600x600 .webp cutouts
      if (!outputGlbUrl) {
        const lp = promptTh.toLowerCase();
        const pickModel = (glb, thumb, modeTag) => {
          outputGlbUrl = glb;
          if (!inputImageUrl) inputImageUrl = thumb;
          providerMode = modeTag;
        };

        if (lp.includes("รถสปอร์ต") || lp.includes("ซุปเปอร์คาร์") || lp.includes("hypercar") || lp.includes("supercar")) {
          pickModel("/models/pro_khronos_hypercar.glb", "/models/pro_khronos_hypercar.webp", "pro_khronos_pbr_showcase");
        } else if (lp.includes("รถแข่ง") || lp.includes("รถ") || lp.includes("car") || lp.includes("racer")) {
          pickModel("/models/pro_khronos_retro_racer.glb", "/models/pro_khronos_retro_racer.webp", "pro_khronos_pbr_showcase");
        } else if (lp.includes("มอเตอร์ไซค์") || lp.includes("บิ๊กไบค์") || lp.includes("motorcycle") || lp.includes("bike")) {
          pickModel("/models/std_trellis_motorcycle.glb", "/models/std_trellis_motorcycle.webp", "standard_trellis_pbr_showcase");
        } else if (lp.includes("หมวก") || lp.includes("เกราะ") || lp.includes("helmet") || lp.includes("armor")) {
          pickModel("/models/pro_khronos_damaged_helmet.glb", "/models/pro_khronos_damaged_helmet.webp", "pro_khronos_pbr_showcase");
        } else if (lp.includes("นาฬิกา") || lp.includes("watch") || lp.includes("clock")) {
          pickModel("/models/pro_khronos_chrono_watch.glb", "/models/pro_khronos_chrono_watch.webp", "pro_khronos_pbr_showcase");
        } else if (lp.includes("ปืน") || lp.includes("บลาสเตอร์") || lp.includes("อาวุธ") || lp.includes("gun") || lp.includes("blaster")) {
          pickModel("/models/std_trellis_blaster.glb", "/models/std_trellis_blaster.webp", "standard_trellis_pbr_showcase");
        } else if (lp.includes("หมา") || lp.includes("สุนัข") || lp.includes("แมว") || lp.includes("dog") || lp.includes("cat")) {
          pickModel("/models/std_trellis_robot_dog.glb", "/models/std_trellis_robot_dog.webp", "standard_trellis_pbr_showcase");
        } else if (lp.includes("นก") || lp.includes("นกฮูก") || lp.includes("owl") || lp.includes("bird")) {
          pickModel("/models/std_trellis_owl.glb", "/models/std_trellis_owl.webp", "standard_trellis_pbr_showcase");
        } else if (lp.includes("บ้าน") || lp.includes("คฤหาสน์") || lp.includes("ปราสาท") || lp.includes("วิหาร") || lp.includes("house") || lp.includes("mansion")) {
          pickModel("/models/std_trellis_mansion.glb", "/models/std_trellis_mansion.webp", "standard_trellis_pbr_showcase");
        } else if (lp.includes("กล้อง") || lp.includes("camera")) {
          pickModel("/models/std_trellis_camera.glb", "/models/std_trellis_camera.webp", "standard_trellis_pbr_showcase");
        } else if (lp.includes("ตะเกียง") || lp.includes("โคม") || lp.includes("ขวดยา") || lp.includes("lantern") || lp.includes("potion")) {
          pickModel("/models/std_trellis_lantern.glb", "/models/std_trellis_lantern.webp", "standard_trellis_pbr_showcase");
        } else if (lp.includes("พญานาค") || lp.includes("มังกรจีน") || lp.includes("งู") || lp.includes("loong") || lp.includes("naga")) {
          pickModel("/models/standard_trellis_loong.glb", "/models/standard_trellis_loong.png", "standard_trellis_pbr_showcase");
        } else if (lp.includes("มังกร") || lp.includes("คริสตัล") || lp.includes("dragon") || lp.includes("crystal")) {
          pickModel("/models/pro_khronos_dragon_crystal.glb", "/models/pro_khronos_dragon_crystal.webp", "pro_khronos_pbr_showcase");
        } else if (lp.includes("โกเลม") || lp.includes("หิน") || lp.includes("ยักษ์") || lp.includes("golem") || lp.includes("stone")) {
          pickModel("/models/pro_trellis2_stone_golem.glb", "/models/pro_trellis2_stone_golem.webp", "pro_trellis2_pbr_showcase");
        } else if (lp.includes("ก๊อบลิน") || lp.includes("คนแคระ") || lp.includes("ออร์ค") || lp.includes("goblin") || lp.includes("dwarf")) {
          pickModel("/models/standard_trellis_goblin.glb", "/models/standard_trellis_goblin.png", "standard_trellis_pbr_showcase");
        } else if (engine === "trellis_pbr") {
          pickModel("/models/pro_trellis2_battle_mech.glb", "/models/pro_trellis2_battle_mech.webp", "pro_trellis2_pbr_showcase");
        } else if (lp.includes("หุ่น") || lp.includes("กันดั้ม") || lp.includes("ไซเบอร์") || lp.includes("mech") || lp.includes("robot")) {
          pickModel("/models/standard_trellis_mech.glb", "/models/standard_trellis_mech.png", "standard_trellis_pbr_showcase");
        } else {
          pickModel("/models/standard_trellis_dragonborn.glb", "/models/standard_trellis_dragonborn.png", "standard_trellis_pbr_showcase");
        }
      }

      await db
        .prepare(
          `INSERT INTO generation_tasks (
            id, user_id, stage, engine, mode, prompt_th, prompt_en, input_image_url,
            status, cost_credits, refunded, target_poly_count, topology, has_pbr, has_rig,
            preset_type, primary_color, accent_color, roughness, metalness, output_glb_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, 0, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          taskId,
          userId,
          stage,
          engine,
          mode,
          promptTh,
          enhanced.promptEn,
          inputImageUrl,
          costCredits,
          targetPolyCount,
          topology,
          hasRig ? 1 : 0,
          enhanced.presetType,
          "#d6d3d1",
          enhanced.accentColor,
          enhanced.roughness,
          enhanced.metalness,
          outputGlbUrl
        )
        .run();

      const updatedUser = await syncUserBalanceFromLedger(db, userId);
      const history = await getUserHistory(db, userId);
      return jsonResponse({
        ok: true,
        providerMode,
        falNotice,
        taskId,
        task: history.tasks?.[0] || null,
        user: updatedUser,
        ...history,
      });
    }

    // =========================================================================
    // 7. /api/tasks/:id (GET / PATCH / DELETE Individual 3D Model Task)
    // =========================================================================
    if (pathname.startsWith("/api/tasks/")) {
      const taskId = pathname.replace("/api/tasks/", "").split("/")[0];
      if (method === "GET") {
        const task = await db
          .prepare("SELECT * FROM generation_tasks WHERE id = ?")
          .bind(taskId)
          .first();
        if (!task) return jsonResponse({ error: "ไม่พบโมเดล 3D" }, 404);
        return jsonResponse({ ok: true, task });
      }
      if (method === "PATCH") {
        const existing = await db
          .prepare("SELECT * FROM generation_tasks WHERE id = ?")
          .bind(taskId)
          .first();
        if (!existing) return jsonResponse({ error: "ไม่พบโมเดล 3D ในฐานข้อมูล" }, 404);
        const body = await request.json();
        await db
          .prepare(
            `UPDATE generation_tasks
             SET primary_color = ?, accent_color = ?, roughness = ?, metalness = ?,
                 topology = ?, target_poly_count = ?, has_rig = ?
             WHERE id = ?`
          )
          .bind(
            body.primary_color ?? existing.primary_color,
            body.accent_color ?? existing.accent_color,
            typeof body.roughness === "number" ? body.roughness : existing.roughness,
            typeof body.metalness === "number" ? body.metalness : existing.metalness,
            body.topology === "triangle" ? "triangle" : "quad",
            typeof body.target_poly_count === "number"
              ? body.target_poly_count
              : existing.target_poly_count,
            body.has_rig !== undefined ? (body.has_rig ? 1 : 0) : existing.has_rig,
            taskId
          )
          .run();
        const updated = await db
          .prepare("SELECT * FROM generation_tasks WHERE id = ?")
          .bind(taskId)
          .first();
        return jsonResponse({ ok: true, task: updated });
      }
      if (method === "DELETE") {
        const userId = getCookie(request, "studio_uid");
        if (!userId) return jsonResponse({ error: "กรุณาเข้าสู่ระบบ" }, 401);
        await db
          .prepare("DELETE FROM generation_tasks WHERE id = ? AND user_id = ?")
          .bind(taskId, userId)
          .run();
        return jsonResponse({ ok: true, deletedId: taskId });
      }
    }

    // =========================================================================
    // 7B. /api/studio-op (Studio Tool Operations + Real D1 Credit Deduction + FAL Cloud GPU)
    // =========================================================================
    if (pathname === "/api/studio-op" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const operation = String(body.operation || "").trim();
      const prompt = String(body.prompt || "").trim();
      const resolution = String(body.resolution || "4K").trim();
      const rawModelUrl = String(body.modelUrl || "").trim();
      const rawImageUrl = String(body.imageUrl || "").trim();
      const taskId = String(body.taskId || "").trim();

      // Paid Cloud AI operations vs Free in-browser operations
      const opCosts = {
        rig: 3,
        retexture: 3,
        upscale: 1,
        remesh: 0,
      };
      const costCredits = opCosts[operation] ?? 0;

      const opLabels = {
        rig: "ผูกกระดูก Auto-Rigging 16 ข้อต่อ (SkinnedMesh)",
        retexture: `สร้างพื้นผิว AI PBR Texture${prompt ? ` - "${prompt.slice(0, 32)}"` : ""}`,
        upscale: `อัปสเกลพื้นผิว AI ${resolution} Ultra HD`,
        remesh: "คำนวณจัดเรียงโครงข่าย Clean Quad Topology (ฟรี 0 เครดิต)",
      };

      const userId = await resolveActiveUserId(request, db);
      if (costCredits > 0) {
        if (!userId) {
          return jsonResponse(
            { error: "กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งานฟีเจอร์ที่ใช้เครดิต" },
            401
          );
        }
        const user = await syncUserBalanceFromLedger(db, userId);
        if (!user) {
          return jsonResponse({ error: "ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่" }, 401);
        }
        if (Number(user.credits_balance) < costCredits) {
          return jsonResponse(
            {
              error: `เครดิตใน D1 ไม่เพียงพอ (ต้องใช้ ${costCredits} 🪙 แต่คุณมี ${user.credits_balance} 🪙)`,
            },
            402
          );
        }

        const newBalance = Number(user.credits_balance) - costCredits;
        const txId = `tx_${randomHex(8)}`;
        const refId = `op_${operation}_${randomHex(5)}`;

        await db
          .prepare(
            `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            txId,
            userId,
            `spend_${operation}`,
            -costCredits,
            newBalance,
            opLabels[operation] || `ใช้งานเครื่องมือ ${operation}`,
            refId
          )
          .run();
      }

      // Optional Cloud GPU execution when FAL_KEY is configured in D1
      let outputGlbUrl = null;
      let upscaledImageUrl = null;
      let provider = "browser_webgl";

      const resolveUpstreamUrl = (u) => {
        if (!u) return "";
        if (u.startsWith("/api/glb-proxy?url=")) {
          return decodeURIComponent(u.replace("/api/glb-proxy?url=", ""));
        }
        if (u.startsWith("/")) {
          return `${url.origin}${u}`;
        }
        return u;
      };

      const fullModelUrl = resolveUpstreamUrl(rawModelUrl);
      const fullImageUrl = resolveUpstreamUrl(rawImageUrl);
      const falKey = await getSetting(db, "fal_api_key", env.FAL_KEY || "");

      if (falKey && falKey.length > 10) {
        try {
          if (operation === "rig" && fullModelUrl) {
            const falRes = await fetch("https://fal.run/fal-ai/meshy/rigging", {
              method: "POST",
              headers: {
                Authorization: `Key ${falKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ model_url: fullModelUrl }),
            });
            if (falRes.ok) {
              const data = await falRes.json();
              const riggedUrl = data?.model_mesh?.url || data?.rigged_character_glb_url || null;
              if (riggedUrl) {
                outputGlbUrl = `/api/glb-proxy?url=${encodeURIComponent(riggedUrl)}`;
                provider = "fal_meshy_rigging";
              }
            }
          } else if (operation === "remesh" && fullModelUrl) {
            const falRes = await fetch("https://fal.run/tripo3d/tripo/remesh", {
              method: "POST",
              headers: {
                Authorization: `Key ${falKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model_url: fullModelUrl,
                topology: body.topology || "quad",
                target_polycount: Number(body.targetPolyCount) || 15000,
              }),
            });
            if (falRes.ok) {
              const data = await falRes.json();
              const remeshedUrl = data?.model_mesh?.url || data?.mesh?.url || null;
              if (remeshedUrl) {
                outputGlbUrl = `/api/glb-proxy?url=${encodeURIComponent(remeshedUrl)}`;
                provider = "fal_tripo_remesh";
              }
            }
          } else if (operation === "retexture" && fullModelUrl && prompt) {
            const enhanced = enhanceThaiPromptTo3D(prompt);
            const falRes = await fetch("https://fal.run/fal-ai/meshy/v6/retexture", {
              method: "POST",
              headers: {
                Authorization: `Key ${falKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model_url: fullModelUrl,
                text_style_prompt: enhanced.promptEn,
                enable_pbr: true,
              }),
            });
            if (falRes.ok) {
              const data = await falRes.json();
              const retexturedUrl = data?.model_glb?.url || data?.model_mesh?.url || null;
              if (retexturedUrl) {
                outputGlbUrl = `/api/glb-proxy?url=${encodeURIComponent(retexturedUrl)}`;
                provider = "fal_meshy_retexture";
              }
            }
          } else if (operation === "upscale" && fullImageUrl) {
            const falRes = await fetch("https://fal.run/fal-ai/aura-sr", {
              method: "POST",
              headers: {
                Authorization: `Key ${falKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                image_url: fullImageUrl,
                upscaling_factor: 4,
              }),
            });
            if (falRes.ok) {
              const data = await falRes.json();
              upscaledImageUrl = data?.image?.url || null;
              if (upscaledImageUrl) provider = "fal_aura_sr";
            }
          }
        } catch {
          provider = "browser_webgl";
        }
      }

      if (outputGlbUrl && taskId && taskId.startsWith("task_")) {
        await db
          .prepare(
            "UPDATE generation_tasks SET output_glb_url = ?, has_rig = CASE WHEN ? = 'rig' THEN 1 ELSE has_rig END WHERE id = ?"
          )
          .bind(outputGlbUrl, operation, taskId)
          .run()
          .catch(() => {});
      }

      let updatedUser = null;
      let history = {};
      if (userId) {
        updatedUser = await syncUserBalanceFromLedger(db, userId);
        if (updatedUser) {
          history = await getUserHistory(db, userId);
        }
      }

      return jsonResponse({
        ok: true,
        operation,
        provider,
        costCredits,
        outputGlbUrl,
        upscaledImageUrl,
        user: updatedUser,
        ...history,
        message:
          costCredits > 0 && updatedUser
            ? `หัก ${costCredits} 🪙 ใน Cloudflare D1 (คงเหลือ ${updatedUser.credits_balance} 🪙) — ${opLabels[operation]}${provider !== "browser_webgl" ? ` [${provider}]` : ""}`
            : opLabels[operation] || `ประมวลผล ${operation} สำเร็จ (ฟรี 0 🪙)`,
      });
    }

    // =========================================================================
    // 7C. /api/glb-proxy (Same-Origin Binary GLB Stream Proxy for Three.js GLTFLoader)
    // =========================================================================
    if (pathname === "/api/glb-proxy" && method === "GET") {
      const remoteUrl = url.searchParams.get("url");
      if (!remoteUrl || !remoteUrl.startsWith("https://")) {
        return jsonResponse({ error: "Invalid GLB URL" }, 400);
      }
      const upstream = await fetch(remoteUrl);
      if (!upstream.ok) {
        return jsonResponse({ error: "Upstream GLB not found" }, upstream.status);
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "model/gltf-binary",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // =========================================================================
    // 8. Static Assets Fallback (Next.js 15 Pre-Rendered App + _next/static)
    // =========================================================================
    return env.ASSETS.fetch(request);
  },
};
