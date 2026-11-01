import fs from "node:fs";
import path from "node:path";
import { getAppSetting } from "@/lib/db/database";

export type AI3DEngine = "triposg" | "hunyuan3d_2_1" | "trellis_pbr";
export type PipelineStage = "preview_2d" | "draft_3d" | "refine_pbr" | "remesh_rig";
export type PresetArchetype = "sword" | "mecha" | "dragon" | "potion" | "vehicle" | "crystal";

export interface EngineSpec {
  id: AI3DEngine;
  name: string;
  vendor: string;
  badge: string;
  visionBackbone: string;
  diffusionBackbone: string;
  costCredits: number;
  realGpuCostThb: number;
  estSeconds: number;
  license: string;
  description: string;
}

export const ENGINE_SPECS: Record<AI3DEngine, EngineSpec> = {
  triposg: {
    id: "triposg",
    name: "TripoSG Fast Draft",
    vendor: "VAST AI Research (Open-Source)",
    badge: "ประหยัดสุด • เร็ว 5 วิ",
    visionBackbone: "DINOv2-Large + CLIP Dual Encoder",
    diffusionBackbone: "Rectified Flow Transformer (SDF VAE)",
    costCredits: 2,
    realGpuCostThb: 0.25,
    estSeconds: 6,
    license: "MIT License (ฟรี 100%)",
    description: "เหมาะสำหรับปั้นโครงขาว (White Mesh) ดูรูปทรง 360° แบบรวดเร็ว ราคาประหยัดเพียง 2 เครดิต",
  },
  hunyuan3d_2_1: {
    id: "hunyuan3d_2_1",
    name: "Hunyuan3D-2.1 Game Mesh",
    vendor: "Tencent Games AI",
    badge: "ยอดฮิตคนทำเกม • ขอบคม",
    visionBackbone: "DINOv2 Giant Patch Extractor",
    diffusionBackbone: "Hunyuan3D-DiT + Paint PBR Module",
    costCredits: 7,
    realGpuCostThb: 0.65,
    estSeconds: 18,
    license: "Community Commercial License",
    description: "เก่งงานปั้นตัวละคร อาวุธ ชุดเกราะ ขอบคมสมมาตร พร้อมควบคุมจำนวน Polygon สำหรับ Unity / Roblox",
  },
  trellis_pbr: {
    id: "trellis_pbr",
    name: "Microsoft TRELLIS.2 Ultra PBR",
    vendor: "Microsoft Research",
    badge: "สวยสุด • PBR 4K แท้",
    visionBackbone: "DINOv2 Dense Feature Grid",
    diffusionBackbone: "Structured Latent (SLAT / O-Voxel) Flow",
    costCredits: 10,
    realGpuCostThb: 0.85,
    estSeconds: 22,
    license: "MIT License (เชิงพาณิชย์ 100%)",
    description: "ตัวท็อปสุดในโลก Open-Source เก็บรายละเอียดซับซ้อน + สร้างพื้นผิว PBR (Metallic/Roughness) คมกริบเทียบเท่าเว็บนอก",
  },
};

export const STAGE_COSTS: Record<
  PipelineStage,
  { label: string; credits: number; realCostThb: number; desc: string }
> = {
  preview_2d: {
    label: "ขั้นที่ 0: เจนภาพต้นแบบ 2D (Flux Schnell + ลบพื้นหลัง BiRefNet)",
    credits: 1,
    realCostThb: 0.08,
    desc: "ดูภาพก่อนปั้นจริง ป้องกันการเสียเครดิตปั้น 3D ฟรี",
  },
  draft_3d: {
    label: "ขั้นที่ 1: ปั้นโครง 3D ด่วน (DINOv2 + TripoSG White Mesh)",
    credits: 2,
    realCostThb: 0.25,
    desc: "ปั้นหุ่น 3 มิติสีขาวเพื่อเช็กรูปทรงรอบทิศทาง 360°",
  },
  refine_pbr: {
    label: "ขั้นที่ 2: ปั้นตัวเต็ม + ลงสี HD PBR (TRELLIS / Hunyuan3D)",
    credits: 7,
    realCostThb: 0.65,
    desc: "สร้างพื้นผิว PBR (BaseColor, Metallic, Roughness, Normal) ความละเอียดสูง",
  },
  remesh_rig: {
    label: "ขั้นที่ 3: ลดโพลีกอน Quad + Auto-Rig กระดูก (Blender + UniRig)",
    credits: 3,
    realCostThb: 0.15,
    desc: "ลด Polygon ให้พร้อมใส่ Roblox / FiveM / Unity พร้อมใส่กระดูก Biped",
  },
};

