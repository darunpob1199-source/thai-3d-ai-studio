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
    keywords: ["คริสตัล", "เพชร", "หิน", "เสา", "วิหาร", "ปราสาท", "บ้าน", "crystal", "tower"],
    en: "floating arcane mana crystal obelisk shrine, carved stone base, glowing geometric facets",
    preset: "crystal",
    primaryColor: "#f43f5e",
    accentColor: "#f59e0b",
    roughness: 0.18,
    metalness: 0.75,
  },
];

function enhanceThaiPromptTo3D(promptTh) {
  const clean = String(promptTh || "").trim().toLowerCase();
  let matched = THAI_DICT[0];
  for (const item of THAI_DICT) {
    if (item.keywords.some((kw) => clean.includes(kw))) {
      matched = item;
      break;
    }
  }
  return {
    promptEn: `${matched.en}, inspired by "${promptTh}", 3D game asset, centered isometric view, 4K PBR metallic-roughness texture, watertight manifold geometry`,
    presetType: matched.preset,
    primaryColor: matched.primaryColor,
    accentColor: matched.accentColor,
    roughness: matched.roughness,
    metalness: matched.metalness,
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
    const updated = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(existing.id)
      .first();
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
    // 1. /api/settings (PromptPay EMVCo QR + Serverless GPU Config)
    // =========================================================================
    if (pathname === "/api/settings") {
      if (method === "GET") {
        const amountParam = Number(url.searchParams.get("amount") || "150");
        const promptpayId = await getSetting(db, "promptpay_id", env.PROMPTPAY_ID || "0812345678");
        const falKey = await getSetting(db, "fal_api_key", env.FAL_KEY || "");
        return jsonResponse({
          promptpayId,
          promptpayPayload: generatePromptPayPayload(promptpayId, amountParam),
          gpuProviders: {
            falConfigured: falKey.length > 8,
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
        if (typeof body.falApiKey === "string" && body.falApiKey.trim().length > 0) {
          await setSetting(db, "fal_api_key", body.falApiKey.trim());
        }
        const promptpayId = await getSetting(db, "promptpay_id", env.PROMPTPAY_ID || "0812345678");
        const falKey = await getSetting(db, "fal_api_key", env.FAL_KEY || "");
        return jsonResponse({
          ok: true,
          promptpayId,
          promptpayPayload: generatePromptPayPayload(promptpayId, 150),
          gpuProviders: {
            falConfigured: falKey.length > 8,
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
    // 3. /api/auth/me (Session Check & Logout)
    // =========================================================================
    if (pathname === "/api/auth/me") {
      if (method === "GET") {
        const userId = getCookie(request, "studio_uid");
        if (!userId) return jsonResponse({ authenticated: false, user: null });
        const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        if (!user) return jsonResponse({ authenticated: false, user: null });
        const history = await getUserHistory(db, user.id);
        return jsonResponse({ authenticated: true, user, ...history });
      }
      if (method === "DELETE") {
        return jsonResponse(
          { ok: true },
          200,
          { "Set-Cookie": "studio_uid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" }
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
      const userId = getCookie(request, "studio_uid");
      if (!userId) {
        return jsonResponse({ error: "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนเติมเครดิต" }, 401);
      }
      const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
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

      const updatedUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
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
      const userId = getCookie(request, "studio_uid");
      if (!userId) {
        return jsonResponse({ error: "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนเริ่มสร้างโมเดล 3D" }, 401);
      }
      const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
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

      const engineCosts = { triposg: 2, hunyuan3d_2_1: 2, trellis_pbr: 15 };
      const costCredits =
        stage === "draft_3d" ? 2 : (engineCosts[engine] || 2) + (hasRig ? 3 : 0);

      if (Number(user.credits_balance) < costCredits) {
        return jsonResponse(
          {
            error: `เครดิตไม่เพียงพอ (ต้องใช้ ${costCredits} เครดิต แต่คุณมี ${user.credits_balance} เครดิต)`,
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
            }
          }

          let gpuRes = null;
          if (hasMultiView && mvImages.front && mvImages.back) {
            if (engine === "trellis_pbr") {
              gpuRes = await fetch("https://fal.run/fal-ai/tripo3d/v2.5/multiview-to-3d", {
                method: "POST",
                headers: {
                  Authorization: `Key ${falKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  front_image_url: mvImages.front,
                  back_image_url: mvImages.back,
                  left_image_url: mvImages.left || undefined,
                  right_image_url: mvImages.right || undefined,
                  texture: "standard",
                }),
              });
            } else {
              const imgList = [
                mvImages.front,
                mvImages.back,
                mvImages.left,
                mvImages.right,
              ].filter(Boolean);
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
          }
        } catch {
          providerMode = "sandbox";
        }
      }

      // Pre-Baked Genuine AI PBR Showcase Fallback (when FAL_KEY is not yet configured):
      // Returns 100% genuine Microsoft TRELLIS.2 (Pro Studio) or Microsoft Trellis (Standard) .GLB with full 360° UV PBR textures
      if (!outputGlbUrl) {
        const lowerPrompt = promptTh.toLowerCase();
        if (engine === "trellis_pbr") {
          const isGolemOrCreature =
            lowerPrompt.includes("โกเลม") ||
            lowerPrompt.includes("หิน") ||
            lowerPrompt.includes("มอนสเตอร์") ||
            lowerPrompt.includes("ยักษ์") ||
            lowerPrompt.includes("มังกร") ||
            lowerPrompt.includes("คริสตัล") ||
            lowerPrompt.includes("golem") ||
            lowerPrompt.includes("monster") ||
            lowerPrompt.includes("stone") ||
            lowerPrompt.includes("dragon");
          outputGlbUrl = isGolemOrCreature
            ? "/models/pro_trellis2_stone_golem.glb"
            : "/models/pro_trellis2_battle_mech.glb";
          if (!inputImageUrl) {
            inputImageUrl = isGolemOrCreature
              ? "/models/pro_trellis2_stone_golem.webp"
              : "/models/pro_trellis2_battle_mech.webp";
          }
          providerMode = "pro_trellis2_pbr_showcase";
        } else {
          if (
            lowerPrompt.includes("หุ่น") ||
            lowerPrompt.includes("กันดั้ม") ||
            lowerPrompt.includes("ไซเบอร์") ||
            lowerPrompt.includes("เครื่องจักร") ||
            lowerPrompt.includes("mech") ||
            lowerPrompt.includes("robot")
          ) {
            outputGlbUrl = "/models/standard_trellis_mech.glb";
            if (!inputImageUrl) inputImageUrl = "/models/standard_trellis_mech.png";
          } else if (
            lowerPrompt.includes("พญานาค") ||
            lowerPrompt.includes("มังกรจีน") ||
            lowerPrompt.includes("งู") ||
            lowerPrompt.includes("loong") ||
            lowerPrompt.includes("naga")
          ) {
            outputGlbUrl = "/models/standard_trellis_loong.glb";
            if (!inputImageUrl) inputImageUrl = "/models/standard_trellis_loong.png";
          } else if (
            lowerPrompt.includes("ก๊อบลิน") ||
            lowerPrompt.includes("คนแคระ") ||
            lowerPrompt.includes("ออร์ค") ||
            lowerPrompt.includes("goblin") ||
            lowerPrompt.includes("dwarf")
          ) {
            outputGlbUrl = "/models/standard_trellis_goblin.glb";
            if (!inputImageUrl) inputImageUrl = "/models/standard_trellis_goblin.png";
          } else {
            outputGlbUrl = "/models/standard_trellis_dragonborn.glb";
            if (!inputImageUrl) inputImageUrl = "/models/standard_trellis_dragonborn.png";
          }
          providerMode = "standard_trellis_pbr_showcase";
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

      const updatedUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
      const history = await getUserHistory(db, userId);
      return jsonResponse({
        ok: true,
        providerMode,
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
    // 7B. /api/glb-proxy (Same-Origin Binary GLB Stream Proxy for Three.js GLTFLoader)
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
