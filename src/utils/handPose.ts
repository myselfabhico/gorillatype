/**
 * Turns "which key is the test waiting for" into a pose for the hand rig in
 * utils/handRig.ts — as plain numbers, so the components can spring between
 * poses instead of snapping between transform strings.
 *
 * Three rules keep the artwork from tearing or smudging, and they are why the
 * solve is shaped the way it is:
 *
 *  - A finger part is pinned on the line `y = RIG_PIVOT_Y`. Scaling about a
 *    point on that line leaves the line exactly where it was, so a finger stays
 *    welded to the palm however far it stretches. A rotation would lift the
 *    finger's base edge and open a gap.
 *  - The hand does the aiming. Its shift, lean and turn are applied to every
 *    part of the hand at once, so neighbours keep their exact relative geometry.
 *  - A finger only ever moves along its own axis — the direction of the two cuts
 *    it shares with the fingers either side of it. Scaling one direction and
 *    leaving the perpendicular one alone moves every line parallel to it onto
 *    itself, so both cuts stay welded to the neighbours and nothing a finger does
 *    can reach as far as a neighbour's body. A finger that moved straight up
 *    instead would drag both cuts sideways across those bodies by several pixels
 *    and leave its outline lying on them as a thin dark line.
 */
import { KEYBOARD, findKeyForChar } from './keyboardLayout';
import { LEFT_HAND_PARTS, RIGHT_HAND_PARTS } from './handRig';
import type { HandPart } from './handRig';
import type { FingerId } from './keyboardLayout';

export type Matrix = [number, number, number, number, number, number];
export type Side = 'left' | 'right';

/** `b` applied after `a`. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function apply(m: Matrix, [x, y]: [number, number]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-6;
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

/** Screen-space rotation (y grows downwards) about a pivot. */
export function rotate(angle: number, [px, py]: [number, number]): Matrix {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, s, -s, c, px - c * px + s * py, py - s * px - c * py];
}

/** Horizontal shear that leaves the line `y = y0` exactly where it was. */
export const shearX = (k: number, y0: number): Matrix => [1, 0, k, 1, -k * y0, 0];

/** Scale about a pivot — keeps the pivot's row on the same horizontal line. */
export function scaleAbout(sx: number, sy: number, [px, py]: [number, number]): Matrix {
  return [sx, 0, 0, sy, px - sx * px, py - sy * py];
}

/** A matrix as the value of an SVG `transform` attribute. */
export const cssMatrix = (m: Matrix) => `matrix(${m.map((v) => Math.round(v * 1e4) / 1e4).join(' ')})`;

/** Distance from the wrist to the fingertips, used to size leans and turns. */
const REACH = 158;
/** The line the hand's lean pivots on: across the wrist. */
const LEAN_Y = 250;
/** How far a struck finger presses into its key, in reference pixels. */
export const DIP = 2.2;

export interface HandSolve {
  /** Wrist shift. */
  x: number;
  y: number;
  /** Lean (horizontal shear about the wrist) and turn (radians). */
  lean: number;
  turn: number;
}

export interface FingerSolve {
  /** Stretch along the finger's own axis (see `axis` in its part). */
  stretch: number;
  /** Press, in reference pixels down into the key, taken along that same axis. */
  dip: number;
}

export const REST_HAND: HandSolve = { x: 0, y: 0, lean: 0, turn: 0 };
export const REST_FINGER: FingerSolve = { stretch: 1, dip: 0 };

export interface RigSolve {
  hands: Record<Side, HandSolve>;
  /** Only the fingers that are actually doing something appear here. */
  fingers: Partial<Record<FingerId, FingerSolve>>;
}

const RIG: Record<Side, { parts: HandPart[]; wrist: [number, number] }> = {
  left: { parts: LEFT_HAND_PARTS, wrist: [95, 248] },
  right: { parts: RIGHT_HAND_PARTS, wrist: [355, 248] },
};

const KEY_INFO = new Map(
  KEYBOARD.map((key) => [
    key.id,
    { finger: key.finger, centre: [key.x + key.w / 2, key.y + key.h / 2] as [number, number] },
  ]),
);

/** The finger a key id belongs to, or null for keys the board does not draw. */
export const fingerOfKey = (id: string): FingerId | null => KEY_INFO.get(id)?.finger ?? null;

