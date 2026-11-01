"use client";

import React, { useState } from "react";
import { ExternalLink, ShieldCheck, ToggleRight, X } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleAuthProvider } from "@/lib/firebase/client";

interface GmailLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

function GoogleLogoSvg({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.275c0-.85-.075-1.675-.215-2.475H12v4.685h6.455c-.28 1.5-1.125 2.775-2.395 3.63v3.015h3.875c2.265-2.085 3.555-5.16 3.555-8.855z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.955-1.075 7.94-2.91l-3.875-3.015c-1.075.72-2.45 1.15-4.065 1.15-3.125 0-5.775-2.11-6.72-4.945H1.275v3.11C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.61H1.275C.465 8.225 0 10.06 0 12s.465 3.775 1.275 5.39l4.005-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.775c1.76 0 3.34.605 4.585 1.795l3.44-3.44C17.95 1.19 15.235 0 12 0 7.31 0 3.25 2.7 1.275 6.61l4.005 3.11c.945-2.835 3.595-4.945 6.72-4.945z"
      />
    </svg>
  );
}

export default function GmailLoginModal({
  isOpen,
  onClose,
  onSuccess,
}: GmailLoginModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRealFirebaseGooglePopup = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
      const firebaseIdToken = await result.user.getIdToken();
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firebaseIdToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google Auth Failed");
      onSuccess(data);
      onClose();
    } catch (err: any) {
      if (err?.code === "auth/operation-not-allowed") {
        setError(
          "เหลือแค่กดเปิดสวิตช์ Google ในหน้า Firebase Console (ลิงก์ด้านล่าง) แล้วกดปุ่มนี้อีกครั้ง หน้าต่าง accounts.google.com จะเด้งขึ้นมาทันทีครับ!"
        );
      } else if (err?.code !== "auth/popup-closed-by-user") {
        setError(err?.message || "เกิดข้อผิดพลาดในการเปิดหน้าต่าง Google Login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111622] text-slate-100 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <GoogleLogoSvg className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                เข้าสู่ระบบด้วย Google (accounts.google.com)
              </h3>
              <p className="text-[11px] text-slate-400">
                เชื่อมผ่านโปรเจกต์ Google Cloud ของคุณ (calorie-line-app)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* ปุ่มเปิด Popup accounts.google.com จริง */}
          <button
            disabled={loading}
            onClick={handleRealFirebaseGooglePopup}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs flex items-center justify-center gap-3 shadow-xl transition"
          >
            <GoogleLogoSvg className="w-5 h-5" />
            <span>
              {loading
                ? "กำลังเปิดหน้าต่าง Google (accounts.google.com)..."
                : "ดำเนินการต่อด้วย Google (Popup ของแท้)"}
            </span>
          </button>

          {error && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 leading-relaxed">
              {error}
            </div>
          )}

          {/* กล่องกดเปิดสวิตช์ใน Firebase Console 1 คลิก */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ToggleRight className="w-4 h-4" />
              ผมผูกโดเมน 3d-studio-dev.lungnuek.com เข้ากับ Google Cloud ของเพื่อนให้แล้ว!
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              เหลือแค่เพื่อนกดเปิดสวิตช์ <b>Google</b> ในหน้า Firebase (ไม่ต้องกรอก URL หรือก๊อปโค้ดใดๆ ทั้งสิ้น):
            </p>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal list-inside">
              <li>
                คลิกปุ่มด้านล่างเพื่อเปิดหน้า <b>Sign-in providers</b>
              </li>
              <li>
                คลิก <b>Add new provider</b> เลือก <b>Google</b>
              </li>
              <li>
                กดเปิดสวิตช์ <b>Enable</b> เลือกอีเมล แล้วกด <b>Save</b>
              </li>
            </ol>
            <a
              href="https://console.firebase.google.com/project/calorie-line-app/authentication/providers"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg"
            >
              <span>เปิดหน้ากดสวิตช์ Google (คลิกเดียวจบ)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Authorized Domain: 3d-studio-dev.lungnuek.com (ผูกสำเร็จแล้ว)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
