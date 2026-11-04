"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Coins,
  Cpu,
  FileCheck2,
  History,
  KeyRound,
  QrCode,
  Receipt,
  Settings,
  ShieldCheck,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { generatePromptPayPayload } from "@/lib/payment/promptpay";
import type { CreditTransactionRecord, TopupOrderRecord, UserRecord } from "@/lib/db/database";

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  user?: UserRecord | null;
  initialTab?: "topup" | "ledger" | "config";
  onRefreshD1?: () => void;
  transactions?: CreditTransactionRecord[];
  orders?: TopupOrderRecord[];
}

const PACKAGES = [
  {
    id: "starter_50",
    name: "Starter",
    amountThb: 50,
    credits: 50,
    bonus: 0,
    badge: "เริ่มต้นประหยัด",
  },
  {
    id: "indie_150",
    name: "Indie Dev",
    amountThb: 150,
    credits: 170,
    bonus: 20,
    badge: "ขายดี +20 ฟรี",
  },
  {
    id: "pro_390",
    name: "Pro Studio",
    amountThb: 390,
    credits: 500,
    bonus: 110,
    badge: "คุ้มสุด +110 ฟรี",
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
  onRefreshD1,
  transactions = [],
  orders = [],
}: TopupModalProps) {
  const [activeTab, setActiveTab] = useState<"topup" | "ledger" | "config">(initialTab);
  const [selectedPkg, setSelectedPkg] = useState(PACKAGES[1]);
  const [promptpayId, setPromptpayId] = useState("0812345678");
  const [falApiKey, setFalApiKey] = useState("");
  const [gpuMode, setGpuMode] = useState<string>("sandbox");
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipName, setSlipName] = useState<string>("");
  const [slipRef, setSlipRef] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/settings?amount=${selectedPkg.amountThb}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.promptpayId) setPromptpayId(d.promptpayId);
        if (d.gpuProviders?.activeMode) setGpuMode(d.gpuProviders.activeMode);
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
      setSlipPreview(null);
      setSlipRef("");
      setSlipName("");
      onSuccess(data);
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
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptpayId,
          ...(falApiKey.trim().length > 0 ? { falApiKey: falApiKey.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      if (data.gpuProviders?.activeMode) setGpuMode(data.gpuProviders.activeMode);
      setFalApiKey("");
      setConfigSavedMsg("บันทึก PromptPay ID & Serverless GPU เรียบร้อยแล้ว!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#110b0e] border border-red-500/25 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-red-500/15 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                PromptPay QR & Studio Ledger
              </h3>
              <p className="text-[10px] text-slate-400">
                มาตรฐาน EMVCo Thai QR • เช็คสลิปกันซ้ำด้วย SHA-256
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
                <span>เครดิตจริงใน Cloudflare D1:</span>
                <span className="text-red-400 text-sm">{user ? user.credits_balance : 0} 🪙</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user
                  ? `บัญชี: ${user.name} (${user.email}) • บันทึกธุรกรรม ${transactions.length} รายการ`
                  : "กรุณาเข้าสู่ระบบเพื่อซิงค์เครดิตจาก Cloudflare D1"}
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
            <span>เติมเครดิต QR</span>
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
        <div className="p-5 space-y-4 overflow-y-auto no-scrollbar">
          {activeTab === "topup" && (
            <>
              {/* แพ็กเกจ 3 ปุ่ม */}
              <div className="grid grid-cols-3 gap-2">
                {PACKAGES.map((pkg) => {
                  const active = selectedPkg.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPkg(pkg)}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer relative ${
                        active
                          ? "bg-red-600/20 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                          : "bg-zinc-900/70 border-white/[0.07] text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="inline-block px-1.5 py-0.2 rounded-full bg-red-500/20 text-[9px] text-red-300 font-semibold mb-1">
                        {pkg.badge}
                      </span>
                      <div className="text-xs font-medium text-zinc-300">{pkg.name}</div>
                      <div className="text-base font-extrabold text-white mt-0.5">
                        {pkg.credits} 🪙
                      </div>
                      <div className="text-xs font-bold text-red-400 mt-0.5">
                        ฿{pkg.amountThb}.00
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* EMVCo Thai PromptPay QR Code & Slip Upload Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Real EMVCo QR Box */}
                <div className="bg-white rounded-xl p-3.5 flex flex-col items-center text-zinc-900 shadow-inner">
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
                    className="w-36 h-36 object-contain rounded-lg border border-zinc-200"
                  />
                  <div className="text-xs font-extrabold mt-2 text-zinc-900">
                    ยอดโอน ฿{selectedPkg.amountThb}.00 บาท
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    ID: {promptpayId} • CRC: {emvPayload.slice(-4)}
                  </div>
                </div>

                {/* Slip Verification Upload Box */}
                <div className="rounded-xl bg-[#160d11] border border-red-500/20 p-3.5 flex flex-col justify-between space-y-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <FileCheck2 className="w-3.5 h-3.5 text-red-400" />
                      <span>แนบสลิปโอนเงิน (Verify Slip)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      อัปโหลดภาพสลิปธนาคาร ระบบจะเข้ารหัส SHA-256 เพื่อป้องกันสลิปซ้ำและเติมเครดิตทันที
                    </p>
                  </div>

                  <label className="flex-1 min-h-[104px] rounded-xl border border-dashed border-red-400/35 hover:border-red-400 bg-black/30 hover:bg-red-500/[0.06] flex flex-col items-center justify-center p-2 text-center cursor-pointer transition">
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
                          className="h-14 w-auto object-contain rounded border border-white/20 mb-1"
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
                    <span>เครดิตไม่มีวันหมดอายุ • ออกใบเสร็จอัตโนมัติ</span>
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
                    ? "กำลังตรวจสอบสลิปและเติมเครดิต..."
                    : slipRef
                      ? `ยืนยันสลิป ${slipRef.slice(0, 12)}... (+${selectedPkg.credits} เครดิต)`
                      : `ยืนยันการโอนเงิน (+${selectedPkg.credits} เครดิต)`}
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
                    <div className="text-xs font-bold text-white">
                      สถานะ AI 3D GPU Pipeline ปัจจุบัน
                    </div>
                    <div className="text-[10px] text-slate-300">
                      {gpuMode === "fal_live"
                        ? "เชื่อมต่อ Serverless GPU แท้ (Flux Schnell -> TRELLIS / Hunyuan3D)"
                        : "โหมด Procedural Sandbox (สร้างโมเดล 3D ทันที ฟรี 0 บาท)"}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    gpuMode === "fal_live"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                      : "bg-red-500/20 text-red-300 border border-red-400/40"
                  }`}
                >
                  {gpuMode}
                </span>
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
                  ใช้สร้าง EMVCo Thai QR Code สแกนจ่ายเข้าบัญชีของคุณโดยตรง
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-red-400" />
                  <span>FAL.ai Serverless GPU Key (`FAL_KEY` สำหรับ TRELLIS / Hunyuan3D)</span>
                </label>
                <input
                  type="password"
                  value={falApiKey}
                  onChange={(e) => setFalApiKey(e.target.value)}
                  placeholder="ใส่คีย์ key_id:key_secret เพื่อเปิดโหมด GPU ของจริง..."
                  className="w-full px-3 py-2 rounded-xl bg-[#090709] border border-red-500/25 text-xs text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[10px] text-slate-400">
                  เมื่อใส่คีย์ ระบบจะรัน Stage 1 (Flux Schnell 2D) ต่อด้วย Stage 2 (TRELLIS / Hunyuan3D-2.1) และดาวน์โหลดไฟล์ .GLB เก็บลงเซิร์ฟเวอร์อัตโนมัติ
                </p>
              </div>

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

              <button
                disabled={loading}
                onClick={handleSaveStudioConfig}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs transition cursor-pointer"
              >
                {loading ? "กำลังบันทึก..." : "บันทึกการตั้งค่า PromptPay & GPU"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
