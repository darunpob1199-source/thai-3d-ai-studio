"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Activity,
  Box,
  Download,
  Eye,
  Grid,
  Layers,
  RotateCcw,
  Sun,
  Grid3X3,
  Scissors,
} from "lucide-react";
import type { GenerationTaskRecord } from "@/lib/db/database";

export type RenderShadingMode =
  | "pbr"
  | "clay"
  | "wireframe"
  | "base_color"
  | "normal"
  | "metallic"
  | "roughness"
  | "ao_curvature"
  | "uv_checker"
  | "segment"
  | "printability"
  | "filament_sim";

export type AnimationClipId =
  | "none"
  | "idle"
  | "walk"
  | "run"
  | "crouch"
  | "jump"
  | "attack"
  | "boxing"
  | "dance"
  | "climb"
  | "quad_gallop";

export type RigCharacterType = "humanoid" | "quadruped_dog" | "quadruped_cat" | "universal";
export type PosePresetType = "bind" | "a_pose" | "t_pose" | "battle";
export type ArtStyleOverride = "standard" | "voxel" | "sculpture" | "relief" | "text3d";
export type ShadingSmoothness = "auto" | "flat" | "smooth";
export type HdriPresetType = "studio" | "outdoor" | "indoor" | "soft" | "cyber";
export type FilamentPresetType = "pla" | "silk" | "petg" | "resin";

export interface LiveStudioOverrides {
  explodeFactor: number; // 0.0 to 1.0 (WorkspaceSegmentationExplodeEffect / auto_split_explode_adjust)
  segmentColorMode: boolean;
  uvCheckerMode: boolean;
  filledParts: {
    auraRing: boolean;
    pedestal: boolean;
    backWings: boolean;
  };
  transform: {
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    rotY: number;
  };
  material: {
    primaryColor: string;
    accentColor: string;
    roughness: number;
    metalness: number;
    emissiveIntensity: number;
    polyMultiplier: number;
  };
  showRig: boolean;
  animationClip: AnimationClipId;
  animationSpeed: number;
  hiddenParts: number[];
  // Meshy 7.1 + Tripo 3.0 Extended Controls
  viewChannel?: RenderShadingMode;
  shadingSmoothness?: ShadingSmoothness;
  artStyleMode?: ArtStyleOverride;
  reliefDepth?: number; // 0.2 to 1.5
  text3dContent?: string;
  text3dDepth?: number;
  rigCharacterType?: RigCharacterType;
  showRigMarkers?: boolean;
  posePreset?: PosePresetType;
  inPlaceAnimation?: boolean;
  addPrintBase?: boolean; // AddBaseStlPlatform
  printCheckMode?: boolean;
  filamentPreset?: FilamentPresetType;
  filamentColor?: string;
  decalEnabled?: boolean;
  decalScale?: number;
  decalRotation?: number;
  decalColor?: string;
  hdriPreset?: HdriPresetType;
  hdriRotation?: number;
  cameraFov?: number;
  showGrid?: boolean;
  activeBrushTool?: "paint" | "healing" | "decal" | "stamp" | "lasso" | "eraser";
}

interface Viewport3DProps {
  activeTask: GenerationTaskRecord | null;
  isGenerating: boolean;
  generationProgress: number;
  generationStepLabel: string;
  studioOverrides?: LiveStudioOverrides;
  onPartNamesChange?: (names: string[]) => void;
}

const SEGMENT_PALETTE = [
  "#ef4444", // Crimson - Core/Torso
  "#10b981", // Emerald - Head/Crown
  "#6366f1", // Indigo - Left Arm/Wing
  "#ec4899", // Pink - Right Arm/Wing
  "#f59e0b", // Amber - Weapon/Cristal
  "#8b5cf6", // Violet - Armor/Trim
  "#14b8a6", // Teal - Lower Body
  "#3b82f6", // Blue - Base/Pedestal
];

function createUvCheckerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const size = 32;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const even = (x + y) % 2 === 0;
      ctx.fillStyle = even ? "#14090c" : "#ef4444";
      ctx.fillRect(x * size, y * size, size, size);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.strokeRect(x * size, y * size, size, size);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  return tex;
}

