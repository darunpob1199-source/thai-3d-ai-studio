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

  const payload = generatePromptPayPayload(promptpayId, amountParam);

  return NextResponse.json({
    promptpayId,
    promptpayPayload: payload,
    gpuProviders: {
      falConfigured: falKey.trim().length > 8,
      tripoConfigured: tripoKey.trim().length > 8,
      meshyConfigured: meshyKey.trim().length > 8,
      activeMode:
        falKey.trim().length > 8
          ? "fal_live"
          : tripoKey.trim().length > 8
            ? "tripo_live"
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
    if (typeof body.falApiKey === "string" && body.falApiKey.trim().length > 0) {
      const cleanFal = body.falApiKey.trim();
      setAppSetting("fal_api_key", cleanFal);
      updateEnvLocalKey("FAL_KEY", cleanFal);
    }
    if (typeof body.tripoApiKey === "string" && body.tripoApiKey.trim().length > 0) {
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

    return NextResponse.json({
      ok: true,
      promptpayId,
      promptpayPayload: generatePromptPayPayload(promptpayId, 150),
      gpuProviders: {
        falConfigured: falKey.trim().length > 8,
        tripoConfigured: tripoKey.trim().length > 8,
        meshyConfigured: meshyKey.trim().length > 8,
        activeMode:
          falKey.trim().length > 8
            ? "fal_live"
            : tripoKey.trim().length > 8
              ? "tripo_live"
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
