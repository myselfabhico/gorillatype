/*
 * Builds src/utils/handRig.ts from the traced contours in src/utils/handArt.ts.
 * Run it with `node scripts/build-hand-rig.mjs` after editing the trace.
 *
 * The traced art is a single silhouette per hand, so nothing can move on its
 * own. This script slices each hand into one part per finger plus a palm/wrist
 * part, using the seams that are already drawn in the artwork as the cut lines
 * (each measured off the trace by scanning it for the ink lines between the
 * skin regions). Every part keeps the original contour clipped to its own
 * region, so the union of the parts at rest is the trace.
 *
 * Each part's outline is simplified and then curve-fitted to take the trace's
 * stair steps out, keeping every extreme, and is pushed clear of the body
 * contour by a fixed rim width. Freshly cut edges are left exactly straight so
 * the parts still tile without gaps.
 */
import { readFileSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- trace input

const src = readFileSync('src/utils/handArt.ts', 'utf8');
const pathOf = (name) => {
  const body = src.match(new RegExp(`export const ${name} =\\s*([\\s\\S]*?);`))[1];
  return [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
};
const parsePath = (d) => {
  const tokens = d.match(/[MLZmlz]|-?\d*\.?\d+/g) ?? [];
  const pts = [];
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (t === 'M' || t === 'L' || t === 'Z' || t === 'z') { i++; continue; }
    pts.push([parseFloat(tokens[i]), parseFloat(tokens[i + 1])]);
    i += 2;
  }
  return pts;
};

/** Extends the wrist past the bottom of the drawing so the hand can rise without ever revealing a cut edge. */
function extendWrist(poly, depth = 400) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i];
    out.push([x, y]);
    const [nx, ny] = poly[(i + 1) % poly.length];
    if (Math.abs(y - 260) < 1 && Math.abs(ny - 260) < 1) {
      out.push([x, depth], [nx, depth]);
    }
  }
  return out;
}

// ------------------------------------------------------------- part geometry
// Each entry: [id, finger, tip, pivotLine x at y=100 (or its own two points),
// leftBoundary, rightBoundary] where boundaries are lines given by two points.

const LINES = {
  left: {
    bounds: {
      outerL: [[30, 100], [30, 166]],
      a_s: [[94, 100], [55.5, 166]],
      s_d: [[117, 100], [74.5, 166]],
      d_f: [[155.5, 100], [110, 166]],
      f_thumb: [[159, 154], [151, 166]],
      outerR: [[210, 100], [210, 166]],
    },
    fingers: [
      { id: 'lpinky', finger: 'lpinky', tip: [84, 93], left: 'outerL', right: 'a_s', centre: [[84, 100], [51, 166]] },
      { id: 'lring', finger: 'lring', tip: [117, 90], left: 'a_s', right: 's_d', centre: [[107, 100], [65, 166]] },
      { id: 'lmiddle', finger: 'lmiddle', tip: [141, 92], left: 's_d', right: 'd_f', centre: [[134, 100], [91, 166]] },
      { id: 'lindex', finger: 'lindex', tip: [168, 94], left: 'd_f', right: 'f_thumb', centre: [[169, 100], [128, 166]] },
      { id: 'lthumb', finger: 'lthumb', tip: [177, 150], left: 'f_thumb', right: 'outerR', centre: [[176, 154], [170.5, 166]], top: 138 },
    ],
  },
  right: {
    bounds: {
      outerL: [[250, 100], [250, 166]],
      thumb_k: [[295.5, 154], [302.5, 166]],
      k_l: [[302.5, 100], [345.5, 166]],
      l_semi: [[337, 100], [379.5, 166]],
      semi_quote: [[362, 100], [398, 166]],
      outerR: [[440, 100], [440, 166]],
    },
    fingers: [
      { id: 'rthumb', finger: 'rthumb', tip: [277, 150], left: 'outerL', right: 'thumb_k', centre: [[277.5, 154], [282.5, 166]], top: 138 },
      { id: 'rindex', finger: 'rindex', tip: [285, 94], left: 'thumb_k', right: 'k_l', centre: [[289.5, 100], [327, 166]] },
      { id: 'rmiddle', finger: 'rmiddle', tip: [316, 94], left: 'k_l', right: 'l_semi', centre: [[322, 100], [363, 166]] },
      { id: 'rring', finger: 'rring', tip: [342, 94], left: 'l_semi', right: 'semi_quote', centre: [[347, 100], [389, 166]] },
      { id: 'rpinky', finger: 'rpinky', tip: [372, 97], left: 'semi_quote', right: 'outerR', centre: [[373, 100], [403, 166]] },
    ],
  },
};

