"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Heart,
  Bookmark,
  Sparkles,
  Wand2,
  Printer,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { GenerationTaskRecord } from "@/lib/db/database";

export type ShowcaseModelItem = GenerationTaskRecord & {
  categoryTag: string;
  clay_image_url?: string;
  isFeatured?: boolean;
  isPrintReady?: boolean;
  likes?: number;
  collects?: number;
  authorName?: string;
};

// ============================================================================
// 1. TRIPO STUDIO CANVAS PERIMETER COMET BORDER (`HomeInputBorderFlow` port)
// ============================================================================
export function HomeInputBorderFlow({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let startTime: number | null = null;
    const durationMs = 6500;
    const stepPct = 0.5;
    const maxRadius = 14;

    // Crimson & White dual comet stops along [0..100] perimeter percentage
    const colors = {
      transparentRed: [220, 38, 38, 0] as [number, number, number, number],
      crimson: [239, 68, 68, 0.75] as [number, number, number, number],
      white: [255, 240, 242, 1] as [number, number, number, number],
    };

    const comets: [number, [number, number, number, number]][][] = [
      [
        [20, colors.transparentRed],
        [28, colors.crimson],
        [32, colors.white],
        [35, colors.transparentRed],
      ],
      [
        [70, colors.transparentRed],
        [78, colors.crimson],
        [82, colors.white],
        [85, colors.transparentRed],
      ],
    ];

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const sampleCometColor = (
      stops: [number, [number, number, number, number]][],
      pct: number
    ) => {
      for (let i = 0; i < stops.length - 1; i++) {
        const [p0, c0] = stops[i];
        const [p1, c1] = stops[i + 1];
        if (pct > p1) continue;
        const t = (pct - p0) / (p1 - p0);
        return `rgb(${Math.round(lerp(c0[0], c1[0], t))} ${Math.round(
          lerp(c0[1], c1[1], t)
        )} ${Math.round(lerp(c0[2], c1[2], t))} / ${lerp(c0[3], c1[3], t).toFixed(
          3
        )})`;
      }
      const last = stops[stops.length - 1][1];
      return `rgb(${last[0]} ${last[1]} ${last[2]} / ${last[3]})`;
    };

    const segments = comets.flatMap((stops) => {
      const start = stops[0][0];
      const end = stops[stops.length - 1][0];
      const count = Math.round((end - start) / stepPct);
      return Array.from({ length: count }, (_, idx) => {
        const pos = start + idx * stepPct;
        return [pos, sampleCometColor(stops, pos + stepPct / 2)] as [
          number,
          string,
        ];
      });
    });

    let state: {
      ctx: CanvasRenderingContext2D;
      width: number;
      height: number;
      perimeter: number;
      segmentLength: number;
      track: Path2D;
    } | null = null;

    const setupGeometry = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        state = null;
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 1.35;

      const r = Math.min(rect.width / 2, rect.height / 2, maxRadius);
      const straightW = rect.width - r * 2;
      const straightH = rect.height - r * 2;
      const perimeter = straightW * 2 + straightH * 2 + Math.PI * r * 2;
      const track = new Path2D();
      track.roundRect(0.5, 0.5, rect.width - 1, rect.height - 1, r);

      state = {
        ctx,
        width: rect.width,
        height: rect.height,
        perimeter,
        segmentLength: (perimeter * stepPct) / 100,
        track,
      };
    };

    setupGeometry();
    const ro = new ResizeObserver(setupGeometry);
    ro.observe(canvas);

    const renderFrame = (ts: number) => {
      if (!state) return;
      if (startTime === null) startTime = ts;
      const progress = paused ? 0 : ((ts - startTime) % durationMs) / durationMs;
      const { ctx, width, height, perimeter, segmentLength, track } = state;

      ctx.clearRect(0, 0, width, height);
      ctx.setLineDash([segmentLength, perimeter - segmentLength]);
      for (const [offsetPct, strokeStyle] of segments) {
        ctx.lineDashOffset = -((offsetPct / 100 + progress) * perimeter);
        ctx.strokeStyle = strokeStyle;
        ctx.stroke(track);
      }

      if (!paused) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute -inset-[1px] w-[calc(100%+2px)] h-[calc(100%+2px)] z-10 transition-opacity duration-300 ${
        paused ? "opacity-30" : "opacity-100"
      }`}
    />
  );
}

// ============================================================================
// 2. TRIPO STUDIO FANNED INSPIRATION TEMPLATES (`HomeInputTemplates` port)
// ============================================================================
const INSPIRATION_TEMPLATES = [
  {
    title: "อัศวินเทมพลาร์เกราะเงิน",
    prompt: "อัศวินเทมพลาร์คุกเข่าปักดาบศักดิ์สิทธิ์ เกราะเหล็กเงินสลักลายพร้อมฐานหิน",
    image: "/models/tripo_templar_knight.webp",
  },
  {
    title: "ราชินีอสรพิษทมิฬ",
    prompt: "ราชินีอสรพิษทมิฬแห่งห้วงอเวจี เกล็ดสีนิลตัดทองคำพร้อมมงกุฎเขาอสูร",
    image: "/models/tripo_serpent_queen.webp",
  },
  {
    title: "หุ่นรบทรานส์ฟอร์เมอร์ส",
    prompt: "หุ่นรบทรานส์ฟอร์เมอร์สทมิฬ-แดง เกราะโลหะหนักพร้อมปืนไรเฟิลพลาสม่า",
    image: "/models/pro_trellis2_transformer.webp",
  },
  {
    title: "คทามรกตพฤกษาเวทย์",
    prompt: "คทามรกตพฤกษาเวทมนตร์โบราณ คริสตัลสีเขียวมรกตโอบล้อมด้วยเถาวัลย์ทองคำ",
    image: "/models/tripo_emerald_staff.webp",
  },
  {
    title: "ฟิกเกอร์สาวน้อยหมวกฟักทอง",
    prompt: "ฟิกเกอร์สาวน้อยฮาโลวีนหมวกฟักทอง สไตล์จิบิพร้อมฐานตั้งเครื่องพิมพ์ 3D",
    image: "/models/tripo_pumpkin_chibi.webp",
  },
  {
    title: "ไฮเปอร์คาร์คาร์บอน-ทอง",
    prompt: "ไฮเปอร์คาร์บูกัตติคาร์บอน-ทอง สปอยเลอร์แอโรไดนามิกและล้อแม็กซ์อัลลอย",
    image: "/models/tripo_veh_bugatti.webp",
  },
];

export function TripoInspirationFan({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (tpl: { title: string; prompt: string; image: string }) => void;
}) {
  if (!open) return null;

  return (
    <div className="mt-2.5 p-4 rounded-[14px] bg-[#160c10]/95 backdrop-blur-2xl border border-red-500/30 shadow-[0_16px_48px_rgba(0,0,0,0.65)] animate-[tripoCardEnter_220ms_cubic-bezier(0.2,0.75,0.25,1)_both]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-[12px] text-[#d4c5cb]">
          <Sparkles className="w-3.5 h-3.5 text-[#ef4444]" />
          <span>คลิกเลือกต้นแบบ 3D แนะนำ (Fanned Quick Templates)</span>
        </div>
        <span className="text-[11px] font-mono text-[#8c767e]">
          IMAGE + PROMPT → 3D
        </span>
      </div>
      <div className="flex items-center justify-center gap-4 sm:gap-5 py-2 overflow-x-auto no-scrollbar">
        {INSPIRATION_TEMPLATES.map((tpl, idx) => {
          const tiltClass =
            idx % 2 === 0 ? "-rotate-6 hover:rotate-0" : "rotate-6 hover:rotate-0";
          return (
            <button
              key={tpl.title}
              type="button"
              onClick={() => onSelect(tpl)}
              className={`group/tpl relative w-24 h-24 sm:w-28 sm:h-28 rounded-[10px] bg-gradient-to-b from-[#261118] to-[#0c0609] border border-red-500/25 hover:border-[#ef4444] shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.75,0.25,1)] ${tiltClass} hover:scale-110 hover:z-10 hover:shadow-[0_10px_28px_rgba(220,38,38,0.35)] cursor-pointer`}
            >
              <img
                src={tpl.image}
                alt={tpl.title}
                className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover/tpl:scale-105"
              />
              <div className=" inset-x-0 bottom-0 absolute bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1.5 py-1 opacity-0 group-hover/tpl:opacity-100 transition-opacity">
                <p className="text-[10px] text-white font-medium truncate">
                  {tpl.title}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 2B. TRIPO STUDIO PRESET SWITCH WITH HOVER PREVIEW (`HomeInputPresetSwitch` port)
// ============================================================================
const PRESET_MODES = [
  {
    id: "trellis_pbr" as const,
    pillLabel: "Best Quality",
    credits: "6",
    title: "High Detail Sculpt + 4K PBR",
    desc: "สร้างโมเดลรายละเอียดสูงระดับ ZBrush Sculpt พร้อมพื้นผิว Metallic/Roughness คมชัดทุกมุมมอง",
    image: "/images/tripo/hd_model.webp",
  },
  {
    id: "hunyuan3d_2_1" as const,
    pillLabel: "Clean Quad",
    credits: "2",
    title: "Smart Low-Poly Quad Mesh",
    desc: "จัดเรียงเส้นโครงข่าย Quad Topology สะอาดตา พร้อมนำไป Rigging ลงเอนจินเกมหรือพิมพ์ 3D ทันที",
    image: "/images/tripo/low-poly.webp",
  },
];

export function TripoPresetSwitch({
  selectedModel,
  onSelectModel,
}: {
  selectedModel: "triposg" | "hunyuan3d_2_1" | "trellis_pbr";
  onSelectModel: (model: "hunyuan3d_2_1" | "trellis_pbr") => void;
}) {
  const [hoveredPreset, setHoveredPreset] = useState<
    "hunyuan3d_2_1" | "trellis_pbr" | null
  >(null);

  const activeHoverItem = PRESET_MODES.find((m) => m.id === hoveredPreset);

  return (
    <div
      className="relative"
      onMouseLeave={() => setHoveredPreset(null)}
    >
      <div className="tripo-gradient-stroke p-1 rounded-full bg-black/35 backdrop-blur-md flex items-center gap-1">
        {PRESET_MODES.map((mode) => {
          const active = selectedModel === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectModel(mode.id)}
              onMouseEnter={() => setHoveredPreset(mode.id)}
              className={`h-7 px-3 rounded-full text-[12px] font-medium flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap ${
                active
                  ? "bg-[#dc2626] text-white shadow-[0_2px_10px_rgba(220,38,38,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]"
                  : "text-[#d4c5cb] hover:text-white"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  active ? "bg-white" : "bg-[#ef4444]"
                }`}
              />
              <span>{mode.pillLabel}</span>
              <span
                className={`text-[10.5px] font-mono tabular-nums ${
                  active ? "text-red-100" : "text-[#9c848b]"
                }`}
              >
                {mode.credits}
              </span>
            </button>
          );
        })}
      </div>

      {/* Floating Glass Preview Card (`hd_model.webp` / `low-poly.webp` from CROXBs8K.js) */}
      {activeHoverItem && (
        <div className="mt-2.5 p-2.5 rounded-[16px] bg-[#160c10]/90 backdrop-blur-[30px] border border-red-500/30 w-[270px] shadow-[0_12px_40px_rgba(0,0,0,0.65)] left-0 top-full absolute z-40 pointer-events-none animate-[tripoCardEnter_180ms_cubic-bezier(0.2,0.75,0.25,1)_both]">
          <div className="border border-white/10 rounded-t-[11px] h-[156px] w-full overflow-hidden relative bg-[#0b0709]">
            <img
              src={activeHoverItem.image}
              alt={activeHoverItem.title}
              className="w-full h-full object-cover"
            />
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 border border-red-500/40 text-[10px] font-mono text-red-200">
              {activeHoverItem.credits} เครดิต
            </span>
          </div>
          <div className="px-3 pb-3.5 pt-2.5 border border-white/10 border-t-0 rounded-b-[12px] bg-black/45 flex flex-col gap-1">
            <p className="text-[13px] text-white leading-tight font-medium">
              {activeHoverItem.title}
            </p>
            <p className="text-[11px] text-[#b8a6ad] leading-[1.45]">
              {activeHoverItem.desc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. TRIPO STUDIO IN-GRID 2-COLUMN SPOTLIGHT CAROUSEL (`HomeCarouselCard` port)
// ============================================================================
const BANNER_SLIDES = [
  {
    badge: "TRIPO MOTION · PBR ∣ CLAY",
    title: "เลื่อนเมาส์บนการ์ดเพื่อส่องโครงปั้น Clay 3D และเอียงมุมมอง 3 มิติ",
    desc: "ระบบคำนวณมุมเอียง Perspective 1100px พร้อมม่านไล่ระดับ 5 ชั้น (Feathered Split Mask) แยกพื้นผิว PBR และโครงปั้นดินเหนียวแบบเรียลไทม์",
    cta: "ทดลองโหมดพิมพ์ 3D",
    actionKey: "3D Printing",
    images: [
      "/models/tripo_templar_knight.webp",
      "/models/tripo_templar_knight_clay.webp",
      "/models/tripo_serpent_queen.webp",
    ],
  },
  {
    badge: "3D PRINTING READY · WATER-TIGHT",
    title: "โมเดลฟิกเกอร์พร้อมฐานตั้งสำหรับเครื่องพิมพ์ 3D (.STL / .GLB)",
    desc: "คัดสรรโมเดล Miniature, อัศวิน, มังกร และฟิกเกอร์อนิเมะกว่า 22 รายการที่ผ่านการจัดระเบียบ Quad/Tri Topology พร้อมส่งเข้า Slicer",
    cta: "ดูโมเดลพิมพ์ 3D ทั้งหมด",
    actionKey: "3D Printing",
    images: [
      "/models/tripo_print_ancient_dragon.webp",
      "/models/tripo_pumpkin_chibi.webp",
      "/models/tripo_scorpion_valkyrie.webp",
    ],
  },
  {
    badge: "TRELLIS.2 4B + TRIPO v3.0",
    title: "คลังผลงาน 119 โมเดล ครบทั้งหุ่นรบ ยานพาหนะ ปราสาท และอาวุธ",
    desc: "คลิกเลือกโมเดลใดก็ได้เพื่อเปิดในสตูดิโอ 3D หมุนดูโครงสร้าง ปรับแต่งวัสดุ Metallic/Roughness หรือใส่ท่าทางแอนิเมชันทันที",
    cta: "สำรวจหุ่นรบ & จักรกล",
    actionKey: "Mecha",
    images: [
      "/models/pro_trellis2_transformer.webp",
      "/models/tripo_voidweaver_sentinel.webp",
      "/models/pro_trellis2_spider_mech.webp",
    ],
  },
];

export function TripoFeaturedBannerCarousel({
  onSelectCategory,
}: {
  onSelectCategory: (catId: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [hovered]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="sm:col-span-2 h-[332px] rounded-[16px] bg-[#160c10] border border-red-500/25 hover:border-red-500/50 relative overflow-hidden group select-none shadow-[0_14px_36px_rgba(0,0,0,0.45)]"
    >
      {/* Sliding Track */}
      <div
        className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.75,0.25,1)]"
        style={{ transform: `translate3d(-${activeIdx * 100}%, 0, 0)` }}
      >
        {BANNER_SLIDES.map((slide, idx) => (
          <div
            key={idx}
            onClick={() => onSelectCategory(slide.actionKey)}
            className="w-full h-full shrink-0 grow-0 basis-full p-6 bg-[radial-gradient(circle_at_80%_50%,rgba(220,38,38,0.24),transparent_65%),linear-gradient(135deg,#1c0d13_0%,#0c0609_100%)] flex items-center justify-between gap-4 cursor-pointer relative overflow-hidden"
          >
            {/* Left Copy */}
            <div className="max-w-[54%] z-10 flex flex-col justify-between h-full py-1">
              <div className="space-y-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2a1119] border border-red-500/35 text-[11px] font-mono text-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                  {slide.badge}
                </span>
                <h3 className="text-[18px] sm:text-[20px] font-semibold text-white leading-[1.3] tracking-tight">
                  {slide.title}
                </h3>
                <p className="text-[12.5px] text-[#b8a6ad] leading-[1.55] line-clamp-3">
                  {slide.desc}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span className="h-8 px-3.5 rounded-[8px] bg-[#dc2626] group-hover:bg-[#ef4444] text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{slide.cta}</span>
                </span>
              </div>
            </div>

            {/* Right Trio of Floating 3D Renders */}
            <div className="relative w-[44%] h-full flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(239,68,68,0.22),transparent_70%)] pointer-events-none" />
              {slide.images.map((imgUrl, i) => {
                const posClass =
                  i === 0
                    ? "z-20 w-44 h-44 sm:w-48 sm:h-48 translate-x-0 scale-105 group-hover:scale-110"
                    : i === 1
                    ? "z-10 w-32 h-32 -translate-x-16 translate-y-6 -rotate-6 opacity-75 group-hover:-translate-x-20"
                    : "z-10 w-32 h-32 translate-x-16 -translate-y-6 rotate-6 opacity-75 group-hover:translate-x-20";
                return (
                  <img
                    key={imgUrl}
                    src={imgUrl}
                    alt=""
                    className={`absolute object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.75)] transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.25,1)] ${posClass}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Prev / Next Arrows on Hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActiveIdx(
            (prev) => (prev - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length
          );
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/60 hover:bg-[#dc2626] border border-white/15 text-white flex items-center justify-center cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActiveIdx((prev) => (prev + 1) % BANNER_SLIDES.length);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/60 hover:bg-[#dc2626] border border-white/15 text-white flex items-center justify-center cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Bottom Indicator Dots */}
      <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5">
        {BANNER_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIdx(i);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              activeIdx === i
                ? "w-5 bg-[#ef4444]"
                : "w-1.5 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 4. TRIPO STUDIO 3D PERSPECTIVE TILT + FEATHERED CLAY SPLIT CARD (`TO` & `OO`)
// ============================================================================
const FEATHER_RATIO = 0.2;
const MAX_TILT_X = 10;
const MAX_TILT_Y = 10;

export function TripoInteractiveCard({
  item,
  index,
  onOpenStudio,
  onRemix,
  onOpenPbr,
}: {
  item: ShowcaseModelItem;
  index: number;
  onOpenStudio: (item: ShowcaseModelItem) => void;
  onRemix: (item: ShowcaseModelItem, cleanTitle: string) => void;
  onOpenPbr: (item: ShowcaseModelItem, cleanTitle: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const clayImgRef = useRef<HTMLImageElement | null>(null);
  const splitLineRef = useRef<HTMLDivElement | null>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [fromLeft, setFromLeft] = useState(true);

  // Deterministic initial community counters derived from item id
  const seed = item.id
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const [liked, setLiked] = useState(false);
  const [collected, setCollected] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes ?? 38 + (seed % 95));
  const [collectCount, setCollectCount] = useState(
    item.collects ?? 14 + (seed % 42)
  );

  const cleanTitle = item.prompt_th
    .replace(/^\[.*?\]\s*/, "")
    .replace(/\s*\(.*?\)\s*$/, "");
  const isPro = item.engine === "trellis_pbr";
  const claySrc = item.clay_image_url || item.input_image_url;
  const hasRealClay = Boolean(item.clay_image_url);

  const updatePointerPhysics = (
    e: React.PointerEvent<HTMLDivElement>,
    enteredFromLeft: boolean
  ) => {
    const host = hostRef.current;
    const surface = surfaceRef.current;
    const clayImg = clayImgRef.current;
    const splitLine = splitLineRef.current;
    if (!host || !surface) return;

    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const normY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

    // Exact Tripo SO(e, t) feathered split formula
    const splitPct = normX * 100;
    const cursorPx = (rect.width * splitPct) / 100;
    const featherPx = Math.min(
      (rect.width * FEATHER_RATIO) / 2,
      cursorPx,
      Math.max(0, rect.width - cursorPx)
    );

    const tiltX = ((0.5 - normY) * MAX_TILT_X).toFixed(2);
    const tiltY = ((normX - 0.5) * MAX_TILT_Y).toFixed(2);

    surface.style.setProperty("--fade-start", `${(cursorPx - featherPx).toFixed(1)}px`);
    surface.style.setProperty(
      "--fade-quarter",
      `${(cursorPx - featherPx / 2).toFixed(1)}px`
    );
    surface.style.setProperty("--split", `${splitPct.toFixed(2)}%`);
    surface.style.setProperty(
      "--fade-three-quarter",
      `${(cursorPx + featherPx / 2).toFixed(1)}px`
    );
    surface.style.setProperty("--fade-end", `${(cursorPx + featherPx).toFixed(1)}px`);
    surface.style.setProperty("--tilt-x", `${tiltX}deg`);
    surface.style.setProperty("--tilt-y", `${tiltY}deg`);

    if (splitLine) {
      splitLine.style.left = `${splitPct.toFixed(2)}%`;
    }

    if (clayImg) {
      if ((enteredFromLeft && normX >= 1) || (!enteredFromLeft && normX <= 0)) {
        clayImg.style.opacity = "1";
      } else if (
        (enteredFromLeft && normX <= 0) ||
        (!enteredFromLeft && normX >= 1)
      ) {
        clayImg.style.opacity = "0";
      } else {
        clayImg.style.opacity = "1";
      }
    }
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const initX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    const enterLeft = initX < 0.5;
    setFromLeft(enterLeft);
    setIsTracking(true);
    updatePointerPhysics(e, enterLeft);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !isTracking) return;
    updatePointerPhysics(e, fromLeft);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    setIsTracking(false);
    const surface = surfaceRef.current;
    const clayImg = clayImgRef.current;
    if (surface) {
      surface.style.setProperty("--tilt-x", "0.00deg");
      surface.style.setProperty("--tilt-y", "0.00deg");
    }
    if (clayImg) {
      clayImg.style.opacity = "0";
    }
  };

  // Exact 5-stop feathered linear-gradient mask from Tripo Studio entry.css
  const maskGradient = fromLeft
    ? "linear-gradient(to right, #000 var(--fade-start, 0px), rgba(0,0,0,0.844) var(--fade-quarter, 0px), rgba(0,0,0,0.5) var(--split, 0%), rgba(0,0,0,0.156) var(--fade-three-quarter, 0px), transparent var(--fade-end, 0px))"
    : "linear-gradient(to right, transparent var(--fade-start, 0px), rgba(0,0,0,0.156) var(--fade-quarter, 0px), rgba(0,0,0,0.5) var(--split, 0%), rgba(0,0,0,0.844) var(--fade-three-quarter, 0px), #000 var(--fade-end, 0px))";

  const staggerDelayMs = Math.min(index % 12, 11) * 35;

  return (
    <div
      onClick={() => onOpenStudio(item)}
      style={{ animationDelay: `${staggerDelayMs}ms` }}
      className="group rounded-[16px] bg-[#14090d]/80 backdrop-blur-md border border-red-500/20 hover:border-red-500/55 p-2 flex flex-col justify-between relative cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.2,0.75,0.25,1)] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.65),0_0_24px_rgba(220,38,38,0.18)] animate-[tripoCardEnter_380ms_cubic-bezier(0.2,0.75,0.25,1)_both]"
    >
      {/* 3D Perspective Viewport Container (`perspective-[1100px]` + Tripo `model_card_bg.webp` Studio Spotlight Stage) */}
      <div
        ref={hostRef}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          backgroundImage:
            "radial-gradient(circle at 22% 14%, rgba(239, 68, 68, 0.16), transparent 55%), url('/images/tripo/model_card_bg.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        className="h-[268px] rounded-[11px] bg-[#0c0608] border border-white/[0.07] relative overflow-hidden perspective-[1100px]"
      >
        {/* Subtle Diagonal Studio Light Streak (`light.webp`) on Card Hover */}
        <img
          src="/images/tripo/light.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -top-8 -left-8 w-56 h-56 object-contain opacity-30 group-hover:opacity-65 transition-opacity duration-500 mix-blend-screen"
        />

        {/* Tilting 3D Surface (`rotateX(var(--tilt-x)) rotateY(var(--tilt-y))`) */}
        <div
          ref={surfaceRef}
          style={{
            transform:
              "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) scale(var(--surface-scale, 1))",
          }}
          className={`w-full h-full origin-center relative overflow-hidden transition-transform ease-[cubic-bezier(0.2,0.75,0.25,1)] ${
            isTracking
              ? "will-change-transform duration-150 [--surface-scale:1.03]"
              : "duration-[420ms] [--surface-scale:1]"
          }`}
        >
          {item.input_image_url ? (
            <>
              {/* Base Layer: Full Textured PBR Render */}
              <img
                src={item.input_image_url}
                alt={cleanTitle}
                loading={index < 8 ? "eager" : "lazy"}
                className="w-full h-full object-contain p-3.5 pointer-events-none select-none"
              />

              {/* Top Layer: Cursor-Tracked Feathered Clay Sculpt Mesh */}
              {claySrc && (
                <img
                  ref={clayImgRef}
                  src={claySrc}
                  alt=""
                  loading="lazy"
                  style={{
                    opacity: 0,
                    maskImage: maskGradient,
                    WebkitMaskImage: maskGradient,
                    filter: hasRealClay
                      ? "none"
                      : "grayscale(1) contrast(1.22) brightness(1.08)",
                  }}
                  className=" inset-0 absolute w-full h-full object-contain p-3.5 pointer-events-none select-none transition-opacity duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                />
              )}

              {/* Subtle Laser Scan Indicator at --split Position */}
              <div
                ref={splitLineRef}
                className={`pointer-events-none absolute inset-y-4 w-[1px] bg-gradient-to-b from-transparent via-red-400/75 to-transparent shadow-[0_0_10px_rgba(239,68,68,0.9)] transition-opacity duration-200 ${
                  isTracking ? "opacity-100" : "opacity-0"
                }`}
              />
            </>
          ) : (
            <div
              className="w-20 h-20 m-auto rounded-[12px] flex items-center justify-center border border-white/15"
              style={{
                background: `linear-gradient(135deg, ${item.primary_color}, ${item.accent_color})`,
              }}
            >
              <Box className="w-8 h-8 stroke-[1.5] text-white" />
            </div>
          )}
        </div>

        {/* Top-Left Spec Badge */}
        <span
          className={`absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-[5px] border flex items-center gap-1.5 text-[10.5px] font-mono tabular-nums pointer-events-none ${
            isPro
              ? "bg-[#281016]/90 border-red-500/40 text-red-200"
              : "bg-[#140a0e]/90 border-red-500/20 text-[#d4c5cb]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isPro ? "bg-[#ef4444]" : "bg-[#b8a6ad]"
            }`}
          />
          <span>{isPro ? "PRO · PBR" : "STD · PBR"}</span>
        </span>

        {/* Top-Right Dual-Render / 3D Print Indicator */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
          {item.isPrintReady && (
            <span className="px-1.5 py-0.5 rounded-[5px] bg-[#140a0e]/90 border border-red-500/25 text-[10px] font-mono text-red-300 flex items-center gap-1">
              <Printer className="w-2.5 h-2.5" />
              <span>STL</span>
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded-[5px] bg-[#140a0e]/90 border border-red-500/25 text-[10px] font-mono tabular-nums text-[#d4c5cb]">
            {hasRealClay ? "PBR ∣ CLAY" : "3D TILT"}
          </span>
        </div>

        {/* Bottom Floating Studio Action Bar (Slides up smoothly on hover) */}
        <div className="opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ease-[cubic-bezier(0.2,0.75,0.25,1)] absolute inset-x-2 bottom-2 z-20 p-1.5 rounded-[8px] bg-[#140a0e]/95 backdrop-blur-md border border-red-500/35 flex items-center justify-between gap-1.5">
          <span className="flex-1 h-7 px-2.5 rounded-[5px] bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium text-[12px] flex items-center justify-center gap-1.5 transition-colors">
            <span>เปิดในสตูดิโอ</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemix(item, cleanTitle);
            }}
            className="h-7 px-2.5 rounded-[5px] bg-[#241219] hover:bg-[#311822] text-[12px] font-normal text-white transition-colors cursor-pointer"
          >
            Remix
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPbr(item, cleanTitle);
            }}
            className="h-7 px-2.5 rounded-[5px] bg-[#241219] hover:bg-[#311822] text-[12px] font-normal text-[#d4c5cb] hover:text-white transition-colors cursor-pointer"
          >
            PBR
          </button>
        </div>
      </div>

      {/* Card Footer: Title + Tripo Community Like/Collect Counters */}
      <div className="pt-2.5 pb-1 px-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white truncate group-hover:text-red-200 transition-colors">
            {cleanTitle}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10.5px] font-mono tabular-nums text-[#8c767e]">
              {(item.target_poly_count / 1000).toFixed(0)}k ·{" "}
              {item.topology.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Interactive Bookmark & Like Pills (Tripo Studio style) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollected((prev) => !prev);
              setCollectCount((c) => (collected ? c - 1 : c + 1));
            }}
            className={`h-6 px-2 rounded-full text-[11px] font-mono tabular-nums inline-flex items-center gap-1 transition-all duration-150 cursor-pointer ${
              collected
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 scale-105"
                : "bg-white/[0.03] hover:bg-white/[0.08] text-[#b8a6ad] hover:text-white"
            }`}
          >
            <Bookmark
              className={`w-3 h-3 ${
                collected ? "fill-amber-400 text-amber-400" : ""
              }`}
            />
            <span>{collectCount}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLiked((prev) => !prev);
              setLikeCount((c) => (liked ? c - 1 : c + 1));
            }}
            className={`h-6 px-2 rounded-full text-[11px] font-mono tabular-nums inline-flex items-center gap-1 transition-all duration-150 cursor-pointer ${
              liked
                ? "bg-red-500/20 text-[#ef4444] border border-red-500/40 scale-105"
                : "bg-white/[0.03] hover:bg-white/[0.08] text-[#b8a6ad] hover:text-white"
            }`}
          >
            <Heart
              className={`w-3 h-3 ${
                liked ? "fill-[#ef4444] text-[#ef4444]" : ""
              }`}
            />
            <span>{likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
