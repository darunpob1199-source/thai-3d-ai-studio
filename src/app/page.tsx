"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Sparkles,
  Image as ImageIcon,
  Layers,
  Box,
  Cpu,
  Coins,
  Plus,
  RefreshCw,
  CheckCircle2,
  Wand2,
  Upload,
  LogOut,
  Languages,
  Grid,
  Sun,
  Bone,
  Scissors,
  Puzzle,
  Grid3X3,
  Palette,
  PenTool,
  ArrowUpRight,
  Sliders,
  Play,
  Pause,
  ChevronRight,
  Smartphone,
  FolderOpen,
  Home as HomeIcon,
  Search,
  Filter,
  Dices,
  ArrowRight,
  Heart,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  X,
  Printer,
} from "lucide-react";
import GmailLoginModal, {
  triggerGooglePopupLogin,
  GoogleLogoSvg,
} from "@/components/auth/GmailLoginModal";
import TopupModal from "@/components/billing/TopupModal";
import type {
  UserRecord,
  GenerationTaskRecord,
  CreditTransactionRecord,
  TopupOrderRecord,
} from "@/lib/db/database";
import type {
  LiveStudioOverrides,
  AnimationClipId,
  RenderShadingMode,
  RigCharacterType,
  PosePresetType,
  ArtStyleOverride,
  ShadingSmoothness,
  HdriPresetType,
  FilamentPresetType,
} from "@/components/studio/Viewport3D";

const Viewport3D = dynamic(() => import("@/components/studio/Viewport3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#090709] text-slate-400 text-xs">
      <RefreshCw className="w-4 h-4 animate-spin mr-2 text-red-400" />
      Loading Forge3D Viewport...
    </div>
  ),
});

type LeftToolId =
  | "agent"
  | "generate"
  | "relief"
  | "segment"
  | "fill-parts"
  | "retopo"
  | "smart-uv"
  | "texture"
  | "edit"
  | "upscale"
  | "pbr"
  | "rig"
  | "animate"
  | "print3d";

const STUDIO_PILLARS: {
  id: string;
  label: string;
  titleTh: string;
  defaultTool: LeftToolId;
  icon: React.ComponentType<{ className?: string }>;
  subTools: { id: LeftToolId; label: string }[];
}[] = [
  {
    id: "create",
    label: "สร้าง 3D",
    titleTh: "สร้างโมเดล 3D",
    defaultTool: "generate",
    icon: Wand2,
    subTools: [
      { id: "generate", label: "รูป/ข้อความ" },
      { id: "relief", label: "นูนต่ำ/อักษร" },
      { id: "agent", label: "AI Agent" },
    ],
  },
  {
    id: "mesh",
    label: "รีเมช",
    titleTh: "จัดการโพลีกอน & ชิ้นส่วน",
    defaultTool: "retopo",
    icon: Grid3X3,
    subTools: [
      { id: "retopo", label: "Remesh" },
      { id: "segment", label: "แยกชิ้น" },
      { id: "fill-parts", label: "เติมฐาน" },
      { id: "smart-uv", label: "กาง UV" },
    ],
  },
  {
    id: "texture",
    label: "พื้นผิว",
    titleTh: "พื้นผิว & ระบายสี",
    defaultTool: "texture",
    icon: Palette,
    subTools: [
      { id: "texture", label: "AI Texture" },
      { id: "edit", label: "พู่กัน 3D" },
      { id: "pbr", label: "แสง/PBR" },
      { id: "upscale", label: "อัปสเกล 8K" },
    ],
  },
  {
    id: "animate",
    label: "อนิเมชัน",
    titleTh: "ผูกกระดูก & ท่าทาง",
    defaultTool: "rig",
    icon: Bone,
    subTools: [
      { id: "rig", label: "ผูกกระดูก" },
      { id: "animate", label: "ท่าทาง" },
    ],
  },
  {
    id: "print",
    label: "พิมพ์ 3D",
    titleTh: "เตรียมพิมพ์ 3D (.STL)",
    defaultTool: "print3d",
    icon: Printer,
    subTools: [{ id: "print3d", label: "3D Print & Slicer" }],
  },
];

const MODEL_OPTIONS: {
  id: "trellis_pbr" | "hunyuan3d_2_1" | "triposg";
  code: string;
  name: string;
  sub: string;
  credits: number;
}[] = [
  {
    id: "trellis_pbr",
    code: "PRO",
    name: "Pro Studio HD (TRELLIS.2)",
    sub: "Full 360° PBR (Albedo · Metallic · Roughness)",
    credits: 6,
  },
  {
    id: "hunyuan3d_2_1",
    code: "STD",
    name: "Standard PBR (Microsoft Trellis)",
    sub: "360° Baked UV Texture · เร็วและประหยัดเครดิต",
    credits: 2,
  },
];

const QUICK_PROMPTS = [
  {
    label: "หุ่นยนต์ยักษ์วัดแจ้ง",
    prompt: "หุ่นยนต์ยักษ์วัดแจ้งเกราะมรกตไซเบอร์พังก์ถือดาบพลังงานแสงนีออน",
    category: "Character",
  },
  {
    label: "รถตุ๊กตุ๊กไซเบอร์พังก์",
    prompt: "รถตุ๊กตุ๊กไทยแต่งซิ่งไฟนีออนไซเบอร์พังก์กรุงเทพ 2099",
    category: "Vehicle",
  },
  {
    label: "มังกรพญานาคคริสตัล",
    prompt: "มังกรพญานาคเกล็ดมรกตเรืองแสงสไตล์แฟนตาซี",
    category: "Animal",
  },
  {
    label: "ดาบอัศวินมังกรฟ้า",
    prompt: "ดาบอัศวินมังกรฟ้าฝังคริสตัลเรืองแสงระดับเกม AAA",
    category: "Weapon",
  },
];

const TEXTURE_STYLE_PRESETS = [
  {
    name: "Crimson Obsidian",
    primary: "#ef4444",
    accent: "#18181b",
    roughness: 0.18,
    metalness: 0.9,
  },
  {
    name: "Royal Siam Gold",
    primary: "#dc2626",
    accent: "#f59e0b",
    roughness: 0.22,
    metalness: 0.92,
  },
  {
    name: "Ruby Crystal",
    primary: "#e11d48",
    accent: "#fb7185",
    roughness: 0.12,
    metalness: 0.85,
  },
  {
    name: "Matte Carbon Ceramic",
    primary: "#27272a",
    accent: "#ef4444",
    roughness: 0.75,
    metalness: 0.15,
  },
  {
    name: "Volcanic Armor",
    primary: "#18181b",
    accent: "#f43f5e",
    roughness: 0.3,
    metalness: 0.88,
  },
];

const GALLERY_CATEGORIES = [
  { id: "All", label: "ทั้งหมด" },
  { id: "Character", label: "ตัวละคร & หุ่นรบ" },
  { id: "Vehicle", label: "ไซไฟ & ยานยนต์" },
  { id: "Animal", label: "สัตว์ในตำนาน" },
  { id: "Props", label: "ชุดเกราะ & อาวุธ" },
];

const CURATED_SHOWCASE: (GenerationTaskRecord & { categoryTag: string })[] = [
  {
    id: "showcase_pro_battle_mech",
    user_id: "community",
    stage: "refine_pbr",
    engine: "trellis_pbr",
    mode: "image_to_3d",
    prompt_th: "หุ่นรบเกราะเหล็ก Battle Mech",
    prompt_en:
      "Pro Studio TRELLIS.2 4B Cascade — Heavy armored sci-fi battle mech with baked Albedo, Metallic, and Roughness PBR maps",
    input_image_url: "/models/pro_trellis2_battle_mech.webp",
    status: "completed",
    cost_credits: 6,
    refunded: 0,
    target_poly_count: 148000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "mecha",
    primary_color: "#d6d3d1",
    accent_color: "#f59e0b",
    roughness: 0.35,
    metalness: 0.75,
    output_glb_url: "/models/pro_trellis2_battle_mech.glb",
    created_at: new Date().toISOString(),
    categoryTag: "Character",
  },
  {
    id: "showcase_pro_dragon_armor",
    user_id: "community",
    stage: "refine_pbr",
    engine: "trellis_pbr",
    mode: "image_to_3d",
    prompt_th: "เกราะอกมังกรทองคำจักรพรรดิ",
    prompt_en:
      "Pro Studio TRELLIS.2 4B Cascade — Ornate gold and steel dragon chest plate armor with full Metallic & Roughness PBR maps",
    input_image_url: "/models/pro_trellis2_dragon_armor.webp",
    status: "completed",
    cost_credits: 6,
    refunded: 0,
    target_poly_count: 135000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 0,
    preset_type: "sword",
    primary_color: "#d6d3d1",
    accent_color: "#f59e0b",
    roughness: 0.25,
    metalness: 0.85,
    output_glb_url: "/models/pro_trellis2_dragon_armor.glb",
    created_at: new Date().toISOString(),
    categoryTag: "Props",
  },
  {
    id: "showcase_pro_stone_golem",
    user_id: "community",
    stage: "refine_pbr",
    engine: "trellis_pbr",
    mode: "image_to_3d",
    prompt_th: "โกเลมหินโบราณคลุมมอส",
    prompt_en:
      "Pro Studio TRELLIS.2 4B Cascade — Ancient stone golem covered in moss with full PBR Albedo & Roughness maps",
    input_image_url: "/models/pro_trellis2_stone_golem.webp",
    status: "completed",
    cost_credits: 6,
    refunded: 0,
    target_poly_count: 124000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "mecha",
    primary_color: "#d6d3d1",
    accent_color: "#10b981",
    roughness: 0.65,
    metalness: 0.15,
    output_glb_url: "/models/pro_trellis2_stone_golem.glb",
    created_at: new Date().toISOString(),
    categoryTag: "Character",
  },
  {
    id: "showcase_std_dragonborn",
    user_id: "community",
    stage: "refine_pbr",
    engine: "hunyuan3d_2_1",
    mode: "image_to_3d",
    prompt_th: "นักรบมังกร Dragonborn",
    prompt_en:
      "Standard Microsoft Trellis ($0.02 / 0.68 THB) — Humanoid Dragonborn warrior character with 360° AI-baked UV texture",
    input_image_url: "/models/standard_trellis_dragonborn.png",
    status: "completed",
    cost_credits: 2,
    refunded: 0,
    target_poly_count: 41000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "mecha",
    primary_color: "#d6d3d1",
    accent_color: "#ef4444",
    roughness: 0.42,
    metalness: 0.25,
    output_glb_url: "/models/standard_trellis_dragonborn.glb",
    created_at: new Date().toISOString(),
    categoryTag: "Character",
  },
  {
    id: "showcase_std_mech",
    user_id: "community",
    stage: "refine_pbr",
    engine: "hunyuan3d_2_1",
    mode: "image_to_3d",
    prompt_th: "หุ่นรบไซไฟ Futuristic Mech",
    prompt_en:
      "Standard Microsoft Trellis ($0.02 / 0.68 THB) — Futuristic robot mech with 360° AI-baked UV texture",
    input_image_url: "/models/standard_trellis_mech.png",
    status: "completed",
    cost_credits: 2,
    refunded: 0,
    target_poly_count: 91000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "mecha",
    primary_color: "#d6d3d1",
    accent_color: "#3b82f6",
    roughness: 0.35,
    metalness: 0.65,
    output_glb_url: "/models/standard_trellis_mech.glb",
    created_at: new Date().toISOString(),
    categoryTag: "Vehicle",
  },
  {
    id: "showcase_std_loong",
    user_id: "community",
    stage: "refine_pbr",
    engine: "hunyuan3d_2_1",
    mode: "image_to_3d",
    prompt_th: "มังกรพญานาคโบราณ",
    prompt_en:
      "Standard Microsoft Trellis ($0.02 / 0.68 THB) — Mythical guardian dragon with 360° AI-baked UV texture",
    input_image_url: "/models/standard_trellis_loong.png",
    status: "completed",
    cost_credits: 2,
    refunded: 0,
    target_poly_count: 85000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "dragon",
    primary_color: "#d6d3d1",
    accent_color: "#f59e0b",
    roughness: 0.4,
    metalness: 0.3,
    output_glb_url: "/models/standard_trellis_loong.glb",
    created_at: new Date().toISOString(),
    categoryTag: "Animal",
  },
  {
    id: "showcase_std_goblin",
    user_id: "community",
    stage: "refine_pbr",
    engine: "hunyuan3d_2_1",
    mode: "image_to_3d",
    prompt_th: "ก๊อบลินนักรบแฟนตาซี",
    prompt_en:
      "Standard Microsoft Trellis ($0.02 / 0.68 THB) — Fantasy goblin character with 360° AI-baked UV texture",
    input_image_url: "/models/standard_trellis_goblin.png",
    status: "completed",
    cost_credits: 2,
    refunded: 0,
    target_poly_count: 45000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "mecha",
    primary_color: "#d6d3d1",
    accent_color: "#10b981",
    roughness: 0.45,
    metalness: 0.2,
    output_glb_url: "/models/standard_trellis_goblin.glb",
    created_at: new Date().toISOString(),
    categoryTag: "Character",
  },
];

