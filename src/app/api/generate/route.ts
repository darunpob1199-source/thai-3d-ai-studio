import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getUserById,
  getUserHistory,
  holdAndSpendCredits,
  refundCredits,
} from "@/lib/db/database";
import {
  AI3DEngine,
  dispatchToServerlessGpu,
  ENGINE_SPECS,
  PipelineStage,
  STAGE_COSTS,
} from "@/lib/ai/providers";

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get("studio_uid")?.value;
    if (!userId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนเริ่มสร้างโมเดล 3D" },
        { status: 401 }
      );
    }

    const user = getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const promptTh = String(body.promptTh || "").trim();
    const stage: PipelineStage = body.stage || "refine_pbr";
    const engine: AI3DEngine = body.engine || "trellis_pbr";
    const mode: "text_to_3d" | "image_to_3d" = body.mode || "text_to_3d";
    const targetPolyCount = Number(body.targetPolyCount) || 12000;
    const topology: "triangle" | "quad" = body.topology === "triangle" ? "triangle" : "quad";
    const hasRig = Boolean(body.hasRig);
    const inputImageUrl = body.inputImageUrl || null;

    if (!promptTh) {
      return NextResponse.json(
        { error: "กรุณาพิมพ์คำสั่งภาษาไทย หรืออธิบายโมเดล 3D ที่ต้องการปั้น" },
        { status: 400 }
      );
    }

    // คำนวณเครดิตตามขั้นตอนและ Engine ที่เลือก
    const engineSpec = ENGINE_SPECS[engine] || ENGINE_SPECS.trellis_pbr;
    const stageSpec = STAGE_COSTS[stage] || STAGE_COSTS.refine_pbr;

    const costCredits = engineSpec.costCredits + (hasRig ? 2 : 0);

    const taskId = `task_${crypto.randomBytes(7).toString("hex")}`;

    // 1. กฎเหล็กกันขาดทุน: หักเครดิตทันทีก่อนส่งงานเข้า GPU (Hold Transaction)
    const hold = holdAndSpendCredits({
      userId: user.id,
      cost: costCredits,
      description: `${stageSpec.label} [${engineSpec.name}] - "${promptTh.slice(0, 40)}"`,
      referenceId: taskId,
    });

    if (!hold.ok) {
      return NextResponse.json({ error: hold.error }, { status: 402 });
    }

    // 2. ส่งเข้า AI Pipeline (แปลภาษาไทย -> DINOv2 -> 3D Diffusion)
    try {
      const gpuResult = await dispatchToServerlessGpu({
        taskId,
        engine,
        stage,
        promptTh,
        inputImageUrl,
      });

      const hasPbr = stage === "draft_3d" ? 0 : 1;

      const db = getDb();
      db.prepare(
        `INSERT INTO generation_tasks (
          id, user_id, stage, engine, mode, prompt_th, prompt_en, input_image_url,
          status, cost_credits, refunded, target_poly_count, topology, has_pbr, has_rig,
          preset_type, primary_color, accent_color, roughness, metalness, output_glb_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        taskId,
        user.id,
        stage,
        engine,
        mode,
        promptTh,
        gpuResult.promptEn,
        inputImageUrl,
        costCredits,
        targetPolyCount,
        topology,
        hasPbr,
        hasRig ? 1 : 0,
        gpuResult.presetType,
        gpuResult.primaryColor,
        gpuResult.accentColor,
        gpuResult.roughness,
        gpuResult.metalness,
        gpuResult.outputGlbUrl
      );

      const updatedUser = getUserById(user.id);
      const history = getUserHistory(user.id);

      return NextResponse.json({
        ok: true,
        providerMode: gpuResult.providerMode,
        taskId,
        user: updatedUser,
        ...history,
      });
    } catch (gpuError) {
      // 3. หาก GPU พัง คืนเครดิตให้ลูกค้าอัตโนมัติ (Auto-Refund)
      const refundedBalance = refundCredits({
        userId: user.id,
        amount: costCredits,
        reason: `คืนเครดิตอัตโนมัติ (GPU ขัดข้อง) สำหรับงาน ${taskId}`,
        taskId,
      });

      return NextResponse.json(
        {
          error:
            gpuError instanceof Error
              ? gpuError.message
              : "GPU ขัดข้อง ระบบได้คืนเครดิตเข้ากระเป๋าให้คุณอัตโนมัติแล้ว",
          refundedBalance,
        },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างโมเดล" },
      { status: 500 }
    );
  }
}
