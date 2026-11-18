import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMERA_PRESETS,
  HERO_DROP_CHAPTERS,
  PDP_ORBIT_MAX_DISTANCE,
  PDP_ORBIT_MAX_POLAR_RAD,
  PDP_ORBIT_MIN_DISTANCE,
  PDP_ORBIT_MIN_POLAR_RAD,
  PDP_ORBIT_PRESETS,
  clampOrbitDistance,
  clampOrbitPitch,
  computeCheckoutPricing,
  computeHeroDropShowcaseState,
  computeScrollDropProgress,
  normalizeAzimuthDegrees,
  resolveDropLivery,
  sphericalToCartesian,
} from "./drop-stage";

test("resolveDropLivery selects team-specific clearcoat palettes for catalog vehicles", () => {
  const rb = resolveDropLivery({ slug: "red-bull-racing-rb20-f1", name: "Red Bull Racing RB20 F1", brand: "Hot Wheel" });
  assert.equal(rb.key, "redbull");
  assert.equal(rb.accentHex, "#e10600");
  assert.equal(rb.carNumber, "1");

  const merc = resolveDropLivery({ slug: "mercedes-amg-petronas-f1-team-black", name: "Mercedes-AMG Petronas" });
  assert.equal(merc.key, "mercedes");
  assert.equal(merc.accentHex, "#00d2be");

  const ferrari = resolveDropLivery({ slug: "ferrari-12cilindri-red", name: "Ferrari 12Cilindri", brand: "Ferrari" });
  assert.equal(ferrari.key, "ferrari");
  assert.equal(ferrari.finish, "gloss");

  const haas = resolveDropLivery({ slug: "moneygram-haas-f1-team-black", name: "MoneyGram Haas F1 Team" });
  assert.equal(haas.key, "haas");

  const williams = resolveDropLivery({ slug: "williams-racing-blue", name: "Williams Racing [Blue]" });
  assert.equal(williams.key, "williams");

  const fallback = resolveDropLivery({ slug: "custom-model", name: "Custom Diecast" });
  assert.equal(fallback.key, "burnout");
});

test("computeScrollDropProgress clamps bounds and smoothly advances drops and yaw spin", () => {
  const start = computeScrollDropProgress(-0.2, 6);
  assert.equal(start.clampedProgress, 0);
  assert.equal(start.activeIndex, 0);

  const mid = computeScrollDropProgress(0.5, 6);
  assert.ok(mid.activeIndex >= 2 && mid.activeIndex <= 3);
  assert.ok(mid.targetYaw > start.targetYaw + Math.PI);

  const end = computeScrollDropProgress(1.5, 6);
  assert.equal(end.clampedProgress, 1);
  assert.equal(end.activeIndex, 5);
  assert.ok(end.targetYaw >= start.targetYaw + Math.PI * 2);
});

test("computeScrollDropProgress handles single-drop edge case without NaN", () => {
  const single = computeScrollDropProgress(0.5, 1);
  assert.equal(single.activeIndex, 0);
  assert.ok(Number.isFinite(single.targetYaw));
  assert.ok(Number.isFinite(single.segmentProgress));
});

test("CAMERA_PRESETS expose finite framing coordinates", () => {
  for (const preset of Object.values(CAMERA_PRESETS)) {
    assert.equal(preset.position.length, 3);
    assert.equal(preset.lookAt.length, 3);
    assert.ok(preset.fov >= 25 && preset.fov <= 60);
  }
});

test("PDP_ORBIT_PRESETS and spherical orbit helpers normalize 360deg angles and clamp bounds cleanly", () => {
  assert.equal(normalizeAzimuthDegrees(0), 0);
  assert.equal(normalizeAzimuthDegrees(Math.PI), 180);
  assert.equal(normalizeAzimuthDegrees(-Math.PI / 2), 270);
  assert.equal(normalizeAzimuthDegrees(Math.PI * 4), 0);
  assert.equal(normalizeAzimuthDegrees(Number.NaN), 0);

  assert.equal(clampOrbitPitch(0), PDP_ORBIT_MIN_POLAR_RAD);
  assert.equal(clampOrbitPitch(3.0), PDP_ORBIT_MAX_POLAR_RAD);
  assert.equal(clampOrbitDistance(1.0), PDP_ORBIT_MIN_DISTANCE);
  assert.equal(clampOrbitDistance(15.0), PDP_ORBIT_MAX_DISTANCE);

  // At polar 1.2 rad (~69 deg), elevation sits accurately above targetY and within clamp bounds
  const frontPos = sphericalToCartesian(0, 1.2, 5.0, 0.34);
  assert.ok(Math.abs(frontPos[0]) < 1e-6);
  assert.ok(Math.abs(frontPos[1] - (0.34 + 5.0 * Math.cos(1.2))) < 1e-6);
  assert.ok(Math.abs(frontPos[2] - 5.0 * Math.sin(1.2)) < 1e-6);

  // At horizon (PI/2), clampOrbitPitch keeps camera safely above studio floor
  const sidePos = sphericalToCartesian(Math.PI / 2, Math.PI / 2, 5.0, 0.34);
  assert.ok(sidePos[0] > 4.9);
  assert.ok(sidePos[1] > 0.34);
  assert.ok(Math.abs(sidePos[2]) < 1e-6);

  for (const preset of Object.values(PDP_ORBIT_PRESETS)) {
    assert.ok(preset.azimuthDeg >= 0 && preset.azimuthDeg < 360);
    assert.ok(preset.distance >= PDP_ORBIT_MIN_DISTANCE && preset.distance <= PDP_ORBIT_MAX_DISTANCE);
  }
});

