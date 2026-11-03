"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
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
  tex.repeat.set(2, 2);
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
    const labelLen = Math.max(3, Math.min(8, (overrides.text3dContent || "PRISM").length));
    group.clear();
    const totalW = labelLen * 0.38;
    for (let i = 0; i < labelLen; i++) {
      const xPos = -totalW / 2 + i * 0.42 + 0.2;
      const charGeo = new THREE.BoxGeometry(0.32, 0.72, tDepth);
      const charMesh = new THREE.Mesh(charGeo, i % 2 === 0 ? mainMat.clone() : accentMat.clone());
      charMesh.name = `Text3D_Glyph_${i + 1}`;
      charMesh.position.set(xPos, 0.45, 0);
      group.add(charMesh);
    }
    const plinthGeo = new THREE.BoxGeometry(totalW + 0.5, 0.18, tDepth + 0.25);
    const plinth = new THREE.Mesh(plinthGeo, darkMat.clone());
    plinth.name = "Text3D_Bevel_Plinth";
    plinth.position.set(0, -0.05, 0);
    group.add(plinth);
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
    renderer.toneMappingExposure = 1.0;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

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
            const gray = Math.round(mVal * 255);
            mesh.material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(`rgb(${gray},${gray},${gray})`),
            });
          } else if (effectiveShading === "roughness") {
            const gray = Math.round(rVal * 255);
            mesh.material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(`rgb(${gray},${gray},${gray})`),
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
            if (!stdMat || !stdMat.map) {
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
                customTint.toLowerCase() === "#d6d3d1" ||
                customTint.toLowerCase() === "#ffffff" ||
                customTint.toLowerCase() === (currentTask.primary_color || "").toLowerCase();
              stdMat.color.set(isDefaultTint ? "#ffffff" : customTint);
              if (studioOverrides?.material.roughness !== undefined) {
                stdMat.roughness = studioOverrides.material.roughness;
              }
              if (studioOverrides?.material.metalness !== undefined) {
                stdMat.metalness = studioOverrides.material.metalness;
              }
              stdMat.emissive = new THREE.Color(
                emInt > 0.08
                  ? studioOverrides?.material.accentColor || "#f59e0b"
                  : "#000000"
              );
              stdMat.emissiveIntensity = emInt > 0.08 ? emInt * 0.45 : 0;
              stdMat.flatShading = isFlat;
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

    const isSpecialArtMode =
      studioOverrides?.artStyleMode === "relief" ||
      studioOverrides?.artStyleMode === "text3d" ||
      studioOverrides?.artStyleMode === "voxel";

    const partSpecs = [
      { name: "Part_01_Head_Hood", explodeDir: new THREE.Vector3(0, 0.55, 0) },
      { name: "Part_02_Torso_Cloak", explodeDir: new THREE.Vector3(0, 0.05, 0.25) },
      { name: "Part_03_Left_Arm", explodeDir: new THREE.Vector3(-0.55, 0.1, 0) },
      { name: "Part_04_Right_Arm_Weapon", explodeDir: new THREE.Vector3(0.55, 0.1, 0) },
      { name: "Part_05_Legs_Boots", explodeDir: new THREE.Vector3(0, -0.5, 0) },
    ];

    const mountConfiguredGlbScene = (baseTemplate: THREE.Group) => {
      const loadedRoot = new THREE.Group();
      loadedRoot.name = `AI_GLB_${currentTask.id}`;

      const sceneInstance = baseTemplate.clone(true);
      const hasNativeTexture = !!baseTemplate.userData.hasNativeTexture;
      const explodeAmt = studioOverrides?.explodeFactor || 0;
      const hiddenSet = new Set(studioOverrides?.hiddenParts || []);
      const pose = studioOverrides?.posePreset || "bind";

      let subIdx = 0;
      sceneInstance.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.material = Array.isArray(m.material)
            ? m.material[0].clone()
            : m.material.clone();
          const pIdx = subIdx++;
          m.visible = !hiddenSet.has(pIdx);
          if (pIdx < partSpecs.length) {
            if (explodeAmt > 0) {
              m.position.addScaledVector(partSpecs[pIdx].explodeDir, explodeAmt);
            }
            if (pose !== "bind" && (pIdx === 2 || pIdx === 3)) {
              const sign = pIdx === 2 ? -1 : 1;
              if (pose === "t_pose") m.rotation.z = sign * 0.28;
              else if (pose === "a_pose") m.rotation.z = sign * 0.15;
              else if (pose === "battle") m.rotation.x = -0.25;
            }
          }
        }
      });

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
        const badgeGeo = new THREE.CylinderGeometry(0.22 * dScale, 0.22 * dScale, 0.04, 6);
        badgeGeo.rotateX(Math.PI / 2);
        const badge = new THREE.Mesh(badgeGeo, decalMat);
        badge.name = "Part_Decal_Projected_Emblem";
        const hitPos = decalHitPosRef.current || [0, 0.15, 0.68];
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
            gltf.scene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                meshList.push(m);
                const mat = m.material as THREE.MeshStandardMaterial;
                if (mat && mat.map) {
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

            // Normalize bounding box BEFORE partitioning/exploding so scale never shrinks when Explode > 0
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const normScale = 2.1 / maxDim;

            gltf.scene.position.set(
              -center.x * normScale,
              -box.min.y * normScale - 0.9,
              -center.z * normScale
            );
            gltf.scene.scale.setScalar(normScale);

            // Semantic Auto-Split: Partition single-mesh GLB into 5 anatomical sub-meshes
            if (meshList.length === 1 && meshList[0].geometry?.boundingBox) {
              const srcMesh = meshList[0];
              const srcGeom = srcMesh.geometry;
              const posAttr = srcGeom.attributes.position;
              const bb = srcGeom.boundingBox!;
              const minX = bb.min.x;
              const spanX = Math.max(bb.max.x - bb.min.x, 0.001);
              const minY = bb.min.y;
              const spanY = Math.max(bb.max.y - bb.min.y, 0.001);

              const buckets: number[][] = [[], [], [], [], []];
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

                let bIdx = 1;
                if (ny > 0.62) bIdx = 0;
                else if (ny < 0.26) bIdx = 4;
                else if (nx < 0.28) bIdx = 2;
                else if (nx > 0.72) bIdx = 3;
                buckets[bIdx].push(i0, i1, i2);
              }

              const parentNode = srcMesh.parent || gltf.scene;
              buckets.forEach((indices, pIdx) => {
                if (indices.length === 0) return;
                const subGeom = new THREE.BufferGeometry();
                subGeom.setAttribute("position", posAttr);
                if (srcGeom.attributes.normal) {
                  subGeom.setAttribute("normal", srcGeom.attributes.normal);
                }
                if (srcGeom.attributes.uv) {
                  subGeom.setAttribute("uv", srcGeom.attributes.uv);
                }
                if (srcGeom.attributes.color) {
                  subGeom.setAttribute("color", srcGeom.attributes.color);
                }
                subGeom.setIndex(indices);

                const subMat = Array.isArray(srcMesh.material)
                  ? srcMesh.material[0].clone()
                  : srcMesh.material.clone();
                const subMesh = new THREE.Mesh(subGeom, subMat);
                subMesh.name = partSpecs[pIdx].name;
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

    // Build Humanoid or Quadruped Rig Skeleton Helper + 6-Point Symmetry Markers
    const rigGroup = new THREE.Group();
    const boneMat = new THREE.MeshBasicMaterial({
      color: "#f43f5e",
      wireframe: true,
      depthTest: false,
    });
    const charType = studioOverrides?.rigCharacterType || "humanoid";
    const jointNodes: [number, number, number][] =
      charType === "quadruped_dog" || charType === "quadruped_cat"
        ? [
            [0, 0.25, -0.55],
            [0, 0.32, 0.0],
            [0, 0.42, 0.55],
            [0, 0.85, 0.85],
            [-0.35, -0.45, 0.55],
            [0.35, -0.45, 0.55],
            [-0.35, -0.45, -0.55],
            [0.35, -0.45, -0.55],
            [0, 0.48, -0.95],
          ]
        : [
            [0, -0.6, 0],
            [0, 0.1, 0],
            [0, 0.85, 0],
            [0, 1.45, 0],
            [-0.75, 0.85, 0],
            [0.75, 0.85, 0],
            [-0.85, 0.15, 0],
            [0.85, 0.15, 0],
            [-0.35, -0.95, 0],
            [0.35, -0.95, 0],
          ];
    for (const [jx, jy, jz] of jointNodes) {
      const joint = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), boneMat);
      joint.position.set(jx, jy, jz);
      rigGroup.add(joint);
    }

    if (studioOverrides?.showRigMarkers) {
      const markerDefs: { pos: [number, number, number]; color: string }[] = [
        { pos: [0, 1.15, 0.35], color: "#ef4444" },
        { pos: [0, -0.15, 0.32], color: "#f59e0b" },
        { pos: [-0.62, 0.65, 0.2], color: "#10b981" },
        { pos: [0.62, 0.65, 0.2], color: "#10b981" },
        { pos: [-0.88, 0.25, 0.25], color: "#ec4899" },
        { pos: [0.88, 0.25, 0.25], color: "#ec4899" },
        { pos: [-0.32, -0.55, 0.25], color: "#a855f7" },
        { pos: [0.32, -0.55, 0.25], color: "#a855f7" },
      ];
      for (const mk of markerDefs) {
        const mMat = new THREE.MeshBasicMaterial({
          color: mk.color,
          depthTest: false,
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), mMat);
        sphere.position.set(mk.pos[0], mk.pos[1], mk.pos[2]);
        rigGroup.add(sphere);
      }
    }

    rigGroup.visible = effectiveShowRig || !!studioOverrides?.showRigMarkers;
    scene.add(rigGroup);
    rigHelperRef.current = rigGroup;

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const rawT = clock.getElapsedTime();
      const speed = studioOverrides?.animationSpeed ?? 1;
      const t = rawT * speed;
      const clip = studioOverrides?.animationClip || "none";
      const inPlace = studioOverrides?.inPlaceAnimation ?? true;
      const baseRotY = ((studioOverrides?.transform.rotY || 0) * Math.PI) / 180;

      if (meshGroupRef.current) {
        // Reset procedural animation offsets before applying clip
        meshGroupRef.current.position.set(0, 0, 0);
        meshGroupRef.current.rotation.x = 0;
        meshGroupRef.current.rotation.z = 0;

        const leftArm = meshGroupRef.current.getObjectByName("Part_03_Left_Arm");
        const rightArm = meshGroupRef.current.getObjectByName("Part_04_Right_Arm_Weapon");
        if (leftArm && rightArm) {
          if (clip === "walk") {
            leftArm.rotation.x = Math.sin(t * 5) * 0.14;
            rightArm.rotation.x = -Math.sin(t * 5) * 0.18;
          } else if (clip === "run") {
            leftArm.rotation.x = Math.sin(t * 9) * 0.24;
            rightArm.rotation.x = -Math.sin(t * 9) * 0.28;
          } else if (clip === "attack" || clip === "boxing") {
            leftArm.rotation.x = -0.15 + Math.sin(t * 8) * 0.22;
            rightArm.rotation.x = -0.25 - Math.cos(t * 8) * 0.32;
          } else if (clip === "dance") {
            leftArm.rotation.z = -0.15 + Math.sin(t * 6) * 0.18;
            rightArm.rotation.z = 0.15 - Math.sin(t * 6) * 0.18;
          }
        }

        if (clip === "idle") {
          meshGroupRef.current.position.y = Math.sin(t * 2.5) * 0.08;
          meshGroupRef.current.rotation.z = Math.sin(t * 1.25) * 0.03;
        } else if (clip === "walk") {
          meshGroupRef.current.position.y = Math.abs(Math.sin(t * 5)) * 0.14;
          meshGroupRef.current.rotation.z = Math.sin(t * 5) * 0.08;
          meshGroupRef.current.rotation.x = 0.08;
          if (!inPlace) {
            meshGroupRef.current.position.z = ((t * 1.2) % 4) - 2;
          }
        } else if (clip === "run") {
          meshGroupRef.current.position.y = Math.abs(Math.sin(t * 9)) * 0.24;
          meshGroupRef.current.rotation.z = Math.sin(t * 9) * 0.12;
          meshGroupRef.current.rotation.x = 0.22;
          if (!inPlace) {
            meshGroupRef.current.position.z = ((t * 2.6) % 5) - 2.5;
          }
        } else if (clip === "crouch") {
          meshGroupRef.current.position.y = -0.22 + Math.abs(Math.sin(t * 3.5)) * 0.07;
          meshGroupRef.current.rotation.x = 0.28;
          meshGroupRef.current.rotation.z = Math.sin(t * 3.5) * 0.06;
        } else if (clip === "jump") {
          meshGroupRef.current.position.y = Math.max(0, Math.sin(t * 4)) * 0.65;
          meshGroupRef.current.rotation.x = Math.sin(t * 4) * 0.18;
        } else if (clip === "attack") {
          meshGroupRef.current.rotation.y = baseRotY + t * 6.0;
          meshGroupRef.current.position.y = Math.sin(t * 6) * 0.12;
        } else if (clip === "boxing") {
          meshGroupRef.current.position.z = Math.sin(t * 8) * 0.18;
          meshGroupRef.current.rotation.y = baseRotY + Math.sin(t * 8) * 0.35;
          meshGroupRef.current.position.y = Math.abs(Math.cos(t * 8)) * 0.09;
        } else if (clip === "dance") {
          meshGroupRef.current.position.y = Math.abs(Math.sin(t * 6)) * 0.22;
          meshGroupRef.current.position.x = Math.sin(t * 3) * 0.25;
          meshGroupRef.current.rotation.z = Math.sin(t * 6) * 0.18;
        } else if (clip === "climb") {
          meshGroupRef.current.position.y = ((t * 0.6) % 1.4) - 0.3;
          meshGroupRef.current.rotation.z = Math.sin(t * 5) * 0.09;
        } else if (clip === "quad_gallop") {
          meshGroupRef.current.position.y = Math.abs(Math.sin(t * 7)) * 0.22;
          meshGroupRef.current.rotation.x = Math.cos(t * 7) * 0.22;
          if (!inPlace) {
            meshGroupRef.current.position.z = ((t * 2.2) % 4) - 2;
          }
        }

        if (clip !== "attack" && clip !== "boxing") {
          if (autoRotate) {
            meshGroupRef.current.rotation.y = baseRotY + rawT * 0.45;
          } else {
            meshGroupRef.current.rotation.y = baseRotY;
          }
        }
      }

      if (rigHelperRef.current && rigHelperRef.current.visible && meshGroupRef.current) {
        rigHelperRef.current.rotation.copy(meshGroupRef.current.rotation);
        rigHelperRef.current.position.copy(meshGroupRef.current.position);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 3D Raycaster: Click on 3D Mesh to Select Part, Paint Surface, or Place 3D Decal
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
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
          }

          // If Decal Sticker is enabled, snap the 3D Decal Emblem to the clicked surface point!
          if (studioOverrides?.decalEnabled) {
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

  const handleExportFile = (format: "glb" | "obj" | "stl") => {
    const targetGroup = meshGroupRef.current;
    if (!targetGroup) return;

    const safeName = (activeTask?.preset_type || "model") + "_" + (activeTask?.id || "3d");

    if (format === "glb") {
      const exporter = new GLTFExporter();
      exporter.parse(
        targetGroup,
        (result) => {
          const blob =
            result instanceof ArrayBuffer
              ? new Blob([result], { type: "model/gltf-binary" })
              : new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${safeName}.glb`;
          a.click();
          URL.revokeObjectURL(url);
        },
        () => {},
        { binary: true }
      );
    } else if (format === "obj") {
      const exporter = new OBJExporter();
      const objText = exporter.parse(targetGroup);
      const blob = new Blob([objText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.obj`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Generate valid ASCII STL for 3D Printing Slicers (Bambu Studio / Creality / Cura)
      const lines: string[] = [`solid ${safeName}`];
      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      const vC = new THREE.Vector3();
      const cb = new THREE.Vector3();
      const ab = new THREE.Vector3();

      targetGroup.updateMatrixWorld(true);
      targetGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.visible) {
          const mesh = obj as THREE.Mesh;
          const geom = mesh.geometry.clone();
          geom.applyMatrix4(mesh.matrixWorld);
          const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
          const pos = nonIndexed.getAttribute("position");
          if (!pos) return;
          for (let i = 0; i < pos.count; i += 3) {
            vA.fromBufferAttribute(pos, i);
            vB.fromBufferAttribute(pos, i + 1);
            vC.fromBufferAttribute(pos, i + 2);
            cb.subVectors(vC, vB);
            ab.subVectors(vA, vB);
            cb.cross(ab).normalize();
            lines.push(`facet normal ${cb.x.toFixed(5)} ${cb.y.toFixed(5)} ${cb.z.toFixed(5)}`);
            lines.push("  outer loop");
            lines.push(`    vertex ${vA.x.toFixed(5)} ${vA.y.toFixed(5)} ${vA.z.toFixed(5)}`);
            lines.push(`    vertex ${vB.x.toFixed(5)} ${vB.y.toFixed(5)} ${vB.z.toFixed(5)}`);
            lines.push(`    vertex ${vC.x.toFixed(5)} ${vC.y.toFixed(5)} ${vC.z.toFixed(5)}`);
            lines.push("  endloop");
            lines.push("endfacet");
          }
        }
      });
      lines.push(`endsolid ${safeName}`);
      const blob = new Blob([lines.join("\n")], { type: "model/stl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.stl`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="relative flex-1 min-h-0 bg-[#090709] overflow-hidden flex flex-col">
      {/* Docked Non-Overlapping Top Meshy ViewSwitcher Channel Bar */}
      <div className="h-9 px-2.5 bg-[#110b0e]/95 border-b border-red-500/15 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              { id: "pbr", label: "PBR" },
              { id: "clay", label: "Clay" },
              { id: "wireframe", label: "Wire" },
              { id: "base_color", label: "Albedo" },
              { id: "normal", label: "Normal" },
              { id: "metallic", label: "Metallic" },
              { id: "roughness", label: "Roughness" },
              { id: "ao_curvature", label: "Cavity/AO" },
              { id: "uv_checker", label: "UV Map" },
              { id: "segment", label: "Segments" },
              { id: "printability", label: "Print Check" },
              { id: "filament_sim", label: "Filament" },
            ] as { id: RenderShadingMode; label: string }[]
          ).map((ch) => (
            <button
              key={ch.id}
              onClick={() => setShadingMode(ch.id)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition cursor-pointer ${
                effectiveShading === ch.id
                  ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Canvas Area */}
      <div className="relative flex-1 min-h-0 w-full flex flex-col">
        <div ref={mountRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

        {/* Right-Edge Compact Scene Controls (No Duplicate View Buttons) */}
        <div className="absolute right-3 top-3 z-10 flex flex-col items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setShowRigBones(!showRigBones)}
            title="Toggle Skeleton Rig Bones"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition border cursor-pointer ${
              effectiveShowRig
                ? "bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                : "bg-[#160d11]/90 text-slate-300 border-red-500/15 hover:bg-red-500/10"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Auto-Rotate Turntable"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition border cursor-pointer ${
              autoRotate
                ? "bg-red-500/20 text-red-300 border-red-400/40"
                : "bg-[#160d11]/90 text-slate-400 border-red-500/15 hover:bg-red-500/10"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setLightIntensity((prev) => (prev > 1.6 ? 0.9 : prev + 0.4))}
            title="Studio Lighting Intensity"
            className="w-8 h-8 rounded-full bg-[#160d11]/90 text-slate-300 border border-red-500/15 hover:bg-red-500/10 flex items-center justify-center transition cursor-pointer"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3D Raycast Clicked Part Inspector Bar */}
        {selectedPart && (
          <div className="absolute bottom-14 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#160d11]/95 backdrop-blur-xl border border-red-500/35 shadow-xl pointer-events-auto">
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
              3D Pick: {selectedPart.name}
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
                  className="w-4 h-4 rounded-full border border-white/40 hover:scale-110 transition cursor-pointer"
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
            </div>
            <button
              onClick={handleToggleSelectedPartVisible}
              className="px-2 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-[10px] text-slate-200 font-semibold cursor-pointer"
            >
              ซ่อน/แสดงชิ้นนี้
            </button>
            <button
              onClick={() => setSelectedPart(null)}
              className="text-[10px] text-slate-400 hover:text-white px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Picture-in-Picture 2D Original Input Image (ภาพต้นแบบ) */}
        {activeTask?.input_image_url && !selectedPart && (
          <div
            onClick={() => setExpandRefImg(!expandRefImg)}
            title="คลิกเพื่อขยาย/ย่อ ภาพต้นแบบ 2D ที่ใช้ปั้นโมเดล 3D นี้"
            className={`absolute bottom-13 left-3 z-10 rounded-xl overflow-hidden bg-[#110b0e]/95 backdrop-blur-md border transition-all duration-200 cursor-pointer pointer-events-auto shadow-2xl ${
              activeTask.engine === "trellis_pbr"
                ? "border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                : "border-sky-400/40"
            } ${expandRefImg ? "w-56" : "w-28"}`}
          >
            <div
              className={`px-2 py-1 text-[9px] font-bold flex items-center justify-between ${
                activeTask.engine === "trellis_pbr"
                  ? "bg-gradient-to-r from-amber-500/25 to-red-500/25 text-amber-200"
                  : "bg-sky-500/20 text-sky-200"
              }`}
            >
              <span className="truncate">
                {activeTask.engine === "trellis_pbr"
                  ? "🏆 ต้นแบบตัวท็อป (Pro)"
                  : "⚡ ต้นแบบตัวกลาง (Std)"}
              </span>
              <span className="text-[8px] opacity-80">{expandRefImg ? "ย่อ" : "ขยาย"}</span>
            </div>
            <div className="p-1.5 bg-black/50 flex items-center justify-center">
              <img
                src={activeTask.input_image_url}
                alt="2D Input Reference"
                className={`object-contain rounded-lg ${
                  expandRefImg ? "w-52 h-52" : "w-24 h-24"
                }`}
              />
            </div>
          </div>
        )}

        {/* Bottom Floating Status & Export Pill */}
        <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-[#110b0e]/90 backdrop-blur-md border border-red-500/15 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>
            {Math.round(
              (activeTask?.target_poly_count || 18000) *
                (studioOverrides?.material.polyMultiplier || 1)
            ).toLocaleString()}{" "}
            Polys
          </span>
          <span className="text-slate-600">•</span>
          <span className="uppercase text-red-300 font-semibold">
            {studioOverrides?.artStyleMode && studioOverrides.artStyleMode !== "standard"
              ? studioOverrides.artStyleMode.toUpperCase()
              : activeTask?.topology || "QUAD"}
          </span>
          {studioOverrides?.addPrintBase && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-300 font-semibold">+STL Base</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#110b0e]/90 backdrop-blur-md border border-red-500/15 p-1 rounded-full shadow-xl pointer-events-auto">
          <button
            onClick={() => handleExportFile("glb")}
            className="h-7 px-3.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.GLB</span>
          </button>
          <button
            onClick={() => handleExportFile("obj")}
            className="h-7 px-2.5 rounded-full hover:bg-white/10 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            .OBJ
          </button>
          <button
            onClick={() => handleExportFile("stl")}
            className="h-7 px-2.5 rounded-full hover:bg-red-500/20 text-red-300 text-xs font-semibold transition cursor-pointer"
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
