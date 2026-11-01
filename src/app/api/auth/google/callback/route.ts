import { NextRequest, NextResponse } from "next/server";
import { findOrCreateGoogleUser, getGoogleOAuthConfig } from "@/lib/db/database";

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
  const code = req.nextUrl.searchParams.get("code");
  const origin = getRequestOrigin(req);

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  try {
    const { clientId, clientSecret } = getGoogleOAuthConfig();
    const redirectUri = `${origin}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${origin}/?auth_error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/?auth_error=userinfo_failed`);
    }

    const profile = await userRes.json();
    const { user } = findOrCreateGoogleUser({
      email: profile.email,
      name: profile.name || profile.email.split("@")[0],
      avatar_url: profile.picture || null,
      google_sub: profile.sub || null,
    });

    const response = NextResponse.redirect(`${origin}/`);
    response.cookies.set("studio_uid", user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.redirect(`${origin}/?auth_error=callback_exception`);
  }
}