/** The key ids the board is currently asking for, including its Shift. */
export function targetsFor(nextChar: string | null): string[] {
  if (!nextChar) return [];
  const lookup = findKeyForChar(nextChar);
  if (!lookup) return [];
  return lookup.shift ? [lookup.key.id, lookup.shift === 'left' ? 'lshift' : 'rshift'] : [lookup.key.id];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * How far a finger may shorten or lengthen. The range is deliberately small:
 * the artwork's fingers are separated by seams they share with each other, so a
 * finger that travels a long way on its own drags its half of that seam across
 * the finger next to it. The rows are covered by moving the hand instead, which
 * is rigid and therefore cannot disturb anything, and the finger's own share of
 * a reach stays a nudge rather than a leap.
 */
const STRETCH_MIN = 0.9;
const STRETCH_MAX = 1.2;
/** How much of the vertical distance to a key the hand takes before the finger does. */
const REACH_SHARE = 0.86;
/** The hand's vertical travel: far enough to cover the number row and the bottom row. */
const REACH_UP = 54;
const REACH_DOWN = 50;

/**
 * Solves the rig. Space and the other thumb keys move a thumb only, letters move
 * one finger, and a shift pulls the opposite hand's pinky across — so at most
 * one finger per hand is ever displaced. The strike that follows a keystroke is
 * not part of the pose: it is a short press of the struck finger, animated by
 * the hands themselves (see components/TypingHands.tsx).
 *
 * The hand does the travelling: its lean and turn keep their usual sizes — they
 * are its own posture — and its wrist is then solved for every remaining
 * sideways and vertical pixel between the stretched fingertip and the middle of
 * the key it is aiming at.
 */
export function solveRig(targets: string[]): RigSolve {
  const solve: RigSolve = {
    hands: { left: { ...REST_HAND }, right: { ...REST_HAND } },
    fingers: {},
  };

  for (const side of ['left', 'right'] as const) {
    const rig = RIG[side];
    let target: HandPart | undefined;
    let finger: FingerId | undefined;
    let centre: [number, number] | undefined;
    for (const id of targets) {
      const info = KEY_INFO.get(id);
      if (!info) continue;
      const part = rig.parts.find((candidate) => candidate.finger === info.finger);
      if (!part || part.finger === 'palm') continue;
      target = part;
      finger = part.finger;
      centre = info.centre;
      break;
    }
    if (!target || !finger || !centre) continue;

    const deltaX = centre[0] - target.tip[0];
    const deltaY = centre[1] - target.tip[1];
    const hand: HandSolve = {
      x: 0,
      y: clamp(deltaY * REACH_SHARE, -REACH_UP, REACH_DOWN),
      lean: clamp((-deltaX * 0.3) / REACH, -0.1, 0.1),
      turn: clamp(deltaX * 0.0011, -0.055, 0.055),
    };

    // How far the finger still has to go, measured in the hand's already-leaning
    // frame. The finger can only travel along its own axis, so the stretch that
    // lands its tip closest to the key is the projection of what is left onto
    // that axis. The stretch is capped, so a key beyond the cap is simply
    // further than the finger gets — the hand has already taken everything it
    // could.
    const [px, py] = target.pivot;
    const [tx, ty] = [target.tip[0] - px, target.tip[1] - py];
    const length2 = tx * tx + ty * ty;
    const local = apply(invert(handMatrix(hand, rig.wrist)), centre);
    const stretch = clamp(
      ((local[0] - px) * tx + (local[1] - py) * ty) / length2,
      STRETCH_MIN,
      STRETCH_MAX,
    );

    // A tilted finger drifts sideways as it extends, so the wrist takes the
    // leftover: it is solved for whatever sideways distance is left between the
    // stretched fingertip and the middle of the key.
    const aimed = apply(handMatrix(hand, rig.wrist), apply(fingerMatrix(target, { stretch, dip: 0 }), target.tip));
    hand.x = centre[0] - aimed[0];

    solve.hands[side] = hand;
    solve.fingers[finger] = { stretch, dip: 0 };
  }

  return solve;
}

/** The hand's transform, composed from its solved numbers. */
export function handMatrix(hand: HandSolve, wrist: [number, number]): Matrix {
  return multiply(
    translate(hand.x, hand.y),
    multiply(shearX(hand.lean, LEAN_Y), rotate(hand.turn, wrist)),
  );
}

/**
 * A posed finger's transform, in its hand's own frame.
 *
 * Everything a single finger does — stretching to a key and tapping it — is a
 * stretch along its own axis plus a slide along that same axis. A map that
 * scales one direction and leaves the perpendicular one alone moves every line
 * parallel to that direction onto itself, and the two cuts the finger shares
 * with its neighbours are exactly those lines: so both seams stay welded however
 * far the finger reaches or presses. Scaling about the pivot keeps the finger
 * pinned to the palm, and nothing here can rotate it, which would lift its base
 * edge off that line.
 */
export function fingerMatrix(part: HandPart, finger: FingerSolve): Matrix {
  const [ux, uy] = part.axis;
  const [px, py] = part.pivot;
  const k = finger.stretch - 1;
  const a = 1 + k * ux * ux;
  const b = k * ux * uy;
  const c = 1 + k * uy * uy;
  // The press rides the same axis, sized so that the downward part of the slide
  // is exactly the dip; the axis leans about a third off vertical, so the press
  // carries the fingertip a little outwards too, the way a finger straightening
  // onto a key does.
  const slide = finger.dip / -uy;
  return [a, b, b, c, px - a * px - b * py - ux * slide, py - b * px - c * py - uy * slide];
}

/** Where a finger's tip ends up, for tests and for the layout sanity checks. */
export function fingerTip(part: HandPart, hand: HandSolve, finger: FingerSolve, side: Side): [number, number] {
  return apply(multiply(handMatrix(hand, RIG[side].wrist), fingerMatrix(part, finger)), part.tip);
}

/** The generated parts and wrist anchor of each hand. */
export { RIG as HAND_ANCHORS };
