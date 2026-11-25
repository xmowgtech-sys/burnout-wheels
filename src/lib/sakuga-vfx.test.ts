import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySakugaTarget,
  createSakugaEffect,
  stepSakugaEffects,
  stepSpring,
  type SakugaEffectKind,
} from "./sakuga-vfx";

test("stepSpring produces underdamped overshoot and converges cleanly without NaN", () => {
  let state = { value: 0, velocity: 0 };
  let maxVal = 0;

  for (let i = 0; i < 180; i++) {
    state = stepSpring(state, 1, 1 / 60, { stiffness: 320, damping: 14, mass: 1 });
    assert.ok(Number.isFinite(state.value));
    assert.ok(Number.isFinite(state.velocity));
    if (state.value > maxVal) maxVal = state.value;
  }

  assert.ok(maxVal > 1.08, `Expected anime overshoot > 1.08, got ${maxVal}`);
  assert.ok(Math.abs(state.value - 1) < 0.01, `Expected convergence near 1, got ${state.value}`);
});

test("createSakugaEffect populates particles and SFX for every supported effect kind", () => {
  const kinds: SakugaEffectKind[] = [
    "impact",
    "slash",
    "smoke",
    "sparkle",
    "splash",
    "check",
    "keyspark",
  ];

  for (const kind of kinds) {
    const fx = createSakugaEffect(kind, 240, 180, { seed: 42 });
    assert.equal(fx.kind, kind);
    assert.equal(fx.x, 240);
    assert.equal(fx.y, 180);
    assert.ok(fx.duration > 0);
    const totalGeometry = fx.puffs.length + fx.wedges.length + fx.sparks.length + fx.burstSpikes.length;
    assert.ok(totalGeometry > 0, `Expected drawn geometry for ${kind}`);
    if (kind !== "keyspark") {
      assert.ok(fx.sfx && fx.sfx.text.length > 0, `Expected manga SFX callout for ${kind}`);
    }
  }
});

test("stepSakugaEffects advances particle motion and prunes expired effects to empty idle state", () => {
  const fx = createSakugaEffect("impact", 100, 100, { seed: 7 });
  const initialSparkX = fx.sparks[0]!.x;

  let active = [fx];
  active = stepSakugaEffects(active, 50);
  assert.equal(active.length, 1);
  assert.equal(active[0]!.age, 50);
  assert.notEqual(active[0]!.sparks[0]!.x, initialSparkX);

  // Advance past total duration — loop must cleanly empty so canvas sleeps at 0% CPU
  for (let i = 0; i < 20; i++) {
    active = stepSakugaEffects(active, 50);
  }
  assert.equal(active.length, 0);
});

test("classifySakugaTarget maps storefront buttons, chips, wishlist, toggles, and opt-outs accurately", () => {
  assert.equal(
    classifySakugaTarget({ tagName: "BUTTON", classNames: "u-btn u-btn-primary" })?.kind,
    "impact"
  );
  assert.equal(
    classifySakugaTarget({ tagName: "BUTTON", classNames: "u-btn u-btn-ghost" })?.kind,
    "slash"
  );
  assert.equal(
    classifySakugaTarget({ tagName: "A", classNames: "u-chip" })?.kind,
    "slash"
  );
  assert.equal(
    classifySakugaTarget({ tagName: "BUTTON", ariaLabel: "Add Ferrari F50 to wishlist" })?.kind,
    "sparkle"
  );
  assert.equal(
    classifySakugaTarget({ tagName: "BUTTON", role: "switch" })?.kind,
    "smoke"
  );
  assert.equal(
    classifySakugaTarget({ tagName: "BUTTON", classNames: "u-btn u-btn-primary", dataSakuga: "off" }),
    null
  );
  assert.equal(
    classifySakugaTarget({ tagName: "BUTTON", dataSakuga: "check" })?.kind,
    "check"
  );
});
