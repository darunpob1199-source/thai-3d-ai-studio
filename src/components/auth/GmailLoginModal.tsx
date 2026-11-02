"use client";

import React, { useState } from "react";
import { Box, X } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleAuthProvider } from "@/lib/firebase/client";

interface GmailLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export function GoogleLogoSvg({ className = "w-5 h-5" }: { className?: string }) {
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

export async function triggerGooglePopupLogin(): Promise<any> {
  const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
  const firebaseIdToken = await result.user.getIdToken();
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firebaseIdToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "ไม่สามารถเข้าสู่ระบบด้วย Google ได้");
  return data;
}

export default function GmailLoginModal({
  isOpen,
  onClose,
  onSuccess,
}: GmailLoginModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await triggerGooglePopupLogin();
      onSuccess(data);
      onClose();
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        setError("ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0b0708] text-zinc-100 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden border border-red-500/20 relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pt-7 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(239,68,68,0.45)]">
            <Box className="w-6 h-6 text-white" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white tracking-tight">
              เข้าสู่ระบบ Prism3D Studio
            </h3>
            <p className="text-xs text-zinc-400">
              เข้าสู่ระบบด้วยบัญชี Google เพื่อสร้างและบันทึกโมเดล 3D
            </p>
          </div>

          <button
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 disabled:opacity-60 text-zinc-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg transition cursor-pointer"
          >
            <GoogleLogoSvg className="w-4 h-4" />
            <span>{loading ? "กำลังเข้าสู่ระบบ..." : "ดำเนินการต่อด้วย Google"}</span>
          </button>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
