import { NextRequest, NextResponse } from "next/server";
import { getUserById, getUserHistory, topupUserCredits } from "@/lib/db/database";

const CREDIT_PACKAGES: Record<
  string,
  { id: string; name: string; amountThb: number; credits: number; bonus: number; badge: string }
> = {
  direct_25: {
    id: "direct_25",
    name: "จ่ายรายตัว Clean Quad / Studio Op",
    amountThb: 25,
    credits: 2,
    bonus: 0,
    badge: "ปั้นทันที 1 รายการ • ไม่ต้องเติมแพ็ก",
  },
  direct_39: {
    id: "direct_39",
    name: "จ่ายรายตัว Best Quality Pro HD",
    amountThb: 39,
    credits: 4,
    bonus: 0,
    badge: "ปั้นตัวท็อป 4K PBR ทันที 1 ตัว",
  },
  mini_59: {
    id: "mini_59",
    name: "Mini Pack (ชุดเปิดใจ)",
    amountThb: 59,
    credits: 8,
    bonus: 0,
    badge: "ปั้นได้ 4 ตัว • เฉลี่ยตัวละ 14.75฿",
  },
  starter_99: {
    id: "starter_99",
    name: "Starter Pack (ชุดเริ่มต้น)",
    amountThb: 99,
    credits: 15,
    bonus: 1,
    badge: "ปั้นได้ 7 ตัว • เฉลี่ยตัวละ 13.20฿",
  },
  creator_299: {
    id: "creator_299",
    name: "Creator Pack (ขายดีที่สุด 🔥)",
    amountThb: 299,
    credits: 50,
    bonus: 5,
    badge: "ขายดีอันดับ 1 • ปั้นได้ 25 ตัว (11.96฿/ตัว)",
  },
  pro_690: {
    id: "pro_690",
    name: "Pro Studio Pack (สายผลิตจริง)",
    amountThb: 690,
    credits: 120,
    bonus: 15,
    badge: "คุ้มมาก • ปั้นได้ 60 ตัว (11.50฿/ตัว)",
  },
  agency_1990: {
    id: "agency_1990",
    name: "Agency / Game Studio",
    amountThb: 1990,
    credits: 360,
    bonus: 60,
    badge: "คุ้มสุด • ปั้นได้ 180 ตัว (11.05฿/ตัว)",
  },
  // Legacy package aliases for backwards compatibility
  starter_50: {
    id: "starter_50",
    name: "Starter ทดลองปั้น",
    amountThb: 50,
    credits: 8,
    bonus: 0,
    badge: "เริ่มต้นง่ายสุด",
  },
  indie_150: {
    id: "indie_150",
    name: "Indie Game Dev",
    amountThb: 150,
    credits: 24,
    bonus: 2,
    badge: "คุ้มค่า",
  },
  pro_390: {
    id: "pro_390",
    name: "Pro Studio Creator",
    amountThb: 390,
    credits: 65,
    bonus: 10,
    badge: "คุ้มสุด",
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
