"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import {
  CAMERA_PRESETS,
  type CameraPresetId,
  type DropLiveryProfile,
  type StudioLightingMode,
} from "@/lib/drop-stage";
import { createF1CarRig, createTurntableAssets } from "./f1-car-model";

interface Props {
  scrollProgress: number;
  targetYaw: number;
  aeroPitch: number;
  livery: DropLiveryProfile;
  preset: CameraPresetId;
  autoSpin: boolean;
  studioMode?: StudioLightingMode;
  carLaunchZ?: number;
  wheelSpeedMultiplier?: number;
  fallbackImage?: string | null;
  fallbackTitle?: string;
}

const STUDIO_RIGS: Record<
  StudioLightingMode,
  {
    bg: number;
    key: number;
    keyInt: number;
    rim: number;
    rimInt: number;
    fill: number;
    fillInt: number;
    hemiInt: number;
    exposure: number;
  }
> = {
  paddock: {
    bg: 0x0b0e14,
    key: 0xfff5e8,
    keyInt: 3.45,
    rim: 0xff381e,
    rimInt: 2.25,
    fill: 0x9bb8e8,
    fillInt: 0.82,
    hemiInt: 0.65,
    exposure: 1.2,
  },
  daylight: {
    bg: 0x131720,
    key: 0xffffff,
    keyInt: 3.7,
    rim: 0x93c5fd,
    rimInt: 1.45,
    fill: 0xdbeafe,
    fillInt: 1.15,
    hemiInt: 0.92,
    exposure: 1.24,
  },
  windtunnel: {
    bg: 0x060b12,
    key: 0xe0f2fe,
    keyInt: 2.75,
    rim: 0x00e5ff,
    rimInt: 2.65,
    fill: 0x38bdf8,
    fillInt: 0.92,
    hemiInt: 0.58,
    exposure: 1.18,
  },
};

/**
 * Isolated WebGL 3D F1 car stage.
 * Zero React setState inside animation loop; supports scroll-driven spinning,
 * live clearcoat livery transitions, studio lighting modes, launch exit physics, drag-to-orbit, and software-GL pacing.
 */