const THAI_DICT: Array<{
  keywords: string[];
  en: string;
  preset: PresetArchetype;
  primaryColor: string;
  accentColor: string;
  roughness: number;
  metalness: number;
}> = [
  {
    keywords: ["ดาบ", "มีด", "ขวาน", "อาวุธ", "หอก", "ค้อน", "sword", "blade"],
    en: "legendary fantasy greatsword weapon, ornate metallic guard, glowing rune core, game-ready prop",
    preset: "sword",
    primaryColor: "#6366f1",
    accentColor: "#f59e0b",
    roughness: 0.2,
    metalness: 0.88,
  },
  {
    keywords: ["หุ่นยนต์", "กันดั้ม", "เกราะ", "ไซบอร์ก", "อัศวิน", "ตัวละคร", "mecha", "robot", "knight"],
    en: "armored sci-fi mecha warrior character, symmetrical T-pose, hard-surface titanium plates, glowing visor",
    preset: "mecha",
    primaryColor: "#3b82f6",
    accentColor: "#06b6d4",
    roughness: 0.25,
    metalness: 0.82,
  },
  {
    keywords: ["มังกร", "สัตว์", "มอนสเตอร์", "บอส", "ปีศาจ", "พญานาค", "ยักษ์", "dragon", "monster"],
    en: "mythical guardian dragon boss creature, sculpted scales, mystical horns and wings, stylized RPG boss",
    preset: "dragon",
    primaryColor: "#10b981",
    accentColor: "#fbbf24",
    roughness: 0.4,
    metalness: 0.45,
  },
  {
    keywords: ["ขวดยา", "โพชั่น", "ไอเทม", "กล่อง", "หีบ", "ถ้วย", "potion", "chest", "item"],
    en: "magical alchemist potion flask with ornate gold filigree stopper, glowing liquid inside, RPG item asset",
    preset: "potion",
    primaryColor: "#ec4899",
    accentColor: "#a855f7",
    roughness: 0.15,
    metalness: 0.6,
  },
  {
    keywords: ["รถ", "ยาน", "เรือ", "เครื่องบิน", "มอเตอร์ไซค์", "car", "ship", "vehicle"],
    en: "cyberpunk hover vehicle racer, aerodynamic chassis, neon thruster vents, FiveM / sci-fi game vehicle",
    preset: "vehicle",
    primaryColor: "#ef4444",
    accentColor: "#38bdf8",
    roughness: 0.22,
    metalness: 0.85,
  },
  {
    keywords: ["คริสตัล", "เพชร", "หิน", "เสา", "วิหาร", "ปราสาท", "บ้าน", "crystal", "tower"],
    en: "floating arcane mana crystal obelisk shrine, carved stone base, glowing geometric facets",
    preset: "crystal",
    primaryColor: "#8b5cf6",
    accentColor: "#2dd4bf",
    roughness: 0.18,
    metalness: 0.75,
  },
];

