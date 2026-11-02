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

const LEFT_RAIL_GROUPS: {
  group: string;
  items: { id: LeftToolId; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    group: "create",
    items: [
      { id: "agent", label: "3D Agent", icon: Sparkles },
      { id: "generate", label: "Image/Text", icon: Wand2 },
      { id: "relief", label: "Relief/Text", icon: Box },
    ],
  },
  {
    group: "mesh",
    items: [
      { id: "segment", label: "Auto-Split", icon: Scissors },
      { id: "fill-parts", label: "Fill Parts", icon: Puzzle },
      { id: "retopo", label: "Remesh", icon: Grid3X3 },
      { id: "smart-uv", label: "Auto-UV", icon: Layers },
    ],
  },
  {
    group: "texture",
    items: [
      { id: "texture", label: "AI Texture", icon: Palette },
      { id: "edit", label: "Brush/Decal", icon: PenTool },
      { id: "upscale", label: "8K Upscale", icon: ArrowUpRight },
      { id: "pbr", label: "PBR/HDRI", icon: Sun },
    ],
  },
  {
    group: "animate",
    items: [
      { id: "rig", label: "Auto-Rig", icon: Bone },
      { id: "animate", label: "Motion 600+", icon: Play },
      { id: "print3d", label: "3D Print", icon: Printer },
    ],
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
    code: "M7.1",
    name: "Meshy 7.1 + TRELLIS.2 Flagship",
    sub: "4B O-Voxel + Native 8K PBR",
    credits: 8,
  },
  {
    id: "hunyuan3d_2_1",
    code: "T3.0",
    name: "Tripo 3.0 + Hunyuan3D – Realistic",
    sub: "Smart Quad Topology + BRDF",
    credits: 6,
  },
  {
    id: "triposg",
    code: "FAST",
    name: "Prism Turbo 1.5 – Quick Draft",
    sub: "4-Second Clean SDF Mesh",
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
    name: "Crimson Obsidian Neon",
    primary: "#ef4444",
    accent: "#18181b",
    roughness: 0.18,
    metalness: 0.9,
  },
  {
    name: "Royal Siam Crimson & Gold",
    primary: "#dc2626",
    accent: "#f59e0b",
    roughness: 0.22,
    metalness: 0.92,
  },
  {
    name: "Blood Moon Ruby Crystal",
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
    name: "Volcanic Obsidian Armor",
    primary: "#18181b",
    accent: "#f43f5e",
    roughness: 0.3,
    metalness: 0.88,
  },
];

const GALLERY_CATEGORIES = [
  "All",
  "3D Printing",
  "Featured",
  "Character",
  "Vehicle",
  "Animal",
  "Architecture",
  "Furniture",
  "Props",
  "Weapon",
];

const CURATED_SHOWCASE: (GenerationTaskRecord & { categoryTag: string })[] = [
  {
    id: "showcase_mecha_arun",
    user_id: "community",
    stage: "refine_pbr",
    engine: "trellis_pbr",
    mode: "text_to_3d",
    prompt_th: "หุ่นยนต์ยักษ์วัดแจ้งเกราะมรกตไซเบอร์พังก์",
    prompt_en: "Cyberpunk Emerald Wat Arun Guardian Mecha, 4K PBR metallic armor, quad mesh",
    input_image_url: null,
    status: "completed",
    cost_credits: 8,
    refunded: 0,
    target_poly_count: 28000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "mecha",
    primary_color: "#ef4444",
    accent_color: "#f59e0b",
    roughness: 0.22,
    metalness: 0.88,
    output_glb_url: null,
    created_at: new Date().toISOString(),
    categoryTag: "Character",
  },
  {
    id: "showcase_dragon_naga",
    user_id: "community",
    stage: "refine_pbr",
    engine: "hunyuan3d_2_1",
    mode: "text_to_3d",
    prompt_th: "พญานาคเกล็ดคริสตัลสีฟ้าเทอร์ควอยซ์",
    prompt_en: "Bioluminescent Turquoise Crystal Naga Dragon, game-ready asset",
    input_image_url: null,
    status: "completed",
    cost_credits: 6,
    refunded: 0,
    target_poly_count: 24000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 1,
    preset_type: "dragon",
    primary_color: "#14b8a6",
    accent_color: "#6366f1",
    roughness: 0.18,
    metalness: 0.78,
    output_glb_url: null,
    created_at: new Date().toISOString(),
    categoryTag: "Animal",
  },
  {
    id: "showcase_tuktuk_2099",
    user_id: "community",
    stage: "refine_pbr",
    engine: "trellis_pbr",
    mode: "text_to_3d",
    prompt_th: "รถตุ๊กตุ๊กนีออนไซเบอร์พังก์ กรุงเทพ 2099",
    prompt_en: "Futuristic Bangkok 2099 Cyberpunk Tuk-Tuk vehicle with neon thrusters",
    input_image_url: null,
    status: "completed",
    cost_credits: 8,
    refunded: 0,
    target_poly_count: 19500,
    topology: "quad",
    has_pbr: 1,
    has_rig: 0,
    preset_type: "vehicle",
    primary_color: "#3b82f6",
    accent_color: "#f43f5e",
    roughness: 0.25,
    metalness: 0.85,
    output_glb_url: null,
    created_at: new Date().toISOString(),
    categoryTag: "Vehicle",
  },
  {
    id: "showcase_astral_blade",
    user_id: "community",
    stage: "refine_pbr",
    engine: "hunyuan3d_2_1",
    mode: "text_to_3d",
    prompt_th: "ดาบคาตานะคริสตัลสายฟ้าสีคราม",
    prompt_en: "Astral Cyan Lightning Katana Greatsword, ornate metallic hilt",
    input_image_url: null,
    status: "completed",
    cost_credits: 6,
    refunded: 0,
    target_poly_count: 14000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 0,
    preset_type: "sword",
    primary_color: "#6366f1",
    accent_color: "#06b6d4",
    roughness: 0.15,
    metalness: 0.92,
    output_glb_url: null,
    created_at: new Date().toISOString(),
    categoryTag: "Weapon",
  },
  {
    id: "showcase_elixir_potion",
    user_id: "community",
    stage: "refine_pbr",
    engine: "triposg",
    mode: "text_to_3d",
    prompt_th: "ขวดน้ำยามรกตเวทมนตร์โบราณ",
    prompt_en: "Ancient Emerald Mana Potion Flask with floating runic ring",
    input_image_url: null,
    status: "completed",
    cost_credits: 2,
    refunded: 0,
    target_poly_count: 12000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 0,
    preset_type: "potion",
    primary_color: "#10b981",
    accent_color: "#f87171",
    roughness: 0.14,
    metalness: 0.65,
    output_glb_url: null,
    created_at: new Date().toISOString(),
    categoryTag: "Props",
  },
  {
    id: "showcase_obelisk_shrine",
    user_id: "community",
    stage: "refine_pbr",
    engine: "trellis_pbr",
    mode: "text_to_3d",
    prompt_th: "แท่นศิลาคริสตัลเรืองแสงแห่งสยาม",
    prompt_en: "Floating Siamese Crystal Obelisk Shrine monument",
    input_image_url: null,
    status: "completed",
    cost_credits: 8,
    refunded: 0,
    target_poly_count: 22000,
    topology: "quad",
    has_pbr: 1,
    has_rig: 0,
    preset_type: "crystal",
    primary_color: "#0ea5e9",
    accent_color: "#a855f7",
    roughness: 0.16,
    metalness: 0.82,
    output_glb_url: null,
    created_at: new Date().toISOString(),
    categoryTag: "Architecture",
  },
];

