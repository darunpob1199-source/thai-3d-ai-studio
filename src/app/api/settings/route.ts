import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/db/database";
import { generatePromptPayPayload } from "@/lib/payment/promptpay";

function updateEnvLocalKey(key: string, value: string) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    let content = fs.readFileSync(envPath, "utf-8");
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}="${value}"`);
    } else {
      content += `\n${key}="${value}"\n`;
    }
    fs.writeFileSync(envPath, content, "utf-8");
  } catch {
    // Ignore filesystem errors in read-only environments
  }
}

export async function GET(req: NextRequest) {
  const amountParam = Number(req.nextUrl.searchParams.get("amount") || "150");
  const promptpayId =
    getAppSetting("promptpay_id") ||
    process.env.PROMPTPAY_ID ||
    process.env.NEXT_PUBLIC_PROMPTPAY_ID ||
    "0812345678";

  const falKey = getAppSetting("fal_api_key") || process.env.FAL_KEY || "";
  const tripoKey = getAppSetting("tripo_api_key") || process.env.TRIPO_API_KEY || "";
  const meshyKey = getAppSetting("meshy_api_key") || process.env.MESHY_API_KEY || "";
  const keyPreview =
    falKey.trim().length > 8
      ? `${falKey.trim().slice(0, 6)}••••${falKey.trim().slice(-4)}`
      : "";
  const tripoKeyPreview =
    tripoKey.trim().length > 8
      ? `${tripoKey.trim().slice(0, 6)}••••${tripoKey.trim().slice(-4)}`
      : "";

  const payload = generatePromptPayPayload(promptpayId, amountParam);

  return NextResponse.json({
    promptpayId,
    promptpayPayload: payload,
    gpuProviders: {
      falConfigured: falKey.trim().length > 8,
      keyPreview,
      tripoConfigured: tripoKey.trim().length > 8,
      tripoKeyPreview,
      meshyConfigured: meshyKey.trim().length > 8,
      activeMode:
        tripoKey.trim().length > 8 && falKey.trim().length > 8
          ? "tripo_and_fal_live"
          : tripoKey.trim().length > 8
            ? "tripo_live"
            : falKey.trim().length > 8
              ? "fal_live"
              : meshyKey.trim().length > 8
                ? "meshy_live"
                : "sandbox",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (typeof body.promptpayId === "string" && body.promptpayId.trim().length >= 10) {
      const cleanId = body.promptpayId.trim();
      setAppSetting("promptpay_id", cleanId);
      updateEnvLocalKey("PROMPTPAY_ID", cleanId);
    }
    if (body.clearFalKey === true) {
      setAppSetting("fal_api_key", "");
      updateEnvLocalKey("FAL_KEY", "");
    } else if (typeof body.falApiKey === "string" && body.falApiKey.trim().length > 0) {
      const cleanFal = body.falApiKey.trim();
      setAppSetting("fal_api_key", cleanFal);
      updateEnvLocalKey("FAL_KEY", cleanFal);
    }
    if (body.clearTripoKey === true) {
      setAppSetting("tripo_api_key", "");
      updateEnvLocalKey("TRIPO_API_KEY", "");
    } else if (typeof body.tripoApiKey === "string" && body.tripoApiKey.trim().length > 0) {
      const cleanTripo = body.tripoApiKey.trim();
      setAppSetting("tripo_api_key", cleanTripo);
      updateEnvLocalKey("TRIPO_API_KEY", cleanTripo);
    }
    if (typeof body.meshyApiKey === "string" && body.meshyApiKey.trim().length > 0) {
      const cleanMeshy = body.meshyApiKey.trim();
      setAppSetting("meshy_api_key", cleanMeshy);
      updateEnvLocalKey("MESHY_API_KEY", cleanMeshy);
    }

    const promptpayId =
      getAppSetting("promptpay_id") ||
      process.env.PROMPTPAY_ID ||
      process.env.NEXT_PUBLIC_PROMPTPAY_ID ||
      "0812345678";
    const falKey = getAppSetting("fal_api_key") || process.env.FAL_KEY || "";
    const tripoKey = getAppSetting("tripo_api_key") || process.env.TRIPO_API_KEY || "";
    const meshyKey = getAppSetting("meshy_api_key") || process.env.MESHY_API_KEY || "";
    const keyPreview =
      falKey.trim().length > 8
        ? `${falKey.trim().slice(0, 6)}••••${falKey.trim().slice(-4)}`
        : "";
    const tripoKeyPreview =
      tripoKey.trim().length > 8
        ? `${tripoKey.trim().slice(0, 6)}••••${tripoKey.trim().slice(-4)}`
        : "";

    let falTest: { valid: boolean; status: number; message: string } | null = null;
    if (body.testFal === true) {
      const candidateKey =
        (typeof body.falApiKey === "string" && body.falApiKey.trim()) || falKey.trim();
      if (!candidateKey || candidateKey.length < 8) {
        falTest = {
          valid: false,
          status: 400,
          message: "กรุณาวางคีย์ FAL_KEY (key_id:key_secret) หรือ Replicate (r8_...) ก่อนกดทดสอบ",
        };
      } else if (candidateKey.startsWith("r8_")) {
        try {
          const repProbe = await fetch("https://api.replicate.com/v1/account", {
            headers: { Authorization: `Bearer ${candidateKey}` },
          });
          if (repProbe.ok) {
            const acc = await repProbe.json().catch(() => ({}));
            falTest = {
              valid: true,
              status: 200,
              message: `เชื่อมต่อ Replicate GPU (${acc?.username || "L40S/A100"}) สำเร็จ! พร้อมรัน Hunyuan3D-2.1 (2.40฿/ตัว) & TRELLIS`,
            };
          } else {
            falTest = {
              valid: false,
              status: repProbe.status,
              message: `คีย์ Replicate (r8_...) ไม่ถูกต้อง (${repProbe.status})`,
            };
          }
        } catch (e) {
          falTest = {
            valid: false,
            status: 500,
            message: `ไม่สามารถติดต่อ Replicate API ได้: ${e instanceof Error ? e.message : "Network Error"}`,
          };
        }
      } else {
        try {
          const probeRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
              Authorization: `Key ${candidateKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });
          if (probeRes.status === 401) {
            falTest = {
              valid: false,
              status: 401,
              message: "คีย์ FAL_KEY ไม่ถูกต้อง (401 Unauthorized) กรุณาตรวจสอบ key_id:key_secret",
            };
          } else if (probeRes.status === 403) {
            const errJson = await probeRes.json().catch(() => ({}));
            falTest = {
              valid: true,
              status: 403,
              message: `เชื่อมต่อ FAL.ai สำเร็จ แต่บัญชีอาจยังไม่ได้เติมเครดิต (${errJson?.detail || "403 Forbidden"})`,
            };
          } else {
            falTest = {
              valid: true,
              status: probeRes.status,
              message: "เชื่อมต่อ FAL.ai Serverless GPU สำเร็จ 100%! พร้อมรัน TRELLIS (0.68฿/ตัว) & Hunyuan3D-2.1 (2.40฿/ตัว)",
            };
          }
        } catch (e) {
          falTest = {
            valid: false,
            status: 500,
            message: `ไม่สามารถติดต่อเกตเวย์ FAL.ai ได้: ${e instanceof Error ? e.message : "Network Error"}`,
          };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      promptpayId,
      promptpayPayload: generatePromptPayPayload(promptpayId, 150),
      falTest,
      gpuProviders: {
        falConfigured: falKey.trim().length > 8,
        keyPreview,
        tripoConfigured: tripoKey.trim().length > 8,
        tripoKeyPreview,
        meshyConfigured: meshyKey.trim().length > 8,
        activeMode:
          tripoKey.trim().length > 8 && falKey.trim().length > 8
            ? "tripo_and_fal_live"
            : tripoKey.trim().length > 8
              ? "tripo_live"
              : falKey.trim().length > 8
                ? "fal_live"
                : meshyKey.trim().length > 8
                  ? "meshy_live"
                  : "sandbox",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกการตั้งค่าไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
