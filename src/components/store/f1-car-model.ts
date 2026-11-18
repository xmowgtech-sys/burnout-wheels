import * as THREE from "three";
import type { DropLiveryProfile } from "@/lib/drop-stage";

export interface F1CarRig {
  root: THREE.Group;
  bodySpinGroup: THREE.Group;
  wheelGroups: THREE.Group[];
  updateLivery: (profile: DropLiveryProfile, dt: number) => void;
  dispose: () => void;
}

function createCarbonTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 256;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext("2d")!;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext("2d")!;

  cctx.fillStyle = "#121418";
  cctx.fillRect(0, 0, size, size);
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, size, size);

  // 2x2 diagonal carbon twill weave
  const cell = 8;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const idx = (x / cell + y / cell) & 3;
      const bright = idx === 0 || idx === 1;
      cctx.fillStyle = bright ? "#1e232c" : "#0b0d11";
      cctx.fillRect(x, y, cell, cell);
      cctx.fillStyle = bright ? "rgba(255,255,255,0.085)" : "rgba(0,0,0,0.34)";
      cctx.fillRect(x + 1, y + 1, cell - 2, cell / 2);

      bctx.fillStyle = bright ? "#d4d4d4" : "#3a3a3a";
      bctx.fillRect(x, y, cell, cell);
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(10, 10);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(10, 10);

  return { map, bumpMap };
}

function createTireTreadTextures(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext("2d")!;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext("2d")!;

  cctx.fillStyle = "#121316";
  cctx.fillRect(0, 0, size, size);

  rctx.fillStyle = "#e0e0e0";
  rctx.fillRect(0, 0, size, size);

  // Authentic warm scrub / vulcanized slick grain + subtle mold seam & shoulder wear bands
  for (let i = 0; i < 4200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 19341.123) % 1;
    const px = Math.abs(x) * size;
    const py = Math.abs(y) * size;
    const v = 14 + Math.floor((Math.abs(Math.sin(i * 3.1)) * 12));
    cctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    cctx.fillRect(px, py, 2 + (i % 3), 2);
    const rv = 200 + (i % 50);
    rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rctx.fillRect(px, py, 3, 2);
  }

  // Subtle longitudinal center mold line + shoulder scrub shading
  const shoulderGrad = cctx.createLinearGradient(0, 0, size, 0);
  shoulderGrad.addColorStop(0, "rgba(10,11,13,0.42)");
  shoulderGrad.addColorStop(0.18, "rgba(0,0,0,0)");
  shoulderGrad.addColorStop(0.5, "rgba(42,43,48,0.14)");
  shoulderGrad.addColorStop(0.82, "rgba(0,0,0,0)");
  shoulderGrad.addColorStop(1, "rgba(10,11,13,0.42)");
  cctx.fillStyle = shoulderGrad;
  cctx.fillRect(0, 0, size, size);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap, bumpMap: roughnessMap };
}