const TOP = 78;          // region tops sit above every fingertip
const PIVOT_Y = 176;     // fingers are pinned a little way inside the palm
const PALM_TOP = 169;    // where the fingers and the palm actually merge
// How far each region reaches past the seam on its left, and past the seam on
// its right. Both cuts are deliberately inside the dark seam line the artwork
// draws between the two fingers, so the two regions overlap in ink the artwork
// already has there.
//
// The margin has to cover a slide the cuts really do take. A finger moves along
// its axis (see axisOf below), and for the two fingers whose far side is a plain
// boundary rather than a drawn seam — the thumb and the little finger — the axis
// is the mean of two lines that disagree by tens of degrees, so neither cut is
// parallel to it and a long stretch drags the cut sideways. Measured on the
// little finger: 2.2px of slide at a stretch of 1.12, which is exactly what a
// 2px overlap has to give up — leaving the board showing through a hairline at
// the seam (`run-aa.cjs envelope` finds it). Four pixels each side leaves room
// for the whole range of motion; the overlap only ever sits in ink the artwork
// has already drawn between the two fingers, so it changes nothing visible.
const OVERLAP = 4;
const UNDER = 4;
// How far the wash region retreats inside its own seams, for the one finger
// whose highlight is still a straight strip (see the silhouette pass below).
const WASH_MARGIN = 0;
// Where the drawn gaps between the fingers can bottom out, and how far off its
// own seam line a gap's bottom may sit and still belong to it.
const NOTCH_MIN_Y = 120;
const NOTCH_MAX_Y = 215;
const NOTCH_TOL = 8;

const atY = (line, y) => {
  const [[x0, y0], [x1, y1]] = line;
  return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
};

// ------------------------------------------------------------------ smoothing

/**
 * Douglas–Peucker, so straight stretches keep only their endpoints. A ring is
 * passed through as an open chain: its first and last vertices are pinned, which
 * is what keeps the metric well defined (a ring closed back onto its own first
 * vertex would measure every offset against a zero-length chord).
 */
function simplify(points, eps) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = -1;
    let index = -1;
    const [x0, y0] = points[first];
    const [x1, y1] = points[last];
    const den = Math.hypot(x1 - x0, y1 - y0) || 1;
    for (let i = first + 1; i < last; i++) {
      const d = Math.abs((points[i][0] - x0) * (y1 - y0) - (points[i][1] - y0) * (x1 - x0)) / den;
      if (d > maxDist) { maxDist = d; index = i; }
    }
    if (maxDist > eps) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const fmt = (n) => (Math.round(n * 10) / 10).toString();
// A direction is worth far more precision than a coordinate: a tenth of a unit
// of error in the axis is a whole degree, and a degree of error slides a finger's
// cuts a third of a pixel sideways at its tip.
const fmtAxis = (n) => (Math.round(n * 1e4) / 1e4).toString();

const insidePoly = (poly, x, y) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

/**
 * The outline is the border the eye actually reads, so it is the contour that
 * gets the smoothing treatment — but by curve fitting, not by blurring. Throwing
 * the trace at a Gaussian shaves the fingertips back by a couple of units and
 * eats the rim; simplifying first and then running a quadratic B-spline through
 * the remaining points keeps every extreme of the drawing while taking the
 * stair steps out.
 *
 * The skin contour is deliberately left exactly as traced: the thin seams drawn
 * between the fingers live in its notches, and moving those by even a unit is
 * what made stray lines run along the fingers and the knuckles.
 */
function smoothOutline(points, step, tolerance) {
  const controls = simplify(points, tolerance);
  const n = controls.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const from = mid(controls[(i - 1 + n) % n], controls[i]);
    const to = mid(controls[i], controls[(i + 1) % n]);
    const count = Math.max(2, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / step));
    for (let s = 0; s < count; s++) {
      const t = s / count;
      const u = 1 - t;
      out.push([
        u * u * from[0] + 2 * u * t * controls[i][0] + t * t * to[0],
        u * u * from[1] + 2 * u * t * controls[i][1] + t * t * to[1],
      ]);
    }
  }
  return out;
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * Keeps the outline at least `margin` clear of the skin, pushing any vertex that
 * drifted closer back out along the skin's normal. That pins the drawn rim to a
 * consistent width, and — because the outline then contains the body by
 * construction — makes it impossible for a seam to open up as a bright or dark
 * stray line.
 */
