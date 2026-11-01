import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthConfig, setAppSetting } from "@/lib/db/database";

export async function GET(req: NextRequest) {
  const cfg = getGoogleOAuthConfig();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const currentOrigin = `${proto}://${host}`;

  return NextResponse.json({
    isConfigured: cfg.isConfigured,
    clientId: cfg.clientId,
    hasClientSecret: cfg.clientSecret.length > 5,
    currentOrigin,
    cloudflareDevUrl: "https://3d-studio-dev.lungnuek.com",
    redirectUriCloudflare: "https://3d-studio-dev.lungnuek.com/api/auth/google/callback",
    redirectUriLocal: "http://localhost:3000/api/auth/google/callback",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId = String(body.clientId || "").trim();
    const clientSecret = String(body.clientSecret || "").trim();

    if (!clientId) {
      return NextResponse.json(
        { error: "กรุณาระบุ Google OAuth Client ID (เช่น xxx.apps.googleusercontent.com)" },
        { status: 400 }
      );
    }

    setAppSetting("google_client_id", clientId);
    if (clientSecret) {
      setAppSetting("google_client_secret", clientSecret);
    }

    const cfg = getGoogleOAuthConfig();
    return NextResponse.json({
      ok: true,
      isConfigured: cfg.isConfigured,
      clientId: cfg.clientId,
      hasClientSecret: cfg.clientSecret.length > 5,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกการตั้งค่า Google OAuth ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
