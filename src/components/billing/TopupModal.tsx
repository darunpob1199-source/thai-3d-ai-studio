"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Coins,
  Cpu,
  FileCheck2,
  Flame,
  History,
  KeyRound,
  QrCode,
  Receipt,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { generatePromptPayPayload } from "@/lib/payment/promptpay";
import type { CreditTransactionRecord, TopupOrderRecord, UserRecord } from "@/lib/db/database";

export interface PendingCheckoutAction {
  type: "generate" | "studio_op";
  title: string;
  modeLabel: string;
  costCredits: number;
  directPriceThb: 5 | 9 | 29;
  previewImage?: string | null;
  opPayload?: any;
}

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any, completedPendingAction?: PendingCheckoutAction | null) => void;
  user?: UserRecord | null;
  initialTab?: "topup" | "ledger" | "config";
  initialPackageId?: string | null;
  onRefreshD1?: () => void;
  transactions?: CreditTransactionRecord[];
  orders?: TopupOrderRecord[];
  pendingAction?: PendingCheckoutAction | null;
  onClearPendingAction?: () => void;
}

export interface CreditPkgItem {
  id: string;
  name: string;
  amountThb: number;
  credits: number;
  bonus: number;
  badge: string;
  subLabel: string;
  isDirect?: boolean;
  popular?: boolean;
}

export const DIRECT_PAY_ITEMS: CreditPkgItem[] = [
  {
    id: "direct_5",
    name: "Standard PBR (TRELLIS)",
    amountThb: 5,
    credits: 1,
    bonus: 0,
    badge: "จ่ายรายตัว • ปั้นทันที",
    subLabel: "ปั้นโมเดล TRELLIS PBR หรือ AI Texture 1 ครั้ง",
    isDirect: true,
  },
  {
    id: "direct_9",
    name: "Pro HD (Hunyuan3D-2.1)",
    amountThb: 9,
    credits: 2,
    bonus: 0,
    badge: "ตัวท็อป 4K PBR • ปั้นทันที",
    subLabel: "ปั้นตัวท็อป Hunyuan3D-2.1 PBR หรือ Auto-Rig 1 ครั้ง",
    isDirect: true,
  },
];

export const CREDIT_PACK_ITEMS: CreditPkgItem[] = [
  {
    id: "starter_29",
    name: "Starter Pack",
    amountThb: 29,
    credits: 6,
    bonus: 0,
    badge: "โปรลองของ",
    subLabel: "ปั้นได้ 6 ตัว (เฉลี่ย 4.83฿/ตัว)",
  },
  {
    id: "mini_59",
    name: "Mini Pack",
    amountThb: 59,
    credits: 15,
    bonus: 3,
    badge: "โปรเกมเมอร์",
    subLabel: "ปั้นได้ 15 ตัว (เฉลี่ย 3.93฿/ตัว)",
  },
  {
    id: "creator_99",
    name: "Creator Pack",
    amountThb: 99,
    credits: 30,
    bonus: 10,
    badge: "ขายดีอันดับ 1 🔥",
    subLabel: "ปั้นได้ 30 ตัว (เฉลี่ย 3.30฿/ตัว)",
    popular: true,
  },
  {
    id: "pro_199",
    name: "Pro Studio",
    amountThb: 199,
    credits: 65,
    bonus: 25,
    badge: "สายปั้นจริงจัง",
    subLabel: "ปั้นได้ 65 ตัว (เฉลี่ย 3.06฿/ตัว)",
  },
  {
    id: "vip_490",
    name: "Studio VIP",
    amountThb: 490,
    credits: 180,
    bonus: 80,
    badge: "คุ้มสุด -46%",
    subLabel: "ปั้นได้ 180 ตัว (เฉลี่ย 2.72฿/ตัว)",
  },
];

async function computeFileSha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `SLIP_${hex.slice(0, 18)}`;
}

