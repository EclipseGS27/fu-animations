import { Particles, Lights, P, PF, Rng, PAL, fit, flare, sparkle, seg, clamp, ease, TAU, WHITE } from "../../core/index.js";

const S = 17; // a die's face, px
const LAND = [0.78, 0.9, 1.02]; // when each die comes to rest
const REVEAL = 1.15, STEP = 0.22, BURST = REVEAL + 3 * STEP + 0.1, FADE = 2.55;
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const REST = [-24, 0, 24];

export const meta = {
  name: "Dice roll",
  desc: "Three ivory dice tumble in, bounce twice kicking up dust and settle on their faces; the pips light up die by die, a gold flare bursts and the dice vanish in sparkles.",
  tags: ["ui", "dice", "luck", "gamble", "chance", "roll", "one-shot"],
  size: [176, 112],
  origin: [88, 100],
  duration: 3.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.gold, dice: PAL.bone, faces: [6, 3, 5], seed: 7 },
};

// where a die is at time t: thrown from the upper left, bouncing lower each time, spinning slower
function pose(i, t) {
  const t0 = i * 0.12, t1 = LAND[i], u = seg(t, t0, t1);
  const x = -70 + (REST[i] + 70) * ease.outCubic(u);
  // three arcs, each lower: the floor is at y = 0, the die's centre half a face above it
  const bounces = [[0, 0.55, 64], [0.55, 0.85, 16], [0.85, 1, 4]];
  let y = -S / 2;
  for (const [a, b, h] of bounces) {
    if (u < a || u > b) continue;
    const k = (u - a) / (b - a);
    y -= a === 0 ? h * (1 - k * k) : h * 4 * k * (1 - k);
  }
  const spin = (1 - ease.outCubic(u)) * (3.5 + i) * TAU * (i % 2 ? -1 : 1);
  return { x, y, a: spin, u, live: t >= t0 };
}

