import { NextRequest, NextResponse } from "next/server";
import { getUserById, getUserHistory } from "@/lib/db/database";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("studio_uid")?.value;
  if (!userId) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const user = getUserById(userId);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const history = getUserHistory(user.id);
  return NextResponse.json({
    authenticated: true,
    user,
    ...history,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("studio_uid");
  return res;
}