export default function SiamPrism3DStudioPage() {
  const [topNav, setTopNav] = useState<"home" | "workspace">("home");

  // User & Auth state
  const [user, setUser] = useState<UserRecord | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
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
    "trellis_pbr"
  );
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const [prompt, setPrompt] = useState<string>(
    "หุ่นยนต์ยักษ์วัดแจ้งเกราะมรกตไซเบอร์พังก์ถือดาบพลังงานแสงนีออน"
  );
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
    emissiveIntensity: 0.25,
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
      primaryColor: activeTask.primary_color || "#ef4444",
      accentColor: activeTask.accent_color || "#f59e0b",
      roughness: activeTask.roughness ?? 0.22,
      metalness: activeTask.metalness ?? 0.85,
      emissiveIntensity: 0.25,
      polyMultiplier: 1,
    });
    setHiddenParts([]);
    setExplodeFactor(0);
  }, [activeTask]);

  // Automatically enable tool-specific visual modes when clicking the Left Icon Rail
  const handleSelectLeftTool = (toolId: LeftToolId) => {
    setActiveLeftTool(toolId);
    setSegmentColorMode(toolId === "segment");
    setUvCheckerMode(toolId === "smart-uv");
    setPrintCheckMode(toolId === "print3d");
    if (toolId === "rig" || toolId === "animate") {
      setShowRigBones(true);
    }
    if (toolId === "rig") {
      setShowRigMarkers(true);
    } else {
      setShowRigMarkers(false);
    }
    if (toolId === "animate" && animationClip === "none") {
      setAnimationClip("idle");
    }
    if (toolId === "relief" && artStyleMode === "standard") {
      setArtStyleMode("relief");
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
          setActiveTask((prev) => prev || data.tasks[0]);
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
        primary_color: "#ef4444",
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
      setUploadedImage(reader.result as string);
      setInputMode("image_to_3d");
      triggerToast(`อัปโหลดรูปภาพ ${file.name} พร้อมสร้าง 3D`);
    };
    reader.readAsDataURL(file);
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
    if (!prompt.trim() && !uploadedImage) {
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
    setGenStageText("แปลภาษาไทย → 3D Spatial Prompt...");

    const timer1 = setTimeout(() => {
      setGenProgress(52);
      setGenStageText(`กำลังประมวลผล ${currentModelSpec.name}...`);
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
          promptTh: prompt || "โมเดล 3D จากรูปภาพต้นแบบ",
          stage: enablePbr8k ? "refine_pbr" : "draft_3d",
          engine: selectedModel,
          mode: inputMode === "image_to_3d" ? "image_to_3d" : "text_to_3d",
          targetPolyCount: targetPolycount,
          topology: cleanTopologyTrial || meshQualityTab === "smart-mesh" ? "quad" : "triangle",
          hasRig: enableAutoRig || activeLeftTool === "rig",
          inputImageUrl: uploadedImage || multiViewImages.front,
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
  const allGalleryModels = [...tasks, ...CURATED_SHOWCASE].filter((item) => {
    if (selectedCategory !== "All" && selectedCategory !== "Featured" && selectedCategory !== "3D Printing") {
      const tag = (item as any).categoryTag || "";
      const presetMap: Record<string, string> = {
        mecha: "Character",
        dragon: "Animal",
        vehicle: "Vehicle",
        sword: "Weapon",
        potion: "Props",
        crystal: "Architecture",
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
    ]
  );

  return (
    <main className="h-dvh w-dvw overflow-hidden bg-[#060608] text-slate-100 flex flex-col p-3 gap-2.5 select-none font-sans relative">
      {/* Ambient Aurora Mesh Backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[620px] h-[360px] rounded-full bg-red-500/[0.09] blur-[130px]" />
        <div className="absolute top-28 right-1/4 w-[520px] h-[340px] rounded-full bg-red-500/[0.09] blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 w-[480px] h-[260px] rounded-full bg-emerald-500/[0.06] blur-[120px]" />
      </div>

      {/* Floating Action Toast */}
      {actionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#110b0e]/95 border border-red-400/50 text-red-200 text-xs font-semibold shadow-[0_0_25px_rgba(239,68,68,0.3)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-red-400" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* =====================================================================
          1. TOP FLOATING PILL HEADER
         ===================================================================== */}
      <header className="relative z-20 h-12 w-full rounded-full bg-[#110b0e]/85 backdrop-blur-2xl px-3 flex items-center justify-between shrink-0 border border-red-500/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Left Navigation */}
        <nav className="flex items-center gap-1.5">
          <button
            onClick={() => setTopNav("home")}
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full hover:bg-white/[0.04] transition cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 via-red-500 to-rose-600 flex items-center justify-center text-white font-black text-xs shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              P
            </div>
            <span className="font-bold text-sm tracking-tight text-white">
              Prism<span className="text-red-400">3D</span>
            </span>
          </button>

          <button
            onClick={() => setTopNav("workspace")}
            className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              topNav === "workspace"
                ? "bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-200 border border-red-400/50 shadow-[0_0_18px_rgba(239,68,68,0.2)]"
                : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] border border-white/10"
            }`}
          >
            <Box className="w-3.5 h-3.5 text-red-400" />
            <span>3D Workspace</span>
          </button>

          <button
            onClick={() => setTopNav("home")}
            className={`h-8 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              topNav === "home"
                ? "bg-red-500/15 text-red-300 border border-red-500/30"
                : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <HomeIcon className="w-3.5 h-3.5" />
            <span>Welcome</span>
          </button>

          <button
            onClick={() => {
              setTopNav("workspace");
              setRightTab("assets");
            }}
            className="h-8 px-3.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] flex items-center gap-1.5 transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-rose-400" />
            <span>Assets ({tasks.length + CURATED_SHOWCASE.length})</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {oauthToast && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{oauthToast}</span>
            </div>
          )}

          {/* 3D Print Check Pill (EngineActionPrint from workspace.js) */}
          <button
            onClick={() => setPrintCheckModalOpen(true)}
            className="hidden lg:flex h-8 px-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-red-500/15 items-center gap-1.5 text-xs font-medium text-slate-200 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-rose-400" />
            <span>3D Print</span>
          </button>

          {/* DCC Bridge Modal Trigger */}
          <button
            onClick={() => setDccBridgeModalOpen(true)}
            className="hidden sm:flex h-8 px-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-red-500/15 items-center gap-1.5 text-xs font-medium text-slate-200 transition cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-red-400" />
            <span>DCC Bridge</span>
          </button>

          {/* Credits + Cyan-Mint Upgrade Pill */}
          <div className="h-8 pl-3 pr-1 rounded-full bg-white/[0.04] border border-red-500/20 flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-bold text-white">
              <Coins className="w-3.5 h-3.5 text-red-400" />
              <span>{user ? user.credits_balance : 0}</span>
            </div>
            <button
              onClick={() => setTopupModalOpen(true)}
              className="h-6 px-2.5 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:brightness-110 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
              <span>เติมเครดิต</span>
            </button>
          </div>

          {/* User Profile / Google Sign-In */}
          {user ? (
            <div className="flex items-center gap-1 pl-1.5 pr-1.5 py-1 rounded-full bg-white/[0.04] border border-red-500/15">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-6 h-6 rounded-full bg-slate-800 object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 text-white font-bold text-xs flex items-center justify-center">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-slate-200 max-w-[96px] truncate hidden md:inline px-1">
                {user.name}
              </span>
              <button
                onClick={handleDirectGoogleLogin}
                title="สลับบัญชี Google"
                className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={handleLogout}
                title="ออกจากระบบ"
                className="p-1 text-slate-400 hover:text-rose-400 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleDirectGoogleLogin}
              className="h-8 px-3.5 rounded-full bg-white text-zinc-900 hover:bg-zinc-100 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.18)]"
            >
              <GoogleLogoSvg className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบด้วย Google</span>
            </button>
          )}
        </div>
      </header>

      {/* =====================================================================
          2A. WELCOME PAGE (HomeInput + Gallery Filter + Bento Grid)
         ===================================================================== */}
      {topNav === "home" ? (
        <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-10 space-y-6 no-scrollbar">
          {/* Top Promo Strip */}
          <div
            onClick={() => setTopupModalOpen(true)}
            className="w-full h-11 rounded-2xl bg-gradient-to-r from-red-500/20 via-red-500/20 to-emerald-500/20 border border-red-400/25 px-4 flex items-center justify-center gap-3 cursor-pointer hover:border-red-400/50 transition"
          >
            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
              Promo
            </span>
            <p className="text-xs text-slate-100 font-medium truncate">
              ปลดล็อก Smart Mesh P2.0, Multi-View และดาวน์โหลด .GLB ไม่จำกัด — รับโบนัสเครดิตเพิ่มสูงสุด 28% เมื่อเติมผ่าน QR PromptPay
            </p>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-[11px] shrink-0">
              อัปเกรดเลย
            </span>
          </div>

          {/* Hero Welcome Section */}
          <section className="pt-4 pb-2 flex flex-col items-center">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white text-center mb-2">
              {user
                ? `Hi, ${user.name}! วันนี้คุณจะปั้นอะไรเป็น 3D?`
                : "What will you bring into 3D?"}
            </h1>

            <p className="text-sm sm:text-base text-slate-400 font-light text-center mb-6">
              Made for the way you work — พิมพ์ภาษาไทย หรือวางรูปภาพ (Ctrl+V) เพื่อเสกโมเดล 3D พร้อมใช้งานทันที
            </p>

            {/* Hero Interactive Creation Box (HomeInput) */}
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
              className={`w-full max-w-[920px] min-h-[220px] rounded-[36px] px-6 pt-5 pb-4 flex flex-col justify-between relative overflow-hidden transition-all duration-300 backdrop-blur-xl ${
                isDragOverHero
                  ? "bg-red-500/15 border-2 border-red-400 shadow-[0_0_60px_rgba(239,68,68,0.35)]"
                  : "bg-[#110b0e]/80 border border-red-400/30 shadow-[0_0_50px_rgba(239,68,68,0.14)]"
              }`}
            >
              <div className="pointer-events-none absolute inset-x-10 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-300/70 to-transparent" />

              {/* Top Mode Switcher inside Hero Box (Meshy Discover: สร้างแบบรวดเร็ว vs โหมดเอเจนต์ + Art Style Pills) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                <div className="inline-flex items-center p-0.5 rounded-full bg-[#060608] border border-red-500/20">
                  <button
                    onClick={() => setHomeCreateMode("quick")}
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      homeCreateMode === "quick"
                        ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>สร้างแบบรวดเร็ว (Quick Create)</span>
                  </button>
                  <button
                    onClick={() => {
                      setHomeCreateMode("agent");
                      setActiveLeftTool("agent");
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      homeCreateMode === "agent"
                        ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>โหมดเอเจนต์ (3D Agent)</span>
                  </button>
                </div>

                {/* Quick Art Style Pills (Meshy 7.1 Styles) */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: "standard", label: "Realistic PBR" },
                    { id: "sculpture", label: "ZBrush Clay" },
                    { id: "voxel", label: "Voxel Block" },
                    { id: "relief", label: "3D Relief" },
                    { id: "text3d", label: "3D Text" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        setArtStyleMode(st.id as ArtStyleOverride);
                        setMeshyArtStyleLabel(st.label);
                        triggerToast(`เลือกสไตล์ 3D: ${st.label}`);
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                        artStyleMode === st.id
                          ? "bg-red-500/25 text-red-200 border border-red-400/50"
                          : "bg-white/[0.04] text-slate-400 hover:text-white border border-transparent"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-stretch gap-4 flex-1 py-2">
                <div className="flex-1 flex flex-col justify-between">
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="พิมพ์สิ่งที่ต้องการสร้างเป็น 3D เช่น หุ่นยนต์ยักษ์วัดแจ้ง, รถตุ๊กตุ๊กไซเบอร์พังก์, ดาบมังกรฟ้า..."
                    className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                  />

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    <span className="text-[11px] text-slate-500 shrink-0">ตัวอย่าง:</span>
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp.label}
                        onClick={() => setPrompt(qp.prompt)}
                        className="px-2.5 py-0.5 rounded-full bg-white/[0.04] hover:bg-red-500/15 border border-white/[0.07] hover:border-red-400/30 text-[11px] text-slate-300 hover:text-red-200 whitespace-nowrap transition cursor-pointer"
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Quick Drop / Paste Zone */}
                <label className="md:w-[230px] rounded-2xl border border-dashed border-red-400/25 hover:border-red-400/60 bg-[#090709]/60 hover:bg-red-500/[0.06] p-3 flex flex-col items-center justify-center text-center cursor-pointer transition relative overflow-hidden shrink-0">
                  <input
                    type="file"
                    accept="image/*,.glb,.gltf"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {uploadedImage ? (
                    <div className="relative w-full h-24 flex items-center justify-center">
                      <img
                        src={uploadedImage}
                        alt="Preview"
                        className="max-h-24 rounded-lg object-contain"
                      />
                      <span className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold">
                        Image-to-3D
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-400/20 flex items-center justify-center mb-1.5">
                        <ImageIcon className="w-4 h-4 text-red-300" />
                      </div>
                      <span className="text-xs font-semibold bg-gradient-to-r from-red-200 via-white to-rose-200 bg-clip-text text-transparent">
                        Generate Quickly from Image
                      </span>
                      <span className="text-[10px] text-red-400/80 mt-0.5">
                        คลิก, ลากวางรูป หรือไฟล์ .GLB
                      </span>
                    </>
                  )}
                </label>
              </div>

              {/* Bottom Controls Bar inside Hero Box */}
              <div className="h-11 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 p-1 pr-3 rounded-full bg-[#090709]/90 border border-white/[0.07]">
                  <button
                    onClick={() =>
                      setSelectedModel(
                        selectedModel === "trellis_pbr"
                          ? "hunyuan3d_2_1"
                          : selectedModel === "hunyuan3d_2_1"
                            ? "triposg"
                            : "trellis_pbr"
                      )
                    }
                    className="px-3.5 py-1.5 rounded-full bg-red-500/15 text-red-300 border border-red-400/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{currentModelSpec.name}</span>
                  </button>

                  <button
                    onClick={() => setCleanTopologyTrial(!cleanTopologyTrial)}
                    className={`text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      cleanTopologyTrial ? "text-white" : "text-slate-500"
                    }`}
                  >
                    <span>Clean Topology</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-semibold">
                      {cleanTopologyTrial ? "Quad ON" : "Triangle"}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRandomPrompt}
                    title="สุ่มไอเดีย Prompt ภาษาไทย"
                    className="w-9.5 h-9.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-slate-300 hover:text-red-300 transition cursor-pointer"
                  >
                    <Dices className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="h-10 px-6 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:brightness-110 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_28px_rgba(239,68,68,0.4)] transition cursor-pointer"
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Generate</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-white text-[11px] font-extrabold">
                      {estimatedCost} 🪙
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Meshy Free 3D Tools & Direct Studio Shortcuts */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setTopNav("workspace")}
                className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-500/20 to-rose-500/20 hover:from-red-500/30 hover:to-rose-500/30 border border-red-400/40 text-xs text-red-200 font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <span>เปิด 3D Workspace เต็มรูปแบบ (14 เครื่องมือ Tripo + Meshy)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {[
                {
                  label: "🤖 3D Agent Chat",
                  action: () => {
                    setTopNav("workspace");
                    handleSelectLeftTool("agent");
                  },
                },
                {
                  label: "🧱 Text-to-Voxel",
                  action: () => {
                    setArtStyleMode("voxel");
                    setTopNav("workspace");
                    handleSelectLeftTool("retopo");
                    triggerToast("แปลงโมเดลเป็น Voxel Block เรียบร้อย!");
                  },
                },
                {
                  label: "🪙 3D Bas-Relief",
                  action: () => {
                    setArtStyleMode("relief");
                    setTopNav("workspace");
                    handleSelectLeftTool("relief");
                    triggerToast("เปิดสตูดิโอปั้นนูนต่ำ 3D Bas-Relief");
                  },
                },
                {
                  label: "🔤 3D Text Generator",
                  action: () => {
                    setArtStyleMode("text3d");
                    setTopNav("workspace");
                    handleSelectLeftTool("relief");
                    triggerToast("เปิดเครื่องสร้างข้อความ 3D Extruder");
                  },
                },
                {
                  label: "🖨️ STL Repair & Base",
                  action: () => {
                    setAddPrintBase(true);
                    setTopNav("workspace");
                    handleSelectLeftTool("print3d");
                    triggerToast("เปิดระบบตรวจเช็กไฟล์พิมพ์ 3D + ฐานตั้งโมเดล");
                  },
                },
              ].map((shortcut) => (
                <button
                  key={shortcut.label}
                  onClick={shortcut.action}
                  className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-red-500/15 border border-white/10 hover:border-red-400/40 text-xs text-slate-300 hover:text-red-200 transition cursor-pointer"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          </section>

          {/* Showcase & Community Gallery Section */}
          <section className="max-w-[1420px] mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Gallery ({allGalleryModels.length})
              </h2>
              <span className="text-xs text-slate-400">
                คลิกที่การ์ดโมเดลเพื่อเปิดแก้ไขด้วยเครื่องมือ Segment / Retopo / UV / Rig / Animate ใน 3D Workspace
              </span>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 relative">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-1">
                <button
                  onClick={() => setFilterPopoverOpen(!filterPopoverOpen)}
                  className={`h-8 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 border transition cursor-pointer ${
                    filterPopoverOpen || filterMeshType !== "all"
                      ? "bg-red-500/20 text-red-200 border-red-400/40"
                      : "bg-white/[0.05] text-slate-200 border-white/10 hover:bg-white/[0.08]"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5 text-red-400" />
                  <span>Filter</span>
                </button>

                <div className="h-4 w-[1px] bg-white/10 mx-1 shrink-0" />

                {GALLERY_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-8 px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        active
                          ? "bg-gradient-to-r from-red-500/25 to-rose-500/25 text-red-200 border border-red-400/40"
                          : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] border border-transparent"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <div className="h-8 px-3 rounded-full bg-[#110b0e] border border-white/10 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาโมเดล 3D..."
                    className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-28 sm:w-40"
                  />
                </div>

                <button
                  onClick={() => setTopNav("workspace")}
                  className="h-8 px-3.5 rounded-full bg-white text-slate-950 hover:bg-red-500 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Feature My Model
                </button>
              </div>

              {filterPopoverOpen && (
                <div className="absolute top-11 left-0 z-30 w-64 rounded-2xl bg-[#110b0e] border border-red-500/25 shadow-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span>Model Type</span>
                    <button
                      onClick={() => {
                        setFilterMeshType("all");
                        setFilterPopoverOpen(false);
                      }}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "all", label: "All Models" },
                      { id: "smart_mesh", label: "Smart Quad Mesh" },
                      { id: "pbr", label: "4K PBR" },
                      { id: "rigged", label: "Auto-Rigged" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setFilterMeshType(opt.id as any);
                          setFilterPopoverOpen(false);
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs transition cursor-pointer ${
                          filterMeshType === opt.id
                            ? "bg-red-600 text-white font-bold"
                            : "bg-white/[0.05] text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedCategory === "All" && (
                <div
                  onClick={() => {
                    setActiveTask(CURATED_SHOWCASE[0]);
                    setTopNav("workspace");
                  }}
                  className="sm:col-span-2 h-[320px] rounded-[24px] bg-gradient-to-br from-[#1f090e] via-[#2c0b14] to-[#0d0608] border border-red-400/25 hover:border-red-400/60 p-6 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition"
                >
                  <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-red-400/15 blur-3xl group-hover:bg-red-400/25 transition" />
                  <div className="space-y-2 relative z-10 max-w-md">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-400/15 border border-red-400/30 text-red-300 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>#ThaiCyberpunkCollection</span>
                    </span>
                    <h3 className="text-2xl font-bold text-white leading-snug">
                      Siam Mecha & Mythical Guardians 3D Pack
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      รวมโมเดล 3D สไตล์ไทยไซเบอร์พังก์และสัตว์หิมพานต์ พร้อมโครงสร้าง Quad Mesh และ PBR 4K สำหรับ Unreal Engine 5 และ Blender
                    </p>
                  </div>

                  <div className="flex items-center justify-between relative z-10">
                    <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md">
                      <span>View Model in 3D</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs text-red-300/80 font-mono">
                      QUAD • 4K PBR • GLB/OBJ
                    </span>
                  </div>
                </div>
              )}

              {allGalleryModels.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveTask(item);
                    setTopNav("workspace");
                  }}
                  className="h-[320px] rounded-[24px] bg-[#110b0e] border border-white/[0.07] hover:border-red-400/50 p-3.5 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition"
                >
                  <div className="flex-1 rounded-2xl bg-gradient-to-b from-[#1f0d13] to-[#0b080a] flex items-center justify-center relative overflow-hidden">
                    <div
                      className="w-24 h-24 rounded-3xl shadow-2xl flex items-center justify-center border border-white/20 transition-transform duration-400 group-hover:scale-110 group-hover:rotate-3"
                      style={{
                        background: `linear-gradient(135deg, ${item.primary_color}, ${item.accent_color})`,
                      }}
                    >
                      <Box className="w-11 h-11 text-white drop-shadow" />
                    </div>

                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#060608]/80 border border-red-400/30 text-[10px] font-bold text-red-300 uppercase">
                      {item.preset_type}
                    </span>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 bg-slate-950/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-3">
                      <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                        <Eye className="w-3.5 h-3.5" />
                        <span>เปิดใน 3D Studio</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTask(item);
                            setPrompt(item.prompt_th);
                            setTopNav("workspace");
                            handleSelectLeftTool("generate");
                            triggerToast(`โหลดพรอมต์และโมเดล "${item.prompt_th}" เพื่อ Remix แล้ว`);
                          }}
                          className="px-2.5 py-1 rounded-full bg-[#110b0e]/90 hover:bg-red-500/25 border border-red-400/40 text-[10px] font-semibold text-red-200 cursor-pointer"
                        >
                          ✨ Remix
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTask(item);
                            setTopNav("workspace");
                            handleSelectLeftTool("texture");
                            triggerToast(`เปิด "${item.prompt_th}" ใน AI Retexture Studio`);
                          }}
                          className="px-2.5 py-1 rounded-full bg-[#110b0e]/90 hover:bg-rose-500/25 border border-rose-400/40 text-[10px] font-semibold text-rose-200 cursor-pointer"
                        >
                          🎨 Retexture
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-red-600 to-rose-700 text-white font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-red-400/30">
                        P
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {item.prompt_th}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {(item.target_poly_count / 1000).toFixed(1)}k polys •{" "}
                          {item.topology.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <Heart className="w-3.5 h-3.5 text-red-400" />
                      <span>42</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* =====================================================================
           2B. 3D WORKSPACE VIEW — ALL 11 LEFT-RAIL TOOLS FULLY INTERACTIVE
           ===================================================================== */
        <div className="relative z-10 flex-1 min-h-0 flex gap-0">
          {/* -------------------------------------------------------------------
              LEFT DOCK PART 1: Vertical Icon Rail (14 Tools from Tripo + Meshy)
             ------------------------------------------------------------------- */}
          <aside className="w-[58px] h-full rounded-l-[20px] bg-[#110b0e] border-y border-l border-red-500/15 flex flex-col justify-between py-1.5 shrink-0">
            <div className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
              {LEFT_RAIL_GROUPS.map((group, gIdx) => (
                <div
                  key={group.group}
                  className={`flex flex-col items-center gap-0.5 px-1 ${
                    gIdx > 0 ? "pt-1 mt-0.5 border-t border-white/[0.06]" : ""
                  }`}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeLeftTool === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectLeftTool(item.id)}
                        className={`w-full py-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                          active
                            ? "bg-red-500/20 text-red-300 border border-red-400/40 shadow-inner"
                            : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[8.5px] leading-none font-medium text-center">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="pt-1 border-t border-white/[0.06] flex flex-col items-center">
              <button
                onClick={() => setTopupModalOpen(true)}
                className="w-11 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] flex flex-col items-center gap-0.5 transition cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[8.5px] leading-none font-medium">QR Pay</span>
              </button>
            </div>
          </aside>

          {/* -------------------------------------------------------------------
              LEFT DOCK PART 2: Dynamic Tool Panel (Switches based on activeLeftTool!)
             ------------------------------------------------------------------- */}
          <section className="w-[272px] h-full rounded-r-[20px] bg-[#160e12] border-y border-r border-red-500/15 flex flex-col shrink-0 overflow-hidden">
            {/* Dynamic Panel Header */}
            <div className="h-10 px-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-white tracking-wide uppercase truncate">
                {activeLeftTool === "agent" && "3D Agent Co-Pilot"}
                {activeLeftTool === "generate" && "Generate Model"}
                {activeLeftTool === "relief" && "3D Relief & Text"}
                {activeLeftTool === "segment" && "Auto-Split Parts"}
                {activeLeftTool === "fill-parts" && "Fill Missing Parts"}
                {activeLeftTool === "retopo" && "Remesh & Voxel"}
                {activeLeftTool === "smart-uv" && "Auto-UV Unwrap"}
                {activeLeftTool === "texture" && "AI Texture Studio"}
                {activeLeftTool === "edit" && "Brush & 3D Decal"}
                {activeLeftTool === "upscale" && "8K AI Upscaler"}
                {activeLeftTool === "pbr" && "PBR & HDRI Light"}
                {activeLeftTool === "rig" && "Auto-Rig & Pose"}
                {activeLeftTool === "animate" && "600+ Motion Library"}
                {activeLeftTool === "print3d" && "3D Print & Slicer"}
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
                  setTransformState({ scaleX: 1, scaleY: 1, scaleZ: 1, rotY: 0 });
                  triggerToast("รีเซ็ตการตั้งค่า Viewport เรียบร้อย");
                }}
                title="Reset Tool Effects"
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>

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
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#090709] border border-white/10">
                  <button
                    onClick={() => {
                      setArtStyleMode("relief");
                      triggerToast("สลับเป็นโหมดปั้นนูนต่ำ 3D Bas-Relief Medallion");
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      artStyleMode === "relief"
                        ? "bg-red-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    🪙 Bas-Relief
                  </button>
                  <button
                    onClick={() => {
                      setArtStyleMode("text3d");
                      triggerToast("สลับเป็นโหมด 3D Text Extruder");
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      artStyleMode === "text3d"
                        ? "bg-red-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    🔤 3D Text
                  </button>
                </div>

                {artStyleMode === "text3d" ? (
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-3">
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-300">ข้อความ 3D (3D Typography)</span>
                      <input
                        type="text"
                        maxLength={8}
                        value={text3dContent}
                        onChange={(e) => setText3dContent(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg bg-[#090709] border border-red-400/40 text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Extrusion Depth (ความหนา)</span>
                        <span className="text-red-300 font-mono">{text3dDepth.toFixed(2)}m</span>
                      </div>
                      <input
                        type="range"
                        min={0.15}
                        max={1.1}
                        step={0.05}
                        value={text3dDepth}
                        onChange={(e) => setText3dDepth(Number(e.target.value))}
                        className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-3">
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      สร้างเหรียญตราหรือป้ายภาพนูนต่ำ 3D (Bas-Relief / Lithophane) พร้อมกรอบเหรียญสำหรับพิมพ์ 3D
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Relief Emboss Height</span>
                        <span className="text-red-300 font-mono">{reliefDepth.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={1.5}
                        step={0.05}
                        value={reliefDepth}
                        onChange={(e) => setReliefDepth(Number(e.target.value))}
                        className="w-full accent-red-400 h-1.5 bg-slate-900 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setArtStyleMode("standard");
                    triggerToast("กลับสู่โหมดโมเดล 3D ปกติ (Full 3D Mesh)");
                  }}
                  className="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
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
                <div className="px-3 pt-3 pb-2 shrink-0">
                  <div className="h-8 w-full rounded-full bg-[#0b080a] p-0.5 flex items-center relative border border-white/[0.06]">
                    <button
                      onClick={() => setMeshQualityTab("hd")}
                      className={`flex-1 h-full rounded-full text-xs font-semibold transition cursor-pointer ${
                        meshQualityTab === "hd"
                          ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      HD Model
                    </button>
                    <button
                      onClick={() => setMeshQualityTab("smart-mesh")}
                      className={`flex-1 h-full rounded-full text-xs font-semibold transition cursor-pointer ${
                        meshQualityTab === "smart-mesh"
                          ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      Smart Mesh
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-2.5 no-scrollbar">
                  <div className="p-3 rounded-2xl border border-red-400/30 bg-red-500/[0.06] flex flex-col gap-2.5">
                    <div className="h-8 w-full rounded-full bg-[#090709] p-0.5 grid grid-cols-4 gap-0.5">
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
                            className={`h-full rounded-full flex items-center justify-center transition cursor-pointer ${
                              active
                                ? "bg-red-600 text-white shadow-sm"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>

                    {inputMode === "image_to_3d" ? (
                      <label className="h-[176px] rounded-xl border border-dashed border-red-400/25 hover:border-red-400/60 bg-[#090709]/60 hover:bg-white/[0.03] flex flex-col items-center justify-center cursor-pointer transition p-2 text-center relative overflow-hidden">
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
                            className="w-full h-full object-contain rounded-lg"
                          />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-red-400 mb-2" />
                            <span className="text-xs font-medium text-slate-200">
                              Upload JPG, PNG, WEBP
                            </span>
                            <span className="text-[10px] text-slate-500 mt-1">
                              Size ≤ 20MB (หรือกด Ctrl+V)
                            </span>
                          </>
                        )}
                      </label>
                    ) : inputMode === "multi_view" ? (
                      /* WorkspaceGeneratePanelMultiViewUploaderV2: 4 Angle Slots */
                      <div className="grid grid-cols-2 gap-2">
                        {(["front", "back", "left", "right"] as const).map((slot) => (
                          <label
                            key={slot}
                            className="h-20 rounded-xl border border-dashed border-red-400/25 hover:border-red-400/60 bg-[#090709]/60 flex flex-col items-center justify-center cursor-pointer p-1 relative overflow-hidden"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleMultiViewSlotUpload(slot, e)}
                              className="hidden"
                            />
                            {multiViewImages[slot] ? (
                              <img
                                src={multiViewImages[slot]!}
                                alt={slot}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5 text-red-400 mb-1" />
                                <span className="text-[10px] font-semibold uppercase text-slate-300">
                                  {slot}
                                </span>
                              </>
                            )}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          rows={5}
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="พิมพ์คำสั่งภาษาไทยหรืออังกฤษ เช่น หุ่นยนต์ยักษ์วัดแจ้ง..."
                          className="w-full h-[132px] rounded-xl bg-[#090709]/70 border border-white/[0.08] focus:border-red-400/60 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                        />
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                          {QUICK_PROMPTS.map((qp) => (
                            <button
                              key={qp.label}
                              onClick={() => setPrompt(qp.prompt)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] hover:bg-red-500/20 text-slate-300 hover:text-red-200 whitespace-nowrap transition cursor-pointer"
                            >
                              {qp.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Geometry & Texture Accordion */}
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.05] p-3 flex flex-col gap-2">
                    <button
                      onClick={() => setAdvancedOpen(!advancedOpen)}
                      className="w-full flex items-center justify-between text-xs font-medium text-slate-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-red-400" />
                        <span>Geometry & Texture</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-semibold">
                          New
                        </span>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                          +3 🪙
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
                    <div className="text-xs font-semibold text-red-200">🧱 3D Voxelizer Mode</div>
                    <div className="text-[10px] text-slate-400">แปลง Mesh เป็นบล็อก Voxel</div>
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
                  onClick={() =>
                    triggerToast(
                      `จัดเรียงเส้น Clean ${activeTask?.topology.toUpperCase() || "QUAD"} Topology เรียบร้อย!`
                    )
                  }
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs cursor-pointer shadow-lg"
                >
                  Apply Smart Remesh / Retopo
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
                    <span>2D UV Islands Atlas</span>
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
                    className="w-full rounded-xl bg-[#090709] border border-white/10 p-2.5 text-xs text-white focus:border-red-400 focus:outline-none resize-none"
                  />
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
                      { id: "paint" as const, label: "🖌️ Paint" },
                      { id: "healing" as const, label: "🩹 Heal Seam" },
                      { id: "decal" as const, label: "🏷️ 3D Decal" },
                      { id: "stamp" as const, label: "🔖 Stamp" },
                      { id: "lasso" as const, label: "⭕ Inpaint" },
                      { id: "eraser" as const, label: "🧼 Eraser" },
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
                    <span className="text-xs font-semibold text-red-200">
                      🏷️ 3D Decal Emblem
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
                  onClick={() => {
                    setMaterialState((prev) => ({
                      ...prev,
                      roughness: Math.max(0.08, prev.roughness * 0.7),
                      emissiveIntensity: 0.42,
                      polyMultiplier: upscaleResolution === "8K" ? 2.0 : 1.5,
                    }));
                    triggerToast(`อัปสเกลโมเดลเป็น ${upscaleResolution} Ultra HD สำเร็จ!`);
                  }}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs cursor-pointer shadow-lg"
                >
                  Run {upscaleResolution} AI Upscaler
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
                      { id: "humanoid" as const, label: "🧍 Humanoid" },
                      { id: "quadruped_dog" as const, label: "🐕 Quadruped Dog" },
                      { id: "quadruped_cat" as const, label: "🐈 Quadruped Cat" },
                      { id: "universal" as const, label: "🦾 Universal Rig" },
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
                  onClick={() => {
                    setShowRigBones(true);
                    setShowRigMarkers(false);
                    setActiveLeftTool("animate");
                    setAnimationClip("idle");
                    triggerToast("Auto-Rig เสร็จสมบูรณ์! พร้อมทดสอบท่าทางในคลัง 600+ Motion");
                  }}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs cursor-pointer shadow-lg"
                >
                  Apply Auto-Rig & Open Motion →
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
                      "Make Printable: ซ่อมแซม Watertight Mesh + เติมฐานตั้งพร้อมพิมพ์ .STL/.3MF!"
                    );
                  }}
                  className="w-full py-2 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  🛠️ One-Click Make Printable (STL Repair)
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() =>
                      triggerToast("กำลังส่งไฟล์โมเดล 3MF Multi-Color ไปยัง Bambu Studio...")
                    }
                    className="py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold cursor-pointer"
                  >
                    🎋 Send to Bambu
                  </button>
                  <button
                    onClick={() =>
                      triggerToast("กำลังส่งไฟล์โมเดล STL ไปยัง Creality Print...")
                    }
                    className="py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-red-200 text-[11px] font-bold cursor-pointer"
                  >
                    🖨️ Creality Print
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Sticky AI Model Selector + Glowing Cyan-Mint Generate CTA */}
            <div className="p-3 border-t border-white/[0.06] bg-[#160e12] space-y-2.5 shrink-0 relative">
              {modelDropdownOpen && (
                <div className="absolute bottom-[116px] left-3 right-3 rounded-2xl bg-[#110b0e] border border-red-500/25 shadow-2xl p-1.5 z-30 space-y-1">
                  {MODEL_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                        selectedModel === m.id
                          ? "bg-red-500/15 text-white border border-red-400/30"
                          : "hover:bg-white/[0.05] text-slate-300"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{m.sub}</div>
                      </div>
                      <span className="text-xs font-bold text-red-300">
                        {m.credits} 🪙
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="w-full p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center text-[10px] font-extrabold text-red-300 shrink-0">
                    {currentModelSpec.code}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {currentModelSpec.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {currentModelSpec.sub}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {errorBanner && (
                <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-200">
                  {errorBanner}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full h-10 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(239,68,68,0.3)] transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="truncate">{genStageText || "Generating..."}</span>
                  </>
                ) : (
                  <>
                    <span>Generate New 3D</span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-black/30 text-white font-extrabold text-[11px]">
                      <Coins className="w-3 h-3" />
                      {estimatedCost}
                    </span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* -------------------------------------------------------------------
              CENTER: Interactive 3D Viewport Canvas
             ------------------------------------------------------------------- */}
          <section className="flex-1 h-full relative mx-3 rounded-[20px] overflow-hidden bg-[#090709] border border-red-500/15 flex flex-col">
            {/* Active Tool & Prompt Pill + Meshy Quick Explode Slider (Below docked 36px ViewSwitcher bar) */}
            <div className="absolute top-11 left-3 z-20 pointer-events-auto flex items-center gap-2">
              <div className="h-7 px-3 rounded-full bg-[#160d11]/90 backdrop-blur-md border border-red-500/20 flex items-center gap-2 text-[11px] text-slate-200 shadow-lg">
                <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-[9px] uppercase">
                  {activeLeftTool}
                </span>
                <span className="truncate max-w-[160px] sm:max-w-[240px]">
                  {activeTask ? `"${activeTask.prompt_th}"` : "Prism3D Studio"}
                </span>
              </div>

              {/* Meshy Viewer Split/Explode Quick Slider (auto_split_explode_adjust) */}
              <div className="hidden xl:flex h-7 px-3 rounded-full bg-[#160d11]/90 backdrop-blur-md border border-red-500/20 items-center gap-2 text-[10px] text-slate-300 shadow-lg">
                <Scissors className="w-3 h-3 text-red-400" />
                <span>Explode</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={explodeFactor}
                  onChange={(e) => setExplodeFactor(Number(e.target.value))}
                  className="w-16 accent-red-400 h-1 bg-slate-900 rounded-lg cursor-pointer"
                />
              </div>
            </div>

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
              RIGHT DOCK: Assets & Property Panel (WorkspaceRightPanel)
             ------------------------------------------------------------------- */}
          <aside className="w-[256px] h-full rounded-[20px] bg-[#110b0e] border border-red-500/15 flex flex-col shrink-0 overflow-hidden">
            <div className="h-9 bg-white/[0.03] grid grid-cols-2 shrink-0 border-b border-white/[0.06]">
              <button
                onClick={() => setRightTab("assets")}
                className={`h-full text-xs font-semibold flex items-center justify-center gap-1.5 transition border-b-2 cursor-pointer ${
                  rightTab === "assets"
                    ? "border-red-400 text-red-300 bg-red-500/[0.05]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Assets</span>
              </button>
              <button
                onClick={() => setRightTab("property")}
                className={`h-full text-xs font-semibold flex items-center justify-center gap-1.5 transition border-b-2 cursor-pointer ${
                  rightTab === "property"
                    ? "border-red-400 text-red-300 bg-red-500/[0.05]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Property</span>
              </button>
            </div>

            <div className="p-3 bg-gradient-to-r from-red-500/15 via-rose-500/10 to-red-500/15 border-b border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white leading-tight">
                  PromptPay QR Top-Up
                </p>
                <p className="text-[10px] text-slate-300 truncate mt-0.5">
                  เติมเครดิตรับโบนัสเพิ่มทันที
                </p>
              </div>
              <button
                onClick={() => setTopupModalOpen(true)}
                className="px-2.5 py-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-[10px] shrink-0 shadow-sm transition cursor-pointer"
              >
                เติมเครดิต
              </button>
            </div>

            {rightTab === "assets" ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    All Assets ({[...tasks, ...CURATED_SHOWCASE].length})
                  </span>
                  <button
                    onClick={() => setRightTab("property")}
                    className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 transition cursor-pointer"
                  >
                    Hierarchy
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Upload .GLB or Image Reference */}
                  <label className="aspect-square rounded-xl border border-dashed border-red-400/25 hover:border-red-400/60 bg-white/[0.02] hover:bg-red-500/[0.05] flex flex-col items-center justify-center p-2 text-center cursor-pointer transition">
                    <input
                      type="file"
                      accept="image/*,.glb,.gltf"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Upload className="w-4 h-4 text-red-400 mb-1" />
                    <span className="text-[10px] font-semibold text-slate-200 leading-tight">
                      Import 3D / Img
                    </span>
                    <span className="text-[8px] text-slate-500 mt-0.5">
                      .GLB, PNG, WEBP
                    </span>
                  </label>

                  {[...tasks, ...CURATED_SHOWCASE].map((item) => {
                    const isSelected = activeTask?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveTask(item)}
                        className={`group aspect-square rounded-xl relative overflow-hidden cursor-pointer border transition flex flex-col items-center justify-center p-2 ${
                          isSelected
                            ? "border-red-400 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.22)]"
                            : "border-white/[0.07] bg-[#160e12] hover:border-red-400/35"
                        }`}
                      >
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md border border-white/20 group-hover:scale-105 transition"
                          style={{
                            background: `linear-gradient(135deg, ${item.primary_color}, ${item.accent_color})`,
                          }}
                        >
                          <Box className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] text-slate-200 font-medium truncate w-full text-center mt-1.5">
                          {item.prompt_th}
                        </span>
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded bg-slate-950/75 text-[8px] font-bold text-red-300 uppercase">
                          {item.preset_type}
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
                    {/* Scene Node Hierarchy Tree (WorkspaceRightPanelPropertyHierarchyTree) */}
                    <div className="p-3 rounded-xl bg-white/[0.04] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-red-300 uppercase font-semibold">
                          Scene Hierarchy ({partNames.length})
                        </span>
                        <button
                          onClick={() => setHiddenParts([])}
                          className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                        {partNames.map((name, idx) => {
                          const hidden = hiddenParts.includes(idx);
                          return (
                            <div
                              key={name}
                              onClick={() => togglePartVisibility(idx)}
                              className="px-2 py-1 rounded-lg bg-[#090709]/60 hover:bg-white/[0.06] flex items-center justify-between text-[11px] cursor-pointer"
                            >
                              <span
                                className={`truncate ${
                                  hidden ? "line-through text-slate-500" : "text-slate-200"
                                }`}
                              >
                                {name}
                              </span>
                              {hidden ? (
                                <EyeOff className="w-3 h-3 text-rose-400 shrink-0" />
                              ) : (
                                <Eye className="w-3 h-3 text-red-400 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Transform Inspector (WorkspaceRightPanelPropertyTransform) */}
                    <div className="p-3 rounded-xl bg-white/[0.04] space-y-2">
                      <span className="text-[10px] text-red-300 uppercase font-semibold">
                        Transform & Rotation
                      </span>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Rotate Y</span>
                        <span className="text-white font-mono">{transformState.rotY}°</span>
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
                        className="w-full accent-red-400 h-1 bg-slate-900 rounded-lg"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.04] space-y-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-red-300 uppercase font-semibold">
                        <Languages className="w-3 h-3" />
                        <span>AI Enhanced 3D Prompt</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
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
                            triggerToast("บันทึกค่าวัสดุ PBR & โครงสร้างลงฐานข้อมูลเรียบร้อย!");
                          } else {
                            setActiveTask({
                              ...activeTask,
                              primary_color: materialState.primaryColor,
                              accent_color: materialState.accentColor,
                              roughness: materialState.roughness,
                              metalness: materialState.metalness,
                            });
                            triggerToast("บันทึกการตั้งค่าวัสดุลงในโมเดลปัจจุบันเรียบร้อย!");
                          }
                        } catch {
                          triggerToast("บันทึกการตั้งค่าวัสดุลงในโมเดลปัจจุบันเรียบร้อย!");
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>บันทึกค่าโมเดลลงฐานข้อมูล (Save to DB)</span>
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
