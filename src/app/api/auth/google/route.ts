import { NextRequest, NextResponse } from "next/server";
import {
  findOrCreateGoogleUser,
  getGoogleOAuthConfig,
  getUserHistory,
} from "@/lib/db/database";

function decodeJwtPayload(token: string): {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getRequestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host && !host.includes("localhost") ? "https" : "http");
  if (host) {
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const { clientId, isConfigured } = getGoogleOAuthConfig();
  const origin = getRequestOrigin(req);

  if (isConfigured && clientId) {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("access_type", "online");
    return NextResponse.redirect(authUrl.toString());
  }

  return NextResponse.json({
    oauthConfigured: false,
    origin,
    message: "Google OAuth Client ID not configured yet",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let email = "";
    let name = "";
    let avatarUrl: string | null = null;
    let googleSub: string | null = null;

    if (body.firebaseIdToken) {
      // 0. มาตรฐาน Firebase GoogleAuthProvider (signInWithPopup -> accounts.google.com ของแท้)
      const verifyRes = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyBHI-5I2BOWEFALho8Yd7vzwF8Ayozr_ms",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: body.firebaseIdToken }),
        }
      );
      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: "ไม่สามารถยืนยัน Firebase Google ID Token ได้" },
          { status: 400 }
        );
      }
      const verifyData = await verifyRes.json();
      const fbUser = verifyData?.users?.[0];
      if (!fbUser?.email) {
        return NextResponse.json(
          { error: "ไม่พบอีเมลในบัญชี Google ของคุณ" },
          { status: 400 }
        );
      }
      email = fbUser.email;
      name = fbUser.displayName || fbUser.email.split("@")[0];
      avatarUrl = fbUser.photoUrl || null;
      googleSub = fbUser.localId || null;
    } else if (body.access_token) {
      // 1. มาตรฐาน Google OAuth 2.0 Popup Token Client -> ยิงเช็กข้อมูลจริงกับ Google API
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${body.access_token}` },
      });
      if (!userRes.ok) {
        return NextResponse.json(
          { error: "ไม่สามารถดึงข้อมูลบัญชีจาก Google OAuth API ได้" },
          { status: 400 }
        );
      }
      const profile = await userRes.json();
      email = profile.email;
      name = profile.name || profile.email.split("@")[0];
      avatarUrl = profile.picture || null;
      googleSub = profile.sub || null;
    } else if (body.credential) {
      // 2. มาตรฐาน Google Identity Services (Sign In With Google Button / One-Tap JWT)
      const tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.credential)}`
      );
      if (tokenInfoRes.ok) {
        const info = await tokenInfoRes.json();
        email = info.email;
        name = info.name || info.email.split("@")[0];
        avatarUrl = info.picture || null;
        googleSub = info.sub || null;
      } else {
        const payload = decodeJwtPayload(body.credential);
        if (!payload || !payload.email) {
          return NextResponse.json(
            { error: "ไม่สามารถยืนยัน Google ID Token ได้" },
            { status: 400 }
          );
        }
        email = payload.email;
        name = payload.name || payload.email.split("@")[0];
        avatarUrl = payload.picture || null;
        googleSub = payload.sub || null;
      }
    } else if (body.email) {
      // 3. Google Account Chooser Simulation (สำหรับทดสอบได้ทันทีแม้ยังไม่ได้สร้าง Google Cloud Client ID)
      email = String(body.email).trim().toLowerCase();
      if (!email.includes("@")) {
        email = `${email}@gmail.com`;
      }
      name =
        body.name && String(body.name).trim()
          ? String(body.name).trim()
          : email.split("@")[0];
      avatarUrl =
        body.avatar_url ||
        `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
      googleSub = `google_${Buffer.from(email).toString("hex").slice(0, 16)}`;
    } else {
      return NextResponse.json(
        { error: "กรุณาเลือกบัญชี Google ที่ต้องการเข้าสู่ระบบ" },
        { status: 400 }
      );
    }

    const { user, isNewUser } = findOrCreateGoogleUser({
      email,
      name,
      avatar_url: avatarUrl,
      google_sub: googleSub,
    });

    const history = getUserHistory(user.id);

    const response = NextResponse.json({
      ok: true,
      isNewUser,
      user,
      ...history,
    });

    response.cookies.set("studio_uid", user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google" },
      { status: 500 }
    );
  }
}