export function create(o) {
  const C = fit(o.palette, 8), D = fit(o.dice, 7), R = new Rng(o.seed);
  const faces = [0, 1, 2].map((i) => clamp(Math.round(o.faces?.[i] ?? 1), 1, 6));
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  const hits = [0, 1, 2].map(() => [false, false, false]);
  const flashed = [false, false, false];
  let t = 0, burst = false;

  function contact(x, k) {
    for (let j = 0; j < 4 + k * 3; j++) ps.spawn(P.DUST, x + R.range(-6, 6), -1, R.range(-30, 30), R.range(-18, -4), R.range(0.35, 0.7), D[2], R.range(2, 3.5), 0, PF.BACK);
    for (let j = 0; j < k * 2; j++) ps.spawn(P.SPARK, x, -2, R.range(-80, 80), R.range(-140, -60), R.range(0.15, 0.3));
  }

  // one die: a dark side below for thickness, the face turned by its spin, a bevel lit from the top left
  function die(p, i, x, y, a, face, glow, alpha, sc) {
    const h = (S / 2) * sc, cs = Math.cos(a), sn = Math.sin(a);
    const pt = (px, py) => [x + px * cs - py * sn, y + px * sn + py * cs];
    const corners = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([px, py]) => pt(px, py));
    p.poly(corners.map(([cx, cy]) => [cx + 1, cy + 2]), D[1], alpha);
    p.poly(corners, D[4], alpha);
    p.poly([pt(-h + 2, -h + 2), pt(h - 2, -h + 2), pt(h - 2, h - 2), pt(-h + 2, h - 2)], D[5], alpha);
    // bevel: bright top and left edges, dark bottom and right
    p.line(...pt(-h, -h), ...pt(h - 1, -h), D[6], alpha);
    p.line(...pt(-h, -h), ...pt(-h, h - 1), D[6], alpha);
    p.line(...pt(h, -h + 1), ...pt(h, h), D[2], alpha);
    p.line(...pt(-h + 1, h), ...pt(h, h), D[2], alpha);
    // pips: while it spins the face changes with each quarter turn; at rest, its own
    const shown = Math.abs(a) > 0.05 ? 1 + (Math.floor(Math.abs(a) / (TAU / 4)) + i) % 6 : face;
    for (const k of PIPS[shown]) {
      const gx = ((k % 3) - 1) * 4.6 * sc, gy = (Math.floor(k / 3) - 1) * 4.6 * sc;
      const [qx, qy] = pt(gx, gy);
      const lit = glow > 0.35;
      p.rect(Math.round(qx) - 1, Math.round(qy) - 1, 3, 3, lit ? C[4] : D[0], alpha);
      p.px(Math.round(qx) - 1, Math.round(qy) - 1, lit ? WHITE : D[1]);
      if (lit) p.light(qx, qy, C[6], 0.4 * glow);
    }
    // a gold rim of light round the die instead of washing its face out
    if (glow > 0) {
      p.polyline([...corners, corners[0]], C[6], glow * alpha);
      p.glow(x, y, 15, C[4], 0.18 * glow);
    }
  }

  return {
    update(dt) {
      const prev = t;
      t += dt;
      for (let i = 0; i < 3; i++) {
        // dust and a few sparks at each touchdown
        for (const [k, at] of [[0, 0.55], [1, 0.85], [2, 1]].map(([k, a]) => [k, i * 0.12 + (LAND[i] - i * 0.12) * a])) {
          if (!hits[i][k] && t >= at) {
            hits[i][k] = true;
            contact(pose(i, at).x, 2 - k);
          }
        }
        const fl = REVEAL + i * STEP;
        if (!flashed[i] && t >= fl) {
          flashed[i] = true;
          lights.add(REST[i], -S / 2, 26, C[5], 0.8, 0.35);
          for (let j = 0; j < 8; j++) if (j < 5) ps.spawn(P.STAR, REST[i] + R.range(-10, 10), -S / 2 + R.range(-10, 2), R.range(-20, 20), R.range(-50, -20), R.range(0.3, 0.6), j % 2 ? WHITE : C[6], 1);
        }
      }
      if (!burst && t >= BURST) {
        burst = true;
        lights.add(0, -34, 44, C[5], 0.55, 0.45);
        for (let j = 0; j < 36; j++) {
          const a = R.range(0, TAU), sp = R.range(60, 220);
          ps.spawn(P.SPARK, 0, -34, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.3, 0.8));
        }
      }
      // the dice dissolve upward in sparkles
      if (t > FADE && prev <= FADE + 0.3 && Math.floor(t * 20) !== Math.floor(prev * 20)) for (let i = 0; i < 3; i++) for (let j = 0; j < 1; j++) ps.spawn(P.STAR, REST[i] + R.range(-6, 6), -S / 2 + R.range(-6, 6), R.range(-10, 10), R.range(-60, -30), R.range(0.3, 0.55), j ? C[6] : WHITE, 1);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
      // soft shadows under the dice, smaller while they are in the air
      for (let i = 0; i < 3; i++) {
        const d = pose(i, t);
        if (!d.live || t > FADE + 0.5) continue;
        const air = clamp(-(d.y + S / 2) / 60);
        p.ellipse(d.x, 0.5, 7 * (1 - air * 0.6), 2, 0, 0.35 * (1 - air) * (1 - seg(t, FADE, FADE + 0.5)));
      }
    },
    draw(p) {
      for (let i = 0; i < 3; i++) {
        const d = pose(i, t);
        if (!d.live) continue;
        const fl = REVEAL + i * STEP;
        const glow = t >= fl ? Math.max(0, 1 - (t - fl) / 0.5) + 0.25 * clamp(1 - (t - BURST) / 0.6) : 0;
        const out = seg(t, FADE, FADE + 0.45);
        if (out >= 1) continue;
        die(p, i, d.x, d.y + (S / 2) * ease.inQuad(out), d.a, faces[i], glow + (out > 0.75 ? 1 : 0), 1, 1 - 0.8 * ease.inQuad(out));
      }
      // the payoff: a gold flare over the three
      const b = seg(t, BURST, BURST + 0.5);
      if (b > 0 && b < 1) {
        flare(p, 0, -34, 30 * ease.outQuart(b), 0.6 * (1 - b), C);
        if (b < 0.1) sparkle(p, 0, -34, 10, WHITE, C[6], 0.7);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
