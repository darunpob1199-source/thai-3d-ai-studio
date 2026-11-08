import { NextRequest, NextResponse } from "next/server";
import { getUserById, getUserHistory, topupUserCredits } from "@/lib/db/database";

const CREDIT_PACKAGES: Record<
  string,
  { id: string; name: string; amountThb: number; credits: number; bonus: number; badge: string }
> = {
  direct_3: {
    id: "direct_3",
    name: "สแกนปั้นด่วน Standard PBR (TRELLIS)",
    amountThb: 3,
    credits: 1,
    bonus: 0,
    badge: "ปั้นทันที 1 ตัว • ไม่ต้องเติมแพ็ก",
  },
  direct_5: {
    id: "direct_5",
    name: "สแกนปั้นด่วน Pro HD PBR (Hunyuan3D-2.1)",
    amountThb: 5,
    credits: 2,
    bonus: 0,
    badge: "ตัวท็อป 4K PBR • ปั้นทันที 1 ตัว",
  },
  direct_9: {
    id: "direct_9",
    name: "สแกนปั้นด่วน Pro HD PBR (Hunyuan3D-2.1)",
    amountThb: 5,
    credits: 2,
    bonus: 0,
    badge: "ตัวท็อป 4K PBR • ปั้นทันที 1 ตัว",
  },
  starter_29: {
    id: "starter_29",
    name: "Starter Pack (โปรลองของ)",
    amountThb: 29,
    credits: 12,
    bonus: 2,
    badge: "ปั้นได้สูงสุด 12 ตัว • เฉลี่ยตัวละ 2.41฿",
  },
  mini_59: {
    id: "mini_59",
    name: "Mini Pack (โปรเกมเมอร์)",
    amountThb: 59,
    credits: 25,
    bonus: 5,
    badge: "ปั้นได้สูงสุด 25 ตัว • เฉลี่ยตัวละ 2.36฿",
  },
  creator_99: {
    id: "creator_99",
    name: "Creator Pack (ขายดีอันดับ 1 🔥)",
    amountThb: 99,
    credits: 45,
    bonus: 15,
    badge: "ขายดีอันดับ 1 • ปั้นได้ 45 ตัว (2.20฿/ตัว)",
  },
  pro_199: {
    id: "pro_199",
    name: "Pro Studio (โปรสายปั้นจริงจัง)",
    amountThb: 199,
    credits: 95,
    bonus: 35,
    badge: "คุ้มมาก • ปั้นได้ 95 ตัว (2.09฿/ตัว)",
  },
  vip_490: {
    id: "vip_490",
    name: "Studio VIP (โปรสตูดิโอเหมา)",
    amountThb: 490,
    credits: 245,
    bonus: 95,
    badge: "คุ้มสุด • ปั้นได้ 245 ตัว (2.00฿/ตัว)",
  },
  // Legacy package aliases for backwards compatibility
  direct_25: {
    id: "direct_25",
    name: "จ่ายรายตัว Clean Quad / Studio Op",
    amountThb: 25,
    credits: 5,
    bonus: 0,
    badge: "ปั้นทันที",
  },
  direct_39: {
    id: "direct_39",
    name: "จ่ายรายตัว Best Quality Pro HD",
    amountThb: 39,
    credits: 8,
    bonus: 0,
    badge: "ปั้นตัวท็อป 4K PBR",
  },
  starter_99: {
    id: "starter_99",
    name: "Creator Pack (99฿)",
    amountThb: 99,
    credits: 30,
    bonus: 10,
    badge: "ปั้นได้ 30 ตัว",
  },
  creator_299: {
    id: "creator_299",
    name: "Creator Pack (299฿)",
    amountThb: 299,
    credits: 95,
    bonus: 35,
    badge: "ขายดี",
  },
  pro_690: {
    id: "pro_690",
    name: "Pro Studio Pack",
    amountThb: 690,
    credits: 240,
    bonus: 90,
    badge: "คุ้มมาก",
  },
  agency_1990: {
    id: "agency_1990",
    name: "Agency / Game Studio",
    amountThb: 1990,
    credits: 720,
    bonus: 270,
    badge: "คุ้มสุด",
  },
  starter_50: {
    id: "starter_50",
    name: "Starter ทดลองปั้น",
    amountThb: 50,
    credits: 12,
    bonus: 0,
    badge: "เริ่มต้นง่ายสุด",
  },
  indie_150: {
    id: "indie_150",
    name: "Indie Game Dev",
    amountThb: 150,
    credits: 45,
    bonus: 5,
    badge: "คุ้มค่า",
  },
  pro_390: {
    id: "pro_390",
    name: "Pro Studio Creator",
    amountThb: 390,
    credits: 140,
    bonus: 40,
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
