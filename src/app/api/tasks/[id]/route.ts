import { NextRequest, NextResponse } from "next/server";
import { getDb, GenerationTaskRecord } from "@/lib/db/database";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const task = db
      .prepare("SELECT * FROM generation_tasks WHERE id = ?")
      .get(id) as unknown as GenerationTaskRecord | undefined;

    if (!task) {
      return NextResponse.json({ error: "ไม่พบโมเดล 3D ที่ระบุ" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ดึงสถานะโมเดลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM generation_tasks WHERE id = ?")
      .get(id) as unknown as GenerationTaskRecord | undefined;

    if (!existing) {
      return NextResponse.json({ error: "ไม่พบโมเดล 3D ในฐานข้อมูล" }, { status: 404 });
    }

    const primaryColor = body.primary_color ?? existing.primary_color;
    const accentColor = body.accent_color ?? existing.accent_color;
    const roughness =
      typeof body.roughness === "number" ? body.roughness : existing.roughness;
    const metalness =
      typeof body.metalness === "number" ? body.metalness : existing.metalness;
    const topology = body.topology === "triangle" ? "triangle" : "quad";
    const targetPolyCount =
      typeof body.target_poly_count === "number"
        ? body.target_poly_count
        : existing.target_poly_count;
    const hasRig =
      typeof body.has_rig === "number"
        ? body.has_rig
        : typeof body.has_rig === "boolean"
          ? body.has_rig
            ? 1
            : 0
          : existing.has_rig;

    db.prepare(
      `UPDATE generation_tasks
       SET primary_color = ?, accent_color = ?, roughness = ?, metalness = ?,
           topology = ?, target_poly_count = ?, has_rig = ?
       WHERE id = ?`
    ).run(
      primaryColor,
      accentColor,
      roughness,
      metalness,
      topology,
      targetPolyCount,
      hasRig,
      id
    );

    const updated = db
      .prepare("SELECT * FROM generation_tasks WHERE id = ?")
      .get(id) as unknown as GenerationTaskRecord;

    return NextResponse.json({ ok: true, task: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกการแก้ไขโมเดลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = req.cookies.get("studio_uid")?.value;
    if (!userId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนลบโมเดล" }, { status: 401 });
    }
    const { id } = await context.params;
    const db = getDb();
    db.prepare("DELETE FROM generation_tasks WHERE id = ? AND user_id = ?").run(
      id,
      userId
    );
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ลบโมเดลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