test("computeCheckoutPricing enforces free-shipping threshold after discount", () => {
  const paidShipping = computeCheckoutPricing({
    items: [{ price: 249900, qty: 1 }],
    shippingMethod: "STANDARD",
    discountAmount: 10000,
  });
  assert.equal(paidShipping.discountedSubtotal, 239900);
  assert.equal(paidShipping.freeShippingUnlocked, false);
  assert.equal(paidShipping.shippingFee, 9900);
  assert.equal(paidShipping.total, 249800);

  const freeShipping = computeCheckoutPricing({
    items: [{ price: 399000, qty: 1 }],
    shippingMethod: "EXPRESS",
    discountAmount: 50000,
  });
  assert.equal(freeShipping.freeShippingUnlocked, true);
  assert.equal(freeShipping.shippingFee, 0);
  assert.equal(freeShipping.total, 349000);
});

test("HERO_DROP_CHAPTERS expose 4 sequential RB20 inspection chapters", () => {
  assert.equal(HERO_DROP_CHAPTERS.length, 4);
  for (let i = 0; i < HERO_DROP_CHAPTERS.length; i++) {
    assert.equal(HERO_DROP_CHAPTERS[i]!.id, i);
    assert.ok(HERO_DROP_CHAPTERS[i]!.title.length > 0);
    assert.ok(CAMERA_PRESETS[HERO_DROP_CHAPTERS[i]!.preset]);
  }
});

test("computeHeroDropShowcaseState completes 360deg inspection spin then triggers Max-Pro launch exit after 0.76", () => {
  const nanState = computeHeroDropShowcaseState(Number.NaN);
  assert.equal(nanState.clampedProgress, 0);
  assert.equal(nanState.chapterIndex, 0);
  assert.equal(nanState.exitProgress, 0);
  assert.equal(nanState.stageOpacity, 1);
  assert.equal(nanState.stageScale, 1);
  assert.equal(nanState.carLaunchZ, 0);

  const negState = computeHeroDropShowcaseState(-0.4);
  assert.equal(negState.clampedProgress, 0);

  const ch1 = computeHeroDropShowcaseState(0.3);
  assert.equal(ch1.chapterIndex, 1);
  assert.equal(ch1.exitProgress, 0);
  assert.equal(ch1.stageOpacity, 1);

  const ch2 = computeHeroDropShowcaseState(0.6);
  assert.equal(ch2.chapterIndex, 2);
  assert.equal(ch2.exitProgress, 0);
  assert.ok(ch2.targetYaw > ch1.targetYaw + Math.PI * 0.6);

  const threshold = computeHeroDropShowcaseState(0.76);
  assert.equal(threshold.chapterIndex, 3);
  assert.equal(threshold.exitProgress, 0);
  assert.ok(Math.abs(threshold.targetYaw - (nanState.targetYaw + Math.PI * 2)) < 1e-4);

  const midExit = computeHeroDropShowcaseState(0.9);
  assert.equal(midExit.chapterIndex, 3);
  assert.ok(midExit.exitProgress > 0 && midExit.exitProgress < 1);
  assert.ok(midExit.carLaunchZ > 0);
  assert.ok(midExit.wheelSpeedMultiplier > 5);
  assert.ok(midExit.stageOpacity > 0 && midExit.stageOpacity < 1);
  assert.ok(midExit.stageScale < 1 && midExit.stageScale > 0.86);

  const fullExit = computeHeroDropShowcaseState(1.4);
  assert.equal(fullExit.clampedProgress, 1);
  assert.equal(fullExit.exitProgress, 1);
  assert.equal(fullExit.stageOpacity, 0);
  assert.ok(Math.abs(fullExit.stageScale - 0.86) < 1e-6);
  assert.ok(fullExit.carLaunchZ > 7);
});