function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  centerAngle: number,
  charSpacingRad: number,
  invertBottom = false
) {
  ctx.save();
  const totalSpan = (text.length - 1) * charSpacingRad;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const offset = -totalSpan * 0.5 + i * charSpacingRad;
    const ang = invertBottom ? centerAngle - offset : centerAngle + offset;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.rotate(invertBottom ? ang - Math.PI / 2 : ang + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function createSidewallTexture(accentHex: string): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Subtle dark rubber sidewall shading + embossed bead rings
  const beadGrad = ctx.createRadialGradient(cx, cy, 340, cx, cy, 505);
  beadGrad.addColorStop(0, "rgba(0,0,0,0)");
  beadGrad.addColorStop(0.5, "rgba(255,255,255,0.03)");
  beadGrad.addColorStop(0.9, "rgba(0,0,0,0.22)");
  beadGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = beadGrad;
  ctx.fillRect(0, 0, size, size);

  // Dual compound curved stripes (Pirelli P-Zero signature arc)
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, 424, -Math.PI * 0.28, Math.PI * 0.28);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 424, Math.PI * 0.72, Math.PI * 1.28);
  ctx.stroke();

  // Crisp inner compound pin-ring
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 376, 0, Math.PI * 2);
  ctx.stroke();

  // Curved PIRELLI (top arc) & P ZERO (bottom arc) motorsport sidewall stencil
  ctx.fillStyle = "#f2f2ed";
  ctx.font = "900 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawCurvedText(ctx, "PIRELLI", cx, cy, 422, -Math.PI / 2, 0.095, false);

  ctx.fillStyle = accentHex;
  ctx.font = "900 32px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawCurvedText(ctx, "P ZERO", cx, cy, 422, Math.PI / 2, 0.092, true);

  // Micro FIA RFID tire barcode decal on right sidewall shoulder
  ctx.save();
  ctx.translate(cx + 392, cy);
  ctx.fillStyle = "#f4f4f0";
  ctx.fillRect(-10, -26, 20, 52);
  ctx.fillStyle = "#111";
  for (let b = -20; b <= 18; b += 5) {
    ctx.fillRect(-7, b, 14, b % 2 === 0 ? 3 : 2);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createNumberPlateTexture(carNumber: string, textColor: string, accentHex?: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 512);

  if (accentHex) {
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(96, 420);
    ctx.lineTo(416, 420);
    ctx.stroke();
  }

  ctx.fillStyle = textColor;
  ctx.font = "900 310px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(256, 260);
  ctx.transform(1, 0, -0.22, 1, 0, 0);
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(carNumber, 0, 0);
  ctx.fillText(carNumber, 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function drawWheelCoverTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 34, cx, cy, 250);
  grad.addColorStop(0, "#242934");
  grad.addColorStop(0.32, "#181b22");
  grad.addColorStop(0.75, "#111318");
  grad.addColorStop(1, "#0b0c10");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Carbon radial aero cover ribs + subtle metallic BBS spoke shadows underneath
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    ctx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.6)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62);
    ctx.lineTo(cx + Math.cos(a + 0.16) * 234, cy + Math.sin(a + 0.16) * 234);
    ctx.stroke();
  }

  // Concentric precision machined lip grooves
  for (const r of [90, 148, 212, 240]) {
    ctx.strokeStyle = r === 240 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = r === 240 ? 4 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Draws a crisp silhouette of the iconic charging Red Bull motif oriented toward nose (-Y in UV with flipY=false).
 */
function drawChargingBullSilhouette(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, fill = "#e10600") {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = fill;
  ctx.beginPath();
  // Head & forward-swept horns charging left
  ctx.moveTo(-48, -10);
  ctx.lineTo(-64, -22);
  ctx.lineTo(-50, -17);
  ctx.lineTo(-34, -24);
  // Muscular shoulder hump & dorsal curve
  ctx.quadraticCurveTo(-8, -32, 16, -18);
  ctx.quadraticCurveTo(38, -12, 52, -4);
  // Whipping tail
  ctx.lineTo(74, -18);
  ctx.lineTo(62, 0);
  // Hindquarters & back legs thrusting
  ctx.lineTo(48, 20);
  ctx.lineTo(36, 22);
  ctx.lineTo(34, 6);
  // Ribcage underside
  ctx.quadraticCurveTo(10, 10, -14, 14);
  // Front forelegs
  ctx.lineTo(-28, 24);
  ctx.lineTo(-36, 20);
  ctx.lineTo(-28, 2);
  ctx.lineTo(-42, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * High-resolution 1024x1024 fuselage livery texture mapped onto buildLoftedMeshGeometry UV space (flipY = false).
 * u = 0 top centerline, u = 0.25 right flank, u = 0.5 belly, u = 0.75 left flank; v = 0 nose tip -> v = 1 rear tail.
 */
function createChassisLiveryTexture(profile: DropLiveryProfile): THREE.CanvasTexture {
  const W = 1024;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const isRB20 = profile.key === "redbull";

  // Base team finish
  ctx.fillStyle = isRB20 ? "#0c1638" : profile.primaryHex;
  ctx.fillRect(0, 0, W, H);

  // Subtle satin shading along upper shoulders
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(255,255,255,0.06)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Weight-saving exposed matte 2x2 carbon fiber along lower monocoque & belly skirt (u in [0.34 .. 0.66])
  ctx.fillStyle = "#101216";
  ctx.fillRect(W * 0.34, 0, W * 0.32, H);
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let y = 0; y < H; y += 8) {
    for (let x = Math.floor(W * 0.34); x < W * 0.66; x += 8) {
      if (((x + y) / 8) % 2 === 0) ctx.fillRect(x, y, 4, 4);
    }
  }

  // Team pinstripe separating painted body from raw carbon skirt
  ctx.fillStyle = isRB20 ? "#e10600" : profile.accentHex;
  ctx.fillRect(W * 0.334, H * 0.08, W * 0.008, H * 0.88);
  ctx.fillRect(W * 0.658, H * 0.08, W * 0.008, H * 0.88);

  if (isRB20) {
    // 1. Iconic Golden Yellow RB20 Nosecone Ring + Crimson Nose Tip Band (wraps cleanly across u = 0 / u = 1)
    ctx.fillStyle = "#ffd100";
    ctx.fillRect(0, H * 0.018, W * 0.22, H * 0.095);
    ctx.fillRect(W * 0.78, H * 0.018, W * 0.22, H * 0.095);

    ctx.fillStyle = "#e10600";
    ctx.fillRect(0, 0, W * 0.25, H * 0.028);
    ctx.fillRect(W * 0.75, 0, W * 0.25, H * 0.028);

    // 2. Crisp "HONDA" wing logo flanks near front nose
    for (const isRight of [true, false]) {
      ctx.save();
      if (isRight) {
        ctx.translate(W * 0.19, H * 0.18);
        ctx.transform(0, 1, 1, 0, 0, 0);
      } else {
        ctx.translate(W * 0.81, H * 0.18);
        ctx.transform(0, -1, -1, 0, 0, 0);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("HONDA", 0, 0);
      ctx.restore();
    }

    // 3. Golden Yellow Sun Disc & Charging Red Bull centered cleanly on upper engine cover shoulder (v = 0.58 .. 0.78)
    for (const isRight of [true, false]) {
      const flankU = isRight ? W * 0.215 : W * 0.785;
      const flankV = H * 0.65;

      // Golden Sun disc behind bull
      ctx.fillStyle = "#ffd100";
      ctx.beginPath();
      ctx.ellipse(flankU, flankV, W * 0.064, H * 0.078, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic Charging Bull graphic oriented charging nose-forward
      ctx.save();
      if (isRight) {
        ctx.translate(flankU, flankV);
        ctx.transform(0, 1, 1, 0, 0, 0);
      } else {
        ctx.translate(flankU, flankV);
        ctx.transform(0, -1, -1, 0, 0, 0);
      }
      drawChargingBullSilhouette(ctx, 0, 0, 0.88, "#e10600");
      ctx.restore();
    }

    // 4. Crisp "ORACLE" white wordmark across upper airbox shoulder
    for (const isRight of [true, false]) {
      ctx.save();
      ctx.translate(isRight ? W * 0.11 : W * 0.89, H * 0.52);
      ctx.transform(isRight ? 0 : 0, isRight ? 1 : -1, isRight ? 1 : -1, 0, 0, 0);
      ctx.fillStyle = "#f4f4f0";
      ctx.font = "800 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ORACLE", 0, 0);
      ctx.restore();
    }
  } else {
    // Crisp motorsport nose trim & side graphics for other catalog F1/road teams
    ctx.fillStyle = profile.accentHex;
    ctx.fillRect(0, H * 0.02, W * 0.16, H * 0.055);
    ctx.fillRect(W * 0.84, H * 0.02, W * 0.16, H * 0.055);

    ctx.fillStyle = profile.secondaryHex;
    ctx.fillRect(0, H * 0.55, W * 0.24, H * 0.022);
    ctx.fillRect(W * 0.76, H * 0.55, W * 0.24, H * 0.022);
  }

  // Precision FIA panel gaps & engine cover titanium quick-release Dzus fasteners
  ctx.strokeStyle = "rgba(0,0,0,0.48)";
  ctx.lineWidth = 2;
  for (const seamV of [0.22, 0.44, 0.54, 0.84]) {
    ctx.beginPath();
    ctx.moveTo(0, H * seamV);
    ctx.lineTo(W, H * seamV);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(215, 224, 240, 0.48)";
  for (let i = 0; i < 16; i++) {
    const vy = H * (0.56 + i * 0.019);
    ctx.beginPath();
    ctx.arc(W * 0.285, vy, 2.2, 0, Math.PI * 2);
    ctx.arc(W * 0.715, vy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Sidepod flank UV livery texture (flipY = false):
 * Right sidepod (side = +1) outer flank is u = 0.25; Left sidepod (side = -1) outer flank is u = 0.75.
 */
function createSidepodLiveryTexture(profile: DropLiveryProfile): THREE.CanvasTexture {
  const W = 1024;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const isRB20 = profile.key === "redbull";
  ctx.fillStyle = isRB20 ? "#0c1638" : profile.primaryHex;
  ctx.fillRect(0, 0, W, H);

  // Dark carbon lower undercut shelf (u in [0.32 .. 0.68])
  ctx.fillStyle = "#101216";
  ctx.fillRect(W * 0.32, 0, W * 0.36, H);

  // Sweeping racing accent pinstripe along lower shoulder
  ctx.fillStyle = isRB20 ? "#e10600" : profile.accentHex;
  ctx.fillRect(W * 0.312, H * 0.04, W * 0.014, H * 0.92);
  ctx.fillRect(W * 0.674, H * 0.04, W * 0.014, H * 0.92);

  if (isRB20) {
    ctx.fillStyle = "#ffd100";
    ctx.fillRect(W * 0.298, H * 0.06, W * 0.008, H * 0.85);
    ctx.fillRect(W * 0.694, H * 0.06, W * 0.008, H * 0.85);
  }

  // Sponsor wordmark on both outer flanks (u = 0.22 and u = 0.78)
  const label = isRB20 ? "ORACLE" : profile.teamLabel.split(" ")[0]?.toUpperCase() ?? "F1";
  for (const isRight of [true, false]) {
    ctx.save();
    ctx.translate(isRight ? W * 0.225 : W * 0.775, H * 0.44);
    if (isRight) {
      ctx.transform(0, 1, 1, 0, 0, 0);
    } else {
      ctx.transform(0, -1, -1, 0, 0, 0);
    }
    ctx.fillStyle = "#f7f7f2";
    ctx.font = "900 58px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);

    if (isRB20) {
      ctx.fillStyle = "#ffd100";
      ctx.font = "800 22px system-ui, sans-serif";
      ctx.fillText("BYBIT", -240, 2);
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Rear wing DRS flap UV texture (span left-to-right matches -X to +X when viewed from behind).
 */
function createRearWingTexture(profile: DropLiveryProfile): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const isRB20 = profile.key === "redbull";
  ctx.fillStyle = isRB20 ? "#0c1638" : profile.accentHex;
  ctx.fillRect(0, 0, W, H);

  // Red upper lip accent band
  ctx.fillStyle = isRB20 ? "#e10600" : profile.primaryHex;
  ctx.fillRect(0, 0, W, H * 0.14);
  ctx.fillRect(0, H * 0.86, W, H * 0.14);

  // Centered ORACLE / team DRS wing stencil
  const word = isRB20 ? "ORACLE" : profile.teamLabel.split(" ")[0]?.toUpperCase() ?? "RACING";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 112px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, W * 0.5, H * 0.5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createTurntableAssets(maxAnisotropy: number): {
  floor: THREE.Mesh;
  shadowDisc: THREE.Mesh;
  dispose: () => void;
} {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;

  const baseGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.5);
  baseGrad.addColorStop(0, "#14171f");
  baseGrad.addColorStop(0.42, "#0d0f14");
  baseGrad.addColorStop(0.76, "#090a0d");
  baseGrad.addColorStop(1, "#08090b");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle dark pit-lane asphalt aggregate micro-speckle
  for (let i = 0; i < 6500; i++) {
    const gx = Math.abs((Math.sin(i * 19.31) * 41293.7) % 1) * size;
    const gy = Math.abs((Math.sin(i * 47.71) * 29183.3) % 1) * size;
    const bright = (i % 5) === 0 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.22)";
    ctx.fillStyle = bright;
    ctx.fillRect(gx, gy, 2, 2);
  }

  ctx.strokeStyle = "rgba(244, 244, 240, 0.075)";
  ctx.lineWidth = 1.5;
  for (const r of [150, 245, 340, 420]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(225, 6, 0, 0.5)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 340, -Math.PI * 0.18, Math.PI * 0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 340, Math.PI * 0.82, Math.PI * 1.42);
  ctx.stroke();

  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    const major = deg % 90 === 0;
    const mid = deg % 30 === 0;
    const r0 = major ? 215 : mid ? 324 : 332;
    const r1 = 340;
    ctx.strokeStyle = major ? "rgba(225, 6, 0, 0.58)" : mid ? "rgba(244, 244, 240, 0.18)" : "rgba(244, 244, 240, 0.065)";
    ctx.lineWidth = major ? 2.5 : 1.25;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0);
    ctx.lineTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
    ctx.stroke();
  }

  const floorTex = new THREE.CanvasTexture(canvas);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.anisotropy = Math.min(8, maxAnisotropy);

  const floorGeo = new THREE.CircleGeometry(8.5, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.88,
    metalness: 0.05,
    envMapIntensity: 0.16,
    polygonOffset: true,
    polygonOffsetFactor: 1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;

  const sc = document.createElement("canvas");
  sc.width = 256;
  sc.height = 512;
  const sctx = sc.getContext("2d")!;
  const sg = sctx.createRadialGradient(128, 256, 16, 128, 256, 128);
  sg.addColorStop(0, "rgba(0,0,0,0.90)");
  sg.addColorStop(0.55, "rgba(0,0,0,0.48)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 256, 512);

  const shadowTex = new THREE.CanvasTexture(sc);
  const shadowGeo = new THREE.PlaneGeometry(2.5, 5.25);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.84,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.011;

  return {
    floor,
    shadowDisc,
    dispose: () => {
      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
    },
  };
}

function buildLoftedMeshGeometry(rings: Array<{ z: number; points: Array<[number, number]> }>): THREE.BufferGeometry {
  const numStations = rings.length;
  const ringCount = rings[0]!.points.length;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < numStations; i++) {
    const { z, points } = rings[i]!;
    const v = i / Math.max(1, numStations - 1);
    for (let j = 0; j < ringCount; j++) {
      const [x, y] = points[j]!;
      positions.push(x, y, z);
      uvs.push(j / ringCount, v);
    }
  }

  for (let i = 0; i < numStations - 1; i++) {
    const rowA = i * ringCount;
    const rowB = (i + 1) * ringCount;
    for (let j = 0; j < ringCount; j++) {
      const jNext = (j + 1) % ringCount;
      const a = rowA + j;
      const b = rowA + jNext;
      const c = rowB + jNext;
      const d = rowB + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  const frontRing = rings[0]!;
  let fcx = 0;
  let fcy = 0;
  for (const [x, y] of frontRing.points) {
    fcx += x;
    fcy += y;
  }
  fcx /= ringCount;
  fcy /= ringCount;
  const frontCenterIdx = positions.length / 3;
  positions.push(fcx, fcy, frontRing.z);
  uvs.push(0.5, 0);
  for (let j = 0; j < ringCount; j++) {
    const jNext = (j + 1) % ringCount;
    indices.push(frontCenterIdx, jNext, j);
  }

  const rearRing = rings[numStations - 1]!;
  let rcx = 0;
  let rcy = 0;
  for (const [x, y] of rearRing.points) {
    rcx += x;
    rcy += y;
  }
  rcx /= ringCount;
  rcy /= ringCount;
  const rearCenterIdx = positions.length / 3;
  positions.push(rcx, rcy, rearRing.z);
  uvs.push(0.5, 1);
  const rearRowStart = (numStations - 1) * ringCount;
  for (let j = 0; j < ringCount; j++) {
    const jNext = (j + 1) % ringCount;
    indices.push(rearCenterIdx, rearRowStart + j, rearRowStart + jNext);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface FuselageStationSpec {
  z: number;
  halfW: number;
  yBot: number;
  yTop: number;
  topNarrow: number;
  cockpitDip: number;
}

function createF1FuselageGeo(): THREE.BufferGeometry {
  const keyStations: FuselageStationSpec[] = [
    { z: 2.24, halfW: 0.052, yBot: 0.132, yTop: 0.184, topNarrow: 0.74, cockpitDip: 0 },
    { z: 2.12, halfW: 0.074, yBot: 0.142, yTop: 0.222, topNarrow: 0.75, cockpitDip: 0 },
    { z: 1.86, halfW: 0.100, yBot: 0.160, yTop: 0.285, topNarrow: 0.77, cockpitDip: 0 },
    { z: 1.48, halfW: 0.132, yBot: 0.172, yTop: 0.360, topNarrow: 0.79, cockpitDip: 0 },
    { z: 1.04, halfW: 0.178, yBot: 0.160, yTop: 0.455, topNarrow: 0.81, cockpitDip: 0 },
    { z: 0.72, halfW: 0.242, yBot: 0.115, yTop: 0.520, topNarrow: 0.84, cockpitDip: 0 },
    { z: 0.50, halfW: 0.268, yBot: 0.092, yTop: 0.528, topNarrow: 0.86, cockpitDip: 0.02 },
    { z: 0.34, halfW: 0.278, yBot: 0.090, yTop: 0.515, topNarrow: 0.88, cockpitDip: 0.145 },
    { z: 0.08, halfW: 0.282, yBot: 0.090, yTop: 0.515, topNarrow: 0.88, cockpitDip: 0.175 },
    { z: -0.14, halfW: 0.268, yBot: 0.092, yTop: 0.560, topNarrow: 0.82, cockpitDip: 0.07 },
    { z: -0.28, halfW: 0.245, yBot: 0.094, yTop: 0.845, topNarrow: 0.52, cockpitDip: 0 },
    { z: -0.44, halfW: 0.228, yBot: 0.096, yTop: 0.945, topNarrow: 0.42, cockpitDip: 0 },
    { z: -0.68, halfW: 0.212, yBot: 0.100, yTop: 0.875, topNarrow: 0.38, cockpitDip: 0 },
    { z: -1.08, halfW: 0.186, yBot: 0.106, yTop: 0.700, topNarrow: 0.36, cockpitDip: 0 },
    { z: -1.52, halfW: 0.145, yBot: 0.120, yTop: 0.490, topNarrow: 0.48, cockpitDip: 0 },
    { z: -1.86, halfW: 0.095, yBot: 0.155, yTop: 0.365, topNarrow: 0.65, cockpitDip: 0 },
    { z: -2.02, halfW: 0.068, yBot: 0.180, yTop: 0.320, topNarrow: 0.75, cockpitDip: 0 },
  ];

  const sampleCount = 40;
  const curveZ = new THREE.CatmullRomCurve3(keyStations.map((s) => new THREE.Vector3(0, 0, s.z)));
  const curveDimsA = new THREE.CatmullRomCurve3(keyStations.map((s) => new THREE.Vector3(s.halfW, s.yBot, s.yTop)));
  const curveDimsB = new THREE.CatmullRomCurve3(keyStations.map((s) => new THREE.Vector3(s.topNarrow, s.cockpitDip, 0)));

  const radialSegments = 32;
  const rings: Array<{ z: number; points: Array<[number, number]> }> = [];

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const z = curveZ.getPoint(t).z;
    const dA = curveDimsA.getPoint(t);
    const dB = curveDimsB.getPoint(t);

    const halfW = Math.max(0.03, dA.x);
    const yBot = dA.y;
    const yTop = Math.max(yBot + 0.04, dA.z);
    const topNarrow = THREE.MathUtils.clamp(dB.x, 0.32, 0.95);
    const cockpitDip = Math.max(0, dB.y);

    const midY = (yBot + yTop) * 0.5;
    const halfH = (yTop - yBot) * 0.5;
    const pts: Array<[number, number]> = [];

    for (let j = 0; j < radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      const upperFactor = cosT > 0 ? Math.pow(cosT, 0.85) : 0;
      const widthScale = THREE.MathUtils.lerp(1.0, topNarrow, upperFactor);
      const x = Math.sign(sinT) * Math.pow(Math.abs(sinT), 0.84) * halfW * widthScale;

      let y = midY + (cosT >= 0 ? Math.pow(cosT, 0.9) : -Math.pow(-cosT, 0.65)) * halfH;

      if (cockpitDip > 0.004 && cosT > 0.25) {
        const centerProximity = Math.max(0, 1 - Math.abs(x) / (halfW * 0.68));
        y -= cockpitDip * Math.pow(centerProximity, 1.8) * Math.pow(cosT, 1.2);
      }

      pts.push([x, y]);
    }
    rings.push({ z, points: pts });
  }

  return buildLoftedMeshGeometry(rings);
}

/**
 * RB20-signature longitudinal "cannon deck" cooling spine bulge flanking the upper engine cover.
 */
function createCannonDeckSpineGeo(sideSign: 1 | -1): THREE.BufferGeometry {
  const specs = [
    { z: -0.22, x: sideSign * 0.14, y: 0.62, r: 0.052 },
    { z: -0.48, x: sideSign * 0.145, y: 0.66, r: 0.072 },
    { z: -0.86, x: sideSign * 0.14, y: 0.625, r: 0.068 },
    { z: -1.32, x: sideSign * 0.115, y: 0.535, r: 0.052 },
    { z: -1.68, x: sideSign * 0.085, y: 0.435, r: 0.032 },
  ];

  const cZ = new THREE.CatmullRomCurve3(specs.map((s) => new THREE.Vector3(s.x, s.y, s.z)));
  const cR = new THREE.CatmullRomCurve3(specs.map((s) => new THREE.Vector3(s.r, 0, 0)));
  const sampleCount = 16;
  const radialSegments = 14;
  const rings: Array<{ z: number; points: Array<[number, number]> }> = [];

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const p = cZ.getPoint(t);
    const r = Math.max(0.015, cR.getPoint(t).x);
    const pts: Array<[number, number]> = [];
    for (let j = 0; j < radialSegments; j++) {
      const th = (j / radialSegments) * Math.PI * 2;
      pts.push([p.x + Math.sin(th) * r * 1.15, p.y + Math.cos(th) * r * 0.85]);
    }
    rings.push({ z: p.z, points: pts });
  }
  return buildLoftedMeshGeometry(rings);
}

function createF1SidepodGeo(sideSign: 1 | -1): THREE.BufferGeometry {
  const specs = [
    { z: 0.54, xIn: 0.21, xOut: 0.51, yBot: 0.26, yTop: 0.455, undercut: 0.22 },
    { z: 0.42, xIn: 0.22, xOut: 0.61, yBot: 0.22, yTop: 0.478, undercut: 0.34 },
    { z: 0.14, xIn: 0.22, xOut: 0.65, yBot: 0.175, yTop: 0.472, undercut: 0.36 },
    { z: -0.25, xIn: 0.20, xOut: 0.62, yBot: 0.155, yTop: 0.435, undercut: 0.30 },
    { z: -0.68, xIn: 0.18, xOut: 0.52, yBot: 0.135, yTop: 0.375, undercut: 0.20 },
    { z: -1.12, xIn: 0.14, xOut: 0.36, yBot: 0.122, yTop: 0.295, undercut: 0.12 },
    { z: -1.56, xIn: 0.095, xOut: 0.19, yBot: 0.125, yTop: 0.215, undercut: 0.05 },
  ];

  const sampleCount = 26;
  const cZ = new THREE.CatmullRomCurve3(specs.map((s) => new THREE.Vector3(0, 0, s.z)));
  const cX = new THREE.CatmullRomCurve3(specs.map((s) => new THREE.Vector3(s.xIn, s.xOut, s.undercut)));
  const cY = new THREE.CatmullRomCurve3(specs.map((s) => new THREE.Vector3(s.yBot, s.yTop, 0)));

  const radialSegments = 24;
  const rings: Array<{ z: number; points: Array<[number, number]> }> = [];

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const z = cZ.getPoint(t).z;
    const px = cX.getPoint(t);
    const py = cY.getPoint(t);

    const xIn = px.x;
    const xOut = Math.max(xIn + 0.05, px.y);
    const undercut = px.z;
    const yBot = py.x;
    const yTop = Math.max(yBot + 0.05, py.y);

    const midX = (xIn + xOut) * 0.5;
    const halfX = (xOut - xIn) * 0.5;
    const midY = (yBot + yTop) * 0.5;
    const halfY = (yTop - yBot) * 0.5;

    const pts: Array<[number, number]> = [];
    for (let j = 0; j < radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      let x = midX + Math.sign(sinT) * Math.pow(Math.abs(sinT), 0.78) * halfX;
      let y = midY + Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.82) * halfY;

      if (cosT < -0.05 && sinT > 0.1) {
        y += undercut * Math.abs(cosT) * Math.pow(sinT, 1.3) * 0.14;
        x -= undercut * Math.abs(cosT) * 0.065;
      }

      pts.push([sideSign * x, y]);
    }
    if (sideSign < 0) {
      pts.reverse();
    }
    rings.push({ z, points: pts });
  }

  return buildLoftedMeshGeometry(rings);
}

function createSweptAirfoilGeo(opts: {
  span: number;
  chord: number;
  thickness: number;
  camber: number;
  sweepBack: number;
  centerDrop?: number;
  tipLift?: number;
  twistRad?: number;
  segX?: number;
}): THREE.BufferGeometry {
  const segX = opts.segX ?? 22;
  const chordPts = 14;
  const rings: Array<{ x: number; pts: Array<[number, number]> }> = [];

  for (let ix = 0; ix <= segX; ix++) {
    const u = ix / segX;
    const s = u * 2 - 1;
    const absS = Math.abs(s);
    const x = s * (opts.span * 0.5);

    const zSweep = -Math.pow(absS, 1.4) * opts.sweepBack;
    const yDip = -(1 - Math.pow(absS, 1.6)) * (opts.centerDrop ?? 0) + Math.pow(absS, 1.8) * (opts.tipLift ?? 0);
    const localChord = opts.chord * (1 - 0.14 * Math.pow(absS, 2));
    const twist = (opts.twistRad ?? 0) * (0.75 + 0.25 * absS);
    const cosTw = Math.cos(twist);
    const sinTw = Math.sin(twist);

    const pts: Array<[number, number]> = [];
    for (let j = 0; j < chordPts; j++) {
      const ang = (j / chordPts) * Math.PI * 2;
      const chordFrac = (1 + Math.cos(ang)) * 0.5;
      const thickEnv = Math.sin(ang) * opts.thickness * (0.4 + 0.85 * Math.sin(chordFrac * Math.PI));
      const camberOffset = Math.sin(chordFrac * Math.PI) * opts.camber;

      const lz = (chordFrac - 0.5) * localChord;
      const ly = camberOffset + thickEnv;

      const ry = ly * cosTw - lz * sinTw;
      const rz = ly * sinTw + lz * cosTw;
      pts.push([yDip + ry, zSweep + rz]);
    }
    rings.push({ x, pts });
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const nX = rings.length;

  for (let i = 0; i < nX; i++) {
    const { x, pts } = rings[i]!;
    for (let j = 0; j < chordPts; j++) {
      const [y, z] = pts[j]!;
      positions.push(x, y, z);
      uvs.push(i / segX, j / chordPts);
    }
  }

  for (let i = 0; i < nX - 1; i++) {
    const rowA = i * chordPts;
    const rowB = (i + 1) * chordPts;
    for (let j = 0; j < chordPts; j++) {
      const jNext = (j + 1) % chordPts;
      const a = rowA + j;
      const b = rowA + jNext;
      const c = rowB + jNext;
      const d = rowB + j;
      indices.push(a, c, b, a, d, c);
    }
  }

  const leftIdx = positions.length / 3;
  const leftAvgY = rings[0]!.pts.reduce((s, p) => s + p[0], 0) / chordPts;
  const leftAvgZ = rings[0]!.pts.reduce((s, p) => s + p[1], 0) / chordPts;
  positions.push(rings[0]!.x, leftAvgY, leftAvgZ);
  uvs.push(0, 0.5);
  for (let j = 0; j < chordPts; j++) {
    const jNext = (j + 1) % chordPts;
    indices.push(leftIdx, j, jNext);
  }

  const rightIdx = positions.length / 3;
  const rightRing = rings[nX - 1]!;
  const rightAvgY = rightRing.pts.reduce((s, p) => s + p[0], 0) / chordPts;
  const rightAvgZ = rightRing.pts.reduce((s, p) => s + p[1], 0) / chordPts;
  positions.push(rightRing.x, rightAvgY, rightAvgZ);
  uvs.push(1, 0.5);
  const rStart = (nX - 1) * chordPts;
  for (let j = 0; j < chordPts; j++) {
    const jNext = (j + 1) % chordPts;
    indices.push(rightIdx, rStart + jNext, rStart + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createF1TireGeo(outerRadius: number, width: number): THREE.BufferGeometry {
  const halfW = width * 0.5;
  const rimR = 0.21;
  const profile = [
    new THREE.Vector2(rimR, -halfW * 0.90),
    new THREE.Vector2(rimR + 0.045, -halfW * 0.98),
    new THREE.Vector2(outerRadius - 0.025, -halfW * 0.99),
    new THREE.Vector2(outerRadius, -halfW * 0.78),
    new THREE.Vector2(outerRadius + 0.002, 0),
    new THREE.Vector2(outerRadius, halfW * 0.78),
    new THREE.Vector2(outerRadius - 0.025, halfW * 0.99),
    new THREE.Vector2(rimR + 0.045, halfW * 0.98),
    new THREE.Vector2(rimR, halfW * 0.90),
  ];
  const geo = new THREE.LatheGeometry(profile, 44);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

export function createF1CarRig(initialLivery: DropLiveryProfile): F1CarRig {
  const root = new THREE.Group();
  const bodySpinGroup = new THREE.Group();
  root.add(bodySpinGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const textures: THREE.Texture[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const { map: carbonMap, bumpMap: carbonBump } = createCarbonTextures();
  trackTex(carbonMap);
  trackTex(carbonBump);

  const { map: tireMap, roughnessMap: tireRoughMap, bumpMap: tireBumpMap } = createTireTreadTextures();
  trackTex(tireMap);
  trackTex(tireRoughMap);
  trackTex(tireBumpMap);

  const wheelCoverTex = trackTex(drawWheelCoverTexture());
  let sidewallTex = createSidewallTexture(initialLivery.sidewallHex);
  let numberTex = createNumberPlateTexture(
    initialLivery.carNumber,
    "#f4f4f0",
    initialLivery.key === "redbull" ? "#ffd100" : initialLivery.accentHex
  );
  let chassisTex = createChassisLiveryTexture(initialLivery);
  let sidepodTex = createSidepodLiveryTexture(initialLivery);
  let rearWingTex = createRearWingTexture(initialLivery);

  const isInitRB = initialLivery.key === "redbull";

  // Painted solid material (wings, endplates, mirrors, trim)
  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(isInitRB ? "#0c1638" : initialLivery.primaryHex),
    metalness: initialLivery.finish === "metallic" ? 0.66 : 0.34,
    roughness: initialLivery.finish === "satin" ? 0.34 : 0.18,
    clearcoat: 0.92,
    clearcoatRoughness: initialLivery.finish === "satin" ? 0.24 : 0.06,
    envMapIntensity: 0.78,
  });

  // Texture-mapped monocoque livery material (Bull sun-disc + Honda + carbon lower skirt)
  const chassisMat = new THREE.MeshPhysicalMaterial({
    map: chassisTex,
    color: new THREE.Color("#ffffff"),
    metalness: initialLivery.finish === "metallic" ? 0.45 : 0.25,
    roughness: initialLivery.finish === "satin" ? 0.34 : 0.2,
    clearcoat: 0.88,
    clearcoatRoughness: initialLivery.finish === "satin" ? 0.24 : 0.08,
    envMapIntensity: 0.78,
  });

  // Texture-mapped downwash sidepod livery material (ORACLE + BYBIT + carbon undercut)
  const sidepodMat = new THREE.MeshPhysicalMaterial({
    map: sidepodTex,
    color: new THREE.Color("#ffffff"),
    metalness: initialLivery.finish === "metallic" ? 0.45 : 0.25,
    roughness: initialLivery.finish === "satin" ? 0.34 : 0.2,
    clearcoat: 0.88,
    clearcoatRoughness: initialLivery.finish === "satin" ? 0.24 : 0.08,
    envMapIntensity: 0.78,
  });

  // Texture-mapped rear DRS wing flap
  const rearWingFlapMat = new THREE.MeshPhysicalMaterial({
    map: rearWingTex,
    color: new THREE.Color("#ffffff"),
    metalness: 0.28,
    roughness: 0.26,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });

  const secondaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialLivery.secondaryHex),
    metalness: 0.44,
    roughness: 0.28,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14,
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialLivery.accentHex),
    metalness: 0.26,
    roughness: 0.22,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    bumpMap: carbonBump,
    bumpScale: 0.014,
    roughness: 0.4,
    metalness: 0.3,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xb2bac6,
    metalness: 0.92,
    roughness: 0.2,
  });

  const exhaustGoldMat = new THREE.MeshStandardMaterial({
    color: 0x9c8668,
    metalness: 0.88,
    roughness: 0.24,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    map: tireMap,
    roughnessMap: tireRoughMap,
    bumpMap: tireBumpMap,
    bumpScale: 0.008,
    roughness: 0.86,
    metalness: 0.04,
  });

  const wheelCoverMat = new THREE.MeshStandardMaterial({
    map: wheelCoverTex,
    roughness: 0.34,
    metalness: 0.46,
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x353942,
    roughness: 0.52,
    metalness: 0.78,
  });

  const nutLeftMat = new THREE.MeshStandardMaterial({
    color: 0xe10600,
    metalness: 0.75,
    roughness: 0.22,
  });

  const nutRightMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    metalness: 0.75,
    roughness: 0.22,
  });

  const sidewallDecalMat = new THREE.MeshBasicMaterial({
    map: sidewallTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const numberDecalMat = new THREE.MeshBasicMaterial({
    map: numberTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialLivery.visorHex),
    metalness: 0.94,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });

  const windscreenMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.48,
    clearcoat: 1.0,
  });

  const cockpitDarkMat = new THREE.MeshStandardMaterial({
    color: 0x090a0d,
    roughness: 0.82,
    metalness: 0.08,
  });

  const rainLightMat = new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: 0xff1e00,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const materials: THREE.Material[] = [
    primaryMat,
    chassisMat,
    sidepodMat,
    rearWingFlapMat,
    secondaryMat,
    accentMat,
    carbonMat,
    titaniumMat,
    exhaustGoldMat,
    tireMat,
    wheelCoverMat,
    rotorMat,
    nutLeftMat,
    nutRightMat,
    sidewallDecalMat,
    numberDecalMat,
    visorMat,
    windscreenMat,
    cockpitDarkMat,
    rainLightMat,
  ];

  // ---------------- 1. Venturi Floor, Tunnel Fences, Edge Wings & 5-Channel Diffuser ----------------
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-0.24, 0.82);
  floorShape.lineTo(0.24, 0.82);
  floorShape.quadraticCurveTo(0.68, 0.66, 0.72, 0.36);
  floorShape.lineTo(0.70, -0.78);
  floorShape.quadraticCurveTo(0.62, -1.24, 0.42, -1.78);
  floorShape.lineTo(-0.42, -1.78);
  floorShape.quadraticCurveTo(-0.62, -1.24, -0.70, -0.78);
  floorShape.lineTo(-0.72, 0.36);
  floorShape.quadraticCurveTo(-0.68, 0.66, -0.24, 0.82);
  floorShape.closePath();

  const floorGeo = trackGeo(
    new THREE.ExtrudeGeometry(floorShape, { depth: 0.032, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2 })
  );
  floorGeo.rotateX(Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, carbonMat);
  floorMesh.position.y = 0.072;
  floorMesh.castShadow = true;
  floorMesh.receiveShadow = true;
  bodySpinGroup.add(floorMesh);

  for (const side of [-1, 1]) {
    const edgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.71, 0.078, 0.48),
      new THREE.Vector3(side * 0.735, 0.072, -0.05),
      new THREE.Vector3(side * 0.70, 0.076, -0.62),
      new THREE.Vector3(side * 0.62, 0.088, -1.04),
    ]);
    const edgeBlade = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(edgeCurve, 18, 0.014, 6, false)), carbonMat);
    const edgeTrim = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(edgeCurve, 18, 0.006, 5, false)), accentMat);
    edgeTrim.position.set(side * 0.008, 0.006, 0);
    bodySpinGroup.add(edgeBlade, edgeTrim);

    for (const [fx, fz, rot] of [
      [0.34, 0.68, 0.16],
      [0.50, 0.56, 0.24],
    ] as const) {
      const fence = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.014, 0.145, 0.34)), carbonMat);
      fence.position.set(side * fx, 0.142, fz);
      fence.rotation.y = side * rot;
      bodySpinGroup.add(fence);
    }
  }

  const diffuserRamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.76, 0.025, 0.52)), carbonMat);
  diffuserRamp.position.set(0, 0.125, -1.84);
  diffuserRamp.rotation.x = -0.26;
  bodySpinGroup.add(diffuserRamp);

  const strakeGeo = trackGeo(new THREE.BoxGeometry(0.014, 0.15, 0.46));
  for (const xPos of [-0.31, -0.155, 0, 0.155, 0.31]) {
    const st = new THREE.Mesh(strakeGeo, carbonMat);
    st.position.set(xPos, 0.135, -1.85);
    st.rotation.x = -0.18;
    bodySpinGroup.add(st);
  }

  // ---------------- 2. Lofted Monocoque, RB20 Cannon-Deck Spines, Pitot Probe & Cockpit ----------------
  const fuselageGeo = trackGeo(createF1FuselageGeo());
  const fuselageMesh = new THREE.Mesh(fuselageGeo, chassisMat);
  fuselageMesh.castShadow = true;
  fuselageMesh.receiveShadow = true;
  bodySpinGroup.add(fuselageMesh);

  // RB20 Dual Cannon-Deck Cooling Channels running back from roll hoop shoulders
  for (const side of [-1, 1] as const) {
    const cannonSpine = new THREE.Mesh(trackGeo(createCannonDeckSpineGeo(side)), primaryMat);
    cannonSpine.castShadow = true;
    bodySpinGroup.add(cannonSpine);

    // Recessed cooling outlet slot on cannon deck tail
    const exhaustSlot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.042, 0.036, 0.075)), cockpitDarkMat);
    exhaustSlot.position.set(side * 0.088, 0.445, -1.66);
    exhaustSlot.rotation.x = -0.22;
    bodySpinGroup.add(exhaustSlot);
  }

  // Dynamic championship #1 nose decal
  const numberPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.20, 0.20)), numberDecalMat);
  numberPlane.position.set(0, 0.376, 1.44);
  numberPlane.rotation.x = -Math.PI * 0.415;
  bodySpinGroup.add(numberPlane);

  // Titanium Pitot Sensor Probe & Twin FOM Nose Camera Pods
  const pitotBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.005, 0.006, 0.055, 8)), carbonMat);
  pitotBase.position.set(0, 0.425, 1.18);
  pitotBase.rotation.x = -0.25;
  const pitotTip = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0025, 0.003, 0.095, 8)), titaniumMat);
  pitotTip.rotation.x = Math.PI / 2;
  pitotTip.position.set(0, 0.448, 1.225);
  bodySpinGroup.add(pitotBase, pitotTip);

  for (const side of [-1, 1]) {
    const camStalk = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.048, 0.012, 0.075)), carbonMat);
    camStalk.position.set(side * 0.135, 0.228, 1.72);
    const camLens = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.022, 0.048)), carbonMat);
    camLens.position.set(side * 0.165, 0.228, 1.72);
    bodySpinGroup.add(camStalk, camLens);
  }

  // Dark cockpit tub + contoured padded headrest + polycarbonate serrated wind deflector
  const cockpitTub = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.12, 0.62)), cockpitDarkMat);
  cockpitTub.position.set(0, 0.38, 0.12);
  bodySpinGroup.add(cockpitTub);

  const windscreen = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.145, 0.148, 0.045, 18, 1, true, -Math.PI * 0.42, Math.PI * 0.84)),
    windscreenMat
  );
  windscreen.position.set(0, 0.542, 0.38);
  windscreen.rotation.x = -0.18;
  bodySpinGroup.add(windscreen);

  const headrestShape = new THREE.Shape();
  headrestShape.moveTo(-0.18, 0.10);
  headrestShape.lineTo(-0.19, -0.22);
  headrestShape.lineTo(0.19, -0.22);
  headrestShape.lineTo(0.18, 0.10);
  headrestShape.lineTo(0.11, 0.10);
  headrestShape.lineTo(0.11, -0.11);
  headrestShape.lineTo(-0.11, -0.11);
  headrestShape.lineTo(-0.11, 0.10);
  headrestShape.closePath();
  const headrestGeo = trackGeo(
    new THREE.ExtrudeGeometry(headrestShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2 })
  );
  headrestGeo.rotateX(Math.PI / 2);
  const headrest = new THREE.Mesh(headrestGeo, secondaryMat);
  headrest.position.set(0, 0.535, 0.03);
  bodySpinGroup.add(headrest);

  // F1 Butterfly Steering Wheel + live telemetry display + shift LEDs
  const steerGroup = new THREE.Group();
  steerGroup.position.set(0, 0.47, 0.38);
  steerGroup.rotation.x = -0.35;
  const wheelBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.19, 0.105, 0.022)), carbonMat);
  const wheelScreenMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
  materials.push(wheelScreenMat);
  const wheelScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.088, 0.048)), wheelScreenMat);
  wheelScreen.position.set(0, 0.014, -0.012);
  wheelScreen.rotation.y = Math.PI;
  const shiftLed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.008, 0.006)), rainLightMat);
  shiftLed.position.set(0, 0.045, -0.012);
  steerGroup.add(wheelBody, wheelScreen, shiftLed);
  bodySpinGroup.add(steerGroup);

  // Dorsal Shark Fin + Recessed Airbox + T-Cam Pod
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.46, 0.90);
  finShape.quadraticCurveTo(-1.15, 0.78, -1.70, 0.56);
  finShape.lineTo(-1.74, 0.35);
  finShape.lineTo(-0.46, 0.52);
  finShape.closePath();
  const finGeo = trackGeo(new THREE.ExtrudeGeometry(finShape, { depth: 0.016, bevelEnabled: false }));
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.008, 0, 0);
  const finMesh = new THREE.Mesh(finGeo, primaryMat);
  finMesh.castShadow = true;
  bodySpinGroup.add(finMesh);

  const finTrimCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.915, -0.48),
    new THREE.Vector3(0, 0.78, -1.10),
    new THREE.Vector3(0, 0.57, -1.68),
  ]);
  bodySpinGroup.add(new THREE.Mesh(trackGeo(new THREE.TubeGeometry(finTrimCurve, 14, 0.012, 6, false)), accentMat));

  const airboxRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.088, 0.024, 10, 20)), carbonMat);
  airboxRim.position.set(0, 0.815, -0.27);
  const airboxHole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16)), cockpitDarkMat);
  airboxHole.rotation.x = Math.PI / 2;
  airboxHole.position.set(0, 0.815, -0.29);
  bodySpinGroup.add(airboxRim, airboxHole);

  const tCamStem = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.085, 0.042)), carbonMat);
  tCamStem.position.set(0, 0.96, -0.44);
  const tCamPod = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.24, 0.020, 0.048)),
    isInitRB ? carbonMat : accentMat
  );
  tCamPod.position.set(0, 1.005, -0.44);
  bodySpinGroup.add(tCamStem, tCamPod);

  // ---------------- 3. Sculpted Overbite Downwash Sidepods ----------------
  for (const side of [-1, 1] as const) {
    const podGeo = trackGeo(createF1SidepodGeo(side));
    const podMesh = new THREE.Mesh(podGeo, sidepodMat);
    podMesh.castShadow = true;
    podMesh.receiveShadow = true;
    bodySpinGroup.add(podMesh);

    // RB20 Overbite upper lip extending sharply over recessed horizontal cooling slot
    const overbiteLip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.285, 0.022, 0.13)), carbonMat);
    overbiteLip.position.set(side * 0.37, 0.44, 0.555);
    overbiteLip.rotation.y = side * -0.18;
    const inletCore = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.082, 0.08)), cockpitDarkMat);
    inletCore.position.set(side * 0.37, 0.382, 0.525);
    inletCore.rotation.y = side * -0.18;
    const inletRim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.265, 0.115, 0.075)), carbonMat);
    inletRim.position.set(side * 0.37, 0.38, 0.51);
    inletRim.rotation.y = side * -0.18;
    bodySpinGroup.add(inletRim, inletCore, overbiteLip);

    // Cooling louvers / shark gill recess along upper rear downwash shoulder
    const gillCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.42, 0.462, -0.15),
      new THREE.Vector3(side * 0.36, 0.415, -0.52),
      new THREE.Vector3(side * 0.27, 0.335, -0.92),
    ]);
    const gillStrip = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(gillCurve, 14, 0.012, 5, false)), carbonMat);
    bodySpinGroup.add(gillStrip);

    // Sculpted aero wing mirror + double carbon stalks
    const mirrorStalkMain = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.012, 0.032)), carbonMat);
    mirrorStalkMain.position.set(side * 0.36, 0.515, 0.39);
    mirrorStalkMain.rotation.z = side * 0.14;
    const mirrorPod = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.095, 0.038, 0.068)),
      isInitRB ? primaryMat : accentMat
    );
    mirrorPod.position.set(side * 0.455, 0.535, 0.38);
    mirrorPod.rotation.y = side * -0.15;
    bodySpinGroup.add(mirrorStalkMain, mirrorPod);
  }

  // ---------------- 4. Titanium/Carbon Halo Fairing & Driver Helmet ----------------
  const haloCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.235, 0.525, -0.18),
    new THREE.Vector3(-0.245, 0.642, 0.18),
    new THREE.Vector3(0, 0.668, 0.53),
    new THREE.Vector3(0.245, 0.642, 0.18),
    new THREE.Vector3(0.235, 0.525, -0.18),
  ]);
  const haloMesh = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(haloCurve, 32, 0.025, 12, false)), carbonMat);
  haloMesh.castShadow = true;
  bodySpinGroup.add(haloMesh);

  const haloTrim = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(haloCurve, 28, 0.012, 8, false)), primaryMat);
  haloTrim.position.y = 0.014;
  bodySpinGroup.add(haloTrim);

  const centerPylonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.51, 0.64),
    new THREE.Vector3(0, 0.668, 0.53),
  ]);
  bodySpinGroup.add(new THREE.Mesh(trackGeo(new THREE.TubeGeometry(centerPylonCurve, 10, 0.022, 10, false)), carbonMat));

  const driverShoulders = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.11, 0.16, 4, 10)), secondaryMat);
  driverShoulders.rotation.z = Math.PI / 2;
  driverShoulders.position.set(0, 0.39, 0.02);
  bodySpinGroup.add(driverShoulders);

  const helmetShell = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.125, 24, 18)), primaryMat);
  helmetShell.scale.set(0.92, 0.94, 1.16);
  helmetShell.position.set(0, 0.525, 0.025);
  bodySpinGroup.add(helmetShell);

  const helmetCrown = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.126, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.35)), accentMat);
  helmetCrown.scale.set(0.92, 0.94, 1.16);
  helmetCrown.position.set(0, 0.527, 0.025);
  bodySpinGroup.add(helmetCrown);

  const helmetSpoiler = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.025, 0.06)), secondaryMat);
  helmetSpoiler.position.set(0, 0.585, -0.075);
  helmetSpoiler.rotation.x = 0.35;
  bodySpinGroup.add(helmetSpoiler);

  const visorGeo = trackGeo(
    new THREE.SphereGeometry(0.128, 22, 14, -Math.PI * 0.34, Math.PI * 0.68, Math.PI * 0.35, Math.PI * 0.25)
  );
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.scale.set(0.93, 0.94, 1.17);
  visorMesh.position.set(0, 0.525, 0.032);
  visorMesh.rotation.y = Math.PI / 2;
  bodySpinGroup.add(visorMesh);

  // ---------------- 5. Swept 4-Element Curved Front Wing ----------------
  const frontWingGroup = new THREE.Group();
  frontWingGroup.position.set(0, 0.112, 2.08);

  const fwMain = new THREE.Mesh(
    trackGeo(createSweptAirfoilGeo({ span: 1.88, chord: 0.25, thickness: 0.016, camber: 0.022, sweepBack: 0.17, centerDrop: 0.022, twistRad: 0.06 })),
    carbonMat
  );
  fwMain.castShadow = true;
  frontWingGroup.add(fwMain);

  const fwFlap1 = new THREE.Mesh(
    trackGeo(createSweptAirfoilGeo({ span: 1.84, chord: 0.135, thickness: 0.013, camber: 0.016, sweepBack: 0.18, centerDrop: 0.016, twistRad: 0.24 })),
    primaryMat
  );
  fwFlap1.position.set(0, 0.032, -0.10);
  fwFlap1.castShadow = true;
  frontWingGroup.add(fwFlap1);

  const fwFlap2 = new THREE.Mesh(
    trackGeo(createSweptAirfoilGeo({ span: 1.78, chord: 0.105, thickness: 0.011, camber: 0.014, sweepBack: 0.19, centerDrop: 0.012, twistRad: 0.38 })),
    isInitRB ? primaryMat : accentMat
  );
  fwFlap2.position.set(0, 0.068, -0.19);
  fwFlap2.castShadow = true;
  frontWingGroup.add(fwFlap2);

  const fwFlap3 = new THREE.Mesh(
    trackGeo(createSweptAirfoilGeo({ span: 1.66, chord: 0.078, thickness: 0.009, camber: 0.01, sweepBack: 0.19, centerDrop: 0.008, twistRad: 0.50 })),
    carbonMat
  );
  fwFlap3.position.set(0, 0.105, -0.26);
  frontWingGroup.add(fwFlap3);

  const fwEndShape = new THREE.Shape();
  fwEndShape.moveTo(0.24, -0.015);
  fwEndShape.lineTo(-0.34, -0.015);
  fwEndShape.lineTo(-0.33, 0.23);
  fwEndShape.quadraticCurveTo(-0.08, 0.25, 0.16, 0.08);
  fwEndShape.closePath();
  const fwEndGeo = trackGeo(
    new THREE.ExtrudeGeometry(fwEndShape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 })
  );
  fwEndGeo.rotateY(-Math.PI / 2);

  for (const side of [-1, 1]) {
    const endplate = new THREE.Mesh(fwEndGeo, primaryMat);
    endplate.position.set(side * 0.94 + (side === -1 ? 0.009 : -0.009), 0, -0.12);
    endplate.rotation.y = side * 0.04;
    endplate.castShadow = true;
    frontWingGroup.add(endplate);

    const diveplane = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 0.012, 0.16)), accentMat);
    diveplane.position.set(side * 0.96, 0.09, -0.14);
    diveplane.rotation.x = 0.25;
    frontWingGroup.add(diveplane);

    const pylon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.014, 0.08, 0.14)), carbonMat);
    pylon.position.set(side * 0.045, 0.045, 0.02);
    frontWingGroup.add(pylon);
  }
  bodySpinGroup.add(frontWingGroup);

  // ---------------- 6. Bi-Plane Cambered Rear DRS Wing, Swan-Neck Pylons, Beam Wing & Heat-Patina Exhaust ----------------
  const rearWingGroup = new THREE.Group();
  rearWingGroup.position.set(0, 0.74, -1.94);

  const rwMain = new THREE.Mesh(
    trackGeo(createSweptAirfoilGeo({ span: 1.00, chord: 0.25, thickness: 0.018, camber: 0.032, sweepBack: 0.02, centerDrop: 0.035, twistRad: 0.24 })),
    carbonMat
  );
  rwMain.castShadow = true;
  rearWingGroup.add(rwMain);

  const rwDrsFlap = new THREE.Mesh(
    trackGeo(createSweptAirfoilGeo({ span: 0.98, chord: 0.175, thickness: 0.015, camber: 0.024, sweepBack: 0.01, centerDrop: 0.02, twistRad: 0.64 })),
    rearWingFlapMat
  );
  rwDrsFlap.position.set(0, 0.125, -0.105);
  rwDrsFlap.castShadow = true;
  rearWingGroup.add(rwDrsFlap);

  const drsPod = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.024, 0.14, 4, 10)), carbonMat);
  drsPod.rotation.x = Math.PI / 2;
  drsPod.position.set(0, 0.09, -0.02);
  rearWingGroup.add(drsPod);

  for (const side of [-1, 1]) {
    const swanCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.085, 0.07, 0.02),
      new THREE.Vector3(side * 0.085, 0.08, 0.14),
      new THREE.Vector3(side * 0.075, -0.12, 0.17),
      new THREE.Vector3(side * 0.065, -0.34, 0.13),
    ]);
    const swanMesh = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(swanCurve, 16, 0.014, 8, false)), carbonMat);
    swanMesh.scale.set(0.65, 1, 1.4);
    rearWingGroup.add(swanMesh);

    const rwEndShape = new THREE.Shape();
    rwEndShape.moveTo(0.18, 0.22);
    rwEndShape.lineTo(-0.22, 0.22);
    rwEndShape.lineTo(-0.20, -0.24);
    rwEndShape.quadraticCurveTo(-0.08, -0.44, 0.06, -0.44);
    rwEndShape.lineTo(0.16, -0.05);
    rwEndShape.closePath();
    const rwEndGeo = trackGeo(
      new THREE.ExtrudeGeometry(rwEndShape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 })
    );
    rwEndGeo.rotateY(-Math.PI / 2);
    const rwEnd = new THREE.Mesh(rwEndGeo, primaryMat);
    rwEnd.position.set(side * 0.50 + (side === -1 ? 0.009 : -0.009), 0, 0);
    rwEnd.castShadow = true;
    rearWingGroup.add(rwEnd);
  }

  const beamWing = new THREE.Mesh(
    trackGeo(createSweptAirfoilGeo({ span: 0.78, chord: 0.14, thickness: 0.012, camber: 0.018, sweepBack: 0.01, twistRad: 0.34 })),
    carbonMat
  );
  beamWing.position.set(0, -0.39, -0.05);
  rearWingGroup.add(beamWing);

  bodySpinGroup.add(rearWingGroup);

  const rainLightHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.125, 0.05)), carbonMat);
  rainLightHousing.position.set(0, 0.235, -2.02);
  const rainLight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.042, 0.095, 0.025)), rainLightMat);
  rainLight.position.set(0, 0.235, -2.045);
  bodySpinGroup.add(rainLightHousing, rainLight);

  const exhaust = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.048, 0.056, 0.18, 18)), exhaustGoldMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, 0.335, -1.97);
  bodySpinGroup.add(exhaust);

  for (const side of [-1, 1]) {
    const wastegate = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 12)), titaniumMat);
    wastegate.rotation.x = Math.PI / 2;
    wastegate.position.set(side * 0.068, 0.315, -1.97);
    bodySpinGroup.add(wastegate);
  }

  // ---------------- 7. 18-Inch Pirelli P-Zero Slicks, Wheel Covers, L/R Anodized Wheel Nuts & Suspension ----------------
  const wheelRadius = 0.32;
  const wheelSpecs = [
    { x: 0.80, z: 1.42, width: 0.285, side: 1 as const, front: true },
    { x: -0.80, z: 1.42, width: 0.285, side: -1 as const, front: true },
    { x: 0.80, z: -1.34, width: 0.375, side: 1 as const, front: false },
    { x: -0.80, z: -1.34, width: 0.375, side: -1 as const, front: false },
  ];

  const wheelGroups: THREE.Group[] = [];
  const frontTireGeo = trackGeo(createF1TireGeo(wheelRadius, 0.285));
  const rearTireGeo = trackGeo(createF1TireGeo(wheelRadius, 0.375));
  const sidewallRingGeo = trackGeo(new THREE.RingGeometry(0.214, 0.314, 44));

  for (const spec of wheelSpecs) {
    const wg = new THREE.Group();
    wg.position.set(spec.x, wheelRadius, spec.z);

    const tireMesh = new THREE.Mesh(spec.front ? frontTireGeo : rearTireGeo, tireMat);
    tireMesh.castShadow = true;
    tireMesh.receiveShadow = true;
    wg.add(tireMesh);

    const dishGeo = trackGeo(new THREE.CylinderGeometry(0.212, 0.212, spec.width * 0.90, 28));
    dishGeo.rotateZ(Math.PI / 2);
    const dish = new THREE.Mesh(dishGeo, wheelCoverMat);
    wg.add(dish);

    const rimLip = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.208, 0.011, 8, 32)), titaniumMat);
    rimLip.rotation.y = Math.PI / 2;
    rimLip.position.x = spec.side * (spec.width * 0.45);
    wg.add(rimLip);

    const pirelliFace = new THREE.Mesh(sidewallRingGeo, sidewallDecalMat);
    pirelliFace.rotation.y = spec.side > 0 ? Math.PI / 2 : -Math.PI / 2;
    pirelliFace.position.x = spec.side * (spec.width * 0.496);
    wg.add(pirelliFace);

    // Authentic F1 directional thread anodized wheel nuts (Left side Red, Right side Blue)
    const centerNut = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.036, 0.045, 0.04, 6)),
      spec.side > 0 ? nutRightMat : nutLeftMat
    );
    centerNut.rotation.z = Math.PI / 2;
    centerNut.position.x = spec.side * (spec.width * 0.468);
    wg.add(centerNut);

    bodySpinGroup.add(wg);
    wheelGroups.push(wg);

    const uprightX = spec.side * (Math.abs(spec.x) - spec.width * 0.48);
    const brakeDisc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.165, 0.165, 0.026, 24)), rotorMat);
    brakeDisc.rotation.z = Math.PI / 2;
    brakeDisc.position.set(uprightX, wheelRadius, spec.z);
    bodySpinGroup.add(brakeDisc);

    const caliper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.042, 0.115, 0.068)), accentMat);
    caliper.position.set(uprightX, wheelRadius + 0.02, spec.z - 0.115);
    bodySpinGroup.add(caliper);

    const brakeScoop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.048, 0.17, 0.13)), carbonMat);
    brakeScoop.position.set(uprightX - spec.side * 0.026, wheelRadius + 0.02, spec.z + 0.05);
    bodySpinGroup.add(brakeScoop);

    if (spec.front) {
      const browShape = new THREE.Shape();
      browShape.moveTo(0.18, 0.31);
      browShape.quadraticCurveTo(-0.02, 0.38, -0.24, 0.24);
      browShape.lineTo(-0.24, 0.22);
      browShape.quadraticCurveTo(-0.02, 0.35, 0.18, 0.295);
      browShape.closePath();
      const browGeo = trackGeo(new THREE.ExtrudeGeometry(browShape, { depth: 0.055, bevelEnabled: false }));
      browGeo.rotateY(-Math.PI / 2);
      const brow = new THREE.Mesh(browGeo, carbonMat);
      brow.position.set(spec.side * 0.61 + 0.0275, wheelRadius, spec.z);
      bodySpinGroup.add(brow);
    }

    const innerChassisX = spec.side * (spec.front ? 0.15 : 0.13);
    const armSpecs = [
      { yIn: spec.front ? 0.39 : 0.36, zIn: spec.z + 0.20, yOut: wheelRadius + 0.08, zOut: spec.z },
      { yIn: spec.front ? 0.39 : 0.36, zIn: spec.z - 0.20, yOut: wheelRadius + 0.08, zOut: spec.z },
      { yIn: 0.17, zIn: spec.z + 0.17, yOut: wheelRadius - 0.075, zOut: spec.z },
      { yIn: 0.17, zIn: spec.z - 0.17, yOut: wheelRadius - 0.075, zOut: spec.z },
      { yIn: spec.front ? 0.16 : 0.39, zIn: spec.z + 0.05, yOut: spec.front ? wheelRadius + 0.08 : wheelRadius - 0.07, zOut: spec.z - 0.02 },
    ];
    for (const arm of armSpecs) {
      const curve = new THREE.LineCurve3(
        new THREE.Vector3(innerChassisX, arm.yIn, arm.zIn),
        new THREE.Vector3(uprightX, arm.yOut, arm.zOut)
      );
      const armMesh = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 2, 0.0115, 6, false)), carbonMat);
      armMesh.castShadow = true;
      bodySpinGroup.add(armMesh);
    }
  }

  const targetPrimary = new THREE.Color(isInitRB ? "#0c1638" : initialLivery.primaryHex);
  const targetSecondary = new THREE.Color(initialLivery.secondaryHex);
  const targetAccent = new THREE.Color(initialLivery.accentHex);
  const targetVisor = new THREE.Color(initialLivery.visorHex);
  let activeKey = initialLivery.key;

  const updateLivery = (profile: DropLiveryProfile, dt: number) => {
    if (profile.key !== activeKey) {
      activeKey = profile.key;
      const isRB = profile.key === "redbull";
      targetPrimary.set(isRB ? "#0c1638" : profile.primaryHex);
      targetSecondary.set(profile.secondaryHex);
      targetAccent.set(profile.accentHex);
      targetVisor.set(profile.visorHex);

      primaryMat.metalness = profile.finish === "metallic" ? 0.66 : 0.34;
      primaryMat.roughness = profile.finish === "satin" ? 0.34 : 0.18;
      primaryMat.clearcoatRoughness = profile.finish === "satin" ? 0.24 : 0.06;

      const oldSidewall = sidewallTex;
      sidewallTex = createSidewallTexture(profile.sidewallHex);
      sidewallDecalMat.map = sidewallTex;
      sidewallDecalMat.needsUpdate = true;
      oldSidewall.dispose();

      const oldNumber = numberTex;
      numberTex = createNumberPlateTexture(profile.carNumber, "#f4f4f0", isRB ? "#ffd100" : profile.accentHex);
      numberDecalMat.map = numberTex;
      numberDecalMat.needsUpdate = true;
      oldNumber.dispose();

      const oldChassis = chassisTex;
      chassisTex = createChassisLiveryTexture(profile);
      chassisMat.map = chassisTex;
      chassisMat.needsUpdate = true;
      oldChassis.dispose();

      const oldSidepod = sidepodTex;
      sidepodTex = createSidepodLiveryTexture(profile);
      sidepodMat.map = sidepodTex;
      sidepodMat.needsUpdate = true;
      oldSidepod.dispose();

      const oldRearWing = rearWingTex;
      rearWingTex = createRearWingTexture(profile);
      rearWingFlapMat.map = rearWingTex;
      rearWingFlapMat.needsUpdate = true;
      oldRearWing.dispose();
    }

    const alpha = 1 - Math.exp(-7.5 * dt);
    primaryMat.color.lerp(targetPrimary, alpha);
    secondaryMat.color.lerp(targetSecondary, alpha);
    accentMat.color.lerp(targetAccent, alpha);
    visorMat.color.lerp(targetVisor, alpha);
  };

  const dispose = () => {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    sidewallTex.dispose();
    numberTex.dispose();
    chassisTex.dispose();
    sidepodTex.dispose();
    rearWingTex.dispose();
  };

  return {
    root,
    bodySpinGroup,
    wheelGroups,
    updateLivery,
    dispose,
  };
}