function clearOfSkin(ink, skin, margin) {
  return ink.map(([x, y]) => {
    let best = null;
    for (let i = 0; i < skin.length; i++) {
      const a = skin[i];
      const b = skin[(i + 1) % skin.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
      const px = a[0] + dx * t;
      const py = a[1] + dy * t;
      const dist = Math.hypot(x - px, y - py);
      if (!best || dist < best.dist) best = { dist, px, py, nx: -dy / Math.sqrt(len2), ny: dx / Math.sqrt(len2) };
    }
    if (!best || best.dist >= margin) return [x, y];
    const out = insidePoly(skin, best.px + best.nx * margin, best.py + best.ny * margin) ? -1 : 1;
    return [best.px + best.nx * margin * out, best.py + best.ny * margin * out];
  });
}

const toPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`).join('') + 'Z';

// ------------------------------------------------------------------ assembly

/** Curve-fit settings for the outline, and the rim width kept clear of the body. */
const OUTLINE_TOLERANCE = 0.75;
const OUTLINE_STEP = 2.6;
const RIM = 1.4;

const hands = {};
for (const side of ['left', 'right']) {
  const tag = side.toUpperCase();
  const traced = parsePath(pathOf(`${tag}_HAND_SKIN`));
  const skin = extendWrist(traced);
  const outline = extendWrist(parsePath(pathOf(`${tag}_HAND_OUTLINE`)));
  const smoothed = smoothOutline(outline, OUTLINE_STEP, OUTLINE_TOLERANCE);
  if (process.env.HAND_RIG_DEBUG) console.log(`${side}: outline ${outline.length} -> simplified+fit ${smoothed.length} -> cleared ${clearOfSkin(smoothed, skin, RIM).length}`);
  hands[side] = { traced, skin, outline: clearOfSkin(smoothed, skin, RIM) };
}

// ------------------------------------------------------------- silhouettes
/**
 * The highlight of a finger is that finger's own outline, dug out of the traced
 * hand rather than cut from a pair of straight lines.
 *
 * A strip between the two seam lines is what a finger with straight sides looks
 * like, and the artwork's fingers are not: they are drawn bent, and the strip
 * wanders off the finger by ten units halfway down — leaving a third of the
 * finger's width bare on one side and hanging over the drawn gap on the other.
 * The drawn gaps themselves are a better guide, because they are what the eye
 * reads as the edge of a finger: each one is a dead-end notch in the skin
 * contour, so the outline runs down one side of it and back up the other. The
 * finger between two of those notches is exactly the stretch of contour from one
 * notch bottom, around the tip, to the next — closed across the knuckle, which
 * is where the notches bottom out.
 *
 * So each highlight is that stretch of contour plus the straight closing cut,
 * which is the same drawn skin the body is painted from: the tint can therefore
 * neither stop short of the finger's edge nor cross the ink line between it and
 * the finger next door. The thumb is the exception — its web is drawn as a
 * single line rather than a gap, so it keeps the straight strip.
 */
const idxMod = (i, n) => ((i % n) + n) % n;

/** Indices of the dead-end notches in the skin contour: the drawn gaps between fingers. */
function notchBottoms(ring) {
  const n = ring.length;
  const found = [];
  for (let i = 0; i < n; i++) {
    const y = ring[i][1];
    if (y < NOTCH_MIN_Y || y > NOTCH_MAX_Y) continue;
    let deepest = true;
    for (let d = 1; d <= 10 && deepest; d++) {
      if (ring[idxMod(i - d, n)][1] > y + 1e-9 || ring[idxMod(i + d, n)][1] > y + 1e-9) deepest = false;
    }
    if (deepest) found.push(i);
  }
  return found;
}

/** The notch bottom that belongs to a seam line, or null when that side is a hand edge or has no notch. */
function notchOn(ring, bottoms, line) {
  let best = null;
  for (const i of bottoms) {
    const d = Math.abs(ring[i][0] - atY(line, ring[i][1]));
    if (!best || d < best.d) best = { i, d };
  }
  return best && best.d <= NOTCH_TOL ? best.i : null;
}

/**
 * The contour from a notch bottom to the far end of the finger: round the tip,
 * then on until the outline reaches a notch bottom again (the far side of the
 * finger) or drops back to the height it started at (a hand edge, which has no
 * notch to stop on). Both directions are walked and the one that passes the
 * tip is kept.
 */
function arcToTip(ring, start, bottoms, tip) {
  const n = ring.length;
  const startY = ring[start][1];
  const walk = (dir) => {
    const points = [ring[start]];
    let closest = Infinity;
    for (let step = 1; step < n; step++) {
      const i = idxMod(start + dir * step, n);
      const [x, y] = ring[i];
      points.push([x, y]);
      closest = Math.min(closest, Math.hypot(x - tip[0], y - tip[1]));
      if (step > 1 && (y >= startY || bottoms.has(i))) break;
    }
    return { points, closest };
  };
  const forward = walk(1);
  const backward = walk(-1);
  return forward.closest <= backward.closest ? forward.points : backward.points;
}

const dirOf = (line) => {
  const [[x0, y0], [x1, y1]] = line;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  return [(x1 - x0) / len, (y1 - y0) / len];
};

/**
 * The one direction a finger is allowed to move in: roughly along the seam it
 * shares with either neighbour, which is also the direction the finger itself
 * points. The cuts are the two seam lines, so moving along their mean leaves
 * both of them exactly where they are — a map that scales one direction and
 * fixes the perpendicular one maps every line parallel to that direction onto
 * itself. The seams disagree by a fraction of a degree, so the residual is
 * hundredths of a pixel; a finger that moved straight up would instead drag
 * both cuts several pixels sideways and paint its outline across its neighbour.
 */
const axisOf = (left, right) => {
  const [la, lb] = dirOf(left);
  const [ra, rb] = dirOf(right);
  const len = Math.hypot(la + ra, lb + rb) || 1;
  const ax = (la + ra) / len;
  const ay = (lb + rb) / len;
  // Both bounds are measured downwards; the axis points up towards the tip.
  return ay > 0 ? [-ax, -ay] : [ax, ay];
};

const straightWash = (bounds, f, top) => [
  [atY(bounds[f.left], top) + WASH_MARGIN, top],
  [atY(bounds[f.right], top) - WASH_MARGIN, top],
  [atY(bounds[f.right], PIVOT_Y) - WASH_MARGIN, PIVOT_Y],
  [atY(bounds[f.left], PIVOT_Y) + WASH_MARGIN, PIVOT_Y],
];

/** Each finger's highlight region: its own traced outline, or the straight strip. */
const WASHES = { left: {}, right: {} };
for (const side of ['left', 'right']) {
  const { bounds, fingers } = LINES[side];
  const ring = hands[side].traced;
  const bottoms = new Set(notchBottoms(ring));
  for (const f of fingers) {
    const top = f.top ?? TOP;
    const left = notchOn(ring, bottoms, bounds[f.left]);
    const right = notchOn(ring, bottoms, bounds[f.right]);
    const start = left ?? right;
    const fallback = straightWash(bounds, f, top);
    WASHES[side][f.id] = start === null ? fallback : arcToTip(ring, start, bottoms, f.tip);
  }
}

const out = { left: [], right: [] };
for (const side of ['left', 'right']) {
  const { bounds, fingers } = LINES[side];
  for (const f of fingers) {
    const top = f.top ?? TOP;
    const l0 = atY(bounds[f.left], top) - OVERLAP;
    const l1 = atY(bounds[f.left], PIVOT_Y) - OVERLAP;
    const r0 = atY(bounds[f.right], top) + UNDER;
    const r1 = atY(bounds[f.right], PIVOT_Y) + UNDER;
    const region = [[l0, top], [r0, top], [r1, PIVOT_Y], [l1, PIVOT_Y]];
    const pivot = [atY(f.centre, PIVOT_Y), PIVOT_Y];
    out[side].push({
      id: f.id,
      finger: f.finger,
      tip: f.tip,
      pivot,
      region,
      wash: WASHES[side][f.id],
      axis: axisOf(bounds[f.left], bounds[f.right]),
    });
  }
  // Palm: everything from the merge line down, and never animated.
  out[side].push({
    id: 'palm',
    finger: 'palm',
    tip: [side === 'left' ? 95 : 355, 250],
    pivot: [side === 'left' ? 95 : 355, 250],
    region: [[10, PALM_TOP], [470, PALM_TOP], [470, 420], [10, 420]],
    wash: [[10, PALM_TOP], [470, PALM_TOP], [470, 420], [10, 420]],
    axis: [0, -1],
  });
}

let ts = `/**
 * Animatable hand rig, generated from the traced artwork in utils/handArt.ts by
 * scripts/build-hand-rig.mjs. Do not hand-edit: the numbers below are
 * measurements taken off the reference design.
 *
 * Each hand is sliced into one part per finger plus a palm/wrist part. The cut
 * lines follow the seams that are already drawn in the trace, so at rest the
 * parts tile back into the original silhouette — while each part can be moved on
 * its own, pinned on the line y = PIVOT_Y so a moving finger never tears away
 * from the palm. Each cut reaches a little past the seam it follows, so the two
 * neighbours overlap where the artwork is dark anyway; the bodies are cut wider
 * still, because a cut that lands inside one of the trace's seam slits would
 * turn its even-odd fill inside out.
 *
 * Each hand is drawn twice: the whole hand's outline, and the whole hand's body
 * on top of it. Every part is both of those, cut to its own region — the whole
 * hand as far as that finger is concerned — and the cut is left to the renderer
 * (a clipPath in components/TypingHands.tsx) rather than baked into the path, so
 * the contour it cuts through stays exactly the traced one.
 *
 * The region a part is cut to only has to cover its finger; where exactly it
 * falls is invisible, because the drawn gaps between the fingers are holes in the
 * contour every part is filled with. The highlight is the one thing that cannot
 * afford a straight cut, so it is given the finger's own traced outline instead
 * (see the silhouette pass below) and is likewise left to the renderer to clip.
 *
 * Why these transforms: a finger only ever stretches and slides along its axis,
 * the direction of its own two cuts, so both of those cuts stay exactly where
 * they are and no finger can drag its outline over the finger next door or open
 * a slit beside it. Nothing may rotate it: a rotation would lift its base edge
 * off the line it is pinned to.
 */
import type { FingerId } from './keyboardLayout';

export interface HandPart {
  /** Finger that owns this part; 'palm' for the palm and wrist. */
  finger: FingerId | 'palm';
  /**
   * The region this part owns, in the reference frame: the strip the finger
   * would be cut out along, from the seams it shares with its neighbours down
   * into the palm. The hand's contours are drawn clipped to it. It reaches a
   * little past both seams, which is invisible between opaque bodies and keeps
   * a moving cut from tearing away from its neighbour.
   */
  region: string;
  /**
   * The region the accent wash is cut to: this finger's own outline, taken from
   * the trace — from one drawn gap between the fingers, round the tip, to the
   * next, closed across the knuckle. It is what the eye reads as the finger, so
   * the tint covers all of it and stops on the ink line rather than beside it. A
   * straight strip between the seam lines cannot do that: the drawn fingers are
   * bent, and a strip wanders off them. The thumb's web is drawn as a line rather
   * than a gap, so it keeps the straight strip measured off its seams.
   */
  wash: string;
  /** Where the finger's tip rests, in reference pixels. */
  tip: [number, number];
  /** Pivot the finger is stretched around; lies on the palm's edge. */
  pivot: [number, number];
  /**
   * Unit vector along the two cuts this part shares with its neighbours, pointing
   * towards the tip. Every move this part makes is along it, which is what keeps
   * both cuts welded to the neighbours however far the finger stretches.
   */
  axis: [number, number];
}

/** The line every finger part is pinned to, in reference pixels. */
export const RIG_PIVOT_Y = ${PIVOT_Y};

`;

for (const side of ['left', 'right']) {
  const tag = side.toUpperCase();
  const parts = out[side];
  ts += `/** ${side === 'left' ? 'Left' : 'Right'} hand: the drawn outline, and the body painted over it. */\n`;
  ts += `export const ${tag}_HAND_INK = '${toPath(hands[side].outline)}';\n`;
  ts += `export const ${tag}_HAND_SKIN = '${toPath(hands[side].skin)}';\n\n`;
  ts += `/** One part per finger, then the palm, each with the region it is cut to. */\nexport const ${tag}_HAND_PARTS: HandPart[] = [\n`;
  const ordered = parts.filter((p) => p.id === 'palm').concat(parts.filter((p) => p.id !== 'palm'));
  for (const part of ordered) {
    ts += `  {\n    finger: '${part.finger}',\n    region: '${toPath(part.region)}',
    wash: '${toPath(part.wash)}',\n    tip: [${part.tip[0]}, ${part.tip[1]}],\n    pivot: [${fmt(part.pivot[0])}, ${fmt(part.pivot[1])}],\n    axis: [${fmtAxis(part.axis[0])}, ${fmtAxis(part.axis[1])}],\n  },\n`;
  }
  ts += '];\n\n';
}

writeFileSync('src/utils/handRig.ts', ts);
console.log(`handRig.ts written: ${(ts.length / 1024).toFixed(1)} kB`);
for (const side of ['left', 'right']) {
  for (const p of out[side]) console.log(`${side} ${p.id.padEnd(9)} pivot ${p.pivot.map((v) => v.toFixed(0)).join(',')}`);
}
