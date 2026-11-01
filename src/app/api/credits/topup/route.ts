import { NextRequest, NextResponse } from "next/server";
import { getUserById, getUserHistory, topupUserCredits } from "@/lib/db/database";

const CREDIT_PACKAGES: Record<
  string,
  { id: string; name: string; amountThb: number; credits: number; bonus: number; badge: string }
> = {
  starter_50: {
    id: "starter_50",
    name: "Starter ทดลองปั้น",
    amountThb: 50,
    credits: 50,
    bonus: 0,
    badge: "เริ่มต้นง่ายสุด • สแกนปุ๊บเข้าปั๊บ",
  },
  indie_150: {
    id: "indie_150",
    name: "Indie Game Dev",
    amountThb: 150,
    credits: 170,
    bonus: 20,
    badge: "ขายดีอันดับ 1 • แถมฟรี +20 เครดิต",
  },
  pro_390: {
    id: "pro_390",
    name: "Pro Studio Creator",
    amountThb: 390,
    credits: 500,
    bonus: 110,
    badge: "คุ้มสุด • ตกเครดิตละ 0.78 บาท (+110 ฟรี)",
  },
};

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get("studio_uid")?.value;
    if (!userId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนเติมเครดิต" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const pkgId = String(body.packageId || "indie_150");
    const slipRef =
      String(body.slipRef || "").trim() ||
      `SLIP_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const pkg = CREDIT_PACKAGES[pkgId];
    if (!pkg) {
      return NextResponse.json({ error: "แพ็กเกจเครดิตไม่ถูกต้อง" }, { status: 400 });
    }

    const result = topupUserCredits({
      userId,
      packageId: pkg.id,
      packageName: pkg.name,
      amountThb: pkg.amountThb,
      creditsGranted: pkg.credits,
      slipRef,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const user = getUserById(userId);
    const history = getUserHistory(userId);

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      creditsAdded: pkg.credits,
      user,
      ...history,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเติมเครดิต" },
      { status: 500 }
    );
  }
}