export function enhanceThaiPromptTo3D(promptTh: string): {
  promptEn: string;
  presetType: PresetArchetype;
  primaryColor: string;
  accentColor: string;
  roughness: number;
  metalness: number;
} {
  const clean = promptTh.trim().toLowerCase();

  let matched = THAI_DICT[0];
  for (const item of THAI_DICT) {
    if (item.keywords.some((kw) => clean.includes(kw))) {
      matched = item;
      break;
    }
  }

  // เช็กคำระบุสีภาษาไทยเพื่อปรับสี PBR ตามที่ลูกค้าสั่งจริง
  let primaryColor = matched.primaryColor;
  let accentColor = matched.accentColor;

  if (clean.includes("แดง") || clean.includes("ไฟ") || clean.includes("เพลิง")) {
    primaryColor = "#ef4444";
    accentColor = "#f97316";
  } else if (clean.includes("ทอง") || clean.includes("สวรรค์") || clean.includes("เทพ")) {
    primaryColor = "#f59e0b";
    accentColor = "#fef08a";
  } else if (clean.includes("เขียว") || clean.includes("มรกต") || clean.includes("พิษ")) {
    primaryColor = "#10b981";
    accentColor = "#34d399";
  } else if (clean.includes("ฟ้า") || clean.includes("น้ำแข็ง") || clean.includes("สายฟ้า")) {
    primaryColor = "#06b6d4";
    accentColor = "#60a5fa";
  } else if (clean.includes("ม่วง") || clean.includes("มืด") || clean.includes("ทมิฬ")) {
    primaryColor = "#8b5cf6";
    accentColor = "#ec4899";
  }

  const promptEn = `${matched.en}, inspired by "${promptTh}", 3D game asset, centered isometric view, clean white background, studio rim lighting, DINOv2 depth-conditioned, 4K PBR metallic-roughness texture, watertight manifold geometry`;

  return {
    promptEn,
    presetType: matched.preset,
    primaryColor,
    accentColor,
    roughness: matched.roughness,
    metalness: matched.metalness,
  };
}

async function cacheGlbLocally(remoteUrl: string, taskId?: string): Promise<string> {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return remoteUrl;
    const arrayBuffer = await res.arrayBuffer();
    const modelsDir = path.join(process.cwd(), "public", "models");
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    const filename = `${taskId || `model_${Date.now()}`}.glb`;
    const filePath = path.join(modelsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return `/models/${filename}`;
  } catch {
    return remoteUrl;
  }
}

export async function dispatchToServerlessGpu(params: {
  taskId?: string;
  engine: AI3DEngine;
  stage: PipelineStage;
  promptTh: string;
  inputImageUrl?: string | null;
}): Promise<{
  providerMode: "sandbox" | "fal_live" | "runpod_live";
  promptEn: string;
  presetType: PresetArchetype;
  primaryColor: string;
  accentColor: string;
  roughness: number;
  metalness: number;
  outputGlbUrl: string | null;
}> {
  const enhanced = enhanceThaiPromptTo3D(params.promptTh);

  const falKey = (getAppSetting("fal_api_key") || process.env.FAL_KEY || "").trim();
  if (falKey.length > 10) {
    try {
      let conditioningImageUrl = params.inputImageUrl || null;

      // Stage 1: If Text-to-3D (no image uploaded), generate clean 2D reference image via Flux Schnell
      if (!conditioningImageUrl) {
        const fluxRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: {
            Authorization: `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: enhanced.promptEn,
            image_size: "square_hd",
            num_inference_steps: 4,
          }),
        });
        if (fluxRes.ok) {
          const fluxData = await fluxRes.json();
          conditioningImageUrl = fluxData?.images?.[0]?.url || null;
        }
      }

      // Stage 2: Dispatch conditioning image to TRELLIS / Hunyuan3D-2.1 / TripoSR
      const endpoint =
        params.engine === "trellis_pbr"
          ? "https://fal.run/fal-ai/trellis"
          : params.engine === "hunyuan3d_2_1"
            ? "https://fal.run/fal-ai/hunyuan3d/v2"
            : "https://fal.run/fal-ai/triposr";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: enhanced.promptEn,
          image_url: conditioningImageUrl || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const remoteGlb = data?.model_mesh?.url || data?.mesh?.url || null;
        const cachedGlb = remoteGlb
          ? await cacheGlbLocally(remoteGlb, params.taskId)
          : null;
        return {
          providerMode: "fal_live",
          ...enhanced,
          outputGlbUrl: cachedGlb,
        };
      }
    } catch {
      // Fallback to sandbox if network fails
    }
  }

  // Sandbox Mode (ฟรี 0 บาท): สร้างโมเดล 3D แบบ Procedural PBR ใน Three.js พร้อมดาวน์โหลดเป็นไฟล์ .GLB จริงได้ทันที
  return {
    providerMode: "sandbox",
    ...enhanced,
    outputGlbUrl: null,
  };
}
