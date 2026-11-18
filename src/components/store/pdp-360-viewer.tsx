"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  PDP_ORBIT_MAX_DISTANCE,
  PDP_ORBIT_MAX_POLAR_RAD,
  PDP_ORBIT_MIN_DISTANCE,
  PDP_ORBIT_MIN_POLAR_RAD,
  PDP_ORBIT_PRESETS,
  clampOrbitDistance,
  clampOrbitPitch,
  normalizeAzimuthDegrees,
  resolveDropLivery,
  sphericalToCartesian,
  type PdpOrbitAngleId,
} from "@/lib/drop-stage";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createF1CarRig, createTurntableAssets } from "./f1-car-model";

const ANGLE_ORDER: PdpOrbitAngleId[] = ["hero", "front", "side", "rear", "top", "cockpit"];

interface ViewerCommand {
  kind: "preset" | "zoom";
  presetId?: PdpOrbitAngleId;
  zoomFactor?: number;
  nonce: number;
}

export function Pdp360Viewer({ product }: { product: Product }) {
  const livery = resolveDropLivery(product);
  const mountRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number>(PDP_ORBIT_PRESETS.hero.azimuthDeg);

  const [webglStatus, setWebglStatus] = useState<"ready" | "fallback">("ready");
  const [activePreset, setActivePreset] = useState<PdpOrbitAngleId | null>("hero");
  const [autoSpin, setAutoSpin] = useState<boolean>(true);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [angleDeg, setAngleDeg] = useState<number>(PDP_ORBIT_PRESETS.hero.azimuthDeg);

  const stateRef = useRef({
    autoSpin: true,
    visible: true,
    dirty: true,
    livery,
  });

  const commandRef = useRef<ViewerCommand | null>(null);
  const requestTickRef = useRef<() => void>(() => {});

  useEffect(() => {
    stateRef.current.livery = livery;
    stateRef.current.dirty = true;
    requestTickRef.current();
  }, [livery]);

  useEffect(() => {
    stateRef.current.autoSpin = autoSpin;
    stateRef.current.dirty = true;
    requestTickRef.current();
  }, [autoSpin]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWebglStatus("fallback");
      return;
    }

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
      });
    } catch {
      setWebglStatus("fallback");
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    // Scene & Environment Reflections
    const scene = new THREE.Scene();
    const bgHex = 0x090a0c;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.048);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    // Camera positioned from hero spherical preset
    const hero = PDP_ORBIT_PRESETS.hero;
    const initAz = THREE.MathUtils.degToRad(hero.azimuthDeg);
    const initPol = clampOrbitPitch(THREE.MathUtils.degToRad(hero.polarDeg));
    const initDist = clampOrbitDistance(hero.distance);

    const camera = new THREE.PerspectiveCamera(
      37,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      60
    );
    camera.position.set(...sphericalToCartesian(initAz, initPol, initDist, hero.targetY));

    // OrbitControls for full 360 horizontal + vertical orbit via mouse drag & 1/2-finger touch
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, hero.targetY, 0);
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.rotateSpeed = 0.92;
    controls.zoomSpeed = 0.85;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.075;
    controls.minPolarAngle = PDP_ORBIT_MIN_POLAR_RAD;
    controls.maxPolarAngle = PDP_ORBIT_MAX_POLAR_RAD;
    controls.minDistance = PDP_ORBIT_MIN_DISTANCE;
    controls.maxDistance = PDP_ORBIT_MAX_DISTANCE;
    controls.autoRotate = stateRef.current.autoSpin;
    controls.autoRotateSpeed = isSoftwareGl ? 1.15 : 1.75;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    controls.update();

    // Prevent accidental page scroll lock when scrolling over canvas without Ctrl/Meta modifier
    const onWheelCapture = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        e.stopPropagation();
      }
    };
    canvas.addEventListener("wheel", onWheelCapture, { capture: true, passive: true });

    // Studio Lighting (warm key + cool overhead + controlled fill + subtle crimson rim)
    const hemi = new THREE.HemisphereLight(0xcddbff, 0x090a0c, 0.44);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.75);
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

    const overheadFill = new THREE.DirectionalLight(0xeef3ff, 1.15);
    overheadFill.position.set(-0.6, 6.5, -0.8);
    scene.add(overheadFill);

    const frontFill = new THREE.DirectionalLight(0x88a8dc, 0.45);
    frontFill.position.set(-4.5, 2.2, 4.2);
    scene.add(frontFill);

    const rimLight = new THREE.DirectionalLight(0xff4228, 1.35);
    rimLight.position.set(-4.8, 3.1, -4.4);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const areaLight = new THREE.RectAreaLight(0xffffff, 2.2, 5.2, 1.4);
      areaLight.position.set(0, 4.4, 0.2);
      areaLight.lookAt(0, 0, 0);
      scene.add(areaLight);
    }

    // Turntable & Shared Ultra-Detailed F1 Car
    const turntable = createTurntableAssets(renderer.capabilities.getMaxAnisotropy());
    scene.add(turntable.floor);
    scene.add(turntable.shadowDisc);

    const car = createF1CarRig(stateRef.current.livery);
    scene.add(car.root);

    // Preset / Zoom transition state (pre-allocated)
    let glideActive = false;
    let glideTargetAz = initAz;
    let glideTargetPol = initPol;
    let glideTargetDist = initDist;
    let glideTargetY = hero.targetY;
    let lastCommandNonce = -1;
    let isDragging = false;
    const sphericalScratch = new THREE.Spherical();
    const offsetScratch = new THREE.Vector3();

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

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        stateRef.current.visible = entry.isIntersecting;
        if (entry.isIntersecting) requestTick();
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    const onControlStart = () => {
      isDragging = true;
      glideActive = false;
      setHasInteracted(true);
      setActivePreset(null);
      if (stateRef.current.autoSpin) {
        stateRef.current.autoSpin = false;
        controls.autoRotate = false;
        setAutoSpin(false);
      }
      requestTick();
    };

    const onControlChange = () => {
      stateRef.current.dirty = true;
      requestTick();
    };

    const onControlEnd = () => {
      isDragging = false;
      stateRef.current.dirty = true;
      requestTick();
    };

    const onDblClick = () => {
      commandRef.current = { kind: "preset", presetId: "hero", nonce: Date.now() };
      setActivePreset("hero");
      setHasInteracted(true);
      requestTick();
    };

    controls.addEventListener("start", onControlStart);
    controls.addEventListener("change", onControlChange);
    controls.addEventListener("end", onControlEnd);
    canvas.addEventListener("dblclick", onDblClick);

    let disposed = false;
    let contextLost = false;
    let rafId = 0;
    let cooldownTimer = 0;
    let pollTimer = 0;
    let lastTime = performance.now();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
      stateRef.current.dirty = true;
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

    const renderSceneStep = (dt: number): boolean => {
      const st = stateRef.current;
      controls.autoRotate = st.autoSpin && !glideActive;

      // Consume queued preset or zoom button command
      const cmd = commandRef.current;
      if (cmd && cmd.nonce !== lastCommandNonce) {
        lastCommandNonce = cmd.nonce;
        offsetScratch.copy(camera.position).sub(controls.target);
        sphericalScratch.setFromVector3(offsetScratch);

        if (cmd.kind === "preset" && cmd.presetId) {
          const p = PDP_ORBIT_PRESETS[cmd.presetId];
          glideTargetAz = THREE.MathUtils.degToRad(p.azimuthDeg);
          glideTargetPol = clampOrbitPitch(THREE.MathUtils.degToRad(p.polarDeg));
          glideTargetDist = clampOrbitDistance(p.distance);
          glideTargetY = p.targetY;
          glideActive = true;
        } else if (cmd.kind === "zoom" && cmd.zoomFactor) {
          glideTargetAz = sphericalScratch.theta;
          glideTargetPol = clampOrbitPitch(sphericalScratch.phi);
          glideTargetDist = clampOrbitDistance(sphericalScratch.radius * cmd.zoomFactor);
          glideTargetY = controls.target.y;
          glideActive = true;
        }
      }

      if (glideActive) {
        offsetScratch.copy(camera.position).sub(controls.target);
        sphericalScratch.setFromVector3(offsetScratch);

        // Shortest-arc azimuth interpolation
        let azDiff = glideTargetAz - sphericalScratch.theta;
        while (azDiff > Math.PI) azDiff -= Math.PI * 2;
        while (azDiff < -Math.PI) azDiff += Math.PI * 2;

        const alpha = 1 - Math.exp(-8.0 * dt);
        const nextAz = sphericalScratch.theta + azDiff * alpha;
        const nextPol = THREE.MathUtils.lerp(sphericalScratch.phi, glideTargetPol, alpha);
        const nextDist = THREE.MathUtils.lerp(sphericalScratch.radius, glideTargetDist, alpha);
        controls.target.y = THREE.MathUtils.lerp(controls.target.y, glideTargetY, alpha);

        camera.position.set(...sphericalToCartesian(nextAz, nextPol, nextDist, controls.target.y));
        camera.lookAt(controls.target);

        if (
          Math.abs(azDiff) < 0.004 &&
          Math.abs(glideTargetPol - nextPol) < 0.004 &&
          Math.abs(glideTargetDist - nextDist) < 0.01
        ) {
          glideActive = false;
        }
      } else {
        controls.update();
      }

      car.updateLivery(st.livery, dt);
      renderer.render(scene, camera);

      // Throttled azimuth readout (only updates React when rounded integer degree changes)
      const azDeg = normalizeAzimuthDegrees(controls.getAzimuthalAngle());
      if (azDeg !== lastAngleRef.current) {
        lastAngleRef.current = azDeg;
        setAngleDeg(azDeg);
      }

      const needsMore = st.autoSpin || isDragging || glideActive || st.dirty;
      st.dirty = false;
      return needsMore;
    };

    const tick = () => {
      rafId = 0;
      if (disposed || contextLost) return;
      if (!stateRef.current.visible) return;

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

    // Immediate first frame
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
      canvas.removeEventListener("wheel", onWheelCapture, { capture: true });
      controls.removeEventListener("start", onControlStart);
      controls.removeEventListener("change", onControlChange);
      controls.removeEventListener("end", onControlEnd);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);

      controls.dispose();
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

  const triggerPreset = (presetId: PdpOrbitAngleId) => {
    setActivePreset(presetId);
    setAutoSpin(false);
    setHasInteracted(true);
    commandRef.current = { kind: "preset", presetId, nonce: Date.now() };
    stateRef.current.autoSpin = false;
    stateRef.current.dirty = true;
    requestTickRef.current();
  };

  const triggerZoom = (factor: number) => {
    setActivePreset(null);
    setHasInteracted(true);
    commandRef.current = { kind: "zoom", zoomFactor: factor, nonce: Date.now() };
    stateRef.current.dirty = true;
    requestTickRef.current();
  };

  if (webglStatus === "fallback") {
    return (
      <div
        data-testid="pdp-360-fallback"
        className="relative flex aspect-[16/11] w-full items-center justify-center overflow-hidden border border-line bg-[#090a0c] sm:aspect-[4/3]"
      >
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-contain p-6"
          />
        ) : (
          <div className="text-center">
            <p className="u-label text-red">360° Studio Spec</p>
            <p className="u-h3 mt-2">{product.name}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 w-full flex-col border border-line bg-[#090a0c]">
      {/* Main Interactive 360° Canvas Stage */}
      <div className="relative aspect-[16/11] w-full overflow-hidden sm:aspect-[4/3]">
        <div
          ref={mountRef}
          data-testid="pdp-360-canvas"
          className="h-full w-full cursor-grab active:cursor-grabbing select-none"
          aria-label={`Interactive 360-degree 3D model of ${product.name} — drag or swipe to spin and inspect from all angles`}
        />

        {/* Crisp solid-backed telemetry corner readout (no backdrop-blur over WebGL) */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 border border-line bg-[#0c0e13]/95 px-2.5 py-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-red">360° F1 Spec</span>
          <span className="h-2.5 w-px bg-line" aria-hidden />
          <span className="u-mono text-[11px] font-medium tabular-nums text-bone" data-testid="pdp-360-angle">
            {String(angleDeg).padStart(3, "0")}°
          </span>
        </div>

        {!hasInteracted && (
          <div className="pointer-events-none absolute right-3 top-3 border border-line bg-[#0c0e13]/95 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-fog">
            <span className="sm:hidden">Swipe 360°</span>
            <span className="hidden sm:inline">Drag or swipe to spin</span>
          </div>
        )}
      </div>

      {/* Unobstructed Bottom Control Deck (below WebGL viewport so car is 100% clear) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel/90 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Camera inspection angles">
          {ANGLE_ORDER.map((id) => {
            const spec = PDP_ORBIT_PRESETS[id];
            const selected = activePreset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => triggerPreset(id)}
                aria-pressed={selected}
                className={cn(
                  "min-h-[38px] border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] transition-colors",
                  selected
                    ? "border-red bg-red text-bone"
                    : "border-line bg-ink text-fog hover:border-fog/50 hover:text-bone"
                )}
              >
                {spec.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setAutoSpin((prev) => !prev);
              setHasInteracted(true);
            }}
            aria-pressed={autoSpin}
            aria-label={autoSpin ? "Pause 360° auto-rotation" : "Resume 360° auto-rotation"}
            className={cn(
              "inline-flex min-h-[38px] items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] transition-colors",
              autoSpin ? "border-bone/50 bg-bone/10 text-bone" : "border-line bg-ink text-fog hover:text-bone"
            )}
          >
            {autoSpin ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            <span>Spin</span>
          </button>

          <button
            type="button"
            onClick={() => triggerZoom(0.82)}
            aria-label="Zoom in on 3D car"
            className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center border border-line bg-ink text-fog transition-colors hover:border-fog/50 hover:text-bone"
          >
            <ZoomIn className="size-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => triggerZoom(1.22)}
            aria-label="Zoom out on 3D car"
            className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center border border-line bg-ink text-fog transition-colors hover:border-fog/50 hover:text-bone"
          >
            <ZoomOut className="size-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoSpin(false);
              triggerPreset("hero");
            }}
            aria-label="Reset 360° camera view"
            className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center border border-line bg-ink text-fog transition-colors hover:border-fog/50 hover:text-bone"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