function buildProceduralGameAsset(
  task: GenerationTaskRecord,
  overrides?: LiveStudioOverrides
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Asset_${task.preset_type}_${task.id}`;

  const primaryHex = overrides?.material.primaryColor || task.primary_color || "#ef4444";
  const accentHex = overrides?.material.accentColor || task.accent_color || "#f59e0b";
  const roughVal = overrides?.material.roughness ?? task.roughness ?? 0.25;
  const metalVal = overrides?.material.metalness ?? task.metalness ?? 0.85;
  const emissiveVal = overrides?.material.emissiveIntensity ?? 0.22;
  const polyMult = overrides?.material.polyMultiplier ?? 1;

  const primary = new THREE.Color(primaryHex);
  const accent = new THREE.Color(accentHex);
  const darkMetal = new THREE.Color("#1e293b");

  const baseSegMultiplier =
    task.target_poly_count >= 25000 ? 2 : task.target_poly_count <= 6000 ? 0.75 : 1.25;
  const radialSegs = Math.max(8, Math.round(24 * baseSegMultiplier * polyMult));

  const mainMat = new THREE.MeshStandardMaterial({
    color: task.has_pbr ? primary : new THREE.Color("#d4d4d8"),
    roughness: task.has_pbr ? roughVal : 0.65,
    metalness: task.has_pbr ? metalVal : 0.1,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: task.has_pbr ? accent : new THREE.Color("#e4e4e7"),
    roughness: task.has_pbr ? Math.max(0.05, roughVal * 0.7) : 0.65,
    metalness: task.has_pbr ? Math.min(1, metalVal + 0.1) : 0.1,
    emissive: task.has_pbr ? accent : new THREE.Color("#000000"),
    emissiveIntensity: task.has_pbr ? emissiveVal : 0,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: task.has_pbr ? darkMetal : new THREE.Color("#a1a1aa"),
    roughness: 0.45,
    metalness: 0.75,
  });

  switch (task.preset_type) {
    case "sword": {
      const bladeGeo = new THREE.ConeGeometry(0.26, 2.5, 4, Math.round(radialSegs / 2));
      bladeGeo.scale(1, 1, 0.28);
      const blade = new THREE.Mesh(bladeGeo, accentMat.clone());
      blade.name = "Part_01_Crystal_Blade";
      blade.position.y = 1.05;
      group.add(blade);

      const coreGeo = new THREE.BoxGeometry(0.16, 2.0, 0.09);
      const core = new THREE.Mesh(coreGeo, mainMat.clone());
      core.name = "Part_02_Blade_Core";
      core.position.y = 0.85;
      group.add(core);

      const guardGeo = new THREE.TorusGeometry(0.45, 0.09, 12, radialSegs, Math.PI);
      guardGeo.rotateZ(Math.PI);
      const guard = new THREE.Mesh(guardGeo, mainMat.clone());
      guard.name = "Part_03_Dragon_Crossguard";
      guard.position.y = -0.12;
      group.add(guard);

      const gripGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.78, radialSegs);
      const grip = new THREE.Mesh(gripGeo, darkMat.clone());
      grip.name = "Part_04_Hilt_Grip";
      grip.position.y = -0.58;
      group.add(grip);

      const pommelGeo = new THREE.OctahedronGeometry(0.18, 1);
      const pommel = new THREE.Mesh(pommelGeo, accentMat.clone());
      pommel.name = "Part_05_Gem_Pommel";
      pommel.position.y = -1.05;
      group.add(pommel);
      break;
    }

    case "mecha": {
      const torsoGeo = new THREE.BoxGeometry(1.1, 1.25, 0.75, 4, 4, 4);
      const torso = new THREE.Mesh(torsoGeo, mainMat.clone());
      torso.name = "Part_01_Mecha_Torso";
      torso.position.y = 0.45;
      group.add(torso);

      const coreGeo = new THREE.OctahedronGeometry(0.25, 2);
      const core = new THREE.Mesh(coreGeo, accentMat.clone());
      core.name = "Part_02_Arc_Reactor_Core";
      core.position.set(0, 0.55, 0.38);
      group.add(core);

      const headGeo = new THREE.ConeGeometry(0.36, 0.75, 6);
      const head = new THREE.Mesh(headGeo, accentMat.clone());
      head.name = "Part_03_WatArun_Crown_Head";
      head.position.y = 1.42;
      group.add(head);

      for (const side of [-1, 1]) {
        const padGeo = new THREE.BoxGeometry(0.52, 0.45, 0.82);
        const pad = new THREE.Mesh(padGeo, accentMat.clone());
        pad.name = side < 0 ? "Part_04_Left_Shoulder_Armor" : "Part_05_Right_Shoulder_Armor";
        pad.position.set(side * 0.85, 0.9, 0);
        pad.rotation.z = side * -0.22;
        group.add(pad);

        const armGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.95, radialSegs);
        const arm = new THREE.Mesh(armGeo, darkMat.clone());
        arm.name = side < 0 ? "Part_06_Left_Mecha_Arm" : "Part_07_Right_Mecha_Arm";
        arm.position.set(side * 0.85, 0.2, 0);
        group.add(arm);

        const legGeo = new THREE.BoxGeometry(0.38, 1.05, 0.48);
        const leg = new THREE.Mesh(legGeo, darkMat.clone());
        leg.name = side < 0 ? "Part_08_Left_Thruster_Leg" : "Part_09_Right_Thruster_Leg";
        leg.position.set(side * 0.34, -0.65, 0);
        group.add(leg);
      }
      break;
    }

    case "dragon": {
      const knotGeo = new THREE.TorusKnotGeometry(
        0.68,
        0.2,
        Math.round(radialSegs * 4),
        Math.round(radialSegs)
      );
      const body = new THREE.Mesh(knotGeo, mainMat.clone());
      body.name = "Part_01_Serpent_Body";
      body.position.y = 0.45;
      group.add(body);

      const crestGeo = new THREE.ConeGeometry(0.35, 0.9, 5);
      const crest = new THREE.Mesh(crestGeo, accentMat.clone());
      crest.name = "Part_02_Naga_Golden_Crest";
      crest.position.set(0, 1.48, 0.25);
      crest.rotation.x = 0.35;
      group.add(crest);

      const orbGeo = new THREE.IcosahedronGeometry(0.28, 2);
      const orb = new THREE.Mesh(orbGeo, accentMat.clone());
      orb.name = "Part_03_Sacred_Energy_Pearl";
      orb.position.set(0, 0.45, 0);
      group.add(orb);
      break;
    }

    case "potion": {
      const flaskGeo = new THREE.SphereGeometry(0.78, radialSegs, radialSegs);
      const flask = new THREE.Mesh(flaskGeo, mainMat.clone());
      flask.name = "Part_01_Crystal_Flask";
      flask.position.y = 0.15;
      group.add(flask);

      const neckGeo = new THREE.CylinderGeometry(0.24, 0.3, 0.55, radialSegs);
      const neck = new THREE.Mesh(neckGeo, darkMat.clone());
      neck.name = "Part_02_Bottle_Neck";
      neck.position.y = 0.95;
      group.add(neck);

      const ringGeo = new THREE.TorusGeometry(0.84, 0.06, 12, radialSegs);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, accentMat.clone());
      ring.name = "Part_03_Runic_Gold_Ring";
      ring.position.y = 0.15;
      group.add(ring);

      const stopperGeo = new THREE.OctahedronGeometry(0.28, 0);
      const stopper = new THREE.Mesh(stopperGeo, accentMat.clone());
      stopper.name = "Part_04_Gem_Stopper";
      stopper.position.y = 1.38;
      group.add(stopper);
      break;
    }

    case "vehicle": {
      const chassisGeo = new THREE.BoxGeometry(1.35, 0.55, 2.1);
      const chassis = new THREE.Mesh(chassisGeo, mainMat.clone());
      chassis.name = "Part_01_TukTuk_Chassis";
      chassis.position.y = 0.1;
      group.add(chassis);

      const cabinGeo = new THREE.BoxGeometry(1.2, 0.72, 1.15);
      const cabin = new THREE.Mesh(cabinGeo, accentMat.clone());
      cabin.name = "Part_02_Cyber_Canopy_Roof";
      cabin.position.set(0, 0.68, -0.15);
      group.add(cabin);

      // Front single wheel + 2 rear wheels
      const frontWheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, radialSegs);
      frontWheelGeo.rotateZ(Math.PI / 2);
      const frontWheel = new THREE.Mesh(frontWheelGeo, darkMat.clone());
      frontWheel.name = "Part_03_Front_Wheel";
      frontWheel.position.set(0, -0.22, 0.88);
      group.add(frontWheel);

      for (const xDir of [-1, 1]) {
        const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, radialSegs);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheel = new THREE.Mesh(wheelGeo, darkMat.clone());
        wheel.name = xDir < 0 ? "Part_04_Rear_Left_Wheel" : "Part_05_Rear_Right_Wheel";
        wheel.position.set(xDir * 0.78, -0.22, -0.78);
        group.add(wheel);
      }
      break;
    }

    case "crystal":
    default: {
      const obeliskGeo = new THREE.OctahedronGeometry(0.85, 1);
      obeliskGeo.scale(0.65, 1.85, 0.65);
      const obelisk = new THREE.Mesh(obeliskGeo, mainMat.clone());
      obelisk.name = "Part_01_Central_Obelisk";
      obelisk.position.y = 0.75;
      group.add(obelisk);

      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const shardGeo = new THREE.OctahedronGeometry(0.28, 0);
        shardGeo.scale(0.5, 1.6, 0.5);
        const shard = new THREE.Mesh(shardGeo, accentMat.clone());
        shard.name = `Part_0${i + 2}_Crystal_Shard_${i + 1}`;
        shard.position.set(Math.cos(angle) * 0.9, 0.35, Math.sin(angle) * 0.9);
        shard.rotation.z = Math.cos(angle) * 0.25;
        group.add(shard);
      }

      const baseGeo = new THREE.CylinderGeometry(1.1, 1.3, 0.32, 8);
      const base = new THREE.Mesh(baseGeo, darkMat.clone());
      base.name = "Part_06_Stone_Altar_Base";
      base.position.y = -0.82;
      group.add(base);
      break;
    }
  }

  // Optional Fill Parts synthesized geometry (WorkspaceFillPartsPanel)
  if (overrides?.filledParts.auraRing) {
    const haloGeo = new THREE.TorusGeometry(1.35, 0.045, 16, 48);
    const halo = new THREE.Mesh(haloGeo, accentMat.clone());
    halo.name = "Part_Filled_Cyber_Halo_Ring";
    halo.position.set(0, 0.75, -0.35);
    group.add(halo);
  }
  if (overrides?.filledParts.backWings) {
    for (const side of [-1, 1]) {
      const wingGeo = new THREE.BoxGeometry(0.95, 1.1, 0.08);
      const wing = new THREE.Mesh(wingGeo, accentMat.clone());
      wing.name = side < 0 ? "Part_Filled_Left_Mecha_Wing" : "Part_Filled_Right_Mecha_Wing";
      wing.position.set(side * 1.15, 0.85, -0.45);
      wing.rotation.z = side * 0.35;
      wing.rotation.y = side * -0.25;
      group.add(wing);
    }
  }
  if (overrides?.filledParts.pedestal) {
    const pedGeo = new THREE.CylinderGeometry(1.45, 1.6, 0.18, 24);
    const ped = new THREE.Mesh(pedGeo, darkMat.clone());
    ped.name = "Part_Filled_Display_Pedestal";
    ped.position.set(0, -1.12, 0);
    group.add(ped);
  }

  // Meshy AddBaseStlPlatform (3D Print Miniature Base Platform)
  if (overrides?.addPrintBase) {
    const basePlatGeo = new THREE.CylinderGeometry(1.55, 1.72, 0.22, 48);
    const basePlatMat = new THREE.MeshStandardMaterial({
      color: "#334155",
      roughness: 0.45,
      metalness: 0.15,
    });
    const basePlat = new THREE.Mesh(basePlatGeo, basePlatMat);
    basePlat.name = "AddBaseStlPlatform";
    basePlat.position.set(0, -1.08, 0);
    group.add(basePlat);

    const rimGeo = new THREE.TorusGeometry(1.56, 0.035, 12, 48);
    rimGeo.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, accentMat.clone());
    rimMesh.name = "AddBaseStlPlatform_Rim";
    rimMesh.position.set(0, -0.97, 0);
    group.add(rimMesh);
  }

  // Meshy Decal Tool (pmDecalSpace 3D Projected Decal Emblem)
  if (overrides?.decalEnabled) {
    const dScale = overrides.decalScale ?? 1.0;
    const dRot = ((overrides.decalRotation ?? 0) * Math.PI) / 180;
    const dColor = overrides.decalColor || "#22d3ee";
    const decalMat = new THREE.MeshStandardMaterial({
      color: dColor,
      emissive: new THREE.Color(dColor),
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.6,
    });
    const badgeGeo = new THREE.CylinderGeometry(0.28 * dScale, 0.28 * dScale, 0.04, 6);
    badgeGeo.rotateX(Math.PI / 2);
    const badge = new THREE.Mesh(badgeGeo, decalMat);
    badge.name = "Part_Decal_Projected_Emblem";
    badge.position.set(0, 0.62, 0.56);
    badge.rotation.z = dRot;
    group.add(badge);
  }

  // Meshy Art Style Overrides: Voxel Mode / Bas-Relief / 3D Text Extruder
  if (overrides?.artStyleMode === "voxel") {
    const voxelGroup = new THREE.Group();
    voxelGroup.name = group.name + "_Voxelized";
    const vSize = 0.22;
    const boxGeo = new THREE.BoxGeometry(vSize * 0.94, vSize * 0.94, vSize * 0.94);
    const vCoords: [number, number, number, boolean][] = [
      // Core Torso Voxels
      [0, 0.2, 0, false], [0, 0.42, 0, false], [0, 0.64, 0, true], [0, 0.86, 0, false],
      [-0.22, 0.42, 0, false], [0.22, 0.42, 0, false], [-0.22, 0.64, 0, false], [0.22, 0.64, 0, false],
      [0, 0.42, 0.22, true], [0, 0.64, 0.22, true],
      // Head & Crown Voxels
      [0, 1.08, 0, false], [-0.22, 1.08, 0, false], [0.22, 1.08, 0, false],
      [0, 1.3, 0, true], [-0.22, 1.3, 0, true], [0.22, 1.3, 0, true], [0, 1.52, 0, true],
      // Arms & Shoulders Voxels
      [-0.44, 0.86, 0, true], [0.44, 0.86, 0, true],
      [-0.66, 0.64, 0, false], [0.66, 0.64, 0, false],
      [-0.66, 0.42, 0.22, false], [0.66, 0.42, 0.22, false],
      // Legs & Base Voxels
      [-0.22, -0.02, 0, false], [0.22, -0.02, 0, false],
      [-0.22, -0.24, 0, false], [0.22, -0.24, 0, false],
      [-0.22, -0.46, 0, true], [0.22, -0.46, 0, true],
      [-0.22, -0.68, 0.12, false], [0.22, -0.68, 0.12, false],
    ];
    vCoords.forEach(([vx, vy, vz, isAccent], idx) => {
      const m = new THREE.Mesh(boxGeo, isAccent ? accentMat.clone() : mainMat.clone());
      m.position.set(vx, vy, vz);
      m.name = `Voxel_Block_${idx + 1}`;
      voxelGroup.add(m);
    });
    group.clear();
    voxelGroup.children.slice().forEach((c) => group.add(c));
  } else if (overrides?.artStyleMode === "relief") {
    const rDepth = overrides.reliefDepth ?? 0.65;
    group.clear();
    const plateGeo = new THREE.CylinderGeometry(1.45, 1.45, 0.14, 48);
    plateGeo.rotateX(Math.PI / 2);
    const plate = new THREE.Mesh(plateGeo, darkMat.clone());
    plate.name = "Relief_01_Backing_Medallion";
    plate.position.set(0, 0.45, -0.15);
    group.add(plate);

    const frameGeo = new THREE.TorusGeometry(1.42, 0.08, 16, 48);
    const frame = new THREE.Mesh(frameGeo, accentMat.clone());
    frame.name = "Relief_02_Ornate_Border";
    frame.position.set(0, 0.45, -0.06);
    group.add(frame);

    const bossGeo = new THREE.IcosahedronGeometry(0.78, 2);
    bossGeo.scale(1.0, 1.15, 0.35 * rDepth);
    const boss = new THREE.Mesh(bossGeo, mainMat.clone());
    boss.name = "Relief_03_Embossed_Sculpt";
    boss.position.set(0, 0.45, 0.08);
    group.add(boss);
  } else if (overrides?.artStyleMode === "text3d") {
    const tDepth = overrides.text3dDepth ?? 0.45;
    const rawText = (overrides.text3dContent || "PRISM3D").slice(0, 8).toUpperCase();
    group.clear();

    const cw = 84;
    const ch = 24;
    const cvs = document.createElement("canvas");
    cvs.width = cw;
    cvs.height = ch;
    const ctx = cvs.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 16px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rawText, cw / 2, ch / 2 + 1);
      const imgData = ctx.getImageData(0, 0, cw, ch).data;
      const cell = 0.042;
      const barGeo = new THREE.BoxGeometry(cell * 0.96, cell * 0.96, tDepth);
      const pixelGroup = new THREE.Group();
      pixelGroup.name = "Text3D_Extruded_Typography";
      let minX = Infinity;
      let maxX = -Infinity;
      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          const alpha = imgData[(py * cw + px) * 4 + 3];
          if (alpha > 110) {
            const wx = (px - cw / 2) * cell;
            const wy = (ch / 2 - py) * cell + 0.48;
            if (wx < minX) minX = wx;
            if (wx > maxX) maxX = wx;
            const isRim = alpha < 200;
            const voxelMesh = new THREE.Mesh(
              barGeo,
              isRim ? accentMat : mainMat
            );
            voxelMesh.position.set(wx, wy, 0);
            pixelGroup.add(voxelMesh);
          }
        }
      }
      group.add(pixelGroup);
      const spanW = Number.isFinite(maxX - minX) ? Math.max(1.4, maxX - minX + 0.45) : 2.6;
      const plinthGeo = new THREE.BoxGeometry(spanW, 0.18, tDepth + 0.25);
      const plinth = new THREE.Mesh(plinthGeo, darkMat.clone());
      plinth.name = "Text3D_Bevel_Plinth";
      plinth.position.set(0, -0.04, 0);
      group.add(plinth);
    }
  }

  // Apply Pose Preset (T-Pose / A-Pose / Battle Pose) to Arm/Wing limbs
  const pose = overrides?.posePreset || "bind";
  if (pose !== "bind") {
    group.children.forEach((child) => {
      if (child.name.includes("Arm") || child.name.includes("Wing")) {
        const isLeft = child.position.x < 0;
        const sign = isLeft ? -1 : 1;
        if (pose === "t_pose") {
          child.rotation.z = sign * (Math.PI / 2);
          child.position.y = 0.82;
        } else if (pose === "a_pose") {
          child.rotation.z = sign * 0.55;
          child.position.y = 0.68;
        } else if (pose === "battle") {
          child.rotation.x = -0.65;
          child.rotation.z = sign * 0.35;
        }
      }
    });
  }

  // Apply Segmentation Explode Offset & Visibility & Custom Overrides
  const explode = overrides?.explodeFactor || 0;
  const hiddenSet = new Set(overrides?.hiddenParts || []);

  group.children.forEach((child, index) => {
    child.visible = !hiddenSet.has(index);
    if (explode > 0) {
      const dir = child.position.clone();
      if (dir.lengthSq() < 0.01) {
        dir.set(0, 1, 0);
      } else {
        dir.normalize();
      }
      child.position.addScaledVector(dir, explode * 1.15);
    }
  });

  if (overrides?.transform) {
    group.scale.set(
      overrides.transform.scaleX,
      overrides.transform.scaleY,
      overrides.transform.scaleZ
    );
  }

  return group;
}

export default function Viewport3D({
  activeTask,
  isGenerating,
  generationProgress,
  generationStepLabel,
  studioOverrides,
  onPartNamesChange,
}: Viewport3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const rigHelperRef = useRef<THREE.Group | null>(null);
  const lastPartNamesKeyRef = useRef<string>("");
  const onPartNamesChangeRef = useRef(onPartNamesChange);
  onPartNamesChangeRef.current = onPartNamesChange;

  const [shadingMode, setShadingMode] = useState<RenderShadingMode>("pbr");
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showRigBones, setShowRigBones] = useState<boolean>(false);
  const [lightIntensity, setLightIntensity] = useState<number>(1.0);
  const [selectedPart, setSelectedPart] = useState<{ index: number; name: string } | null>(
    null
  );
  const partPaintMapRef = useRef<Record<number, string>>({});
  const [expandRefImg, setExpandRefImg] = useState(false);
  const decalHitPosRef = useRef<[number, number, number] | null>(null);
  const cameraStateRef = useRef<{
    taskId: string;
    pos: [number, number, number];
    target: [number, number, number];
  } | null>(null);
  const glbCacheRef = useRef<Map<string, THREE.Group>>(new Map());
  const texCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const getFlattenedMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
    const list: THREE.Mesh[] = [];
    root.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) list.push(c as THREE.Mesh);
    });
    return list;
  };

  const handlePaintSelectedPart = (hexColor: string | null) => {
    if (!selectedPart || !meshGroupRef.current) return;
    const meshes = getFlattenedMeshes(meshGroupRef.current);
    const child = meshes[selectedPart.index];
    if (!child || !child.isMesh) return;
    if (hexColor === null) {
      delete partPaintMapRef.current[selectedPart.index];
    } else {
      partPaintMapRef.current[selectedPart.index] = hexColor;
      const mat = child.material as THREE.MeshStandardMaterial;
      if (mat && mat.color) {
        mat.color.set(hexColor);
        mat.needsUpdate = true;
      }
    }
  };

  const handleToggleSelectedPartVisible = () => {
    if (!selectedPart || !meshGroupRef.current) return;
    const meshes = getFlattenedMeshes(meshGroupRef.current);
    const child = meshes[selectedPart.index];
    if (child) {
      child.visible = !child.visible;
    }
  };

  // Sync external studio overrides into viewport modes when toggled from left rail
  const effectiveShowRig = studioOverrides?.showRig || showRigBones;
  const effectiveShading: RenderShadingMode = studioOverrides?.printCheckMode
    ? "printability"
    : studioOverrides?.uvCheckerMode
      ? "uv_checker"
      : studioOverrides?.segmentColorMode
        ? "segment"
        : studioOverrides?.viewChannel
          ? studioOverrides.viewChannel
          : shadingMode;

  const overridesKey = JSON.stringify(studioOverrides || {});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    const hdri = studioOverrides?.hdriPreset || "studio";
    const bgHex =
      hdri === "outdoor"
        ? "#0c192c"
        : hdri === "indoor"
          ? "#121324"
          : hdri === "cyber"
            ? "#050814"
            : "#090709";
    scene.background = new THREE.Color(bgHex);

    const fov = studioOverrides?.cameraFov ?? 38;
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
    camera.position.set(0.35, 1.15, 4.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envMap = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envMap;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.15, 0);

    const activeTaskId = activeTask?.id || "default_preview";
    if (cameraStateRef.current && cameraStateRef.current.taskId === activeTaskId) {
      camera.position.set(...cameraStateRef.current.pos);
      controls.target.set(...cameraStateRef.current.target);
      controls.update();
    }

    if (studioOverrides?.showGrid !== false) {
      const grid = new THREE.GridHelper(12, 24, "#3b1219", "#17090c");
      grid.position.y = -1.0;
      scene.add(grid);
    }

    const hdriRotRad = ((studioOverrides?.hdriRotation ?? 0) * Math.PI) / 180;
    const ambientLight = new THREE.AmbientLight(
      hdri === "outdoor" ? "#bae6fd" : hdri === "indoor" ? "#fde68a" : "#ffffff",
      0.24 * lightIntensity
    );
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      "#ffffff",
      "#18090c",
      0.38 * lightIntensity
    );
    hemiLight.position.set(0, 8, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.85 * lightIntensity);
    keyLight.position.set(
      Math.cos(hdriRotRad) * 3.5 + 2.2,
      4.8,
      Math.sin(hdriRotRad) * 3.5 + 4.2
    );
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#ffe4e6", 0.35 * lightIntensity);
    fillLight.position.set(-3.5, 1.5, 3.0);
    scene.add(fillLight);

    const rimColor =
      hdri === "cyber" ? "#ec4899" : hdri === "outdoor" ? "#38bdf8" : "#f43f5e";
    const rimLight = new THREE.DirectionalLight(rimColor, 0.75 * lightIntensity);
    rimLight.position.set(-Math.cos(hdriRotRad) * 4, 3.0, -4.0);
    scene.add(rimLight);

    const currentTask: GenerationTaskRecord = activeTask || {
      id: "default_preview",
      user_id: "demo",
      stage: "refine_pbr",
      engine: "trellis_pbr",
      mode: "text_to_3d",
      prompt_th: "หุ่นยนต์ยักษ์วัดแจ้งเกราะมรกต",
      prompt_en: "Wat Arun Guardian Mecha",
      input_image_url: null,
      status: "completed",
      cost_credits: 8,
      refunded: 0,
      target_poly_count: 18000,
      topology: "quad",
      has_pbr: 1,
      has_rig: 1,
      preset_type: "mecha",
      primary_color: "#ef4444",
      accent_color: "#f59e0b",
      roughness: 0.22,
      metalness: 0.85,
      output_glb_url: null,
      created_at: new Date().toISOString(),
    };

    const assetGroup = buildProceduralGameAsset(currentTask, studioOverrides);
    scene.add(assetGroup);
    meshGroupRef.current = assetGroup;

    if (onPartNamesChangeRef.current) {
      const names = assetGroup.children.map(
        (c, idx) => c.name || `Mesh_Part_${idx + 1}`
      );
      const namesKey = names.join("|");
      if (namesKey !== lastPartNamesKeyRef.current) {
        lastPartNamesKeyRef.current = namesKey;
        onPartNamesChangeRef.current(names);
      }
    }

    // Apply Meshy ViewSwitcher Channel & Shading Smoothness Overrides
    const uvCheckerTex =
      effectiveShading === "uv_checker" ? createUvCheckerTexture() : null;
    const smoothness = studioOverrides?.shadingSmoothness || "auto";
    const isFlat = smoothness === "flat";

    const applyShadingToGroup = (targetGrp: THREE.Object3D, applyPbrColors = false) => {
      let partIdx = 0;
      const pHex = studioOverrides?.material.primaryColor || currentTask.primary_color || "#ef4444";
      const rVal = studioOverrides?.material.roughness ?? currentTask.roughness ?? 0.25;
      const mVal = studioOverrides?.material.metalness ?? currentTask.metalness ?? 0.85;

      targetGrp.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (
            mesh.name === "Part_Relief_Medallion_Plate" ||
            ((effectiveShading === "pbr" || effectiveShading === "base_color") &&
              (mesh.name.startsWith("Part_Filled_") ||
                mesh.name.startsWith("AddBaseStlPlatform") ||
                mesh.name.startsWith("Part_Decal_") ||
                mesh.name.endsWith("_Voxel")))
          ) {
            return;
          }
          if (effectiveShading === "wireframe") {
            mesh.material = new THREE.MeshStandardMaterial({
              color: "#f87171",
              wireframe: true,
              roughness: 0.4,
            });
          } else if (effectiveShading === "clay") {
            mesh.material = new THREE.MeshStandardMaterial({
              color: "#e2e8f0",
              roughness: 0.58,
              metalness: 0.08,
              flatShading: isFlat,
            });
          } else if (effectiveShading === "base_color") {
            const prevMat = mesh.material as THREE.MeshStandardMaterial;
            if (prevMat?.map) {
              mesh.material = new THREE.MeshBasicMaterial({
                map: prevMat.map,
                color: "#ffffff",
              });
            } else {
              const origColor = prevMat?.color || new THREE.Color(pHex);
              mesh.material = new THREE.MeshBasicMaterial({
                color: origColor,
              });
            }
          } else if (effectiveShading === "normal") {
            mesh.material = new THREE.MeshNormalMaterial({
              flatShading: isFlat,
            });
          } else if (effectiveShading === "metallic") {
            const prevMat = mesh.material as THREE.MeshStandardMaterial;
            const gray = Math.round(mVal * 255);
            mesh.material = new THREE.MeshStandardMaterial({
              map: prevMat?.metalnessMap || prevMat?.map || null,
              color: new THREE.Color(`rgb(${gray},${gray},${gray})`),
              metalness: Math.max(0.65, mVal),
              roughness: 0.22,
              flatShading: isFlat,
            });
          } else if (effectiveShading === "roughness") {
            const prevMat = mesh.material as THREE.MeshStandardMaterial;
            const gray = Math.round(rVal * 255);
            mesh.material = new THREE.MeshStandardMaterial({
              map: prevMat?.roughnessMap || prevMat?.map || null,
              color: new THREE.Color(`rgb(${gray},${gray},${gray})`),
              roughness: rVal,
              metalness: 0.08,
              flatShading: isFlat,
            });
          } else if (effectiveShading === "ao_curvature") {
            mesh.material = new THREE.MeshStandardMaterial({
              color: "#cbd5e1",
              roughness: 0.85,
              metalness: 0.05,
              emissive: new THREE.Color("#0f172a"),
              emissiveIntensity: 0.35,
              flatShading: true,
            });
          } else if (effectiveShading === "uv_checker" && uvCheckerTex) {
            mesh.material = new THREE.MeshStandardMaterial({
              map: uvCheckerTex,
              roughness: 0.4,
              metalness: 0.1,
            });
          } else if (effectiveShading === "segment") {
            const segColor = SEGMENT_PALETTE[partIdx % SEGMENT_PALETTE.length];
            partIdx++;
            mesh.material = new THREE.MeshStandardMaterial({
              color: segColor,
              roughness: 0.35,
              metalness: 0.2,
              emissive: new THREE.Color(segColor),
              emissiveIntensity: 0.15,
              flatShading: isFlat,
            });
          } else if (effectiveShading === "printability") {
            const isOverhangCandidate =
              mesh.name.includes("Arm") ||
              mesh.name.includes("Wing") ||
              (mesh.position.y > 0.35 && Math.abs(mesh.position.x) > 0.55);
            mesh.material = new THREE.MeshStandardMaterial({
              color: isOverhangCandidate ? "#f43f5e" : "#10b981",
              roughness: 0.4,
              metalness: 0.1,
              emissive: new THREE.Color(isOverhangCandidate ? "#e11d48" : "#059669"),
              emissiveIntensity: 0.22,
              flatShading: true,
            });
          } else if (effectiveShading === "filament_sim") {
            const filPreset = studioOverrides?.filamentPreset || "pla";
            const filColor = studioOverrides?.filamentColor || "#ef4444";
            mesh.material = new THREE.MeshStandardMaterial({
              color: filColor,
              roughness:
                filPreset === "silk"
                  ? 0.16
                  : filPreset === "petg"
                    ? 0.28
                    : filPreset === "resin"
                      ? 0.35
                      : 0.55,
              metalness: filPreset === "silk" ? 0.65 : 0.08,
              flatShading: isFlat,
            });
          } else if (applyPbrColors) {
            const stdMat = mesh.material as THREE.MeshStandardMaterial;
            const emInt = studioOverrides?.material.emissiveIntensity ?? 0;
            const hasNativeMaps =
              stdMat &&
              (stdMat.map ||
                stdMat.normalMap ||
                stdMat.metalnessMap ||
                stdMat.roughnessMap ||
                currentTask.output_glb_url?.includes("dragon_crystal"));
            if (!hasNativeMaps) {
              const aiColor =
                studioOverrides?.material.primaryColor ||
                (currentTask.output_glb_url ? "#d6d3d1" : pHex);
              const aiRoughness =
                studioOverrides?.material.roughness ??
                (currentTask.output_glb_url ? 0.42 : rVal);
              const aiMetalness =
                studioOverrides?.material.metalness ??
                (currentTask.output_glb_url ? 0.18 : Math.min(mVal, 0.35));
              mesh.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(aiColor),
                roughness: aiRoughness,
                metalness: aiMetalness,
                emissive: new THREE.Color(
                  emInt > 0.08
                    ? studioOverrides?.material.accentColor || "#f59e0b"
                    : "#000000"
                ),
                emissiveIntensity: emInt > 0.08 ? emInt * 0.45 : 0,
                flatShading: isFlat,
              });
            } else {
              // Native-textured GLB (Pro Studio / Standard PBR): preserve baked texture map while supporting live PBR/Tint overrides
              const customTint = studioOverrides?.material.primaryColor;
              const isDefaultTint =
                !customTint ||
                customTint.toLowerCase() === "#ef4444" ||
                customTint.toLowerCase() === "#d6d3d1" ||
                customTint.toLowerCase() === "#ffffff" ||
                customTint.toLowerCase() === (currentTask.primary_color || "").toLowerCase();
              if (!currentTask.output_glb_url?.includes("dragon_crystal")) {
                stdMat.color.set(isDefaultTint ? "#ffffff" : customTint);
              } else if (!isDefaultTint && customTint) {
                stdMat.color.set(customTint);
              }
              if (
                studioOverrides?.material.roughness !== undefined &&
                studioOverrides.material.roughness !== 0.25
              ) {
                stdMat.roughness = studioOverrides.material.roughness;
              }
              if (
                studioOverrides?.material.metalness !== undefined &&
                studioOverrides.material.metalness !== 0.85
              ) {
                stdMat.metalness = studioOverrides.material.metalness;
              }
              const forceFaceted =
                isFlat ||
                studioOverrides?.artStyleMode === "voxel" ||
                (studioOverrides?.material.polyMultiplier ?? 1) <= 0.5;
              if (!isDefaultTint && customTint) {
                stdMat.emissive = new THREE.Color(customTint);
                stdMat.emissiveIntensity = Math.max(0.24, emInt * 0.5);
              } else if (emInt > 0.08) {
                stdMat.emissive = new THREE.Color(
                  studioOverrides?.material.accentColor || "#f59e0b"
                );
                stdMat.emissiveIntensity = emInt * 0.45;
              }
              stdMat.flatShading = forceFaceted;
              stdMat.needsUpdate = true;
            }
          } else if (isFlat && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = mesh.material as THREE.MeshStandardMaterial;
            stdMat.flatShading = true;
            stdMat.needsUpdate = true;
          }
        }
      });
    };

    applyShadingToGroup(assetGroup, false);

    const isSpecialArtMode = studioOverrides?.artStyleMode === "text3d";

    const partSpecs = [
      {
        name: "Part_01_Head_Hood",
        explodeDir: new THREE.Vector3(0, 0.55, 0),
        pivot: [0, 0.22, 0] as [number, number, number],
      },
      {
        name: "Part_02_Torso_Cloak",
        explodeDir: new THREE.Vector3(0, 0.05, 0.25),
        pivot: [0, 0.02, 0] as [number, number, number],
      },
      {
        name: "Part_03_Left_Arm",
        explodeDir: new THREE.Vector3(-0.55, 0.1, 0),
        pivot: [-0.18, 0.18, 0] as [number, number, number],
      },
      {
        name: "Part_04_Right_Arm_Weapon",
        explodeDir: new THREE.Vector3(0.55, 0.1, 0),
        pivot: [0.18, 0.18, 0] as [number, number, number],
      },
      {
        name: "Part_05_Left_Leg",
        explodeDir: new THREE.Vector3(-0.28, -0.5, 0),
        pivot: [-0.1, -0.15, 0] as [number, number, number],
      },
      {
        name: "Part_06_Right_Leg",
        explodeDir: new THREE.Vector3(0.28, -0.5, 0),
        pivot: [0.1, -0.15, 0] as [number, number, number],
      },
    ];

    const mountConfiguredGlbScene = (baseTemplate: THREE.Group) => {
      const loadedRoot = new THREE.Group();
      loadedRoot.name = `AI_GLB_${currentTask.id}`;

      const sceneInstance = baseTemplate.clone(true);
      const hasNativeTexture = !!baseTemplate.userData.hasNativeTexture;
      const explodeAmt = studioOverrides?.explodeFactor || 0;
      const hiddenSet = new Set(studioOverrides?.hiddenParts || []);
      const pose = studioOverrides?.posePreset || "bind";
      const invNormScale = baseTemplate.userData.invNormScale || 1;

      // Build live 10-Bone Humanoid THREE.Skeleton if template has boneRestDefs
      const boneRestDefs = baseTemplate.userData.boneRestDefs as
        | { name: string; parent: number; pos: [number, number, number] }[]
        | undefined;
      let liveBones: THREE.Bone[] | null = null;
      let liveSkeleton: THREE.Skeleton | null = null;

      if (boneRestDefs && boneRestDefs.length > 0) {
        liveBones = boneRestDefs.map((def) => {
          const b = new THREE.Bone();
          b.name = def.name;
          return b;
        });
        boneRestDefs.forEach((def, idx) => {
          const b = liveBones![idx];
          if (def.parent === -1) {
            b.position.set(def.pos[0], def.pos[1], def.pos[2]);
          } else {
            const pDef = boneRestDefs[def.parent];
            b.position.set(
              def.pos[0] - pDef.pos[0],
              def.pos[1] - pDef.pos[1],
              def.pos[2] - pDef.pos[2]
            );
            liveBones![def.parent].add(b);
          }
        });
        sceneInstance.add(liveBones[0]);
        sceneInstance.updateMatrixWorld(true);
        liveSkeleton = new THREE.Skeleton(liveBones);
        loadedRoot.userData.bones = liveBones;
        loadedRoot.userData.skeleton = liveSkeleton;
      }

      const rawMeshes: THREE.Mesh[] = [];
      sceneInstance.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          rawMeshes.push(obj as THREE.Mesh);
        }
      });

      rawMeshes.forEach((m, pIdx) => {
        const clonedMat = Array.isArray(m.material)
          ? m.material[0].clone()
          : m.material.clone();

        let targetMesh: THREE.Mesh = m;
        if (
          liveSkeleton &&
          m.geometry &&
          m.geometry.attributes.skinIndex &&
          m.geometry.attributes.skinWeight &&
          m.parent
        ) {
          const skinned = new THREE.SkinnedMesh(m.geometry, clonedMat);
          skinned.name = m.name;
          skinned.bindMode = THREE.DetachedBindMode;
          m.parent.add(skinned);
          m.parent.remove(m);
          skinned.updateMatrixWorld(true);
          skinned.bind(liveSkeleton, skinned.matrixWorld);
          targetMesh = skinned;
        } else {
          m.material = clonedMat;
        }

        targetMesh.visible = !hiddenSet.has(pIdx);

        if (pIdx < partSpecs.length && explodeAmt > 0) {
          targetMesh.position.addScaledVector(
            partSpecs[pIdx].explodeDir,
            explodeAmt * invNormScale
          );
        }
      });

      // Apply calibration pose to real THREE.Bone hierarchy if present
      if (liveBones && liveBones.length >= 10 && pose !== "bind") {
        const leftArm = liveBones[4];
        const leftForeArm = liveBones[5];
        const rightArm = liveBones[6];
        const rightForeArm = liveBones[7];
        if (pose === "t_pose") {
          leftArm.rotation.set(0, 0, -0.32);
          rightArm.rotation.set(0, 0, 0.32);
        } else if (pose === "a_pose") {
          leftArm.rotation.set(0, 0, -0.16);
          rightArm.rotation.set(0, 0, 0.16);
        } else if (pose === "battle") {
          leftArm.rotation.set(-0.35, 0, -0.12);
          leftForeArm.rotation.set(-0.28, 0, 0);
          rightArm.rotation.set(-0.42, 0, 0.12);
          rightForeArm.rotation.set(-0.32, 0, 0);
        }
      }

      if (studioOverrides?.artStyleMode === "relief") {
        const depth = studioOverrides.reliefDepth ?? 0.65;
        sceneInstance.scale.z *= 0.22 * depth;
        const backingGeo = new THREE.CylinderGeometry(1.38, 1.44, 0.14, 64);
        backingGeo.rotateX(Math.PI / 2);
        const backingMat = new THREE.MeshStandardMaterial({
          color: "#27171c",
          roughness: 0.35,
          metalness: 0.78,
        });
        const backing = new THREE.Mesh(backingGeo, backingMat);
        backing.name = "Part_Relief_Medallion_Plate";
        backing.position.set(0, 0.15, -0.18);
        loadedRoot.add(backing);
      } else if (studioOverrides?.artStyleMode === "voxel") {
        // Real 3D Voxelizer on loaded GLB geometry
        const vStep = 0.11;
        const occupied = new Map<string, [number, number, number, number]>();
        sceneInstance.updateMatrixWorld(true);
        const tmpV = new THREE.Vector3();
        let partCounter = 0;
        sceneInstance.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.visible) {
            const m = child as THREE.Mesh;
            const pos = m.geometry?.attributes?.position;
            if (!pos) return;
            const pIdx = partCounter++;
            const stride = Math.max(1, Math.floor(pos.count / 900));
            for (let i = 0; i < pos.count; i += stride) {
              tmpV.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
              const gx = Math.round(tmpV.x / vStep);
              const gy = Math.round(tmpV.y / vStep);
              const gz = Math.round(tmpV.z / vStep);
              const key = `${gx},${gy},${gz}`;
              if (!occupied.has(key)) {
                occupied.set(key, [gx * vStep, gy * vStep, gz * vStep, pIdx]);
              }
            }
          }
        });
        if (occupied.size > 0) {
          const voxGroup = new THREE.Group();
          voxGroup.name = "GLB_Voxelized_Blocks";
          const cubeGeo = new THREE.BoxGeometry(vStep * 0.92, vStep * 0.92, vStep * 0.92);
          const voxPalette = [
            studioOverrides?.material.primaryColor &&
            studioOverrides.material.primaryColor !== "#d6d3d1"
              ? studioOverrides.material.primaryColor
              : currentTask.primary_color || "#b45309",
            currentTask.accent_color || "#78716c",
            "#57534e",
            "#a8a29e",
            "#44403c",
            "#78350f",
          ];
          const voxMats = voxPalette.map(
            (hex) =>
              new THREE.MeshStandardMaterial({
                color: hex,
                roughness: 0.45,
                metalness: 0.25,
                flatShading: true,
              })
          );
          occupied.forEach(([vx, vy, vz, pIdx]) => {
            const cube = new THREE.Mesh(cubeGeo, voxMats[pIdx % voxMats.length]);
            cube.position.set(vx, vy, vz);
            cube.name = `Part_0${(pIdx % 6) + 1}_Voxel`;
            voxGroup.add(cube);
          });
          sceneInstance.visible = false;
          loadedRoot.add(voxGroup);
        }
      }

      loadedRoot.add(sceneInstance);

      // Attach Fill Parts, 3D Print Base Platform, and 3D Decal onto loadedRoot so all 14 tools work on real GLBs
      const addonAccentMat = new THREE.MeshStandardMaterial({
        color: studioOverrides?.material.accentColor || currentTask.accent_color || "#f59e0b",
        roughness: 0.25,
        metalness: 0.85,
      });
      const addonDarkMat = new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.45,
        metalness: 0.35,
      });
      if (studioOverrides?.filledParts.auraRing) {
        const haloGeo = new THREE.TorusGeometry(1.15, 0.04, 16, 48);
        const halo = new THREE.Mesh(haloGeo, addonAccentMat);
        halo.name = "Part_Filled_Cyber_Halo_Ring";
        halo.position.set(0, 0.45, -0.35);
        loadedRoot.add(halo);
      }
      if (studioOverrides?.filledParts.backWings) {
        for (const side of [-1, 1]) {
          const wingGeo = new THREE.BoxGeometry(0.85, 0.95, 0.07);
          const wing = new THREE.Mesh(wingGeo, addonAccentMat.clone());
          wing.name = side < 0 ? "Part_Filled_Left_Wing" : "Part_Filled_Right_Wing";
          wing.position.set(side * 0.95, 0.4, -0.4);
          wing.rotation.z = side * 0.35;
          wing.rotation.y = side * -0.25;
          loadedRoot.add(wing);
        }
      }
      if (studioOverrides?.filledParts.pedestal) {
        const pedGeo = new THREE.CylinderGeometry(1.25, 1.4, 0.16, 32);
        const ped = new THREE.Mesh(pedGeo, addonDarkMat);
        ped.name = "Part_Filled_Display_Pedestal";
        ped.position.set(0, -0.98, 0);
        loadedRoot.add(ped);
      }
      if (studioOverrides?.addPrintBase) {
        const basePlatGeo = new THREE.CylinderGeometry(1.35, 1.5, 0.2, 48);
        const basePlat = new THREE.Mesh(basePlatGeo, addonDarkMat.clone());
        basePlat.name = "AddBaseStlPlatform";
        basePlat.position.set(0, -1.0, 0);
        loadedRoot.add(basePlat);
      }
      if (studioOverrides?.decalEnabled) {
        const dScale = studioOverrides.decalScale ?? 1.0;
        const dRot = ((studioOverrides.decalRotation ?? 0) * Math.PI) / 180;
        const dColor = studioOverrides.decalColor || "#22d3ee";
        const decalMat = new THREE.MeshStandardMaterial({
          color: dColor,
          emissive: new THREE.Color(dColor),
          emissiveIntensity: 0.45,
          roughness: 0.2,
          metalness: 0.6,
        });
        const badgeGeo = new THREE.CylinderGeometry(0.17 * dScale, 0.17 * dScale, 0.04, 6);
        badgeGeo.rotateX(Math.PI / 2);
        const badge = new THREE.Mesh(badgeGeo, decalMat);
        badge.name = "Part_Decal_Projected_Emblem";
        const hitPos = decalHitPosRef.current || [0, 0.34, 0.42];
        badge.position.set(hitPos[0], hitPos[1], hitPos[2]);
        badge.rotation.z = dRot;
        loadedRoot.add(badge);
      }

      if (studioOverrides?.transform) {
        loadedRoot.scale.set(
          studioOverrides.transform.scaleX,
          studioOverrides.transform.scaleY,
          studioOverrides.transform.scaleZ
        );
      }

      applyShadingToGroup(loadedRoot, true);

      const applyProjectedTexAndCustomPaint = (projTex: THREE.CanvasTexture | null) => {
        const customPrimary = studioOverrides?.material.primaryColor;
        const useCustomTint =
          customPrimary &&
          customPrimary.toLowerCase() !== "#d6d3d1" &&
          customPrimary.toLowerCase() !== "#ffffff";
        const emInt = studioOverrides?.material.emissiveIntensity ?? 0;

        if (projTex && (effectiveShading === "pbr" || effectiveShading === "base_color")) {
          loadedRoot.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              if (
                m.name.startsWith("Part_Filled_") ||
                m.name.startsWith("AddBaseStlPlatform") ||
                m.name.startsWith("Part_Decal_")
              ) {
                return;
              }
              const tintColor = useCustomTint ? customPrimary : "#ffffff";
              if (effectiveShading === "base_color") {
                m.material = new THREE.MeshBasicMaterial({
                  map: projTex,
                  color: tintColor,
                });
              } else if (effectiveShading === "pbr") {
                m.material = new THREE.MeshStandardMaterial({
                  map: projTex,
                  color: tintColor,
                  roughness: studioOverrides?.material.roughness ?? 0.45,
                  metalness: studioOverrides?.material.metalness ?? 0.16,
                  emissive: new THREE.Color(
                    emInt > 0.08
                      ? studioOverrides?.material.accentColor || "#f59e0b"
                      : "#000000"
                  ),
                  emissiveIntensity: emInt > 0.08 ? emInt * 0.45 : 0,
                  flatShading: isFlat,
                });
              }
            }
          });
        }

        // Re-apply per-part custom paint colors from Brush/Decal or Floating HUD
        const allMeshes = getFlattenedMeshes(loadedRoot);
        allMeshes.forEach((m, idx) => {
          const paintedHex = partPaintMapRef.current[idx];
          if (paintedHex && (m.material as THREE.MeshStandardMaterial)?.color) {
            (m.material as THREE.MeshStandardMaterial).color.set(paintedHex);
            (m.material as THREE.MeshStandardMaterial).needsUpdate = true;
          }
        });
      };

      // Project 2D Reference Image Texture ONLY for untextured clay GLBs (!hasNativeTexture)
      if (
        !hasNativeTexture &&
        currentTask.input_image_url &&
        (effectiveShading === "pbr" || effectiveShading === "base_color")
      ) {
        const cachedTex = texCacheRef.current.get(currentTask.input_image_url);
        if (cachedTex) {
          applyProjectedTexAndCustomPaint(cachedTex);
        } else {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const natW = img.naturalWidth || 512;
            const natH = img.naturalHeight || 512;
            const isTurnaroundSheet = natW > natH * 1.35;

            const extractSubViewToCanvas = (
              sx: number,
              sy: number,
              sw: number,
              sh: number,
              forBackFallback: boolean
            ) => {
              const W = 512;
              const H = 512;
              const c = document.createElement("canvas");
              c.width = W;
              c.height = H;
              const ctx = c.getContext("2d");
              if (!ctx) return c;
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
              const imgData = ctx.getImageData(0, 0, W, H);
              const d = imgData.data;

              const bgR =
                (d[0] +
                  d[(W - 1) * 4] +
                  d[(H - 1) * W * 4] +
                  d[((H - 1) * W + (W - 1)) * 4]) *
                0.25;
              const bgG =
                (d[1] +
                  d[(W - 1) * 4 + 1] +
                  d[(H - 1) * W * 4 + 1] +
                  d[((H - 1) * W + (W - 1)) * 4 + 1]) *
                0.25;
              const bgB =
                (d[2] +
                  d[(W - 1) * 4 + 2] +
                  d[(H - 1) * W * 4 + 2] +
                  d[((H - 1) * W + (W - 1)) * 4 + 2]) *
                0.25;
              const bgA =
                (d[3] +
                  d[(W - 1) * 4 + 3] +
                  d[(H - 1) * W * 4 + 3] +
                  d[((H - 1) * W + (W - 1)) * 4 + 3]) *
                0.25;

              let fgMinX = W;
              let fgMaxX = 0;
              let fgMinY = H;
              let fgMaxY = 0;
              const isFg = new Uint8Array(W * H);

              for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                  const idx = (y * W + x) * 4;
                  const a = d[idx + 3];
                  const dist =
                    Math.abs(d[idx] - bgR) +
                    Math.abs(d[idx + 1] - bgG) +
                    Math.abs(d[idx + 2] - bgB);
                  if (a > 30 && (bgA < 40 || dist > 42)) {
                    isFg[y * W + x] = 1;
                    if (x < fgMinX) fgMinX = x;
                    if (x > fgMaxX) fgMaxX = x;
                    if (y < fgMinY) fgMinY = y;
                    if (y > fgMaxY) fgMaxY = y;
                  }
                }
              }

              // Horizontal color dilation so silhouette edges never sample background pixels
              for (let y = 0; y < H; y++) {
                let lastR = 140,
                  lastG = 90,
                  lastB = 70;
                for (let x = 0; x < W; x++) {
                  const p = y * W + x;
                  const idx = p * 4;
                  if (isFg[p]) {
                    lastR = d[idx];
                    lastG = d[idx + 1];
                    lastB = d[idx + 2];
                  } else {
                    d[idx] = lastR;
                    d[idx + 1] = lastG;
                    d[idx + 2] = lastB;
                    d[idx + 3] = 255;
                  }
                }
                for (let x = W - 1; x >= 0; x--) {
                  const p = y * W + x;
                  const idx = p * 4;
                  if (isFg[p]) {
                    lastR = d[idx];
                    lastG = d[idx + 1];
                    lastB = d[idx + 2];
                  } else {
                    d[idx] = (d[idx] + lastR) >> 1;
                    d[idx + 1] = (d[idx + 1] + lastG) >> 1;
                    d[idx + 2] = (d[idx + 2] + lastB) >> 1;
                  }
                }
              }

              if (forBackFallback) {
                for (let y = 0; y < H; y++) {
                  const leftIdx = (y * W + Math.floor(W * 0.24)) * 4;
                  const rightIdx = (y * W + Math.floor(W * 0.76)) * 4;
                  for (let x = Math.floor(W * 0.25); x <= Math.floor(W * 0.75); x++) {
                    const t = (x - W * 0.25) / (W * 0.5);
                    const idx = (y * W + x) * 4;
                    d[idx] = Math.round(d[leftIdx] * (1 - t) + d[rightIdx] * t);
                    d[idx + 1] = Math.round(d[leftIdx + 1] * (1 - t) + d[rightIdx + 1] * t);
                    d[idx + 2] = Math.round(d[leftIdx + 2] * (1 - t) + d[rightIdx + 2] * t);
                  }
                }
              }

              ctx.putImageData(imgData, 0, 0);

              if (fgMaxX <= fgMinX + 16 || fgMaxY <= fgMinY + 16) {
                fgMinX = 0;
                fgMaxX = W - 1;
                fgMinY = 0;
                fgMaxY = H - 1;
              }

              const out = document.createElement("canvas");
              out.width = W;
              out.height = H;
              const outCtx = out.getContext("2d");
              if (outCtx) {
                outCtx.drawImage(
                  c,
                  fgMinX,
                  fgMinY,
                  fgMaxX - fgMinX + 1,
                  fgMaxY - fgMinY + 1,
                  0,
                  0,
                  W,
                  H
                );
              }
              return out;
            };

            const atlasCanvas = document.createElement("canvas");
            atlasCanvas.width = 1024;
            atlasCanvas.height = 512;
            const atlasCtx = atlasCanvas.getContext("2d");
            if (!atlasCtx) return;

            if (isTurnaroundSheet) {
              const frontCrop = extractSubViewToCanvas(
                0,
                natH * 0.04,
                natW * 0.25,
                natH * 0.92,
                false
              );
              const backCrop = extractSubViewToCanvas(
                natW * 0.25,
                natH * 0.04,
                natW * 0.25,
                natH * 0.92,
                false
              );
              atlasCtx.drawImage(frontCrop, 0, 0, 512, 512);
              atlasCtx.drawImage(backCrop, 512, 0, 512, 512);
            } else {
              const frontCrop = extractSubViewToCanvas(0, 0, natW, natH, false);
              const backCrop = extractSubViewToCanvas(0, 0, natW, natH, true);
              atlasCtx.drawImage(frontCrop, 0, 0, 512, 512);
              atlasCtx.drawImage(backCrop, 512, 0, 512, 512);
            }

            const projTex = new THREE.CanvasTexture(atlasCanvas);
            projTex.colorSpace = THREE.SRGBColorSpace;
            projTex.needsUpdate = true;
            if (currentTask.input_image_url) {
              texCacheRef.current.set(currentTask.input_image_url, projTex);
            }
            applyProjectedTexAndCustomPaint(projTex);
          };
          img.src = currentTask.input_image_url;
        }
      } else {
        applyProjectedTexAndCustomPaint(null);
      }

      scene.remove(assetGroup);
      scene.add(loadedRoot);
      meshGroupRef.current = loadedRoot;

      if (onPartNamesChangeRef.current) {
        const meshNames = getFlattenedMeshes(loadedRoot).map(
          (m, idx) => m.name || `AI_Mesh_${idx + 1}`
        );
        const namesKey = meshNames.join("|");
        if (meshNames.length > 0 && namesKey !== lastPartNamesKeyRef.current) {
          lastPartNamesKeyRef.current = namesKey;
          onPartNamesChangeRef.current(meshNames);
        }
      }
    };

    if (currentTask.output_glb_url && !isSpecialArtMode) {
      assetGroup.visible = false;
      const glbUrl = currentTask.output_glb_url;
      const cachedTemplate = glbCacheRef.current.get(glbUrl);
      if (cachedTemplate) {
        mountConfiguredGlbScene(cachedTemplate);
      } else {
        const loader = new GLTFLoader();
        loader.load(
          glbUrl,
          (gltf) => {
            let mIdx = 1;
            let hasNativeTexture = false;
            const meshList: THREE.Mesh[] = [];
            const backdropToRemove: THREE.Object3D[] = [];
            gltf.scene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                const lowerName = (m.name || "").toLowerCase();
                if (
                  glbUrl.includes("dragon_crystal") &&
                  (lowerName.includes("cloth") || lowerName.includes("backdrop") || lowerName.includes("background"))
                ) {
                  backdropToRemove.push(m);
                  return;
                }
                if (glbUrl.includes("dragon_crystal")) {
                  m.material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color("#dc2626"),
                    roughness: 0.18,
                    metalness: 0.72,
                    emissive: new THREE.Color("#450a0a"),
                    emissiveIntensity: 0.35,
                  });
                  hasNativeTexture = true;
                }
                meshList.push(m);
                const mat = m.material as THREE.MeshStandardMaterial;
                if (mat && (mat.map || mat.normalMap || mat.metalnessMap || mat.roughnessMap)) {
                  hasNativeTexture = true;
                }
                if (m.geometry) {
                  const geom = m.geometry;
                  const posAttr = geom.attributes.position;
                  if (geom.attributes.color) {
                    hasNativeTexture = true;
                  }

                  geom.computeVertexNormals();
                  geom.computeBoundingBox();

                  if (!geom.attributes.uv && posAttr && geom.boundingBox) {
                    const bb = geom.boundingBox;
                    const spanX = Math.max(bb.max.x - bb.min.x, 0.001);
                    const spanY = Math.max(bb.max.y - bb.min.y, 0.001);
                    const normAttr = geom.attributes.normal;
                    const uvs = new Float32Array(posAttr.count * 2);

                    for (let i = 0; i < posAttr.count; i++) {
                      const vx = posAttr.getX(i);
                      const vy = posAttr.getY(i);
                      const vz = posAttr.getZ(i);
                      const nz = normAttr ? normAttr.getZ(i) : 1;

                      const normX = Math.min(0.98, Math.max(0.02, (vx - bb.min.x) / spanX));
                      const v = Math.min(0.98, Math.max(0.02, (vy - bb.min.y) / spanY));

                      const isBack = vz < -0.04 && nz < -0.12;
                      const u = isBack
                        ? 0.51 + (1.0 - normX) * 0.48
                        : 0.01 + normX * 0.48;

                      uvs[i * 2] = u;
                      uvs[i * 2 + 1] = v;
                    }
                    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
                  }
                }
                if (!m.name) {
                  m.name = `AI_Mesh_Part_0${mIdx++}`;
                }
              }
            });
            backdropToRemove.forEach((b) => b.parent?.remove(b));

            // Bake relative node transform into geometry for single-mesh GLBs so upright orientation is preserved across 6-part segmentation
            if (meshList.length === 1 && meshList[0].geometry) {
              const onlyMesh = meshList[0];
              gltf.scene.updateMatrixWorld(true);
              const relMat = new THREE.Matrix4()
                .copy(gltf.scene.matrixWorld)
                .invert()
                .multiply(onlyMesh.matrixWorld);
              const identityMat = new THREE.Matrix4();
              if (!relMat.equals(identityMat)) {
                onlyMesh.geometry = onlyMesh.geometry.clone();
                onlyMesh.geometry.applyMatrix4(relMat);
                onlyMesh.geometry.computeVertexNormals();
                onlyMesh.geometry.computeBoundingBox();
                onlyMesh.position.set(0, 0, 0);
                onlyMesh.rotation.set(0, 0, 0);
                onlyMesh.scale.set(1, 1, 1);
                let p: THREE.Object3D | null = onlyMesh.parent;
                while (p && p !== gltf.scene) {
                  p.position.set(0, 0, 0);
                  p.rotation.set(0, 0, 0);
                  p.scale.set(1, 1, 1);
                  p = p.parent;
                }
                gltf.scene.updateMatrixWorld(true);
              }
            }

            // Normalize bounding box BEFORE partitioning/exploding so scale never shrinks when Explode > 0
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const normScale = 2.1 / maxDim;
            gltf.scene.userData.invNormScale = 1 / normScale;

            gltf.scene.position.set(
              -center.x * normScale,
              -box.min.y * normScale - 0.9,
              -center.z * normScale
            );
            gltf.scene.scale.setScalar(normScale);

            // Compute True 10-Bone Humanoid Envelope Skinning (JOINTS_0 & WEIGHTS_0) + 6-Part Semantic Segmentation
            if (meshList.length === 1 && meshList[0].geometry?.boundingBox) {
              const srcMesh = meshList[0];
              const srcGeom = srcMesh.geometry;
              const posAttr = srcGeom.attributes.position;
              const bb = srcGeom.boundingBox!;
              const minX = bb.min.x;
              const spanX = Math.max(bb.max.x - bb.min.x, 0.001);
              const minY = bb.min.y;
              const spanY = Math.max(bb.max.y - bb.min.y, 0.001);
              const minZ = bb.min.z;
              const spanZ = Math.max(bb.max.z - bb.min.z, 0.001);
              const midZ = minZ + spanZ * 0.5;

              const toLocal = (nx: number, ny: number): [number, number, number] => [
                minX + nx * spanX,
                minY + ny * spanY,
                midZ,
              ];

              // Automatic Anatomical Silhouette & Air-Gap Scanner (fits Wide Mechs, Golems, Dragonborn, and Bipeds)
              const vCount = posAttr.count;
              let lLegS = 0, lLegC = 0, rLegS = 0, rLegC = 0;
              let lFootS = 0, lFootC = 0, rFootS = 0, rFootC = 0;
              let lShS = 0, lShC = 0, rShS = 0, rShC = 0;
              let lElbS = 0, lElbC = 0, rElbS = 0, rElbC = 0;
              let lHndSX = 0, lHndSY = 0, lHndC = 0, rHndSX = 0, rHndSY = 0, rHndC = 0;
              const xHist = new Int32Array(100);
              const scanStep = Math.max(1, Math.floor(vCount / 18000));

              for (let i = 0; i < vCount; i += scanStep) {
                const nx = (posAttr.getX(i) - minX) / spanX;
                const ny = (posAttr.getY(i) - minY) / spanY;
                if (ny > 0.12 && ny < 0.28) {
                  if (nx > 0.12 && nx < 0.48) { lLegS += nx; lLegC++; }
                  if (nx > 0.52 && nx < 0.88) { rLegS += nx; rLegC++; }
                }
                if (ny > 0.01 && ny < 0.10) {
                  if (nx < 0.48) { lFootS += nx; lFootC++; }
                  if (nx > 0.52) { rFootS += nx; rFootC++; }
                }
                if (ny > 0.62 && ny < 0.75) {
                  if (nx < 0.38) { lShS += nx; lShC++; }
                  if (nx > 0.62) { rShS += nx; rShC++; }
                }
                if (ny > 0.42 && ny < 0.56) {
                  if (nx < 0.22) { lElbS += nx; lElbC++; }
                  if (nx > 0.78) { rElbS += nx; rElbC++; }
                }
                if (ny > 0.22 && ny < 0.42) {
                  if (nx < 0.20) { lHndSX += nx; lHndSY += ny; lHndC++; }
                  if (nx > 0.80) { rHndSX += nx; rHndSY += ny; rHndC++; }
                }
                if (ny > 0.22 && ny < 0.52) {
                  const bin = Math.min(99, Math.max(0, Math.floor(nx * 100)));
                  xHist[bin]++;
                }
              }

              const lLegX = lLegC > 10 ? lLegS / lLegC : 0.32;
              const rLegX = rLegC > 10 ? rLegS / rLegC : 0.68;
              const lFootX = lFootC > 10 ? lFootS / lFootC : lLegX;
              const rFootX = rFootC > 10 ? rFootS / rFootC : rLegX;
              const lHipX = 0.5 * 0.35 + lLegX * 0.65;
              const rHipX = 0.5 * 0.35 + rLegX * 0.65;
              const lShX = lShC > 10 ? lShS / lShC : 0.26;
              const rShX = rShC > 10 ? rShS / rShC : 0.74;
              const lElbowX = lElbC > 10 ? lElbS / lElbC : 0.12;
              const rElbowX = rElbC > 10 ? rElbS / rElbC : 0.88;
              const lHandX = lHndC > 10 ? lHndSX / lHndC : lElbowX - 0.02;
              const rHandX = rHndC > 10 ? rHndSX / rHndC : rElbowX + 0.02;
              const lHandY = lHndC > 10 ? lHndSY / lHndC : 0.33;
              const rHandY = rHndC > 10 ? rHndSY / rHndC : 0.33;

              let lGapBin = 18, lGapMin = 1e9;
              for (let b = 14; b <= 25; b++) {
                if (xHist[b] < lGapMin) { lGapMin = xHist[b]; lGapBin = b; }
              }
              let rGapBin = 80, rGapMin = 1e9;
              for (let b = 74; b <= 86; b++) {
                if (xHist[b] < rGapMin) { rGapMin = xHist[b]; rGapBin = b; }
              }
              const lGapX = (lGapBin + 0.5) / 100;
              const rGapX = (rGapBin + 0.5) / 100;

              // 16-Bone Full Humanoid Hierarchy (Including Knees, Wrists & Ankles for Full-Body Skeleton)
              const boneRestDefs: {
                name: string;
                parent: number;
                pos: [number, number, number];
                segA?: [number, number];
                segB?: [number, number];
              }[] = [
                { name: "Hips", parent: -1, pos: toLocal(0.5, 0.43), segA: [0.5, 0.41], segB: [0.5, 0.51] },
                { name: "Spine", parent: 0, pos: toLocal(0.5, 0.54), segA: [0.5, 0.51], segB: [0.5, 0.62] },
                { name: "Chest", parent: 1, pos: toLocal(0.5, 0.66), segA: [0.5, 0.62], segB: [0.5, 0.74] },
                { name: "Head", parent: 2, pos: toLocal(0.5, 0.82), segA: [0.5, 0.75], segB: [0.5, 0.96] },
                { name: "LeftArm", parent: 2, pos: toLocal(lShX, 0.68), segA: [lShX, 0.68], segB: [lElbowX, 0.50] },
                { name: "LeftForeArm", parent: 4, pos: toLocal(lElbowX, 0.50), segA: [lElbowX, 0.50], segB: [lHandX, Math.min(lHandY, 0.28)] },
                { name: "RightArm", parent: 2, pos: toLocal(rShX, 0.68), segA: [rShX, 0.68], segB: [rElbowX, 0.50] },
                { name: "RightForeArm", parent: 6, pos: toLocal(rElbowX, 0.50), segA: [rElbowX, 0.50], segB: [rHandX, Math.min(rHandY, 0.28)] },
                { name: "LeftUpLeg", parent: 0, pos: toLocal(lHipX, 0.41), segA: [lHipX, 0.41], segB: [lLegX, 0.23] },
                { name: "RightUpLeg", parent: 0, pos: toLocal(rHipX, 0.41), segA: [rHipX, 0.41], segB: [rLegX, 0.23] },
                { name: "LeftLeg", parent: 8, pos: toLocal(lLegX, 0.23), segA: [lLegX, 0.23], segB: [lFootX, 0.04] },
                { name: "RightLeg", parent: 9, pos: toLocal(rLegX, 0.23), segA: [rLegX, 0.23], segB: [rFootX, 0.04] },
                { name: "LeftHand", parent: 5, pos: toLocal(lHandX, lHandY) },
                { name: "RightHand", parent: 7, pos: toLocal(rHandX, rHandY) },
                { name: "LeftFoot", parent: 10, pos: toLocal(lFootX, 0.06) },
                { name: "RightFoot", parent: 11, pos: toLocal(rFootX, 0.06) },
              ];
              gltf.scene.userData.boneRestDefs = boneRestDefs;

              const distToSegment2D = (
                px: number,
                py: number,
                ax: number,
                ay: number,
                bx: number,
                by: number
              ) => {
                const dx = bx - ax;
                const dy = by - ay;
                const lenSq = dx * dx + dy * dy;
                let t = lenSq > 1e-6 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
                t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
              };

              const skinIndices = new Uint16Array(vCount * 4);
              const skinWeights = new Float32Array(vCount * 4);
              const boneW = new Float32Array(12);

              for (let vi = 0; vi < vCount; vi++) {
                const nx = (posAttr.getX(vi) - minX) / spanX;
                const ny = (posAttr.getY(vi) - minY) / spanY;

                const lArmBound = ny > 0.52 ? Math.min(0.32, lGapX + (ny - 0.52) * 0.48) : lGapX;
                const rArmBound = ny > 0.52 ? Math.max(0.68, rGapX - (ny - 0.52) * 0.48) : rGapX;
                const isLeftArmRegion = ny > 0.21 && ny < 0.86 && nx < lArmBound;
                const isRightArmRegion = ny > 0.21 && ny < 0.86 && nx > rArmBound;

                boneW.fill(0);
                // Weight against the 12 deforming bones (0..11, including UpperLegs 8..9 and Knees 10..11)
                for (let b = 0; b < 12; b++) {
                  if (isLeftArmRegion) {
                    if (b !== 4 && b !== 5 && !(b === 2 && ny > 0.60)) continue;
                  } else if (isRightArmRegion) {
                    if (b !== 6 && b !== 7 && !(b === 2 && ny > 0.60)) continue;
                  } else {
                    if ((b === 4 || b === 5) && !(ny > 0.62 && nx < lShX + 0.05)) continue;
                    if ((b === 6 || b === 7) && !(ny > 0.62 && nx > rShX - 0.05)) continue;
                    if ((b === 8 || b === 10) && (nx > 0.51 || ny > 0.47)) continue;
                    if ((b === 9 || b === 11) && (nx < 0.49 || ny > 0.47)) continue;
                    if (b === 3 && (ny < 0.70 || nx < 0.30 || nx > 0.70)) continue;
                    if ((b === 0 || b === 1 || b === 2) && ny < 0.34) continue;
                  }

                  // Keep forearm + weapon moving rigidly with upper arm shoulder so weapons never bend like rubber
                  const targetBone = b === 5 ? 4 : b === 7 ? 6 : b;
                  const [ax, ay] = boneRestDefs[b].segA!;
                  const [bx, by] = boneRestDefs[b].segB!;
                  const d = distToSegment2D(nx, ny, ax, ay, bx, by);
                  const dPlus = d + 0.05;
                  const d2 = dPlus * dPlus;
                  const w = 1 / (d2 * d2);
                  boneW[targetBone] += w;
                }

                let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
                let w0 = 0, w1 = 0, w2 = 0, w3 = 0;
                for (let b = 0; b < 12; b++) {
                  const w = boneW[b];
                  if (w <= w3) continue;
                  if (w > w0) {
                    w3 = w2; b3 = b2;
                    w2 = w1; b2 = b1;
                    w1 = w0; b1 = b0;
                    w0 = w;  b0 = b;
                  } else if (w > w1) {
                    w3 = w2; b3 = b2;
                    w2 = w1; b2 = b1;
                    w1 = w;  b1 = b;
                  } else if (w > w2) {
                    w3 = w2; b3 = b2;
                    w2 = w;  b2 = b;
                  } else {
                    w3 = w;  b3 = b;
                  }
                }
                const sumW = w0 + w1 + w2 + w3 || 1;

                const base = vi * 4;
                skinIndices[base] = b0;
                skinIndices[base + 1] = b1;
                skinIndices[base + 2] = b2;
                skinIndices[base + 3] = b3;
                skinWeights[base] = w0 / sumW;
                skinWeights[base + 1] = w1 / sumW;
                skinWeights[base + 2] = w2 / sumW;
                skinWeights[base + 3] = w3 / sumW;
              }

              const skinIndexAttr = new THREE.Uint16BufferAttribute(skinIndices, 4);
              const skinWeightAttr = new THREE.Float32BufferAttribute(skinWeights, 4);

              const buckets: number[][] = [[], [], [], [], [], []];
              const idxAttr = srcGeom.index;
              const triCount = idxAttr
                ? Math.floor(idxAttr.count / 3)
                : Math.floor(posAttr.count / 3);

              for (let t = 0; t < triCount; t++) {
                const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
                const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
                const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;

                const cx = (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3;
                const cy = (posAttr.getY(i0) + posAttr.getY(i1) + posAttr.getY(i2)) / 3;
                const nx = (cx - minX) / spanX;
                const ny = (cy - minY) / spanY;
                const lArmBound = ny > 0.52 ? Math.min(0.32, lGapX + (ny - 0.52) * 0.48) : lGapX;
                const rArmBound = ny > 0.52 ? Math.max(0.68, rGapX - (ny - 0.52) * 0.48) : rGapX;

                let bIdx = 1;
                if (ny > 0.21 && ny < 0.86 && nx < lArmBound) bIdx = 2;
                else if (ny > 0.21 && ny < 0.86 && nx > rArmBound) bIdx = 3;
                else if (ny > 0.72 && nx >= 0.30 && nx <= 0.70) bIdx = 0;
                else if (ny < 0.44) bIdx = nx < 0.5 ? 4 : 5;
                buckets[bIdx].push(i0, i1, i2);
              }

              const parentNode = srcMesh.parent || gltf.scene;
              buckets.forEach((indices, pIdx) => {
                if (indices.length === 0) return;
                const subGeom = new THREE.BufferGeometry();
                for (const [attrName, attrVal] of Object.entries(srcGeom.attributes)) {
                  subGeom.setAttribute(attrName, attrVal);
                }
                subGeom.setAttribute("skinIndex", skinIndexAttr);
                subGeom.setAttribute("skinWeight", skinWeightAttr);
                subGeom.setIndex(indices);

                const subMat = Array.isArray(srcMesh.material)
                  ? srcMesh.material[0].clone()
                  : srcMesh.material.clone();
                const subMesh = new THREE.Mesh(subGeom, subMat);
                subMesh.name = partSpecs[pIdx].name;
                subMesh.position.set(0, 0, 0);
                parentNode.add(subMesh);
              });
              parentNode.remove(srcMesh);
            }

            gltf.scene.userData.hasNativeTexture = hasNativeTexture;
            glbCacheRef.current.set(glbUrl, gltf.scene);
            mountConfiguredGlbScene(gltf.scene);
          },
          undefined,
          () => {
            assetGroup.visible = true;
          }
        );
      }
    }

    // Build Connected 16-Bone Humanoid or Quadruped Rig Skeleton + Precision Crosshair Calibration Markers
    const rigGroup = new THREE.Group();
    const boneMat = new THREE.MeshBasicMaterial({
      color: "#f43f5e",
      wireframe: true,
      depthTest: false,
    });
    const linkMat = new THREE.MeshBasicMaterial({
      color: "#fb7185",
      depthTest: false,
      transparent: true,
      opacity: 0.88,
    });
    const charType = studioOverrides?.rigCharacterType || "humanoid";
    const jointNodes: [number, number, number][] =
      charType === "quadruped_dog" || charType === "quadruped_cat"
        ? [
            [0, 0.25, -0.55], // 0: Pelvis
            [0, 0.32, 0.0], // 1: Spine
            [0, 0.42, 0.55], // 2: Chest
            [0, 0.85, 0.85], // 3: Head
            [-0.35, -0.45, 0.55], // 4: Front L
            [0.35, -0.45, 0.55], // 5: Front R
            [-0.35, -0.45, -0.55], // 6: Back L
            [0.35, -0.45, -0.55], // 7: Back R
            [0, 0.48, -0.95], // 8: Tail
          ]
        : [
            [0, -0.05, 0], // 0: Hips
            [0, 0.18, 0], // 1: Spine
            [0, 0.44, 0], // 2: Chest
            [0, 0.76, 0], // 3: Head
            [-0.42, 0.48, 0], // 4: LeftArm (Shoulder)
            [-0.72, 0.10, 0], // 5: LeftForeArm (Elbow)
            [0.42, 0.48, 0], // 6: RightArm (Shoulder)
            [0.72, 0.10, 0], // 7: RightForeArm (Elbow)
            [-0.30, -0.09, 0], // 8: LeftUpLeg (Hip)
            [0.30, -0.09, 0], // 9: RightUpLeg (Hip)
            [-0.42, -0.46, 0], // 10: LeftLeg (Knee)
            [0.42, -0.46, 0], // 11: RightLeg (Knee)
            [-0.82, -0.22, 0], // 12: LeftHand (Wrist)
            [0.82, -0.22, 0], // 13: RightHand (Wrist)
            [-0.48, -0.82, 0], // 14: LeftFoot (Ankle)
            [0.48, -0.82, 0], // 15: RightFoot (Ankle)
          ];

    const bonePairs: [number, number][] =
      charType === "quadruped_dog" || charType === "quadruped_cat"
        ? [
            [0, 1],
            [1, 2],
            [2, 3],
            [2, 4],
            [2, 5],
            [0, 6],
            [0, 7],
            [0, 8],
          ]
        : [
            [0, 1],
            [1, 2],
            [2, 3],
            [2, 4],
            [4, 5],
            [5, 12],
            [2, 6],
            [6, 7],
            [7, 13],
            [0, 8],
            [8, 10],
            [10, 14],
            [0, 9],
            [9, 11],
            [11, 15],
          ];

    const visualJointMeshes: THREE.Mesh[] = [];
    for (const [jx, jy, jz] of jointNodes) {
      const joint = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), boneMat);
      joint.position.set(jx, jy, jz);
      rigGroup.add(joint);
      visualJointMeshes.push(joint);
    }

    const upVec = new THREE.Vector3(0, 1, 0);
    const visualLinkMeshes: { cyl: THREE.Mesh; aIdx: number; bIdx: number }[] = [];
    for (const [aIdx, bIdx] of bonePairs) {
      const pA = new THREE.Vector3(...jointNodes[aIdx]);
      const pB = new THREE.Vector3(...jointNodes[bIdx]);
      const dist = Math.max(0.01, pA.distanceTo(pB));
      const mid = pA.clone().add(pB).multiplyScalar(0.5);
      const dir = pB.clone().sub(pA).normalize();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.026, 1, 6), linkMat);
      cyl.scale.set(1, dist, 1);
      cyl.position.copy(mid);
      cyl.quaternion.setFromUnitVectors(upVec, dir);
      rigGroup.add(cyl);
      visualLinkMeshes.push({ cyl, aIdx, bIdx });
    }

    const markerMeshes: THREE.Mesh[] = [];
    if (studioOverrides?.showRigMarkers) {
      const markerDefs: {
        pos: [number, number, number];
        color: string;
        boneIdx: number;
        mirrorIdx?: number;
      }[] = [
        { pos: [0, 0.76, 0.12], color: "#ef4444", boneIdx: 3 }, // 0: Chin / Head
        { pos: [0, -0.05, 0.12], color: "#f59e0b", boneIdx: 0 }, // 1: Groin / Hips
        { pos: [-0.42, 0.48, 0.12], color: "#10b981", boneIdx: 4, mirrorIdx: 3 }, // 2: L Shoulder
        { pos: [0.42, 0.48, 0.12], color: "#10b981", boneIdx: 6, mirrorIdx: 2 }, // 3: R Shoulder
        { pos: [-0.82, -0.22, 0.12], color: "#ec4899", boneIdx: 12, mirrorIdx: 5 }, // 4: L Wrist
        { pos: [0.82, -0.22, 0.12], color: "#ec4899", boneIdx: 13, mirrorIdx: 4 }, // 5: R Wrist
        { pos: [-0.42, -0.46, 0.12], color: "#a855f7", boneIdx: 10, mirrorIdx: 7 }, // 6: L Knee
        { pos: [0.42, -0.46, 0.12], color: "#a855f7", boneIdx: 11, mirrorIdx: 6 }, // 7: R Knee
      ];
      markerDefs.forEach((mk, idx) => {
        const mMat = new THREE.MeshBasicMaterial({
          color: mk.color,
          depthTest: false,
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 16), mMat);
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.058, 0.007, 8, 24),
          mMat
        );
        sphere.add(halo);
        sphere.position.set(mk.pos[0], mk.pos[1], mk.pos[2]);
        sphere.userData.markerIdx = idx;
        sphere.userData.boneIdx = mk.boneIdx;
        sphere.userData.mirrorIdx = mk.mirrorIdx;
        rigGroup.add(sphere);
        markerMeshes.push(sphere);
      });
    }

    rigGroup.visible = effectiveShowRig || !!studioOverrides?.showRigMarkers;
    scene.add(rigGroup);
    rigHelperRef.current = rigGroup;

    let frameId = 0;
    const clock = new THREE.Clock();
    const tmpWorldPos = new THREE.Vector3();
    let draggingMarker: THREE.Mesh | null = null;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const rawT = clock.getElapsedTime();
      const speed = studioOverrides?.animationSpeed ?? 1;
      const t = rawT * speed;
      const clip = studioOverrides?.animationClip || "none";
      const inPlace = studioOverrides?.inPlaceAnimation ?? true;
      const baseRotY = ((studioOverrides?.transform.rotY || 0) * Math.PI) / 180;
      const pose = studioOverrides?.posePreset || "bind";

      if (meshGroupRef.current) {
        meshGroupRef.current.position.set(0, 0, 0);
        meshGroupRef.current.rotation.x = 0;
        meshGroupRef.current.rotation.z = 0;

        const bones = meshGroupRef.current.userData.bones as THREE.Bone[] | undefined;
        const baseArmZ = pose === "t_pose" ? 0.46 : pose === "a_pose" ? 0.24 : 0;
        const baseArmX = pose === "battle" ? -0.5 : 0;
        const baseForeArmX = pose === "battle" ? -0.48 : 0;

        if (bones && bones.length >= 12) {
          // True 16-Bone THREE.SkinnedMesh Bone Hierarchy Animation (Including Knee Flexion)
          const [
            ,
            bSpine,
            bChest,
            bHead,
            bLArm,
            bLForeArm,
            bRArm,
            bRForeArm,
            bLLeg,
            bRLeg,
            bLKnee,
            bRKnee,
          ] = bones;
          bSpine.rotation.set(0, 0, 0);
          bChest.rotation.set(0, 0, 0);
          bHead.rotation.set(0, 0, 0);
          bLArm.rotation.set(baseArmX, 0, -baseArmZ);
          bLForeArm.rotation.set(baseForeArmX, 0, 0);
          bRArm.rotation.set(baseArmX, 0, baseArmZ);
          bRForeArm.rotation.set(baseForeArmX, 0, 0);
          bLLeg.rotation.set(0, 0, 0);
          bRLeg.rotation.set(0, 0, 0);
          bLKnee.rotation.set(0, 0, 0);
          bRKnee.rotation.set(0, 0, 0);

          if (clip === "idle") {
            meshGroupRef.current.position.y = Math.sin(t * 2.5) * 0.05;
            bSpine.rotation.x = Math.sin(t * 2.5) * 0.04;
            bHead.rotation.y = Math.sin(t * 1.5) * 0.14;
            bLArm.rotation.z = -baseArmZ - Math.sin(t * 2.5) * 0.06;
            bRArm.rotation.z = baseArmZ + Math.sin(t * 2.5) * 0.06;
          } else if (clip === "walk") {
            const s = Math.sin(t * 5);
            meshGroupRef.current.position.y = Math.abs(s) * 0.09;
            bSpine.rotation.y = s * 0.12;
            bChest.rotation.x = 0.06;
            bLArm.rotation.x = s * 0.42;
            bLForeArm.rotation.x = -0.25 - Math.max(0, s) * 0.25;
            bRArm.rotation.x = -s * 0.42;
            bRForeArm.rotation.x = -0.25 - Math.max(0, -s) * 0.25;
            bLLeg.rotation.x = -s * 0.42;
            bRLeg.rotation.x = s * 0.42;
            bLKnee.rotation.x = Math.max(0, s) * 0.48;
            bRKnee.rotation.x = Math.max(0, -s) * 0.48;
            bHead.rotation.y = -s * 0.08;
            if (!inPlace) {
              meshGroupRef.current.position.z = ((t * 1.2) % 4) - 2;
            }
          } else if (clip === "run") {
            const s = Math.sin(t * 9);
            meshGroupRef.current.position.y = Math.abs(s) * 0.16;
            bSpine.rotation.x = 0.16;
            bChest.rotation.y = s * 0.18;
            bLArm.rotation.x = s * 0.65;
            bLForeArm.rotation.x = -0.58;
            bRArm.rotation.x = -s * 0.65;
            bRForeArm.rotation.x = -0.58;
            bLLeg.rotation.x = -s * 0.58;
            bRLeg.rotation.x = s * 0.58;
            bLKnee.rotation.x = Math.max(0.08, s * 0.65);
            bRKnee.rotation.x = Math.max(0.08, -s * 0.65);
            if (!inPlace) {
              meshGroupRef.current.position.z = ((t * 2.6) % 5) - 2.5;
            }
          } else if (clip === "crouch") {
            meshGroupRef.current.position.y = -0.18 + Math.abs(Math.sin(t * 3.5)) * 0.05;
            bSpine.rotation.x = 0.28;
            bLLeg.rotation.x = -0.52;
            bRLeg.rotation.x = -0.52;
            bLKnee.rotation.x = 0.68;
            bRKnee.rotation.x = 0.68;
            bLArm.rotation.x = -0.35;
            bLForeArm.rotation.x = -0.45;
            bRArm.rotation.x = -0.35;
            bRForeArm.rotation.x = -0.45;
          } else if (clip === "jump") {
            const jumpPhase = Math.max(0, Math.sin(t * 4));
            meshGroupRef.current.position.y = jumpPhase * 0.62;
            bLArm.rotation.z = -0.52 * jumpPhase;
            bRArm.rotation.z = 0.52 * jumpPhase;
            bLLeg.rotation.x = -0.42 * jumpPhase;
            bRLeg.rotation.x = -0.25 * jumpPhase;
            bLKnee.rotation.x = 0.55 * jumpPhase;
            bRKnee.rotation.x = 0.45 * jumpPhase;
          } else if (clip === "attack") {
            meshGroupRef.current.rotation.y = baseRotY + Math.sin(t * 6) * 0.42;
            meshGroupRef.current.position.y = Math.abs(Math.sin(t * 6)) * 0.09;
            bChest.rotation.y = Math.sin(t * 8) * 0.28;
            bRArm.rotation.x = -0.5 + Math.sin(t * 8) * 0.72;
            bRForeArm.rotation.x = -0.35 + Math.cos(t * 8) * 0.35;
            bLArm.rotation.x = -0.25 - Math.sin(t * 8) * 0.32;
            bLLeg.rotation.x = -0.24;
            bRLeg.rotation.x = 0.24;
            bLKnee.rotation.x = 0.28;
            bRKnee.rotation.x = 0.18;
          } else if (clip === "boxing") {
            meshGroupRef.current.position.z = Math.sin(t * 8) * 0.12;
            bChest.rotation.y = Math.sin(t * 8) * 0.32;
            bLArm.rotation.x = -0.55 + Math.sin(t * 10) * 0.52;
            bLForeArm.rotation.x = -0.6 + Math.sin(t * 10) * 0.4;
            bRArm.rotation.x = -0.55 - Math.sin(t * 10) * 0.52;
            bRForeArm.rotation.x = -0.6 - Math.sin(t * 10) * 0.4;
          } else if (clip === "dance") {
            meshGroupRef.current.position.y = Math.abs(Math.sin(t * 6)) * 0.16;
            meshGroupRef.current.position.x = Math.sin(t * 3) * 0.18;
            bSpine.rotation.z = Math.sin(t * 6) * 0.16;
            bLArm.rotation.z = -0.38 + Math.sin(t * 6) * 0.38;
            bLForeArm.rotation.z = Math.cos(t * 6) * 0.35;
            bRArm.rotation.z = 0.38 + Math.cos(t * 6) * 0.38;
            bRForeArm.rotation.z = -Math.sin(t * 6) * 0.35;
            bLLeg.rotation.z = Math.sin(t * 6) * 0.22;
            bRLeg.rotation.z = -Math.sin(t * 6) * 0.22;
            bHead.rotation.z = -Math.sin(t * 6) * 0.16;
          } else if (clip === "climb") {
            meshGroupRef.current.position.y = ((t * 0.6) % 1.4) - 0.3;
            bLArm.rotation.x = -0.65 + Math.sin(t * 6) * 0.42;
            bRArm.rotation.x = -0.65 - Math.sin(t * 6) * 0.42;
            bLLeg.rotation.x = -Math.sin(t * 6) * 0.38;
            bRLeg.rotation.x = Math.sin(t * 6) * 0.38;
            bLKnee.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.45;
            bRKnee.rotation.x = Math.max(0, -Math.sin(t * 6)) * 0.45;
          } else if (clip === "quad_gallop") {
            meshGroupRef.current.position.y = Math.abs(Math.sin(t * 7)) * 0.22;
            meshGroupRef.current.rotation.x = Math.cos(t * 7) * 0.22;
            if (!inPlace) {
              meshGroupRef.current.position.z = ((t * 2.2) % 4) - 2;
            }
          }
        } else {
          // Procedural fallback part animation
          const head = meshGroupRef.current.getObjectByName("Part_01_Head_Hood");
          const leftArm = meshGroupRef.current.getObjectByName("Part_03_Left_Arm");
          const rightArm = meshGroupRef.current.getObjectByName("Part_04_Right_Arm_Weapon");
          const leftLeg =
            meshGroupRef.current.getObjectByName("Part_05_Left_Leg") ||
            meshGroupRef.current.getObjectByName("Part_05_Legs_Boots");
          const rightLeg = meshGroupRef.current.getObjectByName("Part_06_Right_Leg");

          if (leftArm) leftArm.rotation.set(baseArmX, 0, -baseArmZ);
          if (rightArm) rightArm.rotation.set(baseArmX, 0, baseArmZ);
          if (leftLeg) leftLeg.rotation.set(0, 0, 0);
          if (rightLeg) rightLeg.rotation.set(0, 0, 0);
          if (head) head.rotation.set(0, 0, 0);

          if (clip === "walk" || clip === "run") {
            const freq = clip === "run" ? 9 : 5;
            const amp = clip === "run" ? 0.55 : 0.35;
            meshGroupRef.current.position.y = Math.abs(Math.sin(t * freq)) * 0.14;
            if (leftArm) leftArm.rotation.x = Math.sin(t * freq) * amp;
            if (rightArm) rightArm.rotation.x = -Math.sin(t * freq) * amp;
            if (leftLeg) leftLeg.rotation.x = -Math.sin(t * freq) * amp;
            if (rightLeg) rightLeg.rotation.x = Math.sin(t * freq) * amp;
          }
        }

        if (clip !== "attack" && clip !== "boxing") {
          if (autoRotate) {
            meshGroupRef.current.rotation.y = baseRotY + rawT * 0.45;
          } else {
            meshGroupRef.current.rotation.y = baseRotY;
          }
        }

        // Sync visual skeleton helper bones AND precision calibration markers to live THREE.Bone world positions!
        if (
          rigHelperRef.current &&
          rigHelperRef.current.visible &&
          bones &&
          bones.length === visualJointMeshes.length
        ) {
          meshGroupRef.current.updateMatrixWorld(true);
          rigHelperRef.current.position.set(0, 0, 0);
          rigHelperRef.current.rotation.set(0, 0, 0);
          for (let i = 0; i < bones.length; i++) {
            bones[i].getWorldPosition(tmpWorldPos);
            visualJointMeshes[i].position.copy(tmpWorldPos);
          }
          if (markerMeshes.length > 0) {
            for (const mkMesh of markerMeshes) {
              const bIdx = mkMesh.userData.boneIdx;
              if (typeof bIdx === "number" && visualJointMeshes[bIdx]) {
                if (mkMesh.userData.customDragged) {
                  visualJointMeshes[bIdx].position.x = mkMesh.position.x;
                  visualJointMeshes[bIdx].position.y = mkMesh.position.y;
                } else if (!draggingMarker) {
                  mkMesh.position.copy(visualJointMeshes[bIdx].position);
                  mkMesh.position.z += 0.08;
                }
              }
            }
          }
          for (const { cyl, aIdx, bIdx } of visualLinkMeshes) {
            const pA = visualJointMeshes[aIdx].position;
            const pB = visualJointMeshes[bIdx].position;
            const dist = Math.max(0.01, pA.distanceTo(pB));
            cyl.position.copy(pA).add(pB).multiplyScalar(0.5);
            cyl.scale.set(1, dist, 1);
            cyl.quaternion.setFromUnitVectors(
              upVec,
              tmpWorldPos.copy(pB).sub(pA).normalize()
            );
          }
        } else if (rigHelperRef.current && rigHelperRef.current.visible) {
          rigHelperRef.current.rotation.copy(meshGroupRef.current.rotation);
          rigHelperRef.current.position.copy(meshGroupRef.current.position);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 3D Raycaster: Drag 6-Point Rig Markers, Paint on 3D UV Texture Canvas, or Click Part / Place 3D Decal
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const dragIntersect = new THREE.Vector3();
    let isBrushPainting = false;
    let downX = 0;
    let downY = 0;

    const applyUvCanvasBrushAtHit = (hit: THREE.Intersection) => {
      if (!hit.uv) return false;
      let paintTex = texCacheRef.current.get(`paint_${currentTask.id}`);
      if (!paintTex && meshGroupRef.current) {
        const hitMat = (hit.object as THREE.Mesh)?.material as THREE.MeshStandardMaterial | undefined;
        const srcMap = hitMat?.map;
        const srcImg = srcMap?.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
        if (srcMap && srcImg && "width" in srcImg && srcImg.width > 0) {
          const w = Math.min(1024, srcImg.width);
          const h = Math.min(1024, srcImg.height);
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.drawImage(srcImg as CanvasImageSource, 0, 0, w, h);
            const backup = document.createElement("canvas");
            backup.width = w;
            backup.height = h;
            backup.getContext("2d")?.drawImage(c, 0, 0);
            (c as unknown as { _backupCanvas?: HTMLCanvasElement })._backupCanvas = backup;
          }
          const cTex = new THREE.CanvasTexture(c);
          cTex.flipY = srcMap.flipY;
          cTex.colorSpace = THREE.SRGBColorSpace;
          cTex.needsUpdate = true;
          texCacheRef.current.set(`paint_${currentTask.id}`, cTex);
          paintTex = cTex;
          meshGroupRef.current.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              const mat = m.material as THREE.MeshStandardMaterial;
              if (mat && mat.map) {
                mat.map = cTex;
                mat.needsUpdate = true;
              }
            }
          });
        }
      }
      if (!paintTex || !paintTex.image) return false;
      const c = paintTex.image as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) return false;

      const bTool = studioOverrides?.activeBrushTool;
      const u = hit.uv.x;
      const v = paintTex.flipY ? 1 - hit.uv.y : hit.uv.y;
      const cx = u * c.width;
      const cy = v * c.height;
      const radius = Math.max(14, Math.round(c.width * 0.032));

      if (bTool === "paint" || bTool === "lasso") {
        const brushHex =
          studioOverrides?.material.primaryColor &&
          studioOverrides.material.primaryColor.toLowerCase() !== "#d6d3d1"
            ? studioOverrides.material.primaryColor
            : "#ef4444";
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
        grad.addColorStop(0, brushHex);
        grad.addColorStop(1, "rgba(239,68,68,0)");
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        paintTex.needsUpdate = true;
        return true;
      } else if (bTool === "eraser" || bTool === "healing") {
        const backup = (c as unknown as { _backupCanvas?: HTMLCanvasElement })._backupCanvas;
        if (backup) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(backup, 0, 0);
          ctx.restore();
          paintTex.needsUpdate = true;
          return true;
        }
      }
      return false;
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      if (markerMeshes.length > 0 && rigGroup.visible) {
        const hits = raycaster.intersectObjects(markerMeshes, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && typeof obj.userData?.markerIdx !== "number") {
            obj = obj.parent;
          }
          if (obj) {
            draggingMarker = obj as THREE.Mesh;
            controls.enabled = false;
            return;
          }
        }
      }

      const bTool = studioOverrides?.activeBrushTool;
      if (
        (bTool === "paint" || bTool === "eraser" || bTool === "healing") &&
        meshGroupRef.current
      ) {
        const meshHits = raycaster.intersectObjects(meshGroupRef.current.children, true);
        if (meshHits.length > 0 && applyUvCanvasBrushAtHit(meshHits[0])) {
          isBrushPainting = true;
          controls.enabled = false;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (draggingMarker) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
          draggingMarker.position.x = Math.max(-1.1, Math.min(1.1, dragIntersect.x));
          draggingMarker.position.y = Math.max(-1.0, Math.min(1.2, dragIntersect.y));
          draggingMarker.userData.customDragged = true;
          const mirrorIdx = draggingMarker.userData.mirrorIdx;
          if (typeof mirrorIdx === "number" && markerMeshes[mirrorIdx]) {
            markerMeshes[mirrorIdx].position.x = -draggingMarker.position.x;
            markerMeshes[mirrorIdx].position.y = draggingMarker.position.y;
            markerMeshes[mirrorIdx].userData.customDragged = true;
          }
        }
        return;
      }

      if (isBrushPainting && meshGroupRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const meshHits = raycaster.intersectObjects(meshGroupRef.current.children, true);
        if (meshHits.length > 0) {
          applyUvCanvasBrushAtHit(meshHits[0]);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (draggingMarker) {
        draggingMarker = null;
        controls.enabled = true;
        return;
      }
      if (isBrushPainting) {
        isBrushPainting = false;
        controls.enabled = true;
      }
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6 || !meshGroupRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(meshGroupRef.current.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const allMeshes = getFlattenedMeshes(meshGroupRef.current);
        let hitMesh: THREE.Mesh | null = null;
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr !== meshGroupRef.current) {
          if ((curr as THREE.Mesh).isMesh) {
            hitMesh = curr as THREE.Mesh;
            break;
          }
          curr = curr.parent;
        }
        if (hitMesh) {
          const partIndex = allMeshes.indexOf(hitMesh);
          const partName = hitMesh.name || `Mesh_Part_${partIndex + 1}`;
          if (partIndex >= 0) {
            setSelectedPart({ index: partIndex, name: partName });
            const bTool = studioOverrides?.activeBrushTool;
            if (bTool === "paint" || bTool === "lasso") {
              if (!applyUvCanvasBrushAtHit(hit)) {
                const brushHex =
                  studioOverrides?.material.primaryColor &&
                  studioOverrides.material.primaryColor.toLowerCase() !== "#d6d3d1"
                    ? studioOverrides.material.primaryColor
                    : "#ef4444";
                partPaintMapRef.current[partIndex] = brushHex;
                const mat = hitMesh.material as THREE.MeshStandardMaterial;
                if (mat && mat.color) {
                  mat.color.set(brushHex);
                  mat.needsUpdate = true;
                }
              }
            } else if (bTool === "eraser" || bTool === "healing") {
              applyUvCanvasBrushAtHit(hit);
              delete partPaintMapRef.current[partIndex];
              const mat = hitMesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.color) {
                mat.color.set("#ffffff");
                mat.needsUpdate = true;
              }
            }
          }

          // If Decal Sticker is enabled, snap the 3D Decal Emblem to the clicked surface point!
          if (
            studioOverrides?.decalEnabled ||
            studioOverrides?.activeBrushTool === "decal" ||
            studioOverrides?.activeBrushTool === "stamp"
          ) {
            const decalMesh = meshGroupRef.current.getObjectByName(
              "Part_Decal_Projected_Emblem"
            );
            if (decalMesh && hit.object !== decalMesh) {
              const localPt = meshGroupRef.current.worldToLocal(hit.point.clone());
              decalMesh.position.set(localPt.x, localPt.y, localPt.z + 0.04);
              decalHitPosRef.current = [localPt.x, localPt.y, localPt.z + 0.04];
            }
          }
        }
      } else {
        setSelectedPart(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cameraStateRef.current = {
        taskId: activeTaskId,
        pos: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      };
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [
    activeTask,
    effectiveShading,
    autoRotate,
    effectiveShowRig,
    lightIntensity,
    overridesKey,
  ]);

  const handleExportFile = (format: "glb" | "obj" | "stl", pushToLocalBridge?: boolean) => {
    const targetGroup = meshGroupRef.current;
    if (!targetGroup) return;

    const safeName = (activeTask?.preset_type || "model") + "_" + (activeTask?.id || "3d");
    const roughnessVal = String(studioOverrides?.material?.roughness ?? 0.35);
    const metalnessVal = String(studioOverrides?.material?.metalness ?? 0.65);
    const prevVis = targetGroup.visible;
    targetGroup.visible = true;

    const pushBlobToBridge = (blob: Blob, ext: string) => {
      if (!pushToLocalBridge) return;
      const qs = `filename=${encodeURIComponent(`${safeName}.${ext}`)}&roughness=${encodeURIComponent(roughnessVal)}&metalness=${encodeURIComponent(metalnessVal)}`;
      fetch(`http://127.0.0.1:28450/prism3d-import?${qs}`, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: blob,
      }).catch(() => {});
    };

    if (format === "glb") {
      const hasGeomMods =
        studioOverrides?.artStyleMode === "voxel" ||
        studioOverrides?.artStyleMode === "relief" ||
        studioOverrides?.artStyleMode === "text3d" ||
        studioOverrides?.filledParts?.auraRing ||
        studioOverrides?.filledParts?.backWings ||
        studioOverrides?.filledParts?.pedestal ||
        studioOverrides?.addPrintBase ||
        studioOverrides?.decalEnabled;

      if (activeTask?.output_glb_url && !hasGeomMods) {
        targetGroup.visible = prevVis;
        const glbSrc = activeTask.output_glb_url;
        if (glbSrc.startsWith("/")) {
          const a = document.createElement("a");
          a.href = glbSrc;
          a.download = `${safeName}.glb`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          fetch(glbSrc)
            .then((r) => r.blob())
            .then((blob) => {
              pushBlobToBridge(blob, "glb");
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${safeName}.glb`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 20000);
            })
            .catch(() => {});
        }
        return;
      }

      const exporter = new GLTFExporter();
      exporter.parse(
        targetGroup,
        (result) => {
          targetGroup.visible = prevVis;
          const blob =
            result instanceof ArrayBuffer
              ? new Blob([result], { type: "model/gltf-binary" })
              : new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
          pushBlobToBridge(blob, "glb");
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${safeName}.glb`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 20000);
        },
        () => {
          targetGroup.visible = prevVis;
        },
        { binary: true }
      );
    } else if (format === "obj") {
      const exporter = new OBJExporter();
      const objText = exporter.parse(targetGroup);
      targetGroup.visible = prevVis;
      const blob = new Blob([objText], { type: "text/plain" });
      pushBlobToBridge(blob, "obj");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.obj`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 20000);
    } else {
      // Generate fast Binary STL (ArrayBuffer) for 3D Printing Slicers (Bambu Studio / Creality / Cura)
      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      const vC = new THREE.Vector3();
      const cb = new THREE.Vector3();
      const ab = new THREE.Vector3();

      targetGroup.updateMatrixWorld(true);
      const meshes: { geom: THREE.BufferGeometry; pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute }[] = [];
      let totalTris = 0;

      targetGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.visible) {
          const mesh = obj as THREE.Mesh;
          const geom = mesh.geometry.clone();
          geom.applyMatrix4(mesh.matrixWorld);
          const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
          const pos = nonIndexed.getAttribute("position");
          if (!pos) return;
          const tris = Math.floor(pos.count / 3);
          if (tris > 0) {
            totalTris += tris;
            meshes.push({ geom: nonIndexed, pos });
          }
        }
      });

      const buffer = new ArrayBuffer(84 + totalTris * 50);
      const view = new DataView(buffer);
      view.setUint32(80, totalTris, true);
      let offset = 84;

      for (const { pos } of meshes) {
        for (let i = 0; i + 2 < pos.count; i += 3) {
          vA.fromBufferAttribute(pos, i);
          vB.fromBufferAttribute(pos, i + 1);
          vC.fromBufferAttribute(pos, i + 2);
          cb.subVectors(vC, vB);
          ab.subVectors(vA, vB);
          cb.cross(ab).normalize();

          view.setFloat32(offset, cb.x, true); offset += 4;
          view.setFloat32(offset, cb.y, true); offset += 4;
          view.setFloat32(offset, cb.z, true); offset += 4;

          view.setFloat32(offset, vA.x, true); offset += 4;
          view.setFloat32(offset, vA.y, true); offset += 4;
          view.setFloat32(offset, vA.z, true); offset += 4;

          view.setFloat32(offset, vB.x, true); offset += 4;
          view.setFloat32(offset, vB.y, true); offset += 4;
          view.setFloat32(offset, vB.z, true); offset += 4;

          view.setFloat32(offset, vC.x, true); offset += 4;
          view.setFloat32(offset, vC.y, true); offset += 4;
          view.setFloat32(offset, vC.z, true); offset += 4;

          view.setUint16(offset, 0, true); offset += 2;
        }
      }

      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.stl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 20000);
    }
  };

  const handleExportUvLayoutPng = () => {
    const targetGroup = meshGroupRef.current;
    if (!targetGroup) return;
    const W = 1024;
    const H = 1024;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0b090d";
    ctx.fillRect(0, 0, W, H);

    // Draw UDIM 0..1 Grid
    ctx.strokeStyle = "rgba(244,63,94,0.18)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const p = (i / 8) * W;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(W, p);
      ctx.stroke();
    }

    // Draw actual UV island triangles from meshGroupRef
    let partIdx = 0;
    targetGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.visible) {
        const m = obj as THREE.Mesh;
        const uvAttr = m.geometry?.attributes?.uv;
        if (!uvAttr) return;
        const idxAttr = m.geometry.index;
        const triCount = idxAttr
          ? Math.floor(idxAttr.count / 3)
          : Math.floor(uvAttr.count / 3);
        const stride = Math.max(1, Math.floor(triCount / 2200));
        const strokeColor = SEGMENT_PALETTE[partIdx % SEGMENT_PALETTE.length];
        partIdx++;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        for (let t = 0; t < triCount; t += stride) {
          const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
          const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
          const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
          const x0 = uvAttr.getX(i0) * W;
          const y0 = (1 - uvAttr.getY(i0)) * H;
          const x1 = uvAttr.getX(i1) * W;
          const y1 = (1 - uvAttr.getY(i1)) * H;
          const x2 = uvAttr.getX(i2) * W;
          const y2 = (1 - uvAttr.getY(i2)) * H;
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.closePath();
        }
        ctx.stroke();
      }
    });

    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uv-layout-${activeTask?.id || "model"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 20000);
    }, "image/png");
  };

  useEffect(() => {
    const onCustomExport = (e: Event) => {
      const ce = e as CustomEvent<{
        format?: "glb" | "obj" | "stl" | "uv_png";
        pushToLocalBridge?: boolean;
      }>;
      if (ce.detail?.format === "uv_png") {
        handleExportUvLayoutPng();
      } else {
        handleExportFile(ce.detail?.format || "stl", ce.detail?.pushToLocalBridge);
      }
    };
    window.addEventListener("prism3d-export", onCustomExport);
    return () => window.removeEventListener("prism3d-export", onCustomExport);
  });

  return (
    <div className="relative flex-1 min-h-0 bg-[#090507] overflow-hidden flex flex-col">
      {/* Top Viewport Shading Bar (Crimson-Obsidian #140a0e, 4px Grid, Quiet Controls) */}
      <div className="h-10 px-3 bg-[#140a0e] border-b border-red-500/20 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="flex items-center gap-1 p-0.5 rounded-[8px] bg-[#0b0709] border border-red-500/20">
          {(
            [
              { id: "pbr", label: "PBR" },
              { id: "clay", label: "Clay" },
              { id: "wireframe", label: "Wireframe" },
              { id: "base_color", label: "Albedo" },
              { id: "uv_checker", label: "UV Map" },
            ] as { id: RenderShadingMode; label: string }[]
          ).map((ch) => (
            <button
              key={ch.id}
              onClick={() => setShadingMode(ch.id)}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                effectiveShading === ch.id
                  ? "bg-[#dc2626] text-white"
                  : "text-[#9c848b] hover:text-[#f5eff1]"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        <select
          value={
            ["normal", "metallic", "roughness", "ao_curvature", "segment", "printability", "filament_sim"].includes(
              effectiveShading
            )
              ? effectiveShading
              : ""
          }
          onChange={(e) => {
            if (e.target.value) {
              setShadingMode(e.target.value as RenderShadingMode);
            }
          }}
          className="h-7 px-2.5 rounded-[6px] bg-[#1a0d12] border border-red-500/20 text-[12px] text-[#c7b2b8] focus:outline-none cursor-pointer"
        >
          <option value="" disabled>
            Inspect Maps
          </option>
          <option value="normal">Normal Map</option>
          <option value="metallic">Metallic Map</option>
          <option value="roughness">Roughness Map</option>
          <option value="ao_curvature">Cavity / AO</option>
          <option value="segment">Segments</option>
          <option value="printability">Print Check</option>
          <option value="filament_sim">Filament</option>
        </select>
      </div>

      {/* 3D Canvas Area */}
      <div className="relative flex-1 min-h-0 w-full flex flex-col">
        <div ref={mountRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

        {/* Right-Edge Compact Scene Controls */}
        <div className="absolute right-3 top-3 z-10 flex flex-col items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setShowRigBones(!showRigBones)}
            title="แสดงโครงกระดูก (Skeleton Bones)"
            className={`w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors border cursor-pointer ${
              effectiveShowRig
                ? "bg-[#dc2626] text-white border-[#ef4444]"
                : "bg-[#140a0e]/90 text-[#9c848b] hover:text-[#f5eff1] border-red-500/20"
            }`}
          >
            <Activity className="w-4 h-4 stroke-[1.5]" />
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="หมุนโมเดลอัตโนมัติ (Turntable)"
            className={`w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors border cursor-pointer ${
              autoRotate
                ? "bg-[#241118] text-[#f5eff1] border-red-500/40"
                : "bg-[#140a0e]/90 text-[#9c848b] hover:text-[#f5eff1] border-red-500/20"
            }`}
          >
            <RotateCcw className="w-4 h-4 stroke-[1.5]" />
          </button>

          <button
            onClick={() => setLightIntensity((prev) => (prev > 1.6 ? 0.9 : prev + 0.4))}
            title="ความสว่างไฟสตูดิโอ"
            className="w-8 h-8 rounded-[8px] bg-[#140a0e]/90 text-[#9c848b] hover:text-[#f5eff1] border border-red-500/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Sun className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        {/* 3D Raycast Clicked Part Inspector Bar */}
        {selectedPart && (
          <div className="absolute bottom-14 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#1a0d12]/95 border border-red-500/30 shadow-xl pointer-events-auto">
            <span className="px-2 py-0.5 rounded-[4px] bg-[#2a121a] text-[#f5eff1] text-[11px] font-mono">
              {selectedPart.name}
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: "Crimson", hex: "#ef4444" },
                { label: "Gold", hex: "#f59e0b" },
                { label: "Obsidian", hex: "#18181b" },
                { label: "Emerald", hex: "#10b981" },
              ].map((sw) => (
                <button
                  key={sw.hex}
                  onClick={() => handlePaintSelectedPart(sw.hex)}
                  title={`Paint ${selectedPart.name} ${sw.label}`}
                  className="w-4 h-4 rounded-[4px] border border-white/30 cursor-pointer"
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
            </div>
            <button
              onClick={handleToggleSelectedPartVisible}
              className="px-2 py-0.5 rounded-[4px] bg-[#2a121a] hover:bg-[#381822] text-[11px] text-[#f5eff1] font-normal cursor-pointer"
            >
              ซ่อน/แสดง
            </button>
            <button
              onClick={() => setSelectedPart(null)}
              className="text-[11px] text-[#9c848b] hover:text-[#f5eff1] px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Picture-in-Picture 2D Original Input Image (Crimson-Obsidian Frame) */}
        {activeTask?.input_image_url && !selectedPart && (
          <div
            onClick={() => setExpandRefImg(!expandRefImg)}
            title="คลิกเพื่อขยายหรือย่อภาพต้นแบบ"
            className={`absolute bottom-14 left-3 z-10 rounded-[10px] overflow-hidden bg-[#140a0e]/95 border border-red-500/25 cursor-pointer pointer-events-auto ${
              expandRefImg ? "w-52" : "w-24"
            }`}
          >
            <div className="px-2 py-1 text-[10px] font-mono text-[#c7b2b8] border-b border-red-500/15 flex items-center justify-between">
              <span className="truncate">ภาพต้นแบบ</span>
              <span className="text-[9px] text-red-400">{expandRefImg ? "ย่อ" : "ขยาย"}</span>
            </div>
            <div className="p-1.5 bg-[#0b0709] flex items-center justify-center">
              <img
                src={activeTask.input_image_url}
                alt="2D Input Reference"
                className={`object-contain rounded-[6px] ${
                  expandRefImg ? "w-48 h-48" : "w-20 h-20"
                }`}
              />
            </div>
          </div>
        )}

        {/* Bottom Status & Export Bar */}
        <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
          <div className="h-8 px-3 rounded-[8px] bg-[#140a0e]/95 border border-red-500/20 text-[12px] font-mono tabular-nums text-[#c7b2b8] flex items-center gap-2 pointer-events-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            <span className="text-[#f5eff1]">
              {Math.round(
                (activeTask?.target_poly_count || 18000) *
                  (studioOverrides?.material.polyMultiplier || 1)
              ).toLocaleString()}{" "}
              polys
            </span>
            <span className="text-[#7d666d]">·</span>
            <span className="uppercase text-red-400">
              {studioOverrides?.artStyleMode && studioOverrides.artStyleMode !== "standard"
                ? studioOverrides.artStyleMode.toUpperCase()
                : activeTask?.topology || "QUAD"}
            </span>
            {studioOverrides?.addPrintBase && (
              <>
                <span className="text-[#7d666d]">·</span>
                <span className="text-[#4cc38a]">+STL Base</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#140a0e]/95 border border-red-500/20 p-1 rounded-[8px] pointer-events-auto">
            <button
              onClick={() => handleExportFile("glb")}
              className="h-6 px-3 rounded-[6px] bg-[#dc2626] hover:bg-[#ef4444] text-white text-[12px] font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>.GLB</span>
            </button>
            <button
              onClick={() => handleExportFile("obj")}
              className="h-6 px-2.5 rounded-[6px] hover:bg-[#241118] text-[#c7b2b8] hover:text-[#f5eff1] text-[12px] font-mono transition-colors cursor-pointer"
            >
              .OBJ
            </button>
            <button
              onClick={() => handleExportFile("stl")}
              className="h-6 px-2.5 rounded-[6px] hover:bg-[#241118] text-[#c7b2b8] hover:text-[#f5eff1] text-[12px] font-mono transition-colors cursor-pointer"
              title="Export 3D Printable .STL Mesh"
            >
              .STL
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isGenerating && (
          <div className="absolute inset-0 z-20 bg-[#060608]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-400/40 flex items-center justify-center mb-3 animate-pulse">
              <Box className="w-6 h-6 text-red-300" />
            </div>
            <p className="text-xs font-medium text-white mb-3">{generationStepLabel}</p>
            <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