export default function TopupModal({
  isOpen,
  onClose,
  onSuccess,
  user = null,
  initialTab = "topup",
  initialPackageId = null,
  onRefreshD1,
  transactions = [],
  orders = [],
  pendingAction = null,
  onClearPendingAction,
}: TopupModalProps) {
  const [activeTab, setActiveTab] = useState<"topup" | "ledger" | "config">(initialTab);
  const [selectedPkg, setSelectedPkg] = useState<CreditPkgItem>(CREDIT_PACK_ITEMS[2]);
  const [promptpayId, setPromptpayId] = useState("0812345678");
  const [falApiKey, setFalApiKey] = useState("");
  const [tripoApiKey, setTripoApiKey] = useState("");
  const [keyPreview, setKeyPreview] = useState("");
  const [tripoKeyPreview, setTripoKeyPreview] = useState("");
  const [gpuMode, setGpuMode] = useState<string>("sandbox");
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipName, setSlipName] = useState<string>("");
  const [slipRef, setSlipRef] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [testingFal, setTestingFal] = useState(false);
  const [falTestResult, setFalTestResult] = useState<{
    valid: boolean;
    status: number;
    message: string;
  } | null>(null);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (pendingAction) {
        const targetDirect =
          pendingAction.costCredits > 2
            ? CREDIT_PACK_ITEMS[0]
            : pendingAction.directPriceThb === 9
              ? DIRECT_PAY_ITEMS[1]
              : DIRECT_PAY_ITEMS[0];
        setSelectedPkg(targetDirect);
      } else if (initialPackageId) {
        const allItems = [...DIRECT_PAY_ITEMS, ...CREDIT_PACK_ITEMS];
        const matched = allItems.find((item) => item.id === initialPackageId);
        setSelectedPkg(matched || CREDIT_PACK_ITEMS[2]);
      } else {
        setSelectedPkg(CREDIT_PACK_ITEMS[2]); // Default to Creator Pack 99฿
      }
    }
  }, [isOpen, initialTab, initialPackageId, pendingAction]);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/settings?amount=${selectedPkg.amountThb}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.promptpayId) setPromptpayId(d.promptpayId);
        if (d.gpuProviders?.activeMode) setGpuMode(d.gpuProviders.activeMode);
        if (typeof d.gpuProviders?.keyPreview === "string") {
          setKeyPreview(d.gpuProviders.keyPreview);
        }
        if (typeof d.gpuProviders?.tripoKeyPreview === "string") {
          setTripoKeyPreview(d.gpuProviders.tripoKeyPreview);
        }
      })
      .catch(() => {});
  }, [isOpen, selectedPkg.amountThb]);

  if (!isOpen) return null;

  const emvPayload = generatePromptPayPayload(promptpayId, selectedPkg.amountThb);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    emvPayload
  )}`;

  const handleSlipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSlipName(file.name);
    const reader = new FileReader();
    reader.onload = () => setSlipPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const hashRef = await computeFileSha256(file);
      setSlipRef(hashRef);
    } catch {
      setSlipRef(`SLIP_${Date.now()}`);
    }
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPkg.id,
          slipRef: slipRef || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เติมเครดิตไม่สำเร็จ");
      const actionToRun = pendingAction;
      setSlipPreview(null);
      setSlipRef("");
      setSlipName("");
      if (onClearPendingAction) onClearPendingAction();
      onSuccess(data, actionToRun);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStudioConfig = async () => {
    setLoading(true);
    setConfigSavedMsg(null);
    setFalTestResult(null);
    setError(null);
    try {
      const hasNewFalKey = falApiKey.trim().length > 0;
      const hasNewTripoKey = tripoApiKey.trim().length > 0;
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptpayId,
          ...(hasNewFalKey ? { falApiKey: falApiKey.trim(), testFal: true } : {}),
          ...(hasNewTripoKey ? { tripoApiKey: tripoApiKey.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      if (data.gpuProviders?.activeMode) setGpuMode(data.gpuProviders.activeMode);
      if (typeof data.gpuProviders?.keyPreview === "string") {
        setKeyPreview(data.gpuProviders.keyPreview);
      }
      if (typeof data.gpuProviders?.tripoKeyPreview === "string") {
        setTripoKeyPreview(data.gpuProviders.tripoKeyPreview);
      }
      if (data.falTest) {
        setFalTestResult(data.falTest);
      }
      setFalApiKey("");
      setTripoApiKey("");
      setConfigSavedMsg("บันทึก PromptPay ID & Serverless GPU ลงฐานข้อมูล Cloudflare D1 เรียบร้อยแล้ว!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleTestFalConnection = async () => {
    setTestingFal(true);
    setConfigSavedMsg(null);
    setFalTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testFal: true,
          ...(falApiKey.trim().length > 0 ? { falApiKey: falApiKey.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ทดสอบไม่สำเร็จ");
      if (data.gpuProviders?.activeMode) setGpuMode(data.gpuProviders.activeMode);
      if (typeof data.gpuProviders?.keyPreview === "string") {
        setKeyPreview(data.gpuProviders.keyPreview);
      }
      if (data.falTest) {
        setFalTestResult(data.falTest);
      }
      if (falApiKey.trim().length > 0) setFalApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setTestingFal(false);
    }
  };

  const handleClearFalKey = async () => {
    setLoading(true);
    setConfigSavedMsg(null);
    setFalTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearFalKey: true, clearTripoKey: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบคีย์ไม่สำเร็จ");
      setGpuMode(data.gpuProviders?.activeMode || "sandbox");
      setKeyPreview("");
      setTripoKeyPreview("");
      setFalApiKey("");
      setTripoApiKey("");
      setConfigSavedMsg("สลับกลับสู่โหมด Sandbox (ใช้คลังโมเดล .GLB ในระบบ ฟรี 0 บาท) เรียบร้อยแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#110b0e] border border-red-500/25 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-red-500/15 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-[0_0_16px_rgba(239,68,68,0.4)]">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight flex items-center gap-2">
                <span>PromptPay QR Checkout & แพ็กเกจเครดิต</span>
                {pendingAction && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-bold text-amber-300">
                    ⚡ พร้อมปั้นทันทีหลังโอน
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-400">
                สแกนด่วนรายตัว 5฿ / 9฿ หรือเติมแพ็กเริ่ม 29฿ (เฉลี่ย 2.72฿/ตัว) • เครดิตไม่มีวันหมดอายุ
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (onClearPendingAction) onClearPendingAction();
              onClose();
            }}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Cloudflare D1 Credit Balance Status Bar */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-red-500/15 via-[#180d12] to-rose-500/15 border-b border-red-500/20 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4 text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <span>เครดิตคงเหลือของคุณ:</span>
                <span className="text-red-400 text-sm">{user ? user.credits_balance : 0} 🪙</span>
                <span className="text-[10px] font-normal text-slate-400">
                  (Standard TRELLIS = 1 🪙 • Pro HD Hunyuan3D-2.1 = 2 🪙)
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user
                  ? `บัญชี: ${user.name} (${user.email}) • ซิงค์ตรงกับ Cloudflare D1`
                  : "กรุณาเข้าสู่ระบบด้วย Gmail ก่อนทำรายการ"}
              </div>
            </div>
          </div>
          {onRefreshD1 && (
            <button
              onClick={onRefreshD1}
              className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[10px] font-semibold text-slate-200 shrink-0 transition cursor-pointer"
            >
              🔄 ซิงค์ D1
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 border-b border-red-500/15 bg-[#090709]/60 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab("topup")}
            className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === "topup"
                ? "border-red-500 text-red-300 bg-red-500/10"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>สแกนจ่าย / เติมแพ็ก</span>
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === "ledger"
                ? "border-red-500 text-red-300 bg-red-500/10"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>ประวัติ ({transactions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === "config"
                ? "border-red-500 text-red-300 bg-red-500/10"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ตั้งค่า GPU/QR</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto no-scrollbar">
          {activeTab === "topup" && (
            <>
              {/* Pending Action Alert Banner when triggered from Generate / Studio Op */}
              {pendingAction && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-red-600/20 via-rose-600/15 to-amber-500/15 border border-red-500/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {pendingAction.previewImage ? (
                      <img
                        src={pendingAction.previewImage}
                        alt="Pending task"
                        className="w-10 h-10 rounded-lg object-cover border border-red-400/40 shrink-0 bg-black/50"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-400/40 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-red-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>รายการที่รอปั้นทันทีหลังสแกนจ่าย ({pendingAction.modeLabel})</span>
                      </div>
                      <div className="text-xs font-extrabold text-white truncate">
                        “{pendingAction.title}”
                      </div>
                      <div className="text-[10px] text-slate-300">
                        ใช้ {pendingAction.costCredits} เครดิต • สแกนจ่ายเฉพาะตัวนี้เพียง{" "}
                        <span className="text-red-300 font-bold">฿{pendingAction.directPriceThb}.00</span>{" "}
                        หรือเติมแพ็กเครดิตด้านล่างได้เลย
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Instant Pay-Per-Model QR (25฿ / 39฿) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>1. ขาจรจ่ายรายตัว (Instant Pay-Per-Model QR • ไม่ต้องซื้อแพ็ก)</span>
                  </span>
                  <span className="text-[10px] text-amber-300/90 font-medium">
                    สแกนปุ๊บ ปั้นโมเดลให้ทันที!
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DIRECT_PAY_ITEMS.map((item) => {
                    const active = selectedPkg.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedPkg(item)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? "bg-gradient-to-r from-red-600/25 to-amber-500/15 border-red-400 text-white shadow-[0_0_18px_rgba(239,68,68,0.25)]"
                            : "bg-zinc-900/70 border-white/[0.07] text-zinc-400 hover:text-zinc-200 hover:border-white/15"
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] text-amber-300 font-bold mb-0.5">
                            {item.badge}
                          </span>
                          <div className="text-xs font-extrabold text-white truncate">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.subLabel}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-red-400">
                            ฿{item.amountThb}
                          </div>
                          <div className="text-[10px] font-bold text-slate-300">
                            +{item.credits} 🪙
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: 5 Value Credit Packages (59฿ / 99฿ / 299฿ / 690฿ / 1,990฿) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-red-400" />
                    <span>2. แพ็กเกจเครดิตสุดคุ้ม (ถูกกว่ารายตัวสูงสุด 55% • เครดิตไม่มีวันหมดอายุ)</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {CREDIT_PACK_ITEMS.map((pkg) => {
                    const active = selectedPkg.id === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPkg(pkg)}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer relative flex flex-col justify-between ${
                          active
                            ? "bg-red-600/25 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]"
                            : pkg.popular
                              ? "bg-red-950/30 border-red-500/35 text-zinc-200 hover:border-red-400"
                              : "bg-zinc-900/70 border-white/[0.07] text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold mb-1 ${
                              pkg.popular
                                ? "bg-red-500 text-white"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {pkg.badge}
                          </span>
                          <div className="text-[11px] font-bold text-zinc-200 truncate">
                            {pkg.name}
                          </div>
                        </div>
                        <div className="my-1">
                          <div className="text-sm font-black text-white leading-tight">
                            {pkg.credits} 🪙
                          </div>
                          <div className="text-[9px] text-slate-400 leading-tight mt-0.5">
                            {pkg.subLabel.split(" ")[0]} {pkg.subLabel.split(" ")[1]}{" "}
                            {pkg.subLabel.split(" ")[2]}
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-red-400">
                          ฿{pkg.amountThb.toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* EMVCo Thai PromptPay QR Code & Slip Upload Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Real EMVCo QR Box */}
                <div className="bg-white rounded-xl p-3 flex flex-col items-center text-zinc-900 shadow-inner">
                  <div className="w-full flex items-center justify-between px-2 pb-1.5 mb-1.5 border-b border-zinc-200">
                    <span className="text-[10px] font-extrabold text-[#113566] tracking-wide">
                      THAI QR PAYMENT
                    </span>
                    <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                      PromptPay
                    </span>
                  </div>
                  <img
                    src={qrImageUrl}
                    alt="Thai PromptPay QR"
                    className="w-32 h-32 object-contain rounded-lg border border-zinc-200"
                  />
                  <div className="text-xs font-extrabold mt-1.5 text-zinc-900">
                    ยอดโอน ฿{selectedPkg.amountThb.toLocaleString()}.00 บาท
                  </div>
                  <div className="text-[10px] text-red-600 font-bold">
                    ({selectedPkg.name} • รับ +{selectedPkg.credits} เครดิต)
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                    ID: {promptpayId} • CRC: {emvPayload.slice(-4)}
                  </div>
                </div>

                {/* Slip Verification Upload Box */}
                <div className="rounded-xl bg-[#160d11] border border-red-500/20 p-3 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <FileCheck2 className="w-3.5 h-3.5 text-red-400" />
                      <span>แนบสลิปโอนเงิน (Verify Slip)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      อัปโหลดภาพสลิปธนาคาร ระบบตรวจสอบ SHA-256 ป้องกันสลิปซ้ำและเติมเครดิตทันที
                    </p>
                  </div>

                  <label className="flex-1 min-h-[96px] rounded-xl border border-dashed border-red-400/35 hover:border-red-400 bg-black/30 hover:bg-red-500/[0.06] flex flex-col items-center justify-center p-2 text-center cursor-pointer transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSlipFileChange}
                      className="hidden"
                    />
                    {slipPreview ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={slipPreview}
                          alt="Slip preview"
                          className="h-12 w-auto object-contain rounded border border-white/20 mb-1"
                        />
                        <span className="text-[10px] text-emerald-300 font-semibold truncate max-w-[160px]">
                          ✓ {slipName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {slipRef}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-red-400 mb-1" />
                        <span className="text-[11px] font-semibold text-slate-200">
                          คลิกอัปโหลดรูปสลิปธนาคาร
                        </span>
                        <span className="text-[9px] text-slate-500 mt-0.5">
                          รองรับ K+, SCB, Krungthai, BBL, TrueMoney
                        </span>
                      </>
                    )}
                  </label>

                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>เครดิตไม่มีวันหมดอายุ • ปั้นโมเดลต่อให้อัตโนมัติ</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-center">
                  {error}
                </div>
              )}

              <button
                disabled={loading}
                onClick={handleConfirmPayment}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-[0_6px_20px_rgba(220,38,38,0.35)] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {loading
                    ? "กำลังตรวจสอบสลิปและดำเนินการ..."
                    : pendingAction
                      ? `ยืนยันการโอน ฿${selectedPkg.amountThb.toLocaleString()} (+${selectedPkg.credits} 🪙) & เริ่มปั้นโมเดลทันที!`
                      : slipRef
                        ? `ยืนยันสลิป ${slipRef.slice(0, 12)}... (฿${selectedPkg.amountThb.toLocaleString()} • +${selectedPkg.credits} เครดิต)`
                        : `ยืนยันการโอนเงิน ฿${selectedPkg.amountThb.toLocaleString()} (+${selectedPkg.credits} เครดิต)`}
                </span>
              </button>
            </>
          )}

          {activeTab === "ledger" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-red-400" />
                  <span>ประวัติธุรกรรมเครดิตล่าสุด (Credit Ledger)</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  บันทึกใน SQLite / Cloudflare D1
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center text-xs text-slate-400">
                  ยังไม่มีประวัติธุรกรรมเครดิต
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
                  {transactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <div
                        key={tx.id}
                        className="p-2.5 rounded-xl bg-[#160d11] border border-white/[0.06] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {tx.description}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="uppercase text-red-300 font-mono">
                              {tx.type}
                            </span>
                            <span>•</span>
                            <span>{tx.created_at}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs font-extrabold ${
                              isPositive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPositive ? `+${tx.amount}` : tx.amount} 🪙
                          </div>
                          <div className="text-[10px] text-slate-500">
                            คงเหลือ {tx.balance_after} 🪙
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "config" && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-red-400" />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>สถานะ AI 3D GPU Pipeline ปัจจุบัน</span>
                      {tripoKeyPreview && (
                        <span className="px-1.5 py-0.5 rounded bg-black/50 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                          Tripo: {tripoKeyPreview}
                        </span>
                      )}
                      {keyPreview && (
                        <span className="px-1.5 py-0.5 rounded bg-black/50 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                          FAL: {keyPreview}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      {gpuMode !== "sandbox"
                        ? "เชื่อมต่อ Serverless GPU แท้ (Tencent Hunyuan3D-2.1 PBR 2.40฿ + Microsoft TRELLIS 0.68฿)"
                        : "โหมด Pre-Baked Studio Sandbox (ใช้โมเดล .GLB แท้ในระบบ ฟรี 0 บาท)"}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                    gpuMode !== "sandbox"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                      : "bg-red-500/20 text-red-300 border border-red-400/40"
                  }`}
                >
                  {gpuMode.toUpperCase()}
                </span>
              </div>

              {/* Option A: FAL.ai / Replicate Serverless GPU Key (Primary) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-red-400" />
                    <span>Serverless GPU Key (`FAL_KEY` หรือ `Replicate r8_...` — ต้นทุน 0.68฿–2.40฿/ตัว)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <a
                      href="https://fal.ai/dashboard/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-red-300 hover:underline"
                    >
                      คีย์ fal.ai ↗
                    </a>
                    <span className="text-[10px] text-slate-500">|</span>
                    <a
                      href="https://replicate.com/account/api-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-amber-300 hover:underline"
                    >
                      คีย์ replicate.com ↗
                    </a>
                  </div>
                </div>
                <input
                  type="password"
                  value={falApiKey}
                  onChange={(e) => setFalApiKey(e.target.value)}
                  placeholder={
                    keyPreview
                      ? `มีคีย์ GPU บันทึกไว้แล้ว (${keyPreview}) — วางคีย์ใหม่หากต้องการเปลี่ยน...`
                      : "วางคีย์ FAL (key_id:key_secret) หรือ Replicate (r8_...) ที่นี่..."
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#090709] border border-red-500/25 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  รันโมเดลระดับเรือธงคิดตามวินาทีจริง: <span className="text-emerald-300 font-semibold">Microsoft TRELLIS (0.68฿–1.25฿/ตัว)</span> + <span className="text-amber-300 font-semibold">Tencent Hunyuan3D-2.1 PBR (2.40฿/ตัว)</span> + Flux Schnell (0.10฿)
                </p>
              </div>

              {/* Option B: Official Tripo3D OpenAPI Key (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tripo3D Official API Key (`tsk_...` ตัวเลือกเสริม)</span>
                  </label>
                  <a
                    href="https://platform.tripo3d.ai/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-amber-300 hover:underline"
                  >
                    platform.tripo3d.ai ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={tripoApiKey}
                  onChange={(e) => setTripoApiKey(e.target.value)}
                  placeholder={
                    tripoKeyPreview
                      ? `มีคีย์ Tripo3D บันทึกไว้แล้ว (${tripoKeyPreview}) — วางคีย์ใหม่หากต้องการเปลี่ยน...`
                      : "วางคีย์ tsk_... จาก platform.tripo3d.ai (ถ้าต้องการใช้ Tripo ตรง)..."
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#090709] border border-red-500/25 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-red-400" />
                  <span>เบอร์พร้อมเพย์ / เลขนิติบุคคล 13 หลัก (PromptPay Merchant ID)</span>
                </label>
                <input
                  type="text"
                  value={promptpayId}
                  onChange={(e) => setPromptpayId(e.target.value)}
                  placeholder="เช่น 0812345678 หรือ 0105560000000"
                  className="w-full px-3 py-2 rounded-xl bg-[#090709] border border-red-500/25 text-xs text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[10px] text-slate-400">
                  ใช้สร้าง EMVCo Thai QR Code สแกนจ่ายเข้าบัญชีของคุณโดยตรง (ทั้งรายตัว 5฿/9฿ และแพ็ก 29฿–490฿)
                </p>
              </div>

              {falTestResult && (
                <div
                  className={`p-2.5 rounded-xl border text-xs text-center font-medium ${
                    falTestResult.valid
                      ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                      : "bg-rose-500/15 border-rose-500/35 text-rose-300"
                  }`}
                >
                  {falTestResult.message}
                </div>
              )}

              {configSavedMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 text-center">
                  {configSavedMsg}
                </div>
              )}

              {error && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-center">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  disabled={loading || testingFal}
                  onClick={handleSaveStudioConfig}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  {loading
                    ? "กำลังบันทึก & ตรวจสอบ..."
                    : "บันทึกการตั้งค่า GPU & PromptPay"}
                </button>
                <button
                  disabled={loading || testingFal}
                  onClick={handleTestFalConnection}
                  className="px-3 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-semibold text-slate-200 transition cursor-pointer shrink-0"
                >
                  {testingFal ? "กำลังเช็ค..." : "เช็คคีย์ FAL (0฿)"}
                </button>
              </div>

              {(keyPreview || tripoKeyPreview) && (
                <button
                  disabled={loading || testingFal}
                  onClick={handleClearFalKey}
                  className="w-full py-1.5 rounded-xl bg-transparent hover:bg-white/[0.04] border border-white/10 text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                >
                  สลับกลับโหมด Sandbox (ลบคีย์ GPU ออกจาก D1)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