export function F1ShowroomCanvas({
  scrollProgress,
  targetYaw,
  aeroPitch,
  livery,
  preset,
  autoSpin,
  studioMode = "paddock",
  carLaunchZ = 0,
  wheelSpeedMultiplier = 1,
  fallbackImage,
  fallbackTitle,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglStatus, setWebglStatus] = useState<"ready" | "fallback">("ready");

  // Bridge live React props cleanly into the Three.js loop without recreating the scene
  const stateRef = useRef({
    scrollProgress,
    targetYaw,
    aeroPitch,
    livery,
    preset,
    autoSpin,
    studioMode,
    carLaunchZ,
    wheelSpeedMultiplier,
    manualYawOffset: 0,
    manualPitchOffset: 0,
    isDragging: false,
    visible: true,
    dirty: true,
  });

  const requestTickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const s = stateRef.current;
    s.scrollProgress = scrollProgress;
    s.targetYaw = targetYaw;
    s.aeroPitch = aeroPitch;
    s.livery = livery;
    s.preset = preset;
    s.autoSpin = autoSpin;
    s.studioMode = studioMode;
    s.carLaunchZ = carLaunchZ;
    s.wheelSpeedMultiplier = wheelSpeedMultiplier;
    s.dirty = true;
    requestTickRef.current();
  }, [scrollProgress, targetYaw, aeroPitch, livery, preset, autoSpin, studioMode, carLaunchZ, wheelSpeedMultiplier]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWebglStatus("fallback");
      return;
    }

    // 1. Hardware vs software WebGL detection (disposing probe immediately)
    let isSoftwareGl = false;
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
      if (!gl) {
        setWebglStatus("fallback");
        return;
      }
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
        isSoftwareGl = /SwiftShader|llvmpipe|Software Rasterizer/i.test(name);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebglStatus("fallback");
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: "high-performance",
        alpha: false,
        preserveDrawingBuffer: isSoftwareGl,
      });
    } catch {
      setWebglStatus("fallback");
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "pan-y";
    container.appendChild(canvas);

    // 2. Scene, studio fog & procedural RoomEnvironment reflections
    const scene = new THREE.Scene();
    const initStudio = STUDIO_RIGS[stateRef.current.studioMode];
    const sceneBgColor = new THREE.Color(initStudio.bg);
    scene.background = sceneBgColor;
    const sceneFog = new THREE.FogExp2(initStudio.bg, 0.052);
    scene.fog = sceneFog;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    // 3. Camera
    const initPreset = CAMERA_PRESETS[stateRef.current.preset];
    const camera = new THREE.PerspectiveCamera(
      initPreset.fov,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      60
    );
    camera.position.set(...initPreset.position);
    const currentLookAt = new THREE.Vector3(...initPreset.lookAt);
    camera.lookAt(currentLookAt);

    // 4. Dramatic high-contrast automotive studio lighting (sharp key + crisp rim + controlled fill)
    const hemi = new THREE.HemisphereLight(0xcddbff, 0x0b0c10, 0.52);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 3.1);
    keyLight.position.set(4.8, 6.4, 4.4);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.near = 1.5;
      keyLight.shadow.camera.far = 18;
      keyLight.shadow.camera.left = -3.6;
      keyLight.shadow.camera.right = 3.6;
      keyLight.shadow.camera.top = 3.6;
      keyLight.shadow.camera.bottom = -3.6;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const overheadFill = new THREE.DirectionalLight(0xeef3ff, 1.35);
    overheadFill.position.set(-0.6, 6.5, -0.8);
    scene.add(overheadFill);

    const frontFill = new THREE.DirectionalLight(0x9bb8e8, 0.58);
    frontFill.position.set(-4.5, 2.1, 4.2);
    scene.add(frontFill);

    const rimLight = new THREE.DirectionalLight(0xff381e, 1.95);
    rimLight.position.set(-4.8, 3.1, -4.4);
    scene.add(rimLight);

    let areaLight: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      areaLight = new THREE.RectAreaLight(0xffffff, 2.2, 5.2, 1.4);
      areaLight.position.set(0, 4.4, 0.2);
      areaLight.lookAt(0, 0, 0);
      scene.add(areaLight);
    }

    // 5. Turntable floor + Multi-part F1 Car
    const turntable = createTurntableAssets(renderer.capabilities.getMaxAnisotropy());
    scene.add(turntable.floor);
    scene.add(turntable.shadowDisc);

    const car = createF1CarRig(stateRef.current.livery);
    scene.add(car.root);

    // Size observer
    const syncSize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      stateRef.current.dirty = true;
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    // Visibility pause when off-screen + immediate synchronous paint on reveal
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        stateRef.current.visible = entry.isIntersecting;
        if (entry.isIntersecting) {
          lastTime = performance.now();
          stateRef.current.dirty = true;
          renderSceneStep(0.016);
          requestTick();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    // Interactive pointer orbit
    let dragStartX = 0;
    let dragStartY = 0;
    const onPointerDown = (e: PointerEvent) => {
      stateRef.current.isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      requestTick();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!stateRef.current.isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      stateRef.current.manualYawOffset += dx * 0.0085;
      stateRef.current.manualPitchOffset = THREE.MathUtils.clamp(
        stateRef.current.manualPitchOffset + dy * 0.003,
        -0.14,
        0.28
      );
      stateRef.current.dirty = true;
      requestTick();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!stateRef.current.isDragging) return;
      stateRef.current.isDragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
    };
    const onDblClick = () => {
      stateRef.current.manualYawOffset = 0;
      stateRef.current.manualPitchOffset = 0;
      stateRef.current.dirty = true;
      requestTick();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDblClick);

    // Pre-allocated animation state & scratch vectors/colors
    let currentYaw = stateRef.current.targetYaw;
    let prevYaw = currentYaw;
    let currentLaunchZ = stateRef.current.carLaunchZ;
    let idleSpin = 0;
    let lastTime = performance.now();
    let disposed = false;
    let contextLost = false;
    let rafId = 0;
    let cooldownTimer = 0;
    let pollTimer = 0;
    const targetCamPos = new THREE.Vector3();
    const targetLookPos = new THREE.Vector3();
    const targetBgColor = new THREE.Color(initStudio.bg);
    const targetKeyColor = new THREE.Color(initStudio.key);
    const targetRimColor = new THREE.Color(initStudio.rim);
    const targetFillColor = new THREE.Color(initStudio.fill);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
      requestTick();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    const scheduleNext = (fn: () => void) => {
      if (disposed || contextLost) return;
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(fn);
        return;
      }
      const gl = renderer.getContext();
      if (gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          const poll = () => {
            pollTimer = 0;
            if (disposed) {
              gl.deleteSync(sync);
              return;
            }
            const status = gl.clientWaitSync(sync, 0, 0);
            if (status === gl.WAIT_FAILED || status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
              gl.deleteSync(sync);
              cooldownTimer = window.setTimeout(() => {
                cooldownTimer = 0;
                if (!disposed && !rafId) rafId = requestAnimationFrame(fn);
              }, 75);
              return;
            }
            pollTimer = window.setTimeout(poll, 8);
          };
          poll();
          return;
        }
      }
      cooldownTimer = window.setTimeout(() => {
        cooldownTimer = 0;
        if (!disposed && !rafId) rafId = requestAnimationFrame(fn);
      }, 95);
    };

    const renderSceneStep = (dt: number) => {
      const st = stateRef.current;
      if (st.autoSpin && !st.isDragging) {
        idleSpin += dt * (isSoftwareGl ? 0.25 : 0.36);
      }

      const desiredYaw = st.targetYaw + st.manualYawOffset + idleSpin;
      currentYaw = THREE.MathUtils.damp(currentYaw, desiredYaw, 6.2, dt);
      const yawDelta = currentYaw - prevYaw;
      prevYaw = currentYaw;

      currentLaunchZ = THREE.MathUtils.damp(currentLaunchZ, st.carLaunchZ, 7.2, dt);

      car.bodySpinGroup.rotation.y = currentYaw;
      car.bodySpinGroup.rotation.x = THREE.MathUtils.damp(car.bodySpinGroup.rotation.x, st.aeroPitch, 6.0, dt);
      car.bodySpinGroup.position.set(
        Math.sin(currentYaw) * currentLaunchZ,
        0,
        Math.cos(currentYaw) * currentLaunchZ
      );
      turntable.shadowDisc.position.set(
        car.bodySpinGroup.position.x,
        0.011,
        car.bodySpinGroup.position.z
      );
      turntable.shadowDisc.rotation.z = -currentYaw;

      // Subtle turntable degree rotation + wheel rotation driven by chassis spin & pit-launch exit speed
      turntable.floor.rotation.z = -currentYaw * 0.25;
      const launchWheelRate = st.wheelSpeedMultiplier > 1.05 ? dt * st.wheelSpeedMultiplier * 2.2 : 0;
      const wheelAngularMove = (yawDelta * 2.2) + (st.autoSpin ? dt * 1.45 : 0) + launchWheelRate;
      for (const wg of car.wheelGroups) {
        wg.rotation.x += wheelAngularMove;
      }

      // Smoothly interpolate studio lighting rig (Paddock / Daylight / Wind Tunnel)
      const rig = STUDIO_RIGS[st.studioMode];
      const lightAlpha = 1 - Math.exp(-5.5 * dt);
      targetBgColor.setHex(rig.bg);
      targetKeyColor.setHex(rig.key);
      targetRimColor.setHex(rig.rim);
      targetFillColor.setHex(rig.fill);

      sceneBgColor.lerp(targetBgColor, lightAlpha);
      sceneFog.color.copy(sceneBgColor);
      keyLight.color.lerp(targetKeyColor, lightAlpha);
      rimLight.color.lerp(targetRimColor, lightAlpha);
      frontFill.color.lerp(targetFillColor, lightAlpha);
      keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, rig.keyInt, 5.5, dt);
      rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, rig.rimInt, 5.5, dt);
      frontFill.intensity = THREE.MathUtils.damp(frontFill.intensity, rig.fillInt, 5.5, dt);
      hemi.intensity = THREE.MathUtils.damp(hemi.intensity, rig.hemiInt, 5.5, dt);
      renderer.toneMappingExposure = THREE.MathUtils.damp(renderer.toneMappingExposure, rig.exposure, 5.5, dt);

      // Smoothly transition car clearcoat livery colors
      car.updateLivery(st.livery, dt);

      // Smoothly transition camera preset + user vertical pitch offset
      const pSpec = CAMERA_PRESETS[st.preset];
      targetCamPos.set(
        pSpec.position[0],
        Math.max(0.55, pSpec.position[1] + st.manualPitchOffset * 2.2),
        pSpec.position[2]
      );
      targetLookPos.set(pSpec.lookAt[0], pSpec.lookAt[1], pSpec.lookAt[2]);

      const camAlpha = 1 - Math.exp(-5.0 * dt);
      camera.position.lerp(targetCamPos, camAlpha);
      currentLookAt.lerp(targetLookPos, camAlpha);
      camera.lookAt(currentLookAt);
      const desiredFov = camera.aspect < 0.85 ? pSpec.fov + 12 : pSpec.fov;
      if (Math.abs(camera.fov - desiredFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, desiredFov, 5.0, dt);
        camera.updateProjectionMatrix();
      }

      renderer.render(scene, camera);

      const yawError = Math.abs(desiredYaw - currentYaw);
      const launchError = Math.abs(st.carLaunchZ - currentLaunchZ);
      const camError = camera.position.distanceTo(targetCamPos);
      const bgError =
        Math.abs(sceneBgColor.r - targetBgColor.r) +
        Math.abs(sceneBgColor.g - targetBgColor.g) +
        Math.abs(sceneBgColor.b - targetBgColor.b);
      const needsMoreFrames =
        st.autoSpin ||
        st.isDragging ||
        yawError > 0.002 ||
        launchError > 0.01 ||
        camError > 0.005 ||
        bgError > 0.005 ||
        st.dirty;
      st.dirty = false;
      return needsMoreFrames;
    };

    const tick = () => {
      rafId = 0;
      if (disposed || contextLost) return;
      const st = stateRef.current;
      if (!st.visible) return;

      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (renderSceneStep(dt)) {
        scheduleNext(tick);
      }
    };

    const requestTick = () => {
      if (disposed || contextLost) return;
      if (!rafId && !cooldownTimer && !pollTimer) {
        rafId = requestAnimationFrame(tick);
      }
    };
    requestTickRef.current = requestTick;

    // Draw an immediate crisp initial frame so the showroom never displays an empty black buffer
    renderSceneStep(0.016);
    requestTick();

    return () => {
      disposed = true;
      requestTickRef.current = () => {};
      cancelAnimationFrame(rafId);
      window.clearTimeout(cooldownTimer);
      window.clearTimeout(pollTimer);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);

      car.dispose();
      turntable.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  if (webglStatus === "fallback") {
    return (
      <div
        data-testid="f1-3d-fallback"
        className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#090a0c]"
      >
        {fallbackImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fallbackImage}
            alt={fallbackTitle || "Burnout Wheels F1 Drop"}
            className="h-full w-full object-contain p-6 opacity-90"
          />
        ) : (
          <div className="text-center">
            <p className="u-label text-red">Paddock Studio View</p>
            <p className="u-h3 mt-2">{fallbackTitle || "Formula 1 Spec"}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="f1-3d-canvas"
      className="relative h-full w-full cursor-grab active:cursor-grabbing select-none"
      aria-label="Interactive 3D Formula 1 die-cast car showroom — drag to orbit, scroll to spin through drops"
    />
  );
}
