import { Particles, Lights, P, Rng, fit, seg, clamp, ease, sparkle, flare, TAU, WHITE } from "../../core/index.js";
import { floorRing, sigil } from "./_lib.js";

const SY = 0.36; // the floor's tilt
const SEAL = 0.0, RUN = 0.5, CLOSE = 1.05, FLARE = 1.15, FADE = 2.1;

export const meta = {
  name: "Trinity link",
  desc: "Three seals bloom on the floor at a triangle's corners, light races along its edges, a triangular sigil flares in the middle with a column of light, then motes drift up.",
  tags: ["arcane", "triangle", "link", "team", "combo", "seal", "ground", "one-shot"],
  size: [176, 120],
  origin: [88, 84],
  duration: 3,
  loop: false,
  fps: 30,
  bg: "ground",
  // corners on the floor, px from the origin (the game passes its heroes' feet)
  options: { palette: ["#1a0a24", "#3c1250", "#7a1f8c", "#c23cc0", "#ff6bd5", "#ffb3ec", "#fff0fb", "#ffffff"], points: [[-58, 14], [0, -26], [58, 14]], seed: 5 },
};

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const pts = (o.points?.length >= 3 ? o.points : meta.options.points).slice(0, 3).map(([x, y]) => [x, y]);
  const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
  const ps = new Particles({ rng: R, ground: () => 26, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  const seals = [false, false, false];
  let t = 0, flared = false;

  // light along edge i: a hot head racing from corner i to the next, a lit trail behind it
  function edge(p, i, u, k, back = 0) {
    const [ax, ay] = pts[i], [x1, y1] = pts[(i + 1) % 3];
    if (u <= back) return;
    const x0 = ax + (x1 - ax) * back, y0 = ay + (y1 - ay) * back;
    const hx = ax + (x1 - ax) * u, hy = ay + (y1 - ay) * u;
    p.line(x0, y0, hx, hy, C[4]);
    p.line(x0, y0 - 1, hx, hy - 1, C[6]);
    p.glowLine(x0, y0, hx, hy, 3, C[4], 0.25 * k);
    if (u < 1) {
      p.glow(hx, hy, 6, C[6], 0.7);
      sparkle(p, hx, hy, 3, WHITE, C[6], 0.6);
    }
  }

  // a corner seal: a small ring on the floor that blooms, its sigil standing in it
  function seal(p, i, s, k, far) {
    // fading out, the seal shrinks back into its corner rather than dithering away
    const [x, y] = pts[i], r = 9 * ease.outBack(clamp(s), 2) * (0.25 + 0.75 * k);
    k = Math.min(1, k * 1.6);
    floorRing(p, x, y, r, SY, (g) => (Math.sin(g) < 0 ? C[4] : C[6]), k, far ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0);
    floorRing(p, x, y, r * 0.55, SY, C[5], k * 0.8, far ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0);
    if (!far && s > 0.4 && r > 5) sigil(p, i * 3 + 1, x, y - 6 - 2 * Math.sin(t * 6 + i), C[6], 1, C[2]);
    if (!far && s > 0) p.glow(x, y - 2, 12, C[4], 0.3 * k * s);
  }

  return {
    update(dt) {
      t += dt;
      for (let i = 0; i < 3; i++) {
        if (!seals[i] && t >= SEAL + i * 0.12) {
          seals[i] = true;
          const [x, y] = pts[i];
          lights.add(x, y - 4, 20, C[5], 0.6, 0.3);
          for (let j = 0; j < 8; j++) ps.spawn(P.STAR, x + R.range(-6, 6), y - R.range(0, 6), R.range(-15, 15), R.range(-50, -20), R.range(0.3, 0.6), j % 2 ? WHITE : C[6], 1);
        }
      }
      if (!flared && t >= FLARE) {
        flared = true;
        lights.add(cx, cy - 10, 36, C[5], 0.5, 0.4);
        for (let j = 0; j < 28; j++) {
          const a = R.range(0, TAU), sp = R.range(50, 170);
          ps.spawn(P.SPARK, cx, cy - 8, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 60, R.range(0.3, 0.7));
        }
      }
      // motes drift up off the triangle while it holds
      if (t > FLARE && t < FADE && R.chance(0.5)) {
        const i = R.int(0, 2), u = R.range(0, 1), [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 3];
        ps.spawn(P.MOTE, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, R.range(-8, 8), R.range(-40, -20), R.range(0.4, 0.8), R.chance(0.5) ? C[6] : C[5]);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const k = 1 - seg(t, FADE, FADE + 0.6);
      if (k <= 0) return;
      for (let i = 0; i < 3; i++) seal(p, i, seg(t, SEAL + i * 0.12, SEAL + i * 0.12 + 0.35), k, true);
      // the closed triangle: soft light pooled on the floor inside it, no fill
      const fill = seg(t, CLOSE, CLOSE + 0.2) * k;
      if (fill > 0) {
        const [a, b, c] = pts, x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), y0 = Math.min(a[1], b[1], c[1]), y1 = Math.max(a[1], b[1], c[1]);
        const side = (px, py, [ux, uy], [vx, vy]) => (vx - ux) * (py - uy) - (vy - uy) * (px - ux);
        p.shade(x0, y0, x1, y1, (x, y, out) => {
          const s0 = side(x, y, a, b), s1 = side(x, y, b, c), s2 = side(x, y, c, a);
          if (!((s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0))) return;
          const d = Math.hypot(x - cx, (y - cy) * 2) / 60;
          out.l = C[4];
          out.k = 0.16 * fill * Math.max(0, 1 - d);
        });
      }
      const back = ease.inCubic(seg(t, FADE, FADE + 0.6));
      for (let i = 0; i < 3; i++) edge(p, i, ease.inOutCubic(seg(t, RUN + i * 0.18, RUN + i * 0.18 + 0.35)), 1, back);
    },
    draw(p) {
      const k = 1 - seg(t, FADE, FADE + 0.6);
      if (k > 0) for (let i = 0; i < 3; i++) seal(p, i, seg(t, SEAL + i * 0.12, SEAL + i * 0.12 + 0.35), k, false);
      // the flare: a column of light out of the centre and a triangular sigil turning over it
      const f = seg(t, FLARE, FLARE + 0.9);
      if (f > 0 && f < 1) {
        const w = 6 * (1 - ease.inQuad(f)), h = 70 * ease.outExpo(clamp(f * 3));
        // the column: solid lines that thin away, light around them
        if (w > 1) p.line(cx - 1, cy, cx - 1, cy - h * 0.92, C[5]);
        if (w > 1) p.line(cx + 1, cy, cx + 1, cy - h * 0.92, C[5]);
        p.line(cx, cy, cx, cy - h, f < 0.5 ? WHITE : C[6]);
        p.glowLine(cx, cy, cx, cy - h, 5, C[4], 0.3 * (1 - f));
        const r = 8 + 10 * ease.outQuart(f), spin = f * 2;
        const tri = [0, 1, 2].map((j) => [cx + Math.cos(spin + (j * TAU) / 3 - Math.PI / 2) * r, cy - 24 + Math.sin(spin + (j * TAU) / 3 - Math.PI / 2) * r]);
        p.polyline([...tri, tri[0]], f < 0.15 ? WHITE : f < 0.5 ? C[6] : f < 0.8 ? C[5] : C[4]);
        if (f < 0.2) flare(p, cx, cy - 24, 18 * ease.outQuart(f * 5), 0.45, C);
      }
      ps.draw(p, "back");
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
