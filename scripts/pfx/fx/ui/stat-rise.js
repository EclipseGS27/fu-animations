import { Particles, Lights, P, Rng, PAL, fit, seg, clamp, ease, sparkle, TAU, WHITE } from "../../core/index.js";

const POP = 0.16, GAP = 0.2, ALL = POP + 4 * GAP + 0.15, LEAVE = 1.7;

export const meta = {
  name: "Stat rise",
  desc: "Stat badges pop up off the chest one after another, each with an up-arrow and a gold flash, flash white together, then float up and break into sparkles.",
  tags: ["ui", "buff", "stats", "power up", "level", "text", "one-shot"],
  size: [136, 124],
  origin: [68, 112],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.gold, words: ["DEX", "INS", "MIG", "WLP"], seed: 4 },
};

// an up-arrow, 5 px wide, tip at (x, y)
function arrow(p, x, y, c, edge) {
  const rows = ["..#..", ".###.", "#####", "..#..", "..#.."];
  p.sprite(rows, {}, Math.round(x) - 2, Math.round(y) + 1, { tint: edge });
  p.sprite(rows, {}, Math.round(x) - 2, Math.round(y), { tint: c });
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const words = (o.words?.length ? o.words : meta.options.words).slice(0, 4);
  const n = words.length;
  // badges fan out in two rows above the chest
  const slot = (i) => [((i % 2) * 2 - 1) * 22 + (i >= 2 ? 0 : 0), -52 - Math.floor(i / 2) * 15 + (i % 2 ? 2 : 0)];
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  const popped = new Array(n).fill(false);
  let t = 0, all = false, left = false;

  return {
    update(dt) {
      t += dt;
      for (let i = 0; i < n; i++) {
        if (!popped[i] && t >= POP + i * GAP) {
          popped[i] = true;
          const [x, y] = slot(i);
          lights.add(x - 3, y - 4, 14, C[5], 0.55, 0.25);
          for (let j = 0; j < 7; j++) {
            const a = R.range(0, TAU), sp = R.range(40, 110);
            ps.spawn(P.SPARK, x - 3, y - 4, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.15, 0.35));
          }
        }
      }
      if (!all && t >= ALL) {
        all = true;
        lights.add(0, -62, 22, C[6], 0.5, 0.3);
      }
      if (!left && t >= LEAVE + 0.3) {
        left = true;
        for (let i = 0; i < n; i++) {
          const [x, y] = slot(i);
          for (let j = 0; j < 6; j++) ps.spawn(P.STAR, x - 3 + R.range(-9, 9), y - 22 + R.range(-3, 3), R.range(-15, 15), R.range(-40, -15), R.range(0.3, 0.55), j % 2 ? WHITE : C[6], 1);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      for (let i = 0; i < n; i++) {
        const t0 = POP + i * GAP;
        if (t < t0) continue;
        const [sx, sy] = slot(i);
        // pops up from the chest with an overshoot, holds, then floats off
        const up = ease.outBack(seg(t, t0, t0 + 0.22), 2.2), off = ease.inQuad(seg(t, LEAVE, LEAVE + 0.3));
        if (off >= 1) continue;
        // each badge pops straight up at its own spot from a little lower, with an overshoot
        const x = sx, y = sy + 10 * (1 - up) - off * 18;
        const fresh = 1 - seg(t, t0, t0 + 0.12), flash = t >= ALL && t < ALL + 0.08;
        const body = fresh > 0.4 || flash ? WHITE : t < t0 + 0.3 ? C[7] : C[6];
        const w = p.measure(words[i], { font: "big" })[0];
        p.glow(x, y - 3, 12, C[4], 0.2 + 0.3 * fresh + (flash ? 0.4 : 0));
        p.text(words[i], x - 3, y - 7, body, { font: "big", align: "center", outline: C[1] });
        arrow(p, x + w / 2 + 2, y - 7, flash ? WHITE : C[5], C[1]);
        if (fresh > 0.5) sparkle(p, x + w / 2, y - 8, 4, WHITE, C[6], 0.6);
      }
      ps.draw(p, "back");
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
