import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const remoteUrl = req.nextUrl.searchParams.get("url");
  if (!remoteUrl || !remoteUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid GLB URL" }, { status: 400 });
  }
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream GLB fetch failed" }, { status: res.status });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GLB proxy error" },
      { status: 500 }
    );
  }
}