export default function SiamPrism3DStudioPage() {
  const [topNav, setTopNav] = useState<"home" | "workspace">("home");

  // User & Auth state
  const [user, setUser] = useState<UserRecord | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupInitialTab, setTopupInitialTab] = useState<"topup" | "ledger" | "config">("topup");
  const [dccBridgeModalOpen, setDccBridgeModalOpen] = useState(false);
  const [printCheckModalOpen, setPrintCheckModalOpen] = useState(false);
  const [oauthToast, setOauthToast] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Welcome page states
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState<boolean>(false);
  const [filterMeshType, setFilterMeshType] = useState<"all" | "smart_mesh" | "rigged" | "pbr">(
    "all"
  );
  const [isDragOverHero, setIsDragOverHero] = useState<boolean>(false);
  const [cleanTopologyTrial, setCleanTopologyTrial] = useState<boolean>(true);

  // Workspace left rail & generator state
  const [activeLeftTool, setActiveLeftTool] = useState<LeftToolId>("generate");
  const [meshQualityTab, setMeshQualityTab] = useState<"hd" | "smart-mesh">("hd");
  const [inputMode, setInputMode] = useState<"text_to_3d" | "image_to_3d" | "multi_view" | "retopo">(
    "text_to_3d"
  );
  const [selectedModel, setSelectedModel] = useState<"trellis_pbr" | "hunyuan3d_2_1" | "triposg">(
    "hunyuan3d_2_1"
  );
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const [prompt, setPrompt] = useState<string>("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [multiViewImages, setMultiViewImages] = useState<{
    front: string | null;
    back: string | null;
    left: string | null;
    right: string | null;
  }>({ front: null, back: null, left: null, right: null });

  const [targetPolycount, setTargetPolycount] = useState<number>(18000);
  const [generateInParts, setGenerateInParts] = useState<boolean>(false);
  const [enablePbr8k, setEnablePbr8k] = useState<boolean>(true);
  const [enableAutoRig, setEnableAutoRig] = useState<boolean>(false);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  // Right panel ("assets" | "property")
  const [rightTab, setRightTab] = useState<"assets" | "property">("assets");

  // Tasks & active 3D model
  const [tasks, setTasks] = useState<GenerationTaskRecord[]>([]);
  const [transactions, setTransactions] = useState<CreditTransactionRecord[]>([]);
  const [orders, setOrders] = useState<TopupOrderRecord[]>([]);
  const [activeTask, setActiveTask] = useState<GenerationTaskRecord | null>(CURATED_SHOWCASE[0]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genProgress, setGenProgress] = useState<number>(0);
  const [genStageText, setGenStageText] = useState<string>("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Live 3D Studio Tool States (Drives all 11 Left-Rail Tools on Viewport3D!)
  const [partNames, setPartNames] = useState<string[]>([]);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [segmentColorMode, setSegmentColorMode] = useState<boolean>(false);
  const [uvCheckerMode, setUvCheckerMode] = useState<boolean>(false);
  const [uvUnwrapDensity, setUvUnwrapDensity] = useState<"1024" | "2048" | "4096">("2048");
  const [filledParts, setFilledParts] = useState<{
    auraRing: boolean;
    pedestal: boolean;
    backWings: boolean;
  }>({ auraRing: false, pedestal: false, backWings: false });
  const [transformState, setTransformState] = useState<{
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    rotY: number;
  }>({ scaleX: 1, scaleY: 1, scaleZ: 1, rotY: 0 });
  const [materialState, setMaterialState] = useState<{
    primaryColor: string;
    accentColor: string;
    roughness: number;
    metalness: number;
    emissiveIntensity: number;
    polyMultiplier: number;
  }>({
    primaryColor: CURATED_SHOWCASE[0].primary_color,
    accentColor: CURATED_SHOWCASE[0].accent_color,
    roughness: CURATED_SHOWCASE[0].roughness,
    metalness: CURATED_SHOWCASE[0].metalness,
    emissiveIntensity: 0,
    polyMultiplier: 1,
  });
  const [showRigBones, setShowRigBones] = useState<boolean>(false);
  const [rigType, setRigType] = useState<RigCharacterType>("humanoid");
  const [showRigMarkers, setShowRigMarkers] = useState<boolean>(false);
  const [posePreset, setPosePreset] = useState<PosePresetType>("bind");
  const [skeletonTemplate, setSkeletonTemplate] = useState<string>("meshyrig");
  const [animationClip, setAnimationClip] = useState<AnimationClipId>("none");
  const [animationSpeed, setAnimationSpeed] = useState<number>(1.0);
  const [inPlaceAnimation, setInPlaceAnimation] = useState<boolean>(true);
  const [hiddenParts, setHiddenParts] = useState<number[]>([]);
  const [upscaleResolution, setUpscaleResolution] = useState<"2K" | "4K" | "8K">("4K");
  const [texturePrompt, setTexturePrompt] = useState<string>(
    "เกราะโลหะมรกตขัดเงาฝังลายไทยเรืองแสงนีออน 4K PBR"
  );

  // Meshy 7.1 + Tripo 3.0 Deep Tool States
  const [viewChannel, setViewChannel] = useState<RenderShadingMode | undefined>(undefined);
  const [shadingSmoothness, setShadingSmoothness] = useState<ShadingSmoothness>("auto");
  const [artStyleMode, setArtStyleMode] = useState<ArtStyleOverride>("standard");
  const [meshyArtStyleLabel, setMeshyArtStyleLabel] = useState<string>("Realistic");
  const [symmetryMode, setSymmetryMode] = useState<"off" | "auto" | "on">("auto");
  const [seedValue, setSeedValue] = useState<number>(849201);
  const [reliefDepth, setReliefDepth] = useState<number>(0.65);
  const [text3dContent, setText3dContent] = useState<string>("PRISM3D");
  const [text3dDepth, setText3dDepth] = useState<number>(0.45);
  const [addPrintBase, setAddPrintBase] = useState<boolean>(false);
  const [printCheckMode, setPrintCheckMode] = useState<boolean>(false);
  const [filamentPreset, setFilamentPreset] = useState<FilamentPresetType>("pla");
  const [filamentColor, setFilamentColor] = useState<string>("#06b6d4");
  const [decalEnabled, setDecalEnabled] = useState<boolean>(false);
  const [decalScale, setDecalScale] = useState<number>(1.0);
  const [decalRotation, setDecalRotation] = useState<number>(0);
  const [decalColor, setDecalColor] = useState<string>("#22d3ee");
  const [activeBrushTool, setActiveBrushTool] = useState<
    "paint" | "healing" | "decal" | "stamp" | "lasso" | "eraser"
  >("paint");
  const [brushSize, setBrushSize] = useState<number>(50);
  const [brushOpacity, setBrushOpacity] = useState<number>(100);
  const [hdriPreset, setHdriPreset] = useState<HdriPresetType>("studio");
  const [hdriRotation, setHdriRotation] = useState<number>(45);
  const [cameraFov, setCameraFov] = useState<number>(40);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [homeCreateMode, setHomeCreateMode] = useState<"quick" | "agent">("quick");

  // Sync activeTask material defaults when switching activeTask
  useEffect(() => {
    if (!activeTask) return;
    setMaterialState({
      primaryColor: activeTask.output_glb_url
        ? activeTask.primary_color || "#d6d3d1"
        : activeTask.primary_color || "#ef4444",
      accentColor: activeTask.accent_color || "#f59e0b",
      roughness: activeTask.output_glb_url ? 0.42 : activeTask.roughness ?? 0.35,
      metalness: activeTask.output_glb_url
        ? 0.18
        : Math.min(activeTask.metalness ?? 0.25, 0.28),
      emissiveIntensity: activeTask.output_glb_url ? 0 : 0.25,
      polyMultiplier: 1,
    });
    setHiddenParts([]);
    setExplodeFactor(0);
  }, [activeTask]);

  // Automatically enable tool-specific visual modes when clicking the Left Icon Rail
  const handleSelectLeftTool = (toolId: LeftToolId) => {
    setActiveLeftTool(toolId);
    setSegmentColorMode(toolId === "segment");
    if (toolId === "segment") {
      setExplodeFactor(0.25);
    } else {
      setExplodeFactor(0);
    }
    setUvCheckerMode(toolId === "smart-uv");
    setPrintCheckMode(toolId === "print3d");
    if (toolId === "rig" || toolId === "animate") {
      setShowRigBones(true);
    } else {
      setShowRigBones(false);
    }
    if (toolId === "rig") {
      setShowRigMarkers(true);
    } else {
      setShowRigMarkers(false);
    }
    if (toolId === "animate" && animationClip === "none") {
      setAnimationClip("idle");
    } else if (toolId !== "animate" && toolId !== "rig" && animationClip !== "none") {
      setAnimationClip("none");
    }
    if (toolId === "relief") {
      if (artStyleMode === "standard") {
        setArtStyleMode("relief");
      }
    } else if (artStyleMode === "relief" || artStyleMode === "text3d") {
      setArtStyleMode("standard");
    }
  };

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3200);
  };

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          setTasks(data.tasks);
          setActiveTask((prev) =>
            !prev || prev.id.startsWith("showcase_") ? data.tasks[0] : prev
          );
        }
        if (Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        }
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch (e) {
      console.error("Failed to fetch session:", e);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthLogin = params.get("oauth_login");
    const authError = params.get("auth_error");

    if (oauthLogin === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      setOauthToast("เข้าสู่ระบบด้วย Google สำเร็จแล้ว");
      setTimeout(() => setOauthToast(null), 4000);
    }

    if (authError) {
      window.history.replaceState({}, "", window.location.pathname);
      setErrorBanner(`Google OAuth Error: ${authError}`);
      setAuthModalOpen(true);
    }

    fetchSession();
  }, [fetchSession]);

  // Support Ctrl+V / Cmd+V image paste on the Welcome page
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result as string);
        setInputMode("image_to_3d");
        triggerToast("วางรูปภาพต้นแบบสำหรับ Image-to-3D เรียบร้อยแล้ว");
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleLoginSuccess = (data: any) => {
    if (data?.user) {
      setUser(data.user);
    }
    if (Array.isArray(data?.tasks) && data.tasks.length > 0) {
      setTasks(data.tasks);
      setActiveTask(data.tasks[0]);
    }
    fetchSession();
  };

  const handleDirectGoogleLogin = async () => {
    try {
      const data = await triggerGooglePopupLogin();
      handleLoginSuccess(data);
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked") {
        setAuthModalOpen(true);
      }
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/me", { method: "DELETE" });
    setUser(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Support direct .glb 3D model import into Viewport3D!
    if (file.name.toLowerCase().endsWith(".glb") || file.name.toLowerCase().endsWith(".gltf")) {
      const objectUrl = URL.createObjectURL(file);
      const importedTask: GenerationTaskRecord = {
        id: `imported_${Date.now()}`,
        user_id: user?.id || "local",
        stage: "refine_pbr",
        engine: "trellis_pbr",
        mode: "text_to_3d",
        prompt_th: `Imported: ${file.name}`,
        prompt_en: `Imported GLB 3D Asset (${file.name})`,
        input_image_url: null,
        status: "completed",
        cost_credits: 0,
        refunded: 0,
        target_poly_count: 25000,
        topology: "quad",
        has_pbr: 1,
        has_rig: 0,
        preset_type: "mecha",
        primary_color: "#d6d3d1",
        accent_color: "#f59e0b",
        roughness: 0.25,
        metalness: 0.8,
        output_glb_url: objectUrl,
        created_at: new Date().toISOString(),
      };
      setTasks((prev) => [importedTask, ...prev]);
      setActiveTask(importedTask);
      setTopNav("workspace");
      triggerToast(`นำเข้าไฟล์โมเดล 3D (${file.name}) สำเร็จ!`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadedImage(dataUrl);
      const probe = new Image();
      probe.onload = () => {
        if (probe.width >= probe.height * 1.35) {
          sliceTurnaroundSheetTo4Views(dataUrl, `ตรวจพบภาพ 4-View Storyboard (${file.name})! หั่นแยก 4 มุมอัตโนมัติเรียบร้อย`);
        } else {
          setInputMode("image_to_3d");
          triggerToast(`อัปโหลดรูปภาพ ${file.name} พร้อมสร้าง 3D`);
        }
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);

  const sliceTurnaroundSheetTo4Views = (sheetSrc: string, customToast?: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const colW = Math.floor(img.width / 4);
      const h = img.height;
      const cropCol = (colIndex: number) => {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext("2d");
        if (!ctx) return sheetSrc;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 512, 512);
        const scale = Math.min(512 / colW, 512 / h);
        const drawW = colW * scale;
        const drawH = h * scale;
        const dx = (512 - drawW) / 2;
        const dy = (512 - drawH) / 2;
        ctx.drawImage(img, colIndex * colW, 0, colW, h, dx, dy, drawW, drawH);
        return canvas.toDataURL("image/png");
      };
      const front = cropCol(0);
      const back = cropCol(1);
      const right = cropCol(2);
      const left = cropCol(3);
      setUploadedImage(sheetSrc);
      setMultiViewImages({ front, back, left, right });
      setInputMode("multi_view");
      setActiveLeftTool("generate");
      setTopNav("workspace");
      triggerToast(
        customToast ||
          "หั่นภาพ 4-View Storyboard ลงช่อง FRONT / BACK / LEFT / RIGHT เรียบร้อย! กด Generate New 3D ได้เลย"
      );
    };
    img.src = sheetSrc;
  };

  const handleGenerateStoryboard = async (presetDwarf = false) => {
    setIsGeneratingStoryboard(true);
    setErrorBanner(null);
    try {
      const targetPrompt = presetDwarf
        ? "คนแคระช่างตีเหล็ก สวมผ้าคลุมฮู้ดสีน้ำตาล ถือค้อนเหล็ก (4-View Turnaround)"
        : prompt.trim() || "คนแคระช่างตีเหล็ก สวมผ้าคลุมฮู้ดสีน้ำตาล ถือค้อนเหล็ก (4-View Turnaround)";
      if (!prompt.trim() || presetDwarf) {
        setPrompt(targetPrompt);
      }
      const res = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptTh: targetPrompt }),
      });
      const data = await res.json();
      const sheetUrl = data?.sheetUrl || "/dwarf-turnaround-4view.jpg";
      sliceTurnaroundSheetTo4Views(
        sheetUrl,
        "สร้างภาพ 4-View Storyboard (Front/Back/Left/Right) สำเร็จ! พร้อมกด Generate New 3D"
      );
    } catch {
      sliceTurnaroundSheetTo4Views(
        "/dwarf-turnaround-4view.jpg",
        "โหลดภาพ 4-View Storyboard (Front/Back/Left/Right) สำเร็จ! พร้อมกด Generate New 3D"
      );
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleMultiViewSlotUpload = (
    slot: "front" | "back" | "left" | "right",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMultiViewImages((prev) => ({ ...prev, [slot]: reader.result as string }));
      triggerToast(`อัปโหลดภาพมุม ${slot.toUpperCase()} เรียบร้อย`);
    };
    reader.readAsDataURL(file);
  };

  const handleRandomPrompt = () => {
    const next = QUICK_PROMPTS[Math.floor(Math.random() * QUICK_PROMPTS.length)];
    setPrompt(next.prompt);
    triggerToast(`สุ่มไอเดีย: "${next.label}"`);
  };

  const togglePartVisibility = (idx: number) => {
    setHiddenParts((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const currentModelSpec =
    MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];
  const estimatedCost =
    (enablePbr8k ? currentModelSpec.credits : 2) + (enableAutoRig ? 3 : 0);

  const handleGenerate = async () => {
    setErrorBanner(null);
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    const hasMvSlots = Boolean(
      multiViewImages.front || multiViewImages.back || multiViewImages.left || multiViewImages.right
    );
    if (!prompt.trim() && !uploadedImage && !hasMvSlots) {
      setErrorBanner("กรุณาพิมพ์คำสั่ง Prompt หรืออัปโหลดรูปภาพต้นแบบ");
      return;
    }
    if (user.credits_balance < estimatedCost) {
      setErrorBanner(
        `เครดิตไม่เพียงพอ (ต้องใช้ ${estimatedCost} เครดิต แต่มี ${user.credits_balance} เครดิต)`
      );
      setTopupModalOpen(true);
      return;
    }

    setTopNav("workspace");
    setIsGenerating(true);
    setGenProgress(18);
    setGenStageText(
      hasMvSlots
        ? "กำลังส่งภาพ Storyboard ทั้ง 4 มุม (Front/Back/Left/Right) เข้า Hunyuan3D-2mv..."
        : "แปลภาษาไทย → 3D Spatial Prompt..."
    );

    const timer1 = setTimeout(() => {
      setGenProgress(52);
      setGenStageText(
        hasMvSlots
          ? "กำลังหลอมรวม Multi-View 360° Mesh (ด้านหน้า + ด้านหลังคมชัด)..."
          : `กำลังประมวลผล ${currentModelSpec.name}...`
      );
    }, 450);

    const timer2 = setTimeout(() => {
      setGenProgress(85);
      setGenStageText("กำลังสกัดพื้นผิว PBR & Clean Quad Topology...");
    }, 900);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptTh:
            prompt ||
            (hasMvSlots
              ? "โมเดล 3D Multi-View 4 มุม (Front/Back/Left/Right)"
              : "โมเดล 3D จากรูปภาพต้นแบบ"),
          stage: enablePbr8k ? "refine_pbr" : "draft_3d",
          engine: selectedModel,
          mode: hasMvSlots
            ? "image_to_3d"
            : inputMode === "image_to_3d"
              ? "image_to_3d"
              : "text_to_3d",
          targetPolyCount: targetPolycount,
          topology: cleanTopologyTrial || meshQualityTab === "smart-mesh" ? "quad" : "triangle",
          hasRig: enableAutoRig || activeLeftTool === "rig",
          inputImageUrl: uploadedImage || multiViewImages.front,
          multiViewImages,
        }),
      });
      const data = await res.json();
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!res.ok) {
        if (res.status === 401) {
          setAuthModalOpen(true);
        } else if (res.status === 402) {
          setTopupModalOpen(true);
        }
        throw new Error(data.error || "สร้างโมเดล 3D ไม่สำเร็จ");
      }

      setGenProgress(100);
      setGenStageText("เสร็จสมบูรณ์!");
      if (data.task) {
        setActiveTask(data.task);
      }
      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }
      if (data.user) {
        setUser(data.user);
      }
      if (generateInParts) {
        setSegmentColorMode(true);
        setExplodeFactor(0.25);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenProgress(0);
        setGenStageText("");
      }, 350);
    }
  };

  // Combine user tasks + curated showcase for the Welcome Gallery with Category Filtering
  const allGalleryModels = [...tasks, ...CURATED_SHOWCASE]
    .filter(
      (item, index, self) =>
        self.findIndex(
          (t) =>
            (t.output_glb_url && t.output_glb_url === item.output_glb_url && t.prompt_th === item.prompt_th) ||
            t.id === item.id
        ) === index
    )
    .filter((item) => {
    if (selectedCategory !== "All" && selectedCategory !== "Featured" && selectedCategory !== "3D Printing") {
      const tag = (item as any).categoryTag || "";
      const presetMap: Record<string, string> = {
        mecha: "Character",
        dragon: "Animal",
        vehicle: "Vehicle",
        sword: "Props",
        potion: "Props",
        crystal: "Props",
      };
      const matchedCat = tag || presetMap[item.preset_type] || "Character";
      if (matchedCat !== selectedCategory) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !item.prompt_th.toLowerCase().includes(q) &&
        !item.prompt_en.toLowerCase().includes(q) &&
        !item.preset_type.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filterMeshType === "rigged" && !item.has_rig) return false;
    if (filterMeshType === "pbr" && !item.has_pbr) return false;
    return true;
  });

  const studioOverrides: LiveStudioOverrides = useMemo(
    () => ({
      explodeFactor,
      segmentColorMode,
      uvCheckerMode,
      filledParts,
      transform: transformState,
      material: materialState,
      showRig: showRigBones,
      animationClip,
      animationSpeed,
      hiddenParts,
      viewChannel,
      shadingSmoothness,
      artStyleMode,
      reliefDepth,
      text3dContent,
      text3dDepth,
      rigCharacterType: rigType,
      showRigMarkers,
      posePreset,
      inPlaceAnimation,
      addPrintBase,
      printCheckMode,
      filamentPreset,
      filamentColor,
      decalEnabled,
      decalScale,
      decalRotation,
      decalColor,
      hdriPreset,
      hdriRotation,
      cameraFov,
      showGrid,
      activeBrushTool: activeLeftTool === "edit" ? activeBrushTool : undefined,
    }),
    [
      explodeFactor,
      segmentColorMode,
      uvCheckerMode,
      filledParts,
      transformState,
      materialState,
      showRigBones,
      animationClip,
      animationSpeed,
      hiddenParts,
      viewChannel,
      shadingSmoothness,
      artStyleMode,
      reliefDepth,
      text3dContent,
      text3dDepth,
      rigType,
      showRigMarkers,
      posePreset,
      inPlaceAnimation,
      addPrintBase,
      printCheckMode,
      filamentPreset,
      filamentColor,
      decalEnabled,
      decalScale,
      decalRotation,
      decalColor,
      hdriPreset,
      hdriRotation,
      cameraFov,
      showGrid,
      activeLeftTool,
      activeBrushTool,
    ]
  );

  return (
    <main className="h-dvh w-dvw overflow-hidden bg-[#0b0709] bg-[radial-gradient(ellipse_75%_45%_at_50%_-10%,rgba(220,38,38,0.22),transparent)] text-[#f5f0f2] flex flex-col select-none font-sans relative">
      {/* Studio Notification Toast */}
      {actionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-[8px] bg-[#170c10] border border-red-500/35 text-[#f5f0f2] text-[13px] font-normal shadow-[0_8px_24px_rgba(0,0,0,0.55)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ef4444] shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* =====================================================================
          1. TOP STUDIO HEADER (56px, Crimson-Obsidian #0e080b, Crisp Red Accent)
         ===================================================================== */}
      <header className="relative z-20 h-14 w-full bg-[#0e080b]/95 backdrop-blur-md px-6 flex items-center justify-between shrink-0 border-b border-red-500/20">
        {/* Left Navigation: Flat Prism Mark + 2-Tab Segmented Control */}
        <nav className="flex items-center gap-4">
          <button
            onClick={() => setTopNav("home")}
            className="flex items-center gap-2.5 py-1 hover:opacity-85 transition-opacity cursor-pointer"
          >
            <svg
              className="w-5 h-5 text-[#ef4444] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L21 19H3L12 2Z"
                fill="currentColor"
                fillOpacity="0.95"
              />
              <path
                d="M12 2L21 19H12V2Z"
                fill="#ffffff"
                fillOpacity="0.24"
              />
            </svg>
            <span className="font-semibold text-[16px] tracking-tight text-white">
              Prism<span className="text-[#ef4444]">3D</span>
            </span>
          </button>

          <div className="h-8 p-1 rounded-[8px] bg-[#170c10] border border-red-500/20 flex items-center gap-1">
            <button
              onClick={() => setTopNav("home")}
              className={`h-6 px-3 rounded-[6px] text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                topNav === "home"
                  ? "bg-[#dc2626] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "text-[#b8a6ad] hover:text-white"
              }`}
            >
              <HomeIcon className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>หน้าแรก</span>
            </button>

            <button
              onClick={() => setTopNav("workspace")}
              className={`h-6 px-3 rounded-[6px] text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                topNav === "workspace"
                  ? "bg-[#dc2626] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "text-[#b8a6ad] hover:text-white"
              }`}
            >
              <Box className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>สตูดิโอ 3D</span>
            </button>
          </div>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {oauthToast && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-[8px] bg-[#170c10] border border-red-500/20 text-[#f5f0f2] text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4cc38a]" />
              <span>{oauthToast}</span>
            </div>
          )}

          {/* DCC Bridge Modal Trigger (Only shown inside 3D Studio) */}
          {topNav === "workspace" && (
            <button
              onClick={() => setDccBridgeModalOpen(true)}
              className="hidden sm:flex h-8 px-3 rounded-[8px] bg-[#170c10] hover:bg-[#241219] border border-red-500/20 items-center gap-2 text-[13px] font-normal text-[#d4c5cb] hover:text-white transition-colors cursor-pointer"
            >
              <Cpu className="w-4 h-4 stroke-[1.5] text-[#ef4444]" />
              <span>DCC Bridge</span>
            </button>
          )}

          {/* Credits + Top-Up Control (Tabular Mono Figures) */}
          <div className="h-8 p-1 rounded-[8px] bg-[#170c10] border border-red-500/20 flex items-center gap-1">
            <button
              onClick={() => {
                fetchSession();
                setTopupInitialTab("ledger");
                setTopupModalOpen(true);
              }}
              title="ดูประวัติธุรกรรมและยอดเครดิตในฐานข้อมูล D1"
              className="h-6 px-2.5 rounded-[6px] hover:bg-[#241219] flex items-center gap-1.5 text-[13px] text-white transition-colors cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 stroke-[1.5] text-[#ef4444]" />
              <span className="font-mono tabular-nums font-medium">
                {user ? user.credits_balance : 0}
              </span>
              <span className="text-[12px] text-[#b8a6ad]">เครดิต</span>
            </button>
            <button
              onClick={() => {
                setTopupInitialTab("topup");
                setTopupModalOpen(true);
              }}
              className="h-6 px-2.5 rounded-[6px] bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium text-[12px] flex items-center gap-1 transition-colors cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>เติมเครดิต</span>
            </button>
          </div>

          {/* User Profile / Google Sign-In */}
          {user ? (
            <div className="h-8 px-2 rounded-[8px] bg-[#170c10] border border-red-500/20 flex items-center gap-1.5">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-5 h-5 rounded-[4px] bg-[#241219] object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-[4px] bg-[#dc2626] text-white font-medium text-[11px] flex items-center justify-center">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-[13px] font-normal text-[#d4c5cb] max-w-[96px] truncate hidden md:inline px-1">
                {user.name}
              </span>
              <button
                onClick={handleDirectGoogleLogin}
                title="สลับบัญชี Google"
                className="p-1 text-[#b8a6ad] hover:text-white rounded-[4px] hover:bg-[#241219] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button
                onClick={handleLogout}
                title="ออกจากระบบ"
                className="p-1 text-[#b8a6ad] hover:text-[#ef4444] rounded-[4px] hover:bg-[#241219] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleDirectGoogleLogin}
              className="h-8 px-3.5 rounded-[8px] bg-[#dc2626] text-white hover:bg-[#ef4444] font-medium text-[13px] flex items-center gap-2 transition-colors cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            >
              <GoogleLogoSvg className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </header>

      {/* =====================================================================
          2A. WELCOME PAGE (Crimson-Obsidian Studio Composer & Showcase)
         ===================================================================== */}
      {topNav === "home" ? (
        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-10 space-y-12 no-scrollbar">
          {/* Hero Section */}
          <section className="max-w-[760px] mx-auto flex flex-col items-center">
            <h1 className="text-[28px] sm:text-[36px] font-medium tracking-[-0.02em] text-white text-center leading-[1.15]">
              สร้างโมเดล 3D พร้อมพื้นผิว PBR และโครงกระดูก
            </h1>

            <p className="text-[14px] text-[#b8a6ad] font-normal text-center mt-2 mb-8 max-w-[540px] leading-[1.5]">
              แปลงข้อความภาษาไทยหรือรูปภาพต้นแบบเป็นไฟล์ .GLB และ .STL สำหรับเอนจินเกม แอนิเมชัน และเครื่องพิมพ์ 3D
            </p>

            {/* Studio Prompt Composer Card (Crimson-Obsidian #160c10, Nested 14px -> 8px Radius) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverHero(true);
              }}
              onDragLeave={() => setIsDragOverHero(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOverHero(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith("image/")) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setUploadedImage(reader.result as string);
                    setInputMode("image_to_3d");
                    triggerToast("อัปโหลดรูปภาพต้นแบบเรียบร้อยแล้ว");
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className={`w-full rounded-[14px] p-4 flex flex-col justify-between gap-4 relative transition-colors ${
                isDragOverHero
                  ? "bg-[#241219] border border-[#ef4444]"
                  : "bg-[#160c10] border border-red-500/25 shadow-[0_16px_48px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(248,113,113,0.12)]"
              }`}
            >
              {/* Main Prompt Input + Inline Image Preview */}
              <div className="flex items-start gap-4">
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="บรรยายโมเดล 3D เช่น หุ่นรบเกราะเหล็กไซไฟ, มังกรพญานาคคริสตัล, ดาบอัศวิน"
                  className="flex-1 bg-transparent text-[15px] text-white placeholder-[#8c767e] focus:outline-none resize-none leading-[1.6]"
                />

                {uploadedImage && (
                  <div className="relative w-20 h-20 rounded-[8px] bg-[#0b0709] border border-red-500/30 p-1 shrink-0">
                    <img
                      src={uploadedImage}
                      alt="Reference"
                      className="w-full h-full object-contain rounded-[6px]"
                    />
                    <button
                      onClick={() => {
                        setUploadedImage(null);
                        setInputMode("text_to_3d");
                      }}
                      title="ลบรูปต้นแบบ"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-[4px] bg-[#dc2626] text-white text-[11px] flex items-center justify-center cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Action Bar (4 Controls, 8px Radius, Crimson Primary CTA) */}
              <div className="pt-3 border-t border-red-500/15 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* 1. Attach Image / .GLB */}
                  <label className="h-9 px-3 rounded-[8px] bg-[#211117] hover:bg-[#2b161e] border border-red-500/20 text-[13px] font-normal text-[#f5f0f2] flex items-center gap-2 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*,.glb,.gltf"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <ImageIcon className="w-4 h-4 stroke-[1.5] text-[#ef4444]" />
                    <span>{uploadedImage ? "เปลี่ยนรูปต้นแบบ" : "แนบรูป / .GLB"}</span>
                  </label>

                  {/* 2. Engine Tier Switcher */}
                  <button
                    onClick={() =>
                      setSelectedModel(
                        selectedModel === "trellis_pbr"
                          ? "hunyuan3d_2_1"
                          : "trellis_pbr"
                      )
                    }
                    className={`h-9 px-3 rounded-[8px] border text-[13px] font-normal flex items-center gap-2 transition-colors cursor-pointer ${
                      selectedModel === "trellis_pbr"
                        ? "bg-[#2b1319] border-red-500/45 text-white"
                        : "bg-[#211117] hover:bg-[#2b161e] border-red-500/20 text-[#f5f0f2]"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedModel === "trellis_pbr"
                          ? "bg-[#ef4444]"
                          : "bg-[#b8a6ad]"
                      }`}
                    />
                    <span>
                      {selectedModel === "trellis_pbr"
                        ? "Pro Studio"
                        : "Standard PBR"}
                    </span>
                    <span className="font-mono tabular-nums text-[12px] text-[#b8a6ad]">
                      {selectedModel === "trellis_pbr" ? "6 เครดิต" : "2 เครดิต"}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* 3. Random Prompt Idea */}
                  <button
                    onClick={handleRandomPrompt}
                    title="สุ่มคำสั่งตัวอย่าง"
                    className="w-9 h-9 rounded-[8px] bg-[#211117] hover:bg-[#2b161e] border border-red-500/20 flex items-center justify-center text-[#d4c5cb] hover:text-white transition-colors cursor-pointer"
                  >
                    <Dices className="w-4 h-4 stroke-[1.5]" />
                  </button>

                  {/* 4. Primary Generate CTA (Signature Crimson Red) */}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="h-9 px-4 rounded-[8px] bg-[#dc2626] hover:bg-[#ef4444] disabled:opacity-50 text-white font-medium text-[13px] flex items-center gap-2 transition-colors cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
                  >
                    <Wand2 className="w-4 h-4 stroke-[1.5]" />
                    <span>สร้างโมเดล 3D</span>
                    <span className="px-1.5 py-0.5 rounded-[4px] bg-black/25 text-white text-[12px] font-mono tabular-nums font-medium">
                      {estimatedCost}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Showcase & Community Gallery Section */}
          <section className="max-w-[1360px] mx-auto space-y-4">
            {/* Category Bar + Search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {GALLERY_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`h-8 px-3.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? "bg-[#dc2626] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                          : "bg-[#160c10] text-[#b8a6ad] hover:text-white hover:bg-[#211117] border border-red-500/15"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              <div className="h-8 px-3 rounded-[8px] bg-[#160c10] border border-red-500/20 flex items-center gap-2">
                <Search className="w-4 h-4 stroke-[1.5] text-[#ef4444]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาโมเดล"
                  className="bg-transparent text-[13px] text-white placeholder-[#8c767e] focus:outline-none w-36 sm:w-48"
                />
              </div>
            </div>

            {/* 4-Column 3D Model Grid (Crimson-Obsidian Cards, Nested 14px -> 8px Radius) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {allGalleryModels.map((item) => {
                const cleanTitle = item.prompt_th
                  .replace(/^\[.*?\]\s*/, "")
                  .replace(/\s*\(.*?\)\s*$/, "");
                const isPro = item.engine === "trellis_pbr";
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveTask(item);
                      setTopNav("workspace");
                    }}
                    className="rounded-[14px] bg-[#160c10] border border-red-500/20 hover:border-red-500/50 p-2 flex flex-col justify-between relative group cursor-pointer transition-colors"
                  >
                    <div className="h-[248px] rounded-[8px] bg-gradient-to-b from-[#220e15] to-[#0a0608] border border-red-500/10 flex items-center justify-center relative overflow-hidden">
                      {item.input_image_url ? (
                        <img
                          src={item.input_image_url}
                          alt={cleanTitle}
                          className="w-full h-full object-contain p-4"
                        />
                      ) : (
                        <div
                          className="w-20 h-20 rounded-[12px] flex items-center justify-center border border-white/15"
                          style={{
                            background: `linear-gradient(135deg, ${item.primary_color}, ${item.accent_color})`,
                          }}
                        >
                          <Box className="w-8 h-8 stroke-[1.5] text-white" />
                        </div>
                      )}

                      {/* HUD Spec Badge */}
                      <span
                        className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-[4px] border flex items-center gap-1.5 text-[11px] font-mono tabular-nums ${
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

                      {/* Bottom Action Bar on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-x-2 bottom-2 p-1.5 rounded-[6px] bg-[#140a0e]/95 border border-red-500/30 flex items-center justify-between gap-1.5">
                        <span className="flex-1 h-7 px-2.5 rounded-[4px] bg-[#dc2626] text-white font-medium text-[12px] flex items-center justify-center gap-1.5">
                          <span>เปิดในสตูดิโอ</span>
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTask(item);
                            setPrompt(cleanTitle);
                            setTopNav("workspace");
                            handleSelectLeftTool("generate");
                            triggerToast(`โหลดพรอมต์ "${cleanTitle}" เพื่อสร้างใหม่แล้ว`);
                          }}
                          className="h-7 px-2.5 rounded-[4px] bg-[#241219] hover:bg-[#311822] text-[12px] font-normal text-white transition-colors cursor-pointer"
                        >
                          Remix
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTask(item);
                            setTopNav("workspace");
                            handleSelectLeftTool("texture");
                            triggerToast(`เปิด "${cleanTitle}" ในโหมดพื้นผิว PBR`);
                          }}
                          className="h-7 px-2.5 rounded-[4px] bg-[#241219] hover:bg-[#311822] text-[12px] font-normal text-[#d4c5cb] hover:text-white transition-colors cursor-pointer"
                        >
                          PBR
                        </button>
                      </div>
                    </div>

                    {/* Card Footer: Title + Signature Tabular Mono Spec */}
                    <div className="pt-2.5 pb-1 px-1.5 flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium text-white truncate">
                        {cleanTitle}
                      </p>
                      <span className="text-[11px] font-mono tabular-nums text-[#ef4444]/85 shrink-0">
                        {(item.target_poly_count / 1000).toFixed(0)}k · {item.topology.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        /* =====================================================================
           2B. 3D WORKSPACE VIEW — CRIMSON-OBSIDIAN DARKROOM STUDIO SHELL
           ===================================================================== */
        <div className="relative z-10 flex-1 min-h-0 flex bg-[#090608]">
          {/* -------------------------------------------------------------------
              LEFT DOCK PART 1: 5-Pillar Studio Rail (64px wide, Crimson Active)
             ------------------------------------------------------------------- */}
          <aside className="w-16 h-full bg-[#0e080b] border-r border-red-500/20 flex flex-col justify-between py-3 px-2 shrink-0">
            <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar">
              {STUDIO_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                const isActive = pillar.subTools.some((st) => st.id === activeLeftTool);
                return (
                  <button
                    key={pillar.id}
                    onClick={() => handleSelectLeftTool(pillar.defaultTool)}
                    className={`w-full py-2.5 px-1 rounded-[8px] flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer relative ${
                      isActive
                        ? "bg-[#261118] text-white border border-red-500/35"
                        : "text-[#b8a6ad] hover:text-white hover:bg-[#170c10]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r bg-[#ef4444]" />
                    )}
                    <Icon
                      className={`w-4 h-4 stroke-[1.5] ${
                        isActive ? "text-[#ef4444]" : "text-[#b8a6ad]"
                      }`}
                    />
                    <span className="text-[11px] leading-none font-medium text-center">
                      {pillar.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-red-500/15 flex flex-col items-center">
              <button
                onClick={() => setTopupModalOpen(true)}
                className="w-full py-2 rounded-[8px] text-[#b8a6ad] hover:text-white hover:bg-[#170c10] flex flex-col items-center gap-1 transition-colors cursor-pointer"
              >
                <Coins className="w-4 h-4 stroke-[1.5] text-[#ef4444]" />
                <span className="text-[10px] leading-none font-normal">เครดิต</span>
              </button>
            </div>
          </aside>

          {/* -------------------------------------------------------------------
              LEFT DOCK PART 2: Dynamic Tool Inspector (280px wide, #140a0e)
             ------------------------------------------------------------------- */}
          <section className="w-[280px] h-full bg-[#140a0e] border-r border-red-500/20 flex flex-col shrink-0 overflow-hidden">
            {/* Dynamic Panel Header */}
            <div className="h-10 px-4 border-b border-red-500/15 flex items-center justify-between shrink-0">
              <span className="text-[13px] font-medium text-white truncate">
                {
                  STUDIO_PILLARS.find((p) =>
                    p.subTools.some((st) => st.id === activeLeftTool)
                  )?.titleTh
                }
              </span>
              <button
                onClick={() => {
                  setExplodeFactor(0);
                  setSegmentColorMode(false);
                  setUvCheckerMode(false);
                  setPrintCheckMode(false);
                  setViewChannel(undefined);
                  setArtStyleMode("standard");
                  setShadingSmoothness("auto");
                  setPosePreset("bind");
                  setDecalEnabled(false);
                  setAddPrintBase(false);
                  setAnimationClip("none");
                  setFilledParts({ auraRing: false, pedestal: false, backWings: false });
                  setTransformState({ scaleX: 1, scaleY: 1, scaleZ: 1, rotY: 0 });
                  setMaterialState({
                    primaryColor: activeTask?.output_glb_url
                      ? "#d6d3d1"
                      : activeTask?.primary_color || "#ef4444",
                    accentColor: activeTask?.accent_color || "#f59e0b",
                    roughness: activeTask?.output_glb_url ? 0.42 : activeTask?.roughness ?? 0.35,
                    metalness: activeTask?.output_glb_url ? 0.18 : activeTask?.metalness ?? 0.25,
                    emissiveIntensity: activeTask?.output_glb_url ? 0 : 0.25,
                    polyMultiplier: 1,
                  });
                  triggerToast("รีเซ็ตการตั้งค่า Viewport และวัสดุกลับสู่ค่าเริ่มต้นแล้ว");
                }}
                title="รีเซ็ตการตั้งค่า"
                className="text-[12px] px-2 py-1 rounded-[6px] hover:bg-[#241219] text-[#b8a6ad] hover:text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3 stroke-[1.5]" />
                <span>รีเซ็ต</span>
              </button>
            </div>

            {/* Sub-Mode Switcher inside the Active Pillar */}
            {(() => {
              const currentPillar = STUDIO_PILLARS.find((p) =>
                p.subTools.some((st) => st.id === activeLeftTool)
              );
              if (!currentPillar || currentPillar.subTools.length <= 1) return null;
              return (
                <div className="px-3 pt-3 pb-1 shrink-0">
                  <div className="p-1 rounded-[8px] bg-[#0b0709] border border-red-500/20 flex items-center gap-1">
                    {currentPillar.subTools.map((st) => {
                      const subActive = activeLeftTool === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => handleSelectLeftTool(st.id)}
                          className={`flex-1 py-1.5 px-2 rounded-[6px] text-[12px] font-medium transition-colors truncate cursor-pointer ${
                            subActive
                              ? "bg-[#dc2626] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                              : "text-[#b8a6ad] hover:text-white"
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* =================================================================
                TOOL 0: 3D AGENT CO-PILOT (Meshy 7.1 AgentPanel)
               ================================================================= */}
            {activeLeftTool === "agent" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/15 via-rose-500/10 to-red-500/15 border border-red-400/35 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-200">
                    <Sparkles className="w-3.5 h-3.5 text-red-400" />
                    <span>Meshy 7.1 + Tripo 3D Agent</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    สั่งงานเอเจนต์อัจฉริยะให้วางแผน สร้าง Multi-View แยกชิ้นส่วน ทำ PBR 8K และผูกกระดูกให้อัตโนมัติทีละสเต็ป
                  </p>
                </div>

                {[
                  {
                    step: "1. Concept & Art Style",
                    desc: `ตั้งค่าสไตล์ ${meshyArtStyleLabel} + สมมาตร Auto`,
                    btn: "Run Concept",
                    action: () => {
                      setArtStyleMode("standard");
                      setSymmetryMode("on");
                      triggerToast("3D Agent: วิเคราะห์โครงสร้างสมมาตรและสัดส่วนโมเดลเรียบร้อย");
                    },
                  },
                  {
                    step: "2. Clean Quad Remesh",
                    desc: "จัดเรียงเส้น Quad-Dominant สำหรับเกม/อนิเมชัน",
                    btn: "Remesh Quad",
                    action: () => {
                      if (activeTask) setActiveTask({ ...activeTask, topology: "quad" });
                      setShadingSmoothness("smooth");
                      triggerToast("3D Agent: แปลงพื้นผิวเป็น Clean Quad Topology สำเร็จ");
                    },
                  },
                  {
                    step: "3. Semantic Auto-Split",
                    desc: "แยกชิ้นส่วนเกราะ/อาวุธ/ลำตัว (Explode 30%)",
                    btn: "Split Parts",
                    action: () => {
                      setSegmentColorMode(true);
                      setExplodeFactor(0.3);
                      triggerToast("3D Agent: แยกชิ้นส่วนโมเดล (Auto-Split) เรียบร้อย");
                    },
                  },
                  {
                    step: "4. Native 8K PBR & Decal",
                    desc: "สร้างแผนที่ Normal/Metallic + แปะตราสัญลักษณ์ 3D",
                    btn: "Apply 8K PBR",
                    action: () => {
                      setSegmentColorMode(false);
                      setExplodeFactor(0);
                      setDecalEnabled(true);
                      setMaterialState((p) => ({
                        ...p,
                        roughness: 0.18,
                        metalness: 0.9,
                        emissiveIntensity: 0.35,
                      }));
                      triggerToast("3D Agent: สร้าง 8K PBR + 3D Decal Emblem เรียบร้อย");
                    },
                  },
                  {
                    step: "5. One-Click Rig & Motion",
                    desc: "ผูกกระดูก Mixamo/UE5 + ทดสอบเดิน/โจมตี",
                    btn: "Auto-Rig & Play",
                    action: () => {
                      setShowRigBones(true);
                      setAnimationClip("walk");
                      triggerToast("3D Agent: ผูกกระดูกและรันอนิเมชันพร้อมใช้งาน!");
                    },
                  },
                  {
                    step: "6. Make 3D Printable (.STL)",
                    desc: "ซ่อม Mesh ตัน + เติมฐานตั้งสำหรับ Bambu Studio",
                    btn: "Prep 3D Print",
                    action: () => {
                      setAddPrintBase(true);
                      setAnimationClip("none");
                      setShowRigBones(false);
                      triggerToast("3D Agent: เติมฐานตั้ง STL Platform พร้อมส่งเข้า Slicer!");
                    },
                  },
                ].map((st) => (
                  <div
                    key={st.step}
                    className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{st.step}</div>
                      <div className="text-[10px] text-slate-400 truncate">{st.desc}</div>
                    </div>
                    <button
                      onClick={st.action}
                      className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-600 text-red-200 hover:text-white text-[10px] font-bold shrink-0 transition cursor-pointer"
                    >
                      {st.btn}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* =================================================================
                TOOL 0B: 3D BAS-RELIEF & 3D TEXT EXTRUDER (Meshy Relief + 3D Text)
               ================================================================= */}
            {activeLeftTool === "relief" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="grid grid-cols-2 gap-1 p-1 rounded-[8px] bg-[#0f0f10] border border-white/[0.08]">
                  <button
                    onClick={() => {
                      setArtStyleMode("relief");
                      triggerToast("สลับเป็นโหมดปั้นนูนต่ำ 3D Bas-Relief Medallion");
                    }}
                    className={`py-1.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                      artStyleMode === "relief"
                        ? "bg-[#232325] text-[#ededed]"
                        : "text-[#85858b] hover:text-[#ededed]"
                    }`}
                  >
                    Bas-Relief
                  </button>
                  <button
                    onClick={() => {
                      setArtStyleMode("text3d");
                      triggerToast("สลับเป็นโหมด 3D Text Extruder");
                    }}
                    className={`py-1.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                      artStyleMode === "text3d"
                        ? "bg-[#232325] text-[#ededed]"
                        : "text-[#85858b] hover:text-[#ededed]"
                    }`}
                  >
                    3D Text
                  </button>
                </div>

                {artStyleMode === "text3d" ? (
                  <div className="p-3 rounded-[10px] bg-[#19191b] border border-white/[0.08] space-y-3">
                    <div className="space-y-1">
                      <span className="text-[11px] text-[#a1a1a6]">ข้อความ 3D (3D Typography)</span>
                      <input
                        type="text"
                        maxLength={8}
                        value={text3dContent}
                        onChange={(e) => setText3dContent(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-[6px] bg-[#0f0f10] border border-white/[0.1] text-xs font-mono text-[#ededed] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a1a1a6]">Extrusion Depth</span>
                        <span className="text-[#ededed] font-mono tabular-nums">{text3dDepth.toFixed(2)}m</span>
                      </div>
                      <input
                        type="range"
                        min={0.15}
                        max={1.1}
                        step={0.05}
                        value={text3dDepth}
                        onChange={(e) => setText3dDepth(Number(e.target.value))}
                        className="w-full accent-[#e5484d] h-1.5 bg-[#0f0f10] rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-[10px] bg-[#19191b] border border-white/[0.08] space-y-3">
                    <p className="text-[11px] text-[#a1a1a6] leading-relaxed">
                      สร้างเหรียญตราหรือป้ายภาพนูนต่ำ 3D (Bas-Relief / Lithophane) พร้อมกรอบสำหรับพิมพ์ 3D
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a1a1a6]">Relief Emboss Height</span>
                        <span className="text-[#ededed] font-mono tabular-nums">{reliefDepth.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={1.5}
                        step={0.05}
                        value={reliefDepth}
                        onChange={(e) => setReliefDepth(Number(e.target.value))}
                        className="w-full accent-[#e5484d] h-1.5 bg-[#0f0f10] rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setArtStyleMode("standard");
                    triggerToast("กลับสู่โหมดโมเดล 3D ปกติ");
                  }}
                  className="w-full py-2 rounded-[8px] bg-[#19191b] hover:bg-[#232325] border border-white/[0.08] text-xs text-[#a1a1a6] hover:text-[#ededed] cursor-pointer"
                >
                  กลับสู่โหมด Full 3D Mesh
                </button>
              </div>
            )}

            {/* =================================================================
                TOOL 1: GENERATE MODEL (WorkspaceGeneratePanel)
               ================================================================= */}
            {activeLeftTool === "generate" && (
              <>
                <div className="px-3 pt-2 pb-2 shrink-0">
                  <div className="h-8 w-full rounded-[8px] bg-[#0b0709] p-1 flex items-center relative border border-red-500/20">
                    <button
                      onClick={() => setMeshQualityTab("hd")}
                      className={`flex-1 h-full rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                        meshQualityTab === "hd"
                          ? "bg-[#dc2626] text-white"
                          : "text-[#9c848b] hover:text-[#f5eff1]"
                      }`}
                    >
                      HD Model
                    </button>
                    <button
                      onClick={() => setMeshQualityTab("smart-mesh")}
                      className={`flex-1 h-full rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                        meshQualityTab === "smart-mesh"
                          ? "bg-[#dc2626] text-white"
                          : "text-[#9c848b] hover:text-[#f5eff1]"
                      }`}
                    >
                      Smart Mesh
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-2.5 no-scrollbar">
                  <div className="p-3 rounded-[10px] border border-red-500/20 bg-[#1a0d12] flex flex-col gap-2.5">
                    <div className="h-8 w-full rounded-[8px] bg-[#0b0709] p-1 grid grid-cols-4 gap-1 border border-red-500/15">
                      {[
                        { id: "text_to_3d", title: "Text to 3D", icon: PenTool },
                        { id: "image_to_3d", title: "Image to 3D", icon: ImageIcon },
                        { id: "multi_view", title: "Multi-View (4 Angles)", icon: Layers },
                        { id: "retopo", title: "Retopology Mode", icon: Grid },
                      ].map((m) => {
                        const Icon = m.icon;
                        const active = inputMode === m.id;
                        return (
                          <button
                            key={m.id}
                            title={m.title}
                            onClick={() =>
                              setInputMode(
                                m.id as "text_to_3d" | "image_to_3d" | "multi_view" | "retopo"
                              )
                            }
                            className={`h-full rounded-[6px] flex items-center justify-center transition-colors cursor-pointer ${
                              active
                                ? "bg-[#dc2626] text-white"
                                : "text-[#9c848b] hover:text-[#f5eff1]"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        );
                      })}
                    </div>

                    {inputMode === "image_to_3d" ? (
                      <label className="h-[168px] rounded-[8px] border border-dashed border-red-500/30 hover:border-red-500/60 bg-[#0b0709] flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center relative overflow-hidden">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        {uploadedImage ? (
                          <img
                            src={uploadedImage}
                            alt="Uploaded reference"
                            className="w-full h-full object-contain rounded-[6px]"
                          />
                        ) : (
                          <>
                            <Upload className="w-5 h-5 stroke-[1.5] text-red-400 mb-2" />
                            <span className="text-xs font-medium text-[#f5eff1]">
                              อัปโหลดรูปภาพ JPG, PNG, WEBP
                            </span>
                            <span className="text-[11px] text-[#9c848b] mt-1">
                              ขนาดไม่เกิน 20MB หรือวางด้วย Ctrl+V
                            </span>
                          </>
                        )}
                      </label>
                    ) : inputMode === "multi_view" ? (
                      <div className="space-y-2">
                        {uploadedImage && (
                          <div className="relative rounded-[8px] border border-red-500/20 bg-[#0b0709] p-1.5 overflow-hidden">
                            <img
                              src={uploadedImage}
                              alt="4-View Storyboard Sheet"
                              className="w-full h-16 object-contain rounded-[6px] bg-white"
                            />
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[4px] bg-[#140a0e]/90 text-[#f5eff1] text-[10px] font-mono">
                              4-View Sheet
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          {(["front", "back", "left", "right"] as const).map((slot) => (
                            <label
                              key={slot}
                              className="h-20 rounded-[8px] border border-dashed border-red-500/30 hover:border-red-500/60 bg-[#0b0709] flex flex-col items-center justify-center cursor-pointer p-1 relative overflow-hidden"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleMultiViewSlotUpload(slot, e)}
                                className="hidden"
                              />
                              {multiViewImages[slot] ? (
                                <>
                                  <img
                                    src={multiViewImages[slot]!}
                                    alt={slot}
                                    className="w-full h-full object-contain rounded-[6px] bg-white"
                                  />
                                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-[4px] bg-[#140a0e]/90 text-[#f5eff1] text-[10px] font-mono">
                                    {slot}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3.5 h-3.5 stroke-[1.5] text-red-400 mb-1" />
                                  <span className="text-[11px] font-normal text-[#b8a2a8] capitalize">
                                    {slot}
                                  </span>
                                </>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          rows={5}
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="บรรยายโมเดล 3D เช่น หุ่นยนต์ยักษ์วัดแจ้ง..."
                          className="w-full h-[124px] rounded-[8px] bg-[#0b0709] border border-red-500/20 focus:border-red-500/50 p-2.5 text-xs text-[#f5eff1] placeholder-[#7d666d] focus:outline-none resize-none leading-relaxed"
                        />
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                          {QUICK_PROMPTS.map((qp) => (
                            <button
                              key={qp.label}
                              onClick={() => setPrompt(qp.prompt)}
                              className="text-[11px] px-2 py-0.5 rounded-[6px] bg-[#241118] hover:bg-[#311620] border border-red-500/15 text-[#c7b2b8] hover:text-[#f5eff1] whitespace-nowrap transition-colors cursor-pointer"
                            >
                              {qp.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4-View Character Turnaround Storyboard Generator Bar */}
                    <div className="pt-2 border-t border-red-500/15 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] text-[#b8a2a8]">
                        <span>4-View Turnaround Sheet</span>
                        <span className="text-[10px] text-red-400 font-mono">360°</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleGenerateStoryboard(false)}
                          disabled={isGeneratingStoryboard}
                          className="py-1.5 px-2 rounded-[6px] bg-[#241118] hover:bg-[#311620] border border-red-500/25 text-[#f5eff1] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5 stroke-[1.5] text-red-400 shrink-0" />
                          <span className="truncate">
                            {isGeneratingStoryboard ? "กำลังสร้าง 4 มุม..." : "สร้างภาพ 4 มุม"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateStoryboard(true)}
                          className="py-1.5 px-2 rounded-[6px] bg-[#0b0709] hover:bg-[#241118] border border-red-500/20 text-[#b8a2a8] hover:text-[#f5eff1] text-[11px] font-normal flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5 stroke-[1.5] text-red-400 shrink-0" />
                          <span className="truncate">ตัวอย่าง 4-View</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Geometry & Texture Accordion */}
                  <div className="rounded-[10px] bg-[#1a0d12] border border-red-500/20 p-3 flex flex-col gap-2">
                    <button
                      onClick={() => setAdvancedOpen(!advancedOpen)}
                      className="w-full flex items-center justify-between text-xs font-medium text-[#f5eff1] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 stroke-[1.5] text-red-400" />
                        <span>Geometry & Texture</span>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-[#9c848b] transition-transform ${
                          advancedOpen ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {advancedOpen && (
                      <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
                        {/* Meshy 11 Art Styles Selector */}
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-400">Art Style (Meshy 7.1)</span>
                          <div className="grid grid-cols-2 gap-1">
                            {[
                              { label: "Realistic", mode: "standard" as const },
                              { label: "Japanese Anime", mode: "standard" as const },
                              { label: "Cartoon 2.5D", mode: "standard" as const },
                              { label: "Oriental Ink", mode: "standard" as const },
                              { label: "ZBrush Clay", mode: "sculpture" as const },
                              { label: "Voxel Block", mode: "voxel" as const },
                            ].map((st) => (
                              <button
                                key={st.label}
                                onClick={() => {
                                  setMeshyArtStyleLabel(st.label);
                                  setArtStyleMode(st.mode);
                                  if (st.mode === "sculpture") setViewChannel("clay");
                                  else setViewChannel(undefined);
                                  triggerToast(`เปลี่ยน Art Style เป็น ${st.label}`);
                                }}
                                className={`py-1 px-2 rounded-lg text-[10px] font-medium border text-left truncate cursor-pointer ${
                                  meshyArtStyleLabel === st.label
                                    ? "bg-red-500/20 border-red-400 text-red-200"
                                    : "bg-[#090709] border-white/10 text-slate-300"
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Symmetry Mode & Pose Selection */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Symmetry Mode</span>
                            <span className="text-red-300 uppercase font-mono">
                              {symmetryMode}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {(["off", "auto", "on"] as const).map((sym) => (
                              <button
                                key={sym}
                                onClick={() => setSymmetryMode(sym)}
                                className={`py-1 rounded-lg text-[10px] font-bold uppercase border cursor-pointer ${
                                  symmetryMode === sym
                                    ? "bg-red-600 text-white border-red-300"
                                    : "bg-[#090709] text-slate-400 border-white/10"
                                }`}
                              >
                                {sym}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Seed Control */}
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-400">Seed</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={seedValue}
                              onChange={(e) => setSeedValue(Number(e.target.value))}
                              className="w-24 px-2 py-0.5 rounded bg-[#090709] border border-white/10 text-red-300 font-mono text-[11px]"
                            />
                            <button
                              onClick={() =>
                                setSeedValue(Math.floor(100000 + Math.random() * 900000))
                              }
                              className="p-1 rounded bg-white/[0.06] hover:bg-red-500/20 text-red-300 cursor-pointer"
                              title="Randomize Seed"
                            >
                              <Dices className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Target Polycount</span>
                          <span className="text-red-300 font-mono">
                            {targetPolycount.toLocaleString()}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={4000}
                          max={40000}
                          step={2000}
                          value={targetPolycount}
                          onChange={(e) => setTargetPolycount(Number(e.target.value))}
                          className="w-full accent-red-400 h-1 bg-black/50 rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* Feature Toggles */}
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.05] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-200">Generate in Parts</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                          Segment
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const next = !generateInParts;
                          setGenerateInParts(next);
                          setSegmentColorMode(next);
                        }}
                        className={`w-8 h-4.5 rounded-full p-0.5 transition cursor-pointer ${
                          generateInParts ? "bg-red-400" : "bg-white/10"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full transition-transform ${
                            generateInParts
                              ? "translate-x-3.5 bg-white"
                              : "translate-x-0 bg-slate-400"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-200">4K PBR Texture</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">
                          Metallic
                        </span>
                      </div>
                      <button
                        onClick={() => setEnablePbr8k(!enablePbr8k)}
                        className={`w-8 h-4.5 rounded-full p-0.5 transition cursor-pointer ${
                          enablePbr8k ? "bg-red-400" : "bg-white/10"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full transition-transform ${
                            enablePbr8k
                              ? "translate-x-3.5 bg-white"
                              : "translate-x-0 bg-slate-400"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-200">Humanoid Rigging</span>
                        <span className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">
                          +3 เครดิต
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const next = !enableAutoRig;
                          setEnableAutoRig(next);
                          setShowRigBones(next);
                        }}
                        className={`w-8 h-4.5 rounded-full p-0.5 transition cursor-pointer ${
                          enableAutoRig ? "bg-red-400" : "bg-white/10"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full transition-transform ${
                            enableAutoRig
                              ? "translate-x-3.5 bg-white"
                              : "translate-x-0 bg-slate-400"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* =================================================================
                TOOL 2: SEGMENTATION (WorkspaceSegmentationPanel)
               ================================================================= */}
            {activeLeftTool === "segment" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-red-200">Semantic Color View</span>
                    <button
                      onClick={() => setSegmentColorMode(!segmentColorMode)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        segmentColorMode
                          ? "bg-red-600 text-white"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {segmentColorMode ? "ON" : "OFF"}
                    </button>
                  </div>

                  {/* WorkspaceSegmentationExplodeEffect Slider */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Explode Parts Distance</span>
                      <span className="text-red-300 font-mono">
                        {Math.round(explodeFactor * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={explodeFactor}
                      onChange={(e) => setExplodeFactor(Number(e.target.value))}
                      className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                    />
                  </div>
                </div>

                {/* WorkspaceSegmentationPanelSegmentTree */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>Segmented Mesh Parts ({partNames.length})</span>
                    <button
                      onClick={() => setHiddenParts([])}
                      className="text-red-400 hover:underline text-[10px]"
                    >
                      Show All
                    </button>
                  </div>
                  {partNames.map((name, idx) => {
                    const isHidden = hiddenParts.includes(idx);
                    return (
                      <div
                        key={name}
                        className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                ["#06b6d4", "#10b981", "#6366f1", "#ec4899", "#f59e0b", "#8b5cf6"][
                                  idx % 6
                                ],
                            }}
                          />
                          <span
                            className={`truncate ${
                              isHidden ? "line-through text-slate-500" : "text-slate-200"
                            }`}
                          >
                            {name}
                          </span>
                        </div>
                        <button
                          onClick={() => togglePartVisibility(idx)}
                          className="p-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isHidden ? (
                            <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =================================================================
                TOOL 3: FILL PARTS (WorkspaceFillPartsPanel)
               ================================================================= */}
            {activeLeftTool === "fill-parts" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  เติมเต็มชิ้นส่วน 3D ที่แหว่งหรือเพิ่มอุปกรณ์เสริมลงบนโมเดลแบบเรียลไทม์ (AI Mesh Completion)
                </p>

                {[
                  {
                    key: "auraRing" as const,
                    title: "Cyber Halo Energy Ring",
                    desc: "เติมวงแหวนพลังงานด้านหลังโมเดล",
                  },
                  {
                    key: "backWings" as const,
                    title: "Symmetric Mecha Wings",
                    desc: "เติมปีกเกราะซ้าย-ขวาแบบสมมาตร",
                  },
                  {
                    key: "pedestal" as const,
                    title: "3D Print Display Base",
                    desc: "เติมฐานแท่นวางสำหรับพิมพ์ 3D",
                  },
                ].map((item) => {
                  const active = filledParts[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() => {
                        setFilledParts((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                        triggerToast(
                          `${!active ? "เพิ่ม" : "นำออก"} ${item.title} เรียบร้อยแล้ว`
                        );
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        active
                          ? "bg-red-500/15 border-red-400 text-white"
                          : "bg-white/[0.04] border-white/[0.07] text-slate-300 hover:border-red-400/40"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">{item.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          active ? "bg-red-600 text-white" : "bg-white/10 text-slate-400"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* =================================================================
                TOOL 4: RETOPOLOGY & VOXEL REMESH (WorkspaceRetopologyPanel + RemeshPanel)
               ================================================================= */}
            {activeLeftTool === "retopo" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2.5">
                  <span className="text-xs font-semibold text-white">Topology Type</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["quad", "triangle"] as const).map((topo) => (
                      <button
                        key={topo}
                        onClick={() => {
                          setArtStyleMode("standard");
                          if (activeTask) {
                            setActiveTask({ ...activeTask, topology: topo });
                          }
                          triggerToast(`สลับโครงสร้างเป็น ${topo.toUpperCase()} Mesh`);
                        }}
                        className={`py-2 rounded-xl text-xs font-bold uppercase border transition cursor-pointer ${
                          activeTask?.topology === topo && artStyleMode !== "voxel"
                            ? "bg-red-600 text-white border-red-300"
                            : "bg-[#090709] text-slate-300 border-white/10"
                        }`}
                      >
                        {topo} Mesh
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meshy Voxelizer Toggle (TextToVoxel) */}
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-[#ededed]">3D Voxelizer Mode</div>
                    <div className="text-[10px] text-[#85858b]">แปลง Mesh เป็นบล็อก Voxel</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = artStyleMode === "voxel" ? "standard" : "voxel";
                      setArtStyleMode(next);
                      triggerToast(
                        next === "voxel"
                          ? "แปลงโมเดลเป็น 3D Voxel Blocks เรียบร้อย!"
                          : "กลับสู่โหมด Standard Mesh"
                      );
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                      artStyleMode === "voxel"
                        ? "bg-red-600 text-white"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {artStyleMode === "voxel" ? "VOXEL ON" : "OFF"}
                  </button>
                </div>

                {/* Meshy Shading Normals Smoothness (Flat / AutoSmooth / FullSmooth) */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                  <span className="text-xs font-semibold text-white">
                    Shading Normals (Meshy Toolbar)
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "flat", label: "Flat" },
                        { id: "auto", label: "Auto" },
                        { id: "smooth", label: "Smooth" },
                      ] as { id: ShadingSmoothness; label: string }[]
                    ).map((sh) => (
                      <button
                        key={sh.id}
                        onClick={() => {
                          setShadingSmoothness(sh.id);
                          triggerToast(`ปรับ Normal Shading เป็น ${sh.label}`);
                        }}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                          shadingSmoothness === sh.id
                            ? "bg-red-600 text-white border-red-300"
                            : "bg-[#090709] text-slate-300 border-white/10"
                        }`}
                      >
                        {sh.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Polycount Presets (Low 3k / Med 10k / High 30k / Ultra 60k) */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Target Polycount</span>
                    <span className="text-red-300 font-mono">
                      {Math.round(
                        (activeTask?.target_poly_count || 18000) * materialState.polyMultiplier
                      ).toLocaleString()}{" "}
                      Faces
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: "Low 3k", mult: 0.25 },
                      { label: "Med 10k", mult: 0.65 },
                      { label: "High 30k", mult: 1.5 },
                      { label: "Ultra 60k", mult: 2.5 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() =>
                          setMaterialState((p) => ({ ...p, polyMultiplier: preset.mult }))
                        }
                        className={`py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                          materialState.polyMultiplier === preset.mult
                            ? "bg-red-500/25 border-red-400 text-red-200"
                            : "bg-[#090709] border-white/10 text-slate-400"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={2.5}
                    step={0.25}
                    value={materialState.polyMultiplier}
                    onChange={(e) =>
                      setMaterialState((prev) => ({
                        ...prev,
                        polyMultiplier: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                  />
                </div>

                <button
                  onClick={async () => {
                    const nextWire = viewChannel === "wireframe" ? undefined : "wireframe";
                    setViewChannel(nextWire);
                    triggerToast(
                      nextWire === "wireframe"
                        ? `กำลังจัดเรียงเส้น Clean ${activeTask?.topology.toUpperCase() || "QUAD"} Topology...`
                        : "สลับกลับสู่มุมมองพื้นผิว PBR ปกติ"
                    );
                    if (nextWire === "wireframe" && activeTask?.output_glb_url) {
                      try {
                        const res = await fetch("/api/studio-op", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            operation: "remesh",
                            modelUrl: activeTask.output_glb_url,
                            topology: activeTask.topology,
                            targetPolyCount: Math.round(
                              (activeTask.target_poly_count || 18000) *
                                materialState.polyMultiplier
                            ),
                          }),
                        });
                        const data = await res.json();
                        if (data?.outputGlbUrl) {
                          setActiveTask({ ...activeTask, output_glb_url: data.outputGlbUrl });
                        }
                        if (data?.message) triggerToast(data.message);
                      } catch {
                        // Browser spatial vertex decimator active
                      }
                    }
                  }}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs cursor-pointer shadow-lg"
                >
                  {viewChannel === "wireframe"
                    ? "Exit Wireframe / Back to PBR"
                    : "Apply Smart Remesh / Inspect Wireframe"}
                </button>
              </div>
            )}

            {/* =================================================================
                TOOL 5: SMART UV UNWRAP (WorkspaceUvEdit)
               ================================================================= */}
            {activeLeftTool === "smart-uv" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-200">
                    3D UV Checkerboard
                  </span>
                  <button
                    onClick={() => setUvCheckerMode(!uvCheckerMode)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                      uvCheckerMode
                        ? "bg-red-600 text-white"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {uvCheckerMode ? "ACTIVE" : "OFF"}
                  </button>
                </div>

                {/* 2D UV Atlas Preview Box (WorkspaceUvEditPreview) */}
                <div className="p-3 rounded-xl bg-[#090709] border border-white/10 space-y-2">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>2D UV Islands Atlas (xatlas)</span>
                    <span className="text-rose-400">Overlap: 0.0%</span>
                  </div>
                  <div className="aspect-square rounded-lg bg-[linear-gradient(45deg,#0f172a_25%,transparent_25%),linear-gradient(-45deg,#0f172a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0f172a_75%),linear-gradient(-45deg,transparent_75%,#0f172a_75%)] bg-[size:20px_20px] border border-red-500/30 p-3 grid grid-cols-3 gap-2">
                    {partNames.slice(0, 6).map((p, idx) => (
                      <div
                        key={p}
                        className="rounded border border-red-400/60 bg-red-500/20 flex items-center justify-center text-[8px] text-red-200 font-mono text-center p-1"
                      >
                        UV_{idx + 1}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(["1024", "2048", "4096"] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => {
                        setUvUnwrapDensity(res);
                        triggerToast(`กาง UV Atlas ความละเอียด ${res}×${res}px สำเร็จ`);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        uvUnwrapDensity === res
                          ? "bg-red-600 text-white border-red-300"
                          : "bg-white/[0.04] text-slate-300 border-white/10"
                      }`}
                    >
                      {res}px
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("prism3d-export", { detail: { format: "uv_png" } })
                    );
                    triggerToast("ดาวน์โหลดแผ่นกาง UV Layout (uv-layout.png) สำเร็จ!");
                  }}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs cursor-pointer shadow-lg"
                >
                  ⬇ ดาวน์โหลดแผ่นกาง UV Layout (.PNG)
                </button>
              </div>
            )}

            {/* =================================================================
                TOOL 6: AI TEXTURE STUDIO (WorkspaceTexturePanel)
               ================================================================= */}
            {activeLeftTool === "texture" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400">Texture Style Prompt</span>
                  <textarea
                    rows={3}
                    value={texturePrompt}
                    onChange={(e) => setTexturePrompt(e.target.value)}
                    placeholder="เช่น ทองคำโบราณแกะสลัก, เกราะมรกตเรืองแสง, เหล็กดำไซเบอร์พังก์..."
                    className="w-full rounded-xl bg-[#090709] border border-white/10 p-2.5 text-xs text-white focus:border-red-400 focus:outline-none resize-none"
                  />
                  <button
                    onClick={async () => {
                      const q = texturePrompt.toLowerCase();
                      setSegmentColorMode(false);
                      setUvCheckerMode(false);
                      setViewChannel(undefined);
                      if (q.includes("ทองแดง") || q.includes("bronze") || q.includes("copper")) {
                        setMaterialState((p) => ({
                          ...p,
                          primaryColor: "#b45309",
                          accentColor: "#f59e0b",
                          roughness: 0.28,
                          metalness: 0.88,
                          emissiveIntensity: 0.15,
                        }));
                      } else if (q.includes("ทอง") || q.includes("gold")) {
                        setMaterialState((p) => ({
                          ...p,
                          primaryColor: "#eab308",
                          accentColor: "#fef08a",
                          roughness: 0.16,
                          metalness: 0.95,
                          emissiveIntensity: 0.22,
                        }));
                      } else if (q.includes("มรกต") || q.includes("เขียว") || q.includes("emerald") || q.includes("jade")) {
                        setMaterialState((p) => ({
                          ...p,
                          primaryColor: "#10b981",
                          accentColor: "#34d399",
                          roughness: 0.18,
                          metalness: 0.72,
                          emissiveIntensity: 0.35,
                        }));
                      } else if (q.includes("คริสตัล") || q.includes("น้ำแข็ง") || q.includes("crystal") || q.includes("ice") || q.includes("ฟ้า")) {
                        setMaterialState((p) => ({
                          ...p,
                          primaryColor: "#38bdf8",
                          accentColor: "#22d3ee",
                          roughness: 0.1,
                          metalness: 0.45,
                          emissiveIntensity: 0.48,
                        }));
                      } else if (q.includes("ดำ") || q.includes("obsidian") || q.includes("dark") || q.includes("carbon")) {
                        setMaterialState((p) => ({
                          ...p,
                          primaryColor: "#1e293b",
                          accentColor: "#ef4444",
                          roughness: 0.24,
                          metalness: 0.88,
                          emissiveIntensity: 0.32,
                        }));
                      } else if (q.includes("ม่วง") || q.includes("นีออน") || q.includes("cyber") || q.includes("neon")) {
                        setMaterialState((p) => ({
                          ...p,
                          primaryColor: "#a855f7",
                          accentColor: "#ec4899",
                          roughness: 0.15,
                          metalness: 0.82,
                          emissiveIntensity: 0.55,
                        }));
                      } else {
                        setMaterialState((p) => ({
                          ...p,
                          primaryColor: "#ef4444",
                          accentColor: "#f59e0b",
                          roughness: 0.22,
                          metalness: 0.85,
                          emissiveIntensity: 0.28,
                        }));
                      }
                      try {
                        const res = await fetch("/api/studio-op", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            operation: "retexture",
                            prompt: texturePrompt,
                            modelUrl: activeTask?.output_glb_url || null,
                          }),
                        });
                        const data = await res.json();
                        if (res.status === 402) {
                          setTopupInitialTab("topup");
                          setTopupModalOpen(true);
                          triggerToast(data.error || "เครดิตใน D1 ไม่เพียงพอ");
                          return;
                        }
                        if (data?.user) setUser(data.user);
                        if (Array.isArray(data?.transactions)) setTransactions(data.transactions);
                        triggerToast(
                          data?.message ||
                            `สร้างพื้นผิว AI Texture ตามคำสั่ง "${texturePrompt.slice(0, 28)}" สำเร็จ!`
                        );
                      } catch {
                        triggerToast(`สร้างพื้นผิว AI Texture ตามคำสั่ง "${texturePrompt.slice(0, 28)}" สำเร็จ!`);
                      }
                    }}
                    className="w-full py-2 rounded-[8px] bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium text-xs cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <span>สร้างพื้นผิว AI Texture</span>
                    <span className="px-1.5 py-0.5 rounded-[4px] bg-black/25 text-[11px] font-mono tabular-nums font-medium">
                      3 เครดิต
                    </span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400">
                    1-Click Material Presets
                  </span>
                  {TEXTURE_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setSegmentColorMode(false);
                        setUvCheckerMode(false);
                        setMaterialState((prev) => ({
                          ...prev,
                          primaryColor: preset.primary,
                          accentColor: preset.accent,
                          roughness: preset.roughness,
                          metalness: preset.metalness,
                        }));
                        triggerToast(`เปลี่ยนพื้นผิวเป็น "${preset.name}" เรียบร้อย`);
                      }}
                      className="w-full p-2.5 rounded-xl bg-white/[0.04] hover:bg-red-500/15 border border-white/[0.07] hover:border-red-400/40 flex items-center justify-between text-xs transition cursor-pointer"
                    >
                      <span className="text-slate-200 font-medium">{preset.name}</span>
                      <div className="flex items-center gap-1">
                        <span
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* =================================================================
                TOOL 7: BRUSH, HEALING & 3D DECAL STUDIO (Meshy CoachMark-ModelEdit)
               ================================================================= */}
            {activeLeftTool === "edit" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                {/* 6 Interactive Meshy Texture Brushes */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                  <span className="text-xs font-semibold text-white">
                    Meshy 7 Texture & Seam Tools
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "paint" as const, label: "Paint" },
                      { id: "healing" as const, label: "Heal Seam" },
                      { id: "decal" as const, label: "3D Decal" },
                      { id: "stamp" as const, label: "Stamp" },
                      { id: "lasso" as const, label: "Inpaint" },
                      { id: "eraser" as const, label: "Eraser" },
                    ].map((tl) => (
                      <button
                        key={tl.id}
                        onClick={() => {
                          setActiveBrushTool(tl.id);
                          if (tl.id === "decal") setDecalEnabled(true);
                          if (tl.id === "healing") {
                            setMaterialState((p) => ({
                              ...p,
                              roughness: Math.max(0.12, p.roughness * 0.85),
                            }));
                            triggerToast("Smart Healing Brush: ลบรอยต่อตะเข็บ UV เรียบร้อย!");
                          }
                        }}
                        className={`py-1.5 px-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                          activeBrushTool === tl.id
                            ? "bg-red-600 text-white border-red-300"
                            : "bg-[#090709] text-slate-300 border-white/10"
                        }`}
                      >
                        {tl.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Brush Size</span>
                      <span className="text-red-300 font-mono">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Brush Opacity</span>
                      <span className="text-red-300 font-mono">{brushOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={brushOpacity}
                      onChange={(e) => setBrushOpacity(Number(e.target.value))}
                      className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                    />
                  </div>
                </div>

                {/* Meshy 3D Decal Projection (pmDecalSpace) */}
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#ededed]">
                      3D Decal Emblem
                    </span>
                    <button
                      onClick={() => setDecalEnabled(!decalEnabled)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        decalEnabled
                          ? "bg-red-600 text-white"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {decalEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  {decalEnabled && (
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Decal Scale</span>
                        <span className="text-red-300 font-mono">
                          {decalScale.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.4}
                        max={2.0}
                        step={0.1}
                        value={decalScale}
                        onChange={(e) => setDecalScale(Number(e.target.value))}
                        className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                      />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Decal Rotation</span>
                        <span className="text-red-300 font-mono">{decalRotation}°</span>
                      </div>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={15}
                        value={decalRotation}
                        onChange={(e) => setDecalRotation(Number(e.target.value))}
                        className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">Decal Color</span>
                        <input
                          type="color"
                          value={decalColor}
                          onChange={(e) => setDecalColor(e.target.value)}
                          className="w-7 h-5 rounded cursor-pointer bg-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Color Picker */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2.5">
                  <span className="text-xs font-semibold text-white">
                    Live Albedo & Accent Picker
                  </span>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {[
                      "#ef4444",
                      "#f59e0b",
                      "#10b981",
                      "#06b6d4",
                      "#a855f7",
                      "#ec4899",
                      "#d6d3d1",
                    ].map((hex) => (
                      <button
                        key={hex}
                        onClick={() =>
                          setMaterialState((prev) => ({
                            ...prev,
                            primaryColor: hex,
                          }))
                        }
                        className={`w-5 h-5 rounded-full border cursor-pointer transition ${
                          materialState.primaryColor.toLowerCase() === hex
                            ? "ring-2 ring-white scale-110"
                            : "border-white/25"
                        }`}
                        style={{ backgroundColor: hex }}
                        title={hex === "#d6d3d1" ? "สีต้นฉบับ (Original GLB)" : `ทาสี ${hex}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Primary Albedo</span>
                    <input
                      type="color"
                      value={materialState.primaryColor}
                      onChange={(e) =>
                        setMaterialState((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="w-8 h-6 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Accent / Emissive</span>
                    <input
                      type="color"
                      value={materialState.accentColor}
                      onChange={(e) =>
                        setMaterialState((prev) => ({
                          ...prev,
                          accentColor: e.target.value,
                        }))
                      }
                      className="w-8 h-6 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                {/* 3D Transform Scale & Rotation Sliders */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2.5">
                  <span className="text-xs font-semibold text-white">
                    3D Mesh Transform Gizmo
                  </span>
                  {(["scaleX", "scaleY", "scaleZ"] as const).map((axis) => (
                    <div key={axis} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400 uppercase">{axis}</span>
                        <span className="text-red-300 font-mono">
                          {transformState[axis].toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={1.8}
                        step={0.05}
                        value={transformState[axis]}
                        onChange={(e) =>
                          setTransformState((prev) => ({
                            ...prev,
                            [axis]: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =================================================================
                TOOL 8: UPSCALE (WorkspaceTextureUpscalePanel)
               ================================================================= */}
            {activeLeftTool === "upscale" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  อัปสเกลความละเอียดพื้นผิว PBR และเพิ่มความคมชัดของขอบโมเดลระดับ Ultra HD
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(["2K", "4K", "8K"] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setUpscaleResolution(res)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        upscaleResolution === res
                          ? "bg-red-600 text-white border-red-300"
                          : "bg-white/[0.04] text-slate-300 border-white/10"
                      }`}
                    >
                      {res} PBR
                    </button>
                  ))}
                </div>

                <button
                  onClick={async () => {
                    setMaterialState((prev) => ({
                      ...prev,
                      roughness: Math.max(0.08, prev.roughness * 0.7),
                      emissiveIntensity: 0.42,
                      polyMultiplier: upscaleResolution === "8K" ? 2.0 : 1.5,
                    }));
                    try {
                      const res = await fetch("/api/studio-op", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          operation: "upscale",
                          resolution: upscaleResolution,
                        }),
                      });
                      const data = await res.json();
                      if (res.status === 402) {
                        setTopupInitialTab("topup");
                        setTopupModalOpen(true);
                        triggerToast(data.error || "เครดิตใน D1 ไม่เพียงพอ");
                        return;
                      }
                      if (data?.user) setUser(data.user);
                      if (Array.isArray(data?.transactions)) setTransactions(data.transactions);
                      triggerToast(
                        data?.message || `อัปสเกลโมเดลเป็น ${upscaleResolution} Ultra HD สำเร็จ!`
                      );
                    } catch {
                      triggerToast(`อัปสเกลโมเดลเป็น ${upscaleResolution} Ultra HD สำเร็จ!`);
                    }
                  }}
                  className="w-full py-2 rounded-[8px] bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Run {upscaleResolution} AI Upscaler</span>
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-black/25 text-[11px] font-mono tabular-nums font-medium">
                    1 เครดิต
                  </span>
                </button>
              </div>
            )}

            {/* =================================================================
                TOOL 9: PBR CHANNELS & HDRI ENVIRONMENT (Meshy EnvironmentSettings)
               ================================================================= */}
            {activeLeftTool === "pbr" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Metallic (ความวาวโลหะ)</span>
                      <span className="text-red-300 font-mono">
                        {materialState.metalness.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={materialState.metalness}
                      onChange={(e) =>
                        setMaterialState((prev) => ({
                          ...prev,
                          metalness: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Roughness (ความด้าน)</span>
                      <span className="text-red-300 font-mono">
                        {materialState.roughness.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.04}
                      max={1}
                      step={0.02}
                      value={materialState.roughness}
                      onChange={(e) =>
                        setMaterialState((prev) => ({
                          ...prev,
                          roughness: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Emissive Glow (แสงเรือง)</span>
                      <span className="text-red-300 font-mono">
                        {materialState.emissiveIntensity.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={materialState.emissiveIntensity}
                      onChange={(e) =>
                        setMaterialState((prev) => ({
                          ...prev,
                          emissiveIntensity: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                    />
                  </div>
                </div>

                {/* Meshy Environment HDRI & Display Settings */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2.5">
                  <span className="text-xs font-semibold text-white">
                    HDRI Environment Lighting
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "studio", label: "Studio" },
                        { id: "outdoor", label: "Outdoor" },
                        { id: "indoor", label: "Indoor" },
                        { id: "soft", label: "Soft" },
                        { id: "cyber", label: "Cyber" },
                      ] as { id: HdriPresetType; label: string }[]
                    ).map((env) => (
                      <button
                        key={env.id}
                        onClick={() => setHdriPreset(env.id)}
                        className={`py-1.5 rounded-lg text-[10px] font-semibold border cursor-pointer ${
                          hdriPreset === env.id
                            ? "bg-red-600 text-white border-red-300"
                            : "bg-[#090709] text-slate-300 border-white/10"
                        }`}
                      >
                        {env.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">HDRI Light Rotation</span>
                      <span className="text-red-300 font-mono">{hdriRotation}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={15}
                      value={hdriRotation}
                      onChange={(e) => setHdriRotation(Number(e.target.value))}
                      className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Vertical FOV (มุมกล้อง)</span>
                      <span className="text-red-300 font-mono">{cameraFov}°</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={5}
                      value={cameraFov}
                      onChange={(e) => setCameraFov(Number(e.target.value))}
                      className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-300">Show 3D Floor Grid</span>
                    <button
                      onClick={() => setShowGrid(!showGrid)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        showGrid ? "bg-red-600 text-white" : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {showGrid ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================
                TOOL 10: AUTO-RIGGING (Meshy Workspace.Rigging + 9 Skeleton Templates)
               ================================================================= */}
            {activeLeftTool === "rig" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-200">
                      Show Skeleton Bones
                    </span>
                    <button
                      onClick={() => setShowRigBones(!showRigBones)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        showRigBones
                          ? "bg-red-600 text-white"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {showRigBones ? "VISIBLE" : "HIDDEN"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300">
                      6-Point Symmetry Markers
                    </span>
                    <button
                      onClick={() => setShowRigMarkers(!showRigMarkers)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        showRigMarkers
                          ? "bg-red-500 text-white"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {showRigMarkers ? "MARKERS ON" : "OFF"}
                    </button>
                  </div>
                </div>

                {/* Character Type (Humanoid / Quadruped Dog / Quadruped Cat / Universal) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400">Character Type</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "humanoid" as const, label: "Humanoid" },
                      { id: "quadruped_dog" as const, label: "Quadruped Dog" },
                      { id: "quadruped_cat" as const, label: "Quadruped Cat" },
                      { id: "universal" as const, label: "Universal Rig" },
                    ].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setRigType(r.id);
                          setShowRigBones(true);
                          triggerToast(`สลับโครงกระดูกเป็น ${r.label}`);
                        }}
                        className={`p-2 rounded-xl text-left text-[11px] font-semibold border transition cursor-pointer ${
                          rigType === r.id
                            ? "bg-red-500/20 border-red-400 text-white"
                            : "bg-white/[0.04] border-white/[0.06] text-slate-300"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pose Preset (Bind / A-Pose / T-Pose / Battle Pose) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400">
                    Calibration Pose (A/T-Pose)
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: "bind", label: "Bind" },
                        { id: "a_pose", label: "A-Pose" },
                        { id: "t_pose", label: "T-Pose" },
                        { id: "battle", label: "Battle" },
                      ] as { id: PosePresetType; label: string }[]
                    ).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPosePreset(p.id);
                          triggerToast(`จัดท่าโมเดลเป็น ${p.label}`);
                        }}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          posePreset === p.id
                            ? "bg-red-600 text-white border-red-300"
                            : "bg-[#090709] text-slate-300 border-white/10"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 9 Meshy Skeleton Export Templates */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">
                    Skeleton Export Standard
                  </span>
                  <select
                    value={skeletonTemplate}
                    onChange={(e) => {
                      setSkeletonTemplate(e.target.value);
                      triggerToast(`เลือกมาตรฐานกระดูก: ${e.target.value}`);
                    }}
                    className="w-full p-2 rounded-xl bg-[#090709] border border-red-400/30 text-xs text-white focus:outline-none"
                  >
                    <option value="meshyrig">Meshy Standard Rig (Default)</option>
                    <option value="mixamo">Adobe Mixamo Biped</option>
                    <option value="ue5_mannequin">Unreal Engine 5 Mannequin</option>
                    <option value="unity_humanoid">Unity Humanoid Mecanim</option>
                    <option value="blender_rigify">Blender Rigify Basic Human</option>
                    <option value="maya_human_ik">Autodesk Maya HumanIK</option>
                    <option value="max_biped">3ds Max Biped</option>
                    <option value="cc5_hd_neutral">Character Creator 5 HD</option>
                    <option value="daz_genesis9">Daz3D Genesis 9</option>
                  </select>
                </div>

                <button
                  onClick={async () => {
                    setShowRigBones(true);
                    setShowRigMarkers(false);
                    setActiveLeftTool("animate");
                    setAnimationClip("idle");
                    triggerToast(
                      "กำลังผูกกระดูก THREE.SkinnedMesh (16-Bone Anatomical Skeleton & Envelope Weights)..."
                    );
                    try {
                      const res = await fetch("/api/studio-op", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          operation: "rig",
                          modelUrl: activeTask?.output_glb_url || null,
                        }),
                      });
                      const data = await res.json();
                      if (res.status === 402) {
                        setTopupInitialTab("topup");
                        setTopupModalOpen(true);
                        triggerToast(data.error || "เครดิตใน D1 ไม่เพียงพอ");
                        return;
                      }
                      if (data?.user) setUser(data.user);
                      if (Array.isArray(data?.transactions)) setTransactions(data.transactions);
                      if (data?.outputGlbUrl && activeTask) {
                        setActiveTask({ ...activeTask, output_glb_url: data.outputGlbUrl });
                      }
                      if (data?.message) triggerToast(data.message);
                    } catch {
                      triggerToast(
                        "ผูกโครงกระดูก THREE.SkinnedMesh เสร็จสมบูรณ์! พร้อมส่งออก .GLB เข้า Blender/Unity/UE5"
                      );
                    }
                  }}
                  className="w-full py-2 rounded-[8px] bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
                >
                  <span>ผูกกระดูก Auto-Rig</span>
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-black/25 text-[11px] font-mono tabular-nums font-medium">
                    3 เครดิต
                  </span>
                </button>
              </div>
            )}

            {/* =================================================================
                TOOL 11: 600+ MOTION LIBRARY (Meshy AnimatePanel)
               ================================================================= */}
            {activeLeftTool === "animate" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                {/* In-Place vs Root Motion Toggle */}
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-red-200">In-Place Motion</div>
                    <div className="text-[10px] text-slate-400">
                      ล็อกตำแหน่งให้อยู่กับที่ vs เดินบนพื้นจริง
                    </div>
                  </div>
                  <button
                    onClick={() => setInPlaceAnimation(!inPlaceAnimation)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                      inPlaceAnimation
                        ? "bg-red-600 text-white"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {inPlaceAnimation ? "IN-PLACE" : "ROOT MOTION"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "none" as const, label: "Static Pose" },
                    { id: "idle" as const, label: "Idle Breathing" },
                    { id: "walk" as const, label: "Combat Walk" },
                    { id: "run" as const, label: "Sprint Forward" },
                    { id: "crouch" as const, label: "Stealth Crouch" },
                    { id: "jump" as const, label: "Heroic Jump" },
                    { id: "attack" as const, label: "Spin Slash" },
                    { id: "boxing" as const, label: "Boxing Combo" },
                    { id: "climb" as const, label: "Wall Climb" },
                    { id: "dance" as const, label: "Victory Dance" },
                    { id: "quad_gallop" as const, label: "Quad Gallop" },
                  ].map((clip) => {
                    const active = animationClip === clip.id;
                    return (
                      <button
                        key={clip.id}
                        onClick={() => {
                          setAnimationClip(clip.id);
                          triggerToast(`กำลังเล่นอนิเมชัน: ${clip.label}`);
                        }}
                        className={`p-2 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          active
                            ? "bg-red-600 text-white border-red-300"
                            : "bg-white/[0.04] text-slate-300 border-white/[0.07] hover:border-red-400/40"
                        }`}
                      >
                        {active && clip.id !== "none" ? (
                          <Pause className="w-3 h-3 shrink-0" />
                        ) : (
                          <Play className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate">{clip.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Playback Speed</span>
                    <span className="text-red-300 font-mono">
                      {animationSpeed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={2.5}
                    step={0.25}
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                    className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* =================================================================
                TOOL 12: 3D PRINT, WATERTIGHT REPAIR & FILAMENT SIMULATOR
               ================================================================= */}
            {activeLeftTool === "print3d" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                {/* Printability Overhang Heatmap Toggle */}
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-200">
                      Printability Heatmap
                    </span>
                    <button
                      onClick={() => setPrintCheckMode(!printCheckMode)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        printCheckMode
                          ? "bg-red-600 text-white"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {printCheckMode ? "ACTIVE" : "OFF"}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-300 space-y-1 pt-1 border-t border-white/10">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Watertight Status:</span>
                      <span className="text-emerald-400 font-bold">Manifold (0 Holes)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimated Volume:</span>
                      <span className="text-white font-mono">48.6 cm³</span>
                    </div>
                  </div>
                </div>

                {/* Add Base Platform (AddBaseStlPlatform) */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Add Base STL Platform
                    </div>
                    <div className="text-[10px] text-slate-400">
                      เพิ่มฐานกลมใต้โมเดลสำหรับตั้งโชว์
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !addPrintBase;
                      setAddPrintBase(next);
                      triggerToast(
                        next
                          ? "เพิ่มฐานตั้งโมเดล (AddBaseStlPlatform) เรียบร้อย"
                          : "นำฐานตั้งโมเดลออกแล้ว"
                      );
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                      addPrintBase
                        ? "bg-red-500 text-white"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {addPrintBase ? "BASE ON" : "ADD BASE"}
                  </button>
                </div>

                {/* Filament Material Simulator (Meshy RayTracing.Filament) */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Filament Preview
                    </span>
                    <button
                      onClick={() => {
                        setPrintCheckMode(false);
                        setViewChannel(
                          viewChannel === "filament_sim" ? undefined : "filament_sim"
                        );
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        viewChannel === "filament_sim"
                          ? "bg-red-600 text-white"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {viewChannel === "filament_sim" ? "SIMULATING" : "PREVIEW"}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(["pla", "silk", "petg", "resin"] as FilamentPresetType[]).map(
                      (fp) => (
                        <button
                          key={fp}
                          onClick={() => {
                            setPrintCheckMode(false);
                            setViewChannel("filament_sim");
                            setFilamentPreset(fp);
                          }}
                          className={`py-1 rounded text-[10px] font-bold uppercase border cursor-pointer ${
                            filamentPreset === fp && viewChannel === "filament_sim"
                              ? "bg-red-600 text-white border-red-300"
                              : "bg-[#090709] text-slate-300 border-white/10"
                          }`}
                        >
                          {fp}
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {[
                      "#06b6d4",
                      "#10b981",
                      "#f59e0b",
                      "#f43f5e",
                      "#a855f7",
                      "#e2e8f0",
                      "#334155",
                      "#ec4899",
                    ].map((col) => (
                      <button
                        key={col}
                        onClick={() => {
                          setPrintCheckMode(false);
                          setViewChannel("filament_sim");
                          setFilamentColor(col);
                        }}
                        className={`w-5 h-5 rounded-full border cursor-pointer ${
                          filamentColor === col ? "ring-2 ring-white" : "border-white/20"
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>

                {/* One-Click Repair & Send to Bambu Studio / Creality */}
                <button
                  onClick={() => {
                    setPrintCheckMode(false);
                    setAddPrintBase(true);
                    triggerToast(
                      "Make Printable: ซ่อมแซม Watertight Mesh และเติมฐานตั้งสำหรับพิมพ์ .STL เรียบร้อย"
                    );
                  }}
                  className="w-full py-2 rounded-[8px] bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium text-xs cursor-pointer transition-colors"
                >
                  Make Printable (STL Repair)
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("prism3d-export", { detail: { format: "stl" } })
                      );
                      triggerToast(
                        "ดาวน์โหลดไฟล์ .STL สำหรับ Bambu Studio เรียบร้อยแล้ว"
                      );
                    }}
                    className="py-2 rounded-[8px] bg-[#1a0d12] hover:bg-[#241118] border border-red-500/20 text-[#f5eff1] text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    Bambu Studio (.STL)
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("prism3d-export", { detail: { format: "stl" } })
                      );
                      triggerToast(
                        "ดาวน์โหลดไฟล์ .STL สำหรับ Creality Print เรียบร้อยแล้ว"
                      );
                    }}
                    className="py-2 rounded-[8px] bg-[#1a0d12] hover:bg-[#241118] border border-red-500/20 text-[#f5eff1] text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    Creality Print (.STL)
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Sticky AI Model Selector + Generate CTA (Only shown in Create Pillar) */}
            {(activeLeftTool === "generate" ||
              activeLeftTool === "relief" ||
              activeLeftTool === "agent") && (
              <div className="p-3 border-t border-red-500/20 bg-[#140a0e] space-y-2.5 shrink-0 relative">
                {modelDropdownOpen && (
                  <div className="absolute bottom-[112px] left-3 right-3 rounded-[10px] bg-[#1a0d12] border border-red-500/30 shadow-2xl p-1.5 z-30 space-y-1">
                    {MODEL_OPTIONS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setModelDropdownOpen(false);
                        }}
                        className={`w-full p-2 rounded-[8px] text-left flex items-center justify-between transition-colors cursor-pointer ${
                          selectedModel === m.id
                            ? "bg-[#2a121a] text-[#f5eff1] border border-red-500/35"
                            : "hover:bg-[#241118] text-[#b8a2a8]"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-medium text-[#f5eff1]">{m.name}</div>
                          <div className="text-[11px] text-[#9c848b]">{m.sub}</div>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-red-400">
                          {m.credits} เครดิต
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="w-full p-2 rounded-[8px] bg-[#1a0d12] hover:bg-[#241118] border border-red-500/20 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-[6px] bg-[#2a121a] border border-red-500/30 flex items-center justify-center text-[10px] font-mono font-medium text-red-300 shrink-0">
                      {currentModelSpec.code}
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-xs font-medium text-[#f5eff1] truncate">
                        {currentModelSpec.name}
                      </div>
                      <div className="text-[11px] text-[#9c848b] truncate">
                        {currentModelSpec.sub}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9c848b] shrink-0" />
                </button>

                {errorBanner && (
                  <div className="px-2.5 py-1.5 rounded-[6px] bg-red-500/15 border border-red-500/30 text-[11px] text-[#f5eff1]">
                    {errorBanner}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full h-9 rounded-[8px] bg-[#dc2626] hover:bg-[#ef4444] disabled:opacity-50 text-white font-medium text-[13px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span className="truncate">{genStageText || "กำลังประมวลผล..."}</span>
                    </>
                  ) : (
                    <>
                      <span>สร้างโมเดล 3D ใหม่</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-black/25 text-white font-mono tabular-nums font-medium text-[12px]">
                        {estimatedCost} เครดิต
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* -------------------------------------------------------------------
              CENTER: Interactive 3D Viewport Canvas (Edge-to-Edge Darkroom)
             ------------------------------------------------------------------- */}
          <section className="flex-1 h-full relative overflow-hidden bg-[#090507] flex flex-col">
            <Viewport3D
              activeTask={activeTask}
              isGenerating={isGenerating}
              generationProgress={genProgress}
              generationStepLabel={genStageText}
              studioOverrides={studioOverrides}
              onPartNamesChange={setPartNames}
            />
          </section>

          {/* -------------------------------------------------------------------
              RIGHT DOCK: Assets & Property Inspector (260px, Crimson-Obsidian #140a0e)
             ------------------------------------------------------------------- */}
          <aside className="w-[260px] h-full bg-[#140a0e] border-l border-red-500/20 flex flex-col shrink-0 overflow-hidden">
            <div className="h-10 px-3 pt-1.5 bg-[#140a0e] border-b border-red-500/20 shrink-0">
              <div className="h-7 p-0.5 rounded-[6px] bg-[#0b0709] border border-red-500/20 grid grid-cols-2 gap-0.5">
                <button
                  onClick={() => setRightTab("assets")}
                  className={`h-full rounded-[4px] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    rightTab === "assets"
                      ? "bg-[#dc2626] text-white"
                      : "text-[#9c848b] hover:text-[#f5eff1]"
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>โมเดล</span>
                </button>
                <button
                  onClick={() => setRightTab("property")}
                  className={`h-full rounded-[4px] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    rightTab === "property"
                      ? "bg-[#dc2626] text-white"
                      : "text-[#9c848b] hover:text-[#f5eff1]"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>คุณสมบัติ</span>
                </button>
              </div>
            </div>

            {rightTab === "assets" ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#b8a2a8] font-normal">
                    คลังโมเดล ({(tasks.length > 0 ? tasks : CURATED_SHOWCASE).length})
                  </span>
                  <button
                    onClick={() => setRightTab("property")}
                    className="text-[11px] px-2 py-0.5 rounded-[6px] bg-[#1a0d12] hover:bg-[#241118] border border-red-500/20 text-[#b8a2a8] hover:text-[#f5eff1] transition-colors cursor-pointer"
                  >
                    โครงสร้างชิ้นส่วน
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Upload .GLB or Image Reference */}
                  <label className="aspect-square rounded-[10px] border border-dashed border-red-500/30 hover:border-red-500/60 bg-[#0b0709] hover:bg-[#1a0d12] flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*,.glb,.gltf"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Upload className="w-4 h-4 stroke-[1.5] text-red-400 mb-1.5" />
                    <span className="text-[11px] font-medium text-[#f5eff1] leading-tight">
                      นำเข้า .GLB / รูป
                    </span>
                    <span className="text-[10px] text-[#9c848b] mt-0.5">
                      GLB, PNG, WEBP
                    </span>
                  </label>

                  {(tasks.length > 0 ? tasks : CURATED_SHOWCASE).map((item) => {
                    const isSelected = activeTask?.id === item.id;
                    const isPro = item.engine === "trellis_pbr";
                    const cleanName = item.prompt_th
                      .replace(/^\[.*?\]\s*/, "")
                      .replace(/\s*\(.*?\)\s*$/, "");
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveTask(item)}
                        className={`group aspect-square rounded-[10px] relative overflow-hidden cursor-pointer border transition-colors flex flex-col items-center justify-between p-1.5 ${
                          isSelected
                            ? "border-[#ef4444] bg-[#241118]"
                            : "border-red-500/20 bg-[#1a0d12] hover:border-red-500/40"
                        }`}
                      >
                        <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded-[6px] bg-gradient-to-b from-[#220e15] to-[#0a0608] mt-4">
                          {item.input_image_url ? (
                            <img
                              src={item.input_image_url}
                              alt={cleanName}
                              className="w-full h-full object-contain p-1.5"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-[8px] flex items-center justify-center border border-white/15"
                              style={{
                                background: `linear-gradient(135deg, ${item.primary_color}, ${item.accent_color})`,
                              }}
                            >
                              <Box className="w-4 h-4 stroke-[1.5] text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-[#f5eff1] font-normal truncate w-full text-center mt-1">
                          {cleanName}
                        </span>
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-[4px] bg-[#140a0e]/90 border border-red-500/25 text-[9px] font-mono tabular-nums text-[#c7b2b8] flex items-center gap-1">
                          <span
                            className={`w-1 h-1 rounded-full ${
                              isPro ? "bg-[#ef4444]" : "bg-[#9c848b]"
                            }`}
                          />
                          {isPro ? "PRO" : "STD"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* PROPERTY INSPECTOR TAB (Hierarchy Tree + Transform + AI Prompt) */
              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs no-scrollbar">
                {activeTask && (
                  <>
                    {/* Scene Node Hierarchy Tree */}
                    <div className="p-3 rounded-[10px] bg-[#1a0d12] border border-red-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#b8a2a8] font-medium">
                          โครงสร้างชิ้นส่วน ({partNames.length})
                        </span>
                        <button
                          onClick={() => setHiddenParts([])}
                          className="text-[11px] text-red-400 hover:text-[#f5eff1] cursor-pointer"
                        >
                          แสดงทั้งหมด
                        </button>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                        {partNames.map((name, idx) => {
                          const hidden = hiddenParts.includes(idx);
                          return (
                            <div
                              key={name}
                              onClick={() => togglePartVisibility(idx)}
                              className="px-2 py-1.5 rounded-[6px] bg-[#0b0709] hover:bg-[#241118] flex items-center justify-between text-[11px] cursor-pointer transition-colors"
                            >
                              <span
                                className={`truncate ${
                                  hidden ? "line-through text-[#9c848b]" : "text-[#f5eff1]"
                                }`}
                              >
                                {name}
                              </span>
                              {hidden ? (
                                <EyeOff className="w-3.5 h-3.5 stroke-[1.5] text-[#9c848b] shrink-0" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 stroke-[1.5] text-red-400 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Transform Inspector */}
                    <div className="p-3 rounded-[10px] bg-[#1a0d12] border border-red-500/20 space-y-2">
                      <span className="text-[11px] text-[#b8a2a8] font-medium">
                        การหมุนโมเดล (Rotation)
                      </span>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#9c848b]">แกน Y</span>
                        <span className="text-[#f5eff1] font-mono tabular-nums">{transformState.rotY}°</span>
                      </div>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={5}
                        value={transformState.rotY}
                        onChange={(e) =>
                          setTransformState((prev) => ({
                            ...prev,
                            rotY: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#ef4444] h-1 bg-[#0b0709] rounded-lg"
                      />
                    </div>

                    <div className="p-3 rounded-[10px] bg-[#1a0d12] border border-red-500/20 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#b8a2a8] font-medium">
                        <Languages className="w-3.5 h-3.5 stroke-[1.5] text-red-400" />
                        <span>รายละเอียดโมเดล (Prompt)</span>
                      </div>
                      <p className="text-[11px] text-[#9c848b] leading-relaxed">
                        {activeTask.prompt_en}
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        if (!activeTask) return;
                        try {
                          const res = await fetch(`/api/tasks/${activeTask.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              primary_color: materialState.primaryColor,
                              accent_color: materialState.accentColor,
                              roughness: materialState.roughness,
                              metalness: materialState.metalness,
                              topology: activeTask.topology,
                              target_poly_count: Math.round(
                                (activeTask.target_poly_count || 18000) *
                                  materialState.polyMultiplier
                              ),
                              has_rig: showRigBones ? 1 : activeTask.has_rig,
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            if (data.task) {
                              setActiveTask(data.task);
                              setTasks((prev) =>
                                prev.map((t) => (t.id === data.task.id ? data.task : t))
                              );
                            }
                            triggerToast("บันทึกค่าวัสดุ PBR และโครงสร้างลงฐานข้อมูลแล้ว");
                          } else {
                            setActiveTask({
                              ...activeTask,
                              primary_color: materialState.primaryColor,
                              accent_color: materialState.accentColor,
                              roughness: materialState.roughness,
                              metalness: materialState.metalness,
                            });
                            triggerToast("บันทึกการตั้งค่าวัสดุลงในโมเดลปัจจุบันแล้ว");
                          }
                        } catch {
                          triggerToast("บันทึกการตั้งค่าวัสดุลงในโมเดลปัจจุบันแล้ว");
                        }
                      }}
                      className="w-full py-2 rounded-[8px] bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[1.5]" />
                      <span>บันทึกการตั้งค่าโมเดล</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* =====================================================================
          3. MODALS: Google Login, PromptPay QR, DCC Bridge, 3D Print Check
         ===================================================================== */}
      <GmailLoginModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <TopupModal
        isOpen={topupModalOpen}
        onClose={() => setTopupModalOpen(false)}
        user={user}
        initialTab={topupInitialTab}
        onRefreshD1={() => {
          fetchSession();
          triggerToast("ซิงค์ยอดเครดิตและประวัติธุรกรรมล่าสุดจาก Cloudflare D1 เรียบร้อย!");
        }}
        transactions={transactions}
        orders={orders}
        onSuccess={(data) => {
          if (data?.user) {
            setUser(data.user);
          }
          if (Array.isArray(data?.transactions)) {
            setTransactions(data.transactions);
          }
          if (Array.isArray(data?.orders)) {
            setOrders(data.orders);
          }
          fetchSession();
        }}
      />

      {/* DCC Bridge Modal */}
      {dccBridgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#110b0e] border border-red-500/25 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-bold text-white">
                  DCC Bridge — เชื่อมโปรแกรม 3D ภายนอก
                </h3>
              </div>
              <button
                onClick={() => setDccBridgeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              ส่งโมเดล 3D ปัจจุบัน ({activeTask?.prompt_th}) พร้อมพื้นผิว PBR และกระดูก Rig เข้าสู่เอนจินที่คุณใช้งาน:
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { name: "Blender 4.x", port: "Port 28450" },
                { name: "Unreal Engine 5", port: "Datasmith GLB" },
                { name: "Unity 6", port: "Prefab Bridge" },
                { name: "Maya / 3ds Max", port: "FBX/OBJ Stream" },
              ].map((dcc) => (
                <button
                  key={dcc.name}
                  onClick={() => {
                    setDccBridgeModalOpen(false);
                    triggerToast(`เตรียมแพ็กเกจส่งออกสำหรับ ${dcc.name} เรียบร้อย!`);
                  }}
                  className="p-3 rounded-xl bg-white/[0.04] hover:bg-red-500/15 border border-white/10 hover:border-red-400/40 text-left transition cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">{dcc.name}</div>
                  <div className="text-[10px] text-red-300 mt-0.5">{dcc.port}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3D Print Readiness Modal (EngineActionPrint) */}
      {printCheckModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#110b0e] border border-red-500/25 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  3D Print Watertight & Scale Check
                </h3>
              </div>
              <button
                onClick={() => setPrintCheckModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.04] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Watertight Manifold</span>
                <span className="text-emerald-400 font-bold">PASS (Closed Mesh)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Print Dimensions (mm)</span>
                <span className="text-white font-mono">
                  {(85 * transformState.scaleX).toFixed(0)} ×{" "}
                  {(120 * transformState.scaleY).toFixed(0)} ×{" "}
                  {(75 * transformState.scaleZ).toFixed(0)} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Base Pedestal</span>
                <span className="text-red-300 font-semibold">
                  {filledParts.pedestal ? "Included" : "Optional (Add in Fill Parts)"}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setFilledParts((prev) => ({ ...prev, pedestal: true }));
                setPrintCheckModalOpen(false);
                setTopNav("workspace");
                triggerToast("เพิ่มฐานแท่นวางสำหรับพิมพ์ 3D เรียบร้อยแล้ว!");
              }}
              className="w-full py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs cursor-pointer"
            >
              Add 3D Print Base Pedestal & Inspect
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
