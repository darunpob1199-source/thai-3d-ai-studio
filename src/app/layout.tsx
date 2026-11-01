import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THAI 3D AI STUDIO | แพลตฟอร์มปั้นโมเดล 3D ด้วย AI สำหรับคนทำเกมไทย",
  description:
    "สร้างโมเดล 3D สำหรับเกม Roblox, FiveM, Unity, Unreal และ Blender ด้วย DINOv2 + Microsoft TRELLIS.2, Hunyuan3D-2.1 และ TripoSG ราคาคนไทย เริ่มต้นเพียง 2 บาท",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
