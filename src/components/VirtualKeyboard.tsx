import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { EyeOff, SlidersHorizontal } from 'lucide-react';
import type { UserSettings } from '../types';
import { FINGER_COLORS, KEYBOARD, ROW_H, STAGE_U, findKeyForChar, keyCenter } from '../utils/keyboardLayout';
import type { FingerId, Pos, VirtualKey } from '../utils/keyboardLayout';
import { soundManager } from '../utils/sound';

export interface KeyboardPress {
  id: string;
  correct: boolean;
  seq: number;
}

interface VirtualKeyboardProps {
  nextChar: string | null;
  press: KeyboardPress | null;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

type HandSide = 'left' | 'right';
interface HandTarget {
  key: VirtualKey;
  finger: FingerId;
}

/**
 * Radiograph hand rig, modeled directly on an X-ray plate: solid bright
 * spindle-shaped bones with flared ends, visible joint gaps between phalanges,
 * carpal pebbles at the wrist and radius + ulna forearms. Poses animate through
 * a single JS spring, so bones and arm move as one hand with no CSS transform
 * transitions fighting the spring (that was causing the pre-press shiver).
 *
 * All local geometry below is for the LEFT hand (y negative = toward keys);
 * the right hand mirrors x.
 */
const HOME_Y = 1.25; // global y of the home-row key centers
const WRIST: Record<HandSide, Pos> = { left: { x: 4.0, y: 2.8 }, right: { x: 11.0, y: 2.8 } };
const ELBOW: Record<HandSide, Pos> = { left: { x: 3.0, y: 5.3 }, right: { x: 12.0, y: 5.3 } };

type Digit = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
const DIGITS: Digit[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];

const FINGER_OF: Record<HandSide, Record<Digit, FingerId>> = {
  left: { pinky: 'lpinky', ring: 'lring', middle: 'lmiddle', index: 'lindex', thumb: 'lthumb' },
  right: { pinky: 'rpinky', ring: 'rring', middle: 'rmiddle', index: 'rindex', thumb: 'rthumb' },
};

interface DigitDef {
  base: Pos;
  rest: Pos;
  /** Bone shaft half-width. */
  w: number;
  /** Skin radius, only used by the faint tissue halo outline. */
  r: number;
  /** Max sideways lean of the fingertip from its column. */
  lean: number;
}

/**
 * Finger geometry, proportioned directly from the reference radiograph:
 * knuckles set LOW in the palm (long visible fingers, short palm — middle
 * ≈ 2.3× the exposed metacarpal length), ring/index slightly shorter than
 * middle, splayed pinky, thick low-slung thumb, generous flesh radius.
 * rest.y pins each resting fingertip onto its home-row key.
 */
const LEFT_DIGITS: Record<Digit, DigitDef> = {
  pinky: { base: { x: -1.0, y: -0.3 }, rest: { x: -1.5, y: -1.47 }, w: 0.042, r: 0.16, lean: 0.5 },
  ring: { base: { x: -0.36, y: -0.36 }, rest: { x: -0.5, y: -1.55 }, w: 0.046, r: 0.175, lean: 0.35 },
  middle: { base: { x: 0.34, y: -0.38 }, rest: { x: 0.5, y: -1.57 }, w: 0.05, r: 0.185, lean: 0.28 },
  index: { base: { x: 1.02, y: -0.32 }, rest: { x: 1.5, y: -1.53 }, w: 0.047, r: 0.18, lean: 0.32 },
  thumb: { base: { x: 1.12, y: 0.0 }, rest: { x: 1.88, y: -0.78 }, w: 0.058, r: 0.22, lean: 0.55 },
};

/** Webbing dips between finger bases, thumb-webbing, then palm silhouette anchors. */
const LEFT_OUTLINE = {
  webs: [
    { x: -0.6, y: -0.36 },
    { x: 0, y: -0.38 },
    { x: 0.6, y: -0.36 },
  ],
  thumbWeb: { x: 1.0, y: -0.28 },
  wristL: { x: -0.6, y: 0.66 },
  wristR: { x: 0.6, y: 0.66 },
  palmSideC1: { x: -1.06, y: 0.44 },
  palmSideC2: { x: -1.12, y: -0.04 },
  thenar: { x: 1.36, y: 0.3 },
  wristMid: { x: 0, y: 0.84 },
};

const FINGER_LABELS: Record<FingerId, string> = {
  lpinky: 'left pinky', lring: 'left ring', lmiddle: 'left middle', lindex: 'left index',
  rindex: 'right index', rmiddle: 'right middle', rring: 'right ring', rpinky: 'right pinky',
  lthumb: 'left thumb', rthumb: 'right thumb',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');
const f2 = (n: number) => n.toFixed(3).replace(/\.?0+$/, '');
const f = (n: number) => (Object.is(n, -0) ? '0' : f2(n));
type Vec = Pos;
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const len = (a: Vec) => Math.hypot(a.x, a.y);
const norm = (a: Vec): Vec => {
  const l = Math.max(1e-6, len(a));
  return { x: a.x / l, y: a.y / l };
};
const rotate = (a: Vec, deg: number): Vec => {
  const t = (deg * Math.PI) / 180;
  return { x: a.x * Math.cos(t) - a.y * Math.sin(t), y: a.x * Math.sin(t) + a.y * Math.cos(t) };
};

/** Perpendicular pointing to the finger's left side when extending upward. */
const leftPerp = (d: Vec): Vec => ({ x: d.y, y: -d.x });

interface Pose {
  dx: number;
  dy: number;
  tips: Partial<Record<FingerId, Pos>>;
  /** 0 = straight, 1 = fully flexed onto the key (press curl). */
  curl: Partial<Record<FingerId, number>>;
  keyId: string;
}

function restPose(side: HandSide): Pose {
  const m = side === 'right' ? -1 : 1;
  const tips: Partial<Record<FingerId, Pos>> = {};
  for (const digit of DIGITS) {
    const def = LEFT_DIGITS[digit];
    tips[FINGER_OF[side][digit]] = { x: def.rest.x * m, y: def.rest.y };
  }
  return { dx: 0, dy: 0, tips, curl: {}, keyId: '' };
}

function computeTargetPose(side: HandSide, target: HandTarget | null, activeFinger: FingerId | null): Pose {
  const pose = restPose(side);
  pose.keyId = target ? `${target.key.id}:${target.finger}` : '';
  // The striking finger flexes onto its key; the spring eases it back out on release.
  if (activeFinger) pose.curl[activeFinger] = 1;
  if (!target) return pose;
  const m = side === 'right' ? -1 : 1;
  const wrist = WRIST[side];
  const digit = (Object.keys(FINGER_OF[side]) as Digit[]).find((d) => FINGER_OF[side][d] === target.finger)!;
  const def = LEFT_DIGITS[digit];
  const restGlobal: Pos = { x: wrist.x + def.rest.x * m, y: wrist.y + def.rest.y };

  const center = keyCenter(target.key);
  // Wide modifier keys are pressed on the edge facing the resting finger; the
  // thumbs hit the space bar near its inner edge.
  const isThumb = digit === 'thumb';
  const aimX = isThumb && target.key.id === 'space'
    ? center.x + m * 0.45
    : target.key.w >= 1.5
      ? (restGlobal.x < center.x ? target.key.x + 0.75 : target.key.x + target.key.w - 0.75)
      : center.x;
  const aimY = isThumb ? Math.max(center.y, wrist.y - 0.55) : center.y;

  const deltaX = aimX - restGlobal.x;
  const lean = clamp(deltaX * 0.3, -def.lean, def.lean);
  // The HAND travels most of the distance so fingers never cross each other.
  pose.dx = clamp(deltaX - lean, -2.7, 2.7);
  pose.dy = clamp((aimY - HOME_Y) * (aimY < HOME_Y ? 0.6 : 0.18), -0.85, 0.16);

  // Striking fingertip lands exactly on the key (compensating palm rotation).
  const tilt = clamp(pose.dx * 2.5, -4, 4);
  const wristPos: Pos = { x: wrist.x + pose.dx, y: wrist.y + pose.dy };
  pose.tips[target.finger] = rotate({ x: aimX - wristPos.x, y: aimY - wristPos.y }, -tilt);
  return pose;
}

function lerpPose(current: Pose, target: Pose, k: number): { pose: Pose; moving: boolean } {
  let moving = false;
  const step = (a: number, b: number) => {
    const d = b - a;
    if (Math.abs(d) > 0.0025) moving = true;
    return a + d * k;
  };
  const tips: Partial<Record<FingerId, Pos>> = {};
  for (const [id, tip] of Object.entries(target.tips) as Array<[FingerId, Pos]>) {
    const cur = current.tips[id] ?? tip;
    tips[id] = { x: step(cur.x, tip.x), y: step(cur.y, tip.y) };
  }
  const curl: Partial<Record<FingerId, number>> = {};
  const curlIds = new Set([
    ...Object.keys(current.curl),
    ...Object.keys(target.curl),
  ] as FingerId[]);
  // Flexion gets its own easing: slightly softer on the way down (the finger
  // rolls onto the key) and moderately slower on release (a real finger
  // unrolls lazily, but not so slowly it stays bent during travel).
  const stepCurl = (a: number, b: number) => {
    const d = b - a;
    if (Math.abs(d) > 0.0015) moving = true;
    return a + d * (d > 0 ? k * 0.8 : k * 0.55);
  };
  for (const id of curlIds) {
    curl[id] = stepCurl(current.curl[id] ?? 0, target.curl[id] ?? 0);
  }
  return {
    pose: { dx: step(current.dx, target.dx), dy: step(current.dy, target.dy), tips, curl, keyId: target.keyId },
    moving,
  };
}

/** One frame of pose state that survives re-renders (owned by the rAF loop). */
interface SpringState {
  pose: Pose;
  target: Pose;
}

function useAnimatedPose(target: Pose): Pose {
  const [pose, setPose] = useState<Pose>(target);
  const spring = useRef<SpringState | null>(null);
  useEffect(() => {
    if (!spring.current) spring.current = { pose: target, target };
    spring.current.target = target;
    let raf = 0;
    const step = () => {
      const state = spring.current!;
      const next = lerpPose(state.pose, state.target, 0.3);
      state.pose = next.pose;
      setPose(next.pose);
      if (next.moving) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return pose;
}

/**
 * A radiograph bone: a spindle with a slim shaft and flared, rounded condyle
 * ends — the bright "drumstick" shapes you see on an X-ray plate. The rounded
 * articular end points at `b`.
 */
function Bone({ a, b, w, variant = 'phalanx' }: { a: Pos; b: Pos; w: number; variant?: 'phalanx' | 'long' | 'tuft' }) {
  const d = sub(b, a);
  const L = Math.max(0.05, len(d));
  const angle = (Math.atan2(d.x, -d.y) * 180) / Math.PI;
  // Chunky radiograph bones: wide base flare, slim shaft, broad articular head.
  const base = w * (variant === 'long' ? 1.7 : 1.55);
  const head = w * (variant === 'long' ? 2.0 : variant === 'tuft' ? 1.9 : 1.75);
  const shaft = w * (variant === 'long' ? 0.86 : 0.8);
  const tipArc = variant === 'tuft' ? -L * 1.08 : -L * 1.2;
  const p = (x: number, y: number) => `${f(x)} ${f(y)}`;
  const dd = [
    `M ${p(-base, 0)}`,
    `C ${p(-base * 1.16, -L * 0.08)} ${p(-shaft * 1.12, -L * 0.3)} ${p(-shaft, -L * 0.5)}`,
    `C ${p(-shaft, -L * 0.74)} ${p(-head * 1.08, -L * 0.9)} ${p(-head, -L)}`,
    `Q ${p(0, tipArc)} ${p(head, -L)}`,
    `C ${p(head * 1.08, -L * 0.9)} ${p(shaft, -L * 0.74)} ${p(shaft, -L * 0.5)}`,
    `C ${p(shaft * 1.12, -L * 0.3)} ${p(base * 1.16, -L * 0.08)} ${p(base, 0)}`,
    `Q ${p(0, base * 0.8)} ${p(-base, 0)}`,
    'Z',
  ].join(' ');
  return (
    <g className="vk-bone" style={{ transform: `translate(${f(a.x)}px, ${f(a.y)}px) rotate(${angle.toFixed(2)}deg)` }}>
      <path className="vk-bone-shape" d={dd} />
      {/* Mottled density speckle inside the bone, like the grain on a film plate */}
      <path className="vk-bone-grain" d={dd} />
      {/* Brighter condyle at the articular end, like a radiograph joint head */}
      <ellipse className="vk-condyle" cx={0} cy={-L} rx={head * 0.82} ry={head * 0.64} />
    </g>
  );
}

/** One finger: a chain of spindle phalanges with visible joint gaps between them. */
function Finger({ base, tip, def, isTarget, pressed, color, curl }: {
  base: Pos;
  tip: Pos;
  def: DigitDef;
  isTarget: boolean;
  pressed: boolean;
  color: string;
  curl: number;
}) {
  const thumb = def.w > 0.042;
  // Phalanx chains stop short of each joint so the dark gap between bones
  // shows through — the defining look of an X-ray.
  const segs: Array<[number, number, 'phalanx' | 'long' | 'tuft']> = thumb
    ? [[0, 0.46, 'long'], [0.5, 0.8, 'phalanx'], [0.84, 1, 'tuft']]
    : [[0, 0.43, 'phalanx'], [0.47, 0.77, 'phalanx'], [0.81, 1, 'tuft']];
  const d = sub(tip, base);
  // Flexion during a press: the fingertip stays pinned to the key while the
  // interior joints draw slightly toward the palm and the distal phalanx
  // unrolls to keep contact — how a real finger articulates a keystroke.
  // Bow depth scales with the finger's own length (capped) so short digits
  // like the thumb don't bow proportionally deeper than long ones.
  const depth = Math.min(0.14, len(d) * 0.13) * curl;
  const jointAt = (t: number): Pos => add(base, mul(d, t - depth * Math.sin(Math.PI * t)));
  return (
    <g
      className={cx('vk-finger', isTarget && 'vk-finger-target', pressed && 'vk-finger-pressed')}
      style={{ '--finger-color': color } as CSSProperties}
    >
      {segs.map(([s, e, variant], index) => (
        <Bone
          key={index}
          a={jointAt(s)}
          b={jointAt(e)}
          w={def.w * [1, 0.86, 0.72][index]}
          variant={variant}
        />
      ))}
    </g>
  );
}

/** Builds the faint tissue halo: one continuous outline around palm, fingers and thumb. */
function handOutline(side: HandSide, tips: Partial<Record<FingerId, Pos>>): string {
  const m = side === 'right' ? -1 : 1;
  const mir = (p: Pos): Pos => ({ x: p.x * m, y: p.y });
  const o = {
    webs: LEFT_OUTLINE.webs.map(mir),
    thumbWeb: mir(LEFT_OUTLINE.thumbWeb),
    wristL: mir(LEFT_OUTLINE.wristL),
    wristR: mir(LEFT_OUTLINE.wristR),
    palmSideC1: mir(LEFT_OUTLINE.palmSideC1),
    palmSideC2: mir(LEFT_OUTLINE.palmSideC2),
    thenar: mir(LEFT_OUTLINE.thenar),
    wristMid: mir(LEFT_OUTLINE.wristMid),
  };
  const order: Digit[] = side === 'left' ? ['pinky', 'ring', 'middle', 'index'] : ['index', 'middle', 'ring', 'pinky'];
  const firstDef = LEFT_DIGITS[order[0]];
  const firstBase = mir(firstDef.base);
  let d = `M ${f(o.wristL.x)} ${f(o.wristL.y)}`;
  d += ` C ${f(o.palmSideC1.x)} ${f(o.palmSideC1.y)} ${f(o.palmSideC2.x)} ${f(o.palmSideC2.y)} ${f(firstBase.x - firstDef.r)} ${f(firstBase.y)}`;
  order.forEach((digit, index) => {
    const def = LEFT_DIGITS[digit];
    const base = mir(def.base);
    const tip = tips[FINGER_OF[side][digit]] ?? mir(def.rest);
    const r = def.r;
    const dir = norm(sub(tip, base));
    const p = leftPerp(dir);
    d += ` L ${f(base.x + p.x * r)} ${f(base.y + p.y * r)}`;
    d += ` L ${f(tip.x + p.x * r)} ${f(tip.y + p.y * r)}`;
    d += ` Q ${f(tip.x + dir.x * r * 1.5)} ${f(tip.y + dir.y * r * 1.5)} ${f(tip.x - p.x * r)} ${f(tip.y - p.y * r)}`;
    d += ` L ${f(base.x - p.x * r)} ${f(base.y - p.y * r)}`;
    if (index < 3) d += ` L ${f(o.webs[index].x)} ${f(o.webs[index].y)}`;
  });
  const thumbDef = LEFT_DIGITS.thumb;
  const tBase = mir(thumbDef.base);
  const tTip = tips[FINGER_OF[side].thumb] ?? mir(thumbDef.rest);
  const tDir = norm(sub(tTip, tBase));
  const tP = leftPerp(tDir);
  d += ` L ${f(o.thumbWeb.x)} ${f(o.thumbWeb.y)}`;
  d += ` L ${f(tBase.x + tP.x * thumbDef.r)} ${f(tBase.y + tP.y * thumbDef.r)}`;
  d += ` L ${f(tTip.x + tP.x * thumbDef.r)} ${f(tTip.y + tP.y * thumbDef.r)}`;
  d += ` Q ${f(tTip.x + tDir.x * thumbDef.r * 1.5)} ${f(tTip.y + tDir.y * thumbDef.r * 1.5)} ${f(tTip.x - tP.x * thumbDef.r)} ${f(tTip.y - tP.y * thumbDef.r)}`;
  d += ` L ${f(tBase.x - tP.x * thumbDef.r)} ${f(tBase.y - tP.y * thumbDef.r)}`;
  d += ` Q ${f(o.thenar.x)} ${f(o.thenar.y)} ${f(o.wristR.x)} ${f(o.wristR.y)}`;
  d += ` Q ${f(o.wristMid.x)} ${f(o.wristMid.y)} ${f(o.wristL.x)} ${f(o.wristL.y)} Z`;
  return d;
}

function Hand({ side, target, pressedFinger, shake, dip }: {
  side: HandSide;
  target: HandTarget | null;
  pressedFinger: FingerId | null;
  shake: { side: 'l' | 'r'; seq: number } | null;
  dip: { side: 'l' | 'r'; seq: number } | null;
}) {
  const ownPressed = useMemo(
    () => (pressedFinger && (Object.values(FINGER_OF[side]) as string[]).includes(pressedFinger) ? pressedFinger : null),
    [side, pressedFinger],
  );
  const pose = useAnimatedPose(useMemo(() => computeTargetPose(side, target, ownPressed), [side, target, ownPressed]));
  const m = side === 'right' ? -1 : 1;
  const wrist0 = WRIST[side];
  const elbow = ELBOW[side];
  const wrist: Pos = { x: wrist0.x + pose.dx, y: wrist0.y + pose.dy };
  const tilt = clamp(pose.dx * 2.5, -4, 4);

  const arm = sub(wrist, elbow);
  const armDir = norm(arm);
  const perp = { x: armDir.y, y: -armDir.x };

  const mySide = side === 'left' ? 'l' : 'r';
  const dipClass = dip && dip.side === mySide ? (dip.seq % 2 ? 'vk-dip-a' : 'vk-dip-b') : undefined;
  const shakeClass = shake && shake.side === mySide ? (shake.seq % 2 ? 'vk-shake-a' : 'vk-shake-b') : undefined;

  const tissueD = handOutline(side, pose.tips);

  // Metacarpals fan from the palm center to the knuckles (left table, mirrored).
  const palmCenter: Pos = { x: 0.05 * m, y: 0.32 };
  const metas = (['pinky', 'ring', 'middle', 'index'] as Digit[]).map((digit) => {
    const def = LEFT_DIGITS[digit];
    const knuckle: Pos = { x: def.base.x * m, y: def.base.y };
    const start: Pos = {
      x: palmCenter.x + (knuckle.x - palmCenter.x) * 0.24,
      y: palmCenter.y + (knuckle.y - palmCenter.y) * 0.24,
    };
    return { start, knuckle, w: def.w * 0.95 };
  });
  // Carpal pebbles clustered at the wrist, like the bones on an X-ray plate.
  const carpals: Array<{ x: number; y: number; r: number }> = [
    { x: -0.17 * m, y: 0.16, r: 0.095 },
    { x: 0.01, y: 0.09, r: 0.105 },
    { x: 0.19 * m, y: 0.15, r: 0.09 },
    { x: -0.1 * m, y: 0.33, r: 0.08 },
    { x: 0.1 * m, y: 0.31, r: 0.085 },
    { x: -0.005, y: 0.47, r: 0.075 },
  ];

  return (
    <g className="vk-hand">
      {/* Forearm: radius + ulna running in from below, flaring at the wrist.
          Thick like the reference plate — the radius especially. */}
      <Bone a={add(elbow, mul(perp, 0.19))} b={add(wrist, mul(perp, 0.3))} w={0.1} variant="long" />
      <Bone a={sub(elbow, mul(perp, 0.16))} b={sub(wrist, mul(perp, 0.26))} w={0.07} variant="long" />
      <g className="vk-palm-move" style={{ transform: `translate(${f(wrist.x)}px, ${f(wrist.y)}px) rotate(${tilt.toFixed(2)}deg)` }}>
        <g className="vk-breathe">
          <g className={dipClass}>
            {/* key forces a remount so the shake animation restarts on every error */}
            <g key={shake?.seq ?? 0} className={shakeClass}>
              {/* Faint soft-tissue halo under the skeleton */}
              <path className="vk-tissue" d={tissueD} filter="url(#vkTissue)" />
              {metas.map((bone, index) => (
                <Bone key={`m${index}`} a={bone.start} b={bone.knuckle} w={bone.w} variant="long" />
              ))}
              {carpals.map((c, index) => (
                <circle key={`c${index}`} className="vk-carpal" cx={c.x} cy={c.y} r={c.r} />
              ))}
              {DIGITS.map((digit) => {
                const id = FINGER_OF[side][digit];
                const def = LEFT_DIGITS[digit];
                return (
                  <Finger
                    key={id}
                    base={{ x: def.base.x * m, y: def.base.y }}
                    tip={pose.tips[id] ?? { x: def.rest.x * m, y: def.rest.y }}
                    def={def}
                    isTarget={target?.finger === id}
                    pressed={pressedFinger === id}
                    color={FINGER_COLORS[id]}
                    curl={pose.curl[id] ?? 0}
                  />
                );
              })}
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

function SettingRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-darkborder/60 transition-colors text-left">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-bodytext">{label}</span>
        <span className="block text-[10px] text-mutedtext">{desc}</span>
      </span>
      <span className={`vk-switch ${on ? 'on' : ''}`} aria-hidden="true"><span className="vk-knob" /></span>
    </button>
  );
}

function KeyLabels({ k }: { k: VirtualKey }) {
  if (k.id === 'space') return null;
  const y = k.y * ROW_H;
  if (k.shiftLabel) {
    return (
      <>
        <text className="vk-key-sub" x={k.x + k.w - 0.12} y={y + 0.2} fontSize={0.17} textAnchor="end">{k.shiftLabel}</text>
        <text className="vk-key-label" x={k.x + 0.12} y={y + 0.41} fontSize={0.21}>{k.label}</text>
      </>
    );
  }
  if (k.mod) {
    return <text className="vk-key-label" x={k.x + 0.12} y={y + 0.32} fontSize={0.19}>{k.label}</text>;
  }
  return <text className="vk-key-label" x={k.x + k.w / 2} y={y + 0.34} fontSize={0.3} textAnchor="middle">{k.label}</text>;
}

export function VirtualKeyboard({ nextChar, press, settings, onUpdateSettings }: VirtualKeyboardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [flash, setFlash] = useState<KeyboardPress | null>(null);
  const [dip, setDip] = useState<{ side: 'l' | 'r'; seq: number } | null>(null);
  const [shake, setShake] = useState<{ side: 'l' | 'r'; seq: number } | null>(null);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  // Key-cap dips are driven by the SAME spring profile as the finger curl
  // (0.8k down / 0.55k up) and triggered by the same state (flash), so the
  // cap and the flexing finger move as one synchronized keystroke instead of
  // an instant cap-pop plus a slower curl.
  const capRefs = useRef(new Map<string, SVGRectElement>());
  const capDips = useRef(new Map<string, { v: number; t: number }>());
  const dipRaf = useRef(0);

  // Fit the keyboard into whatever vertical space is left below the page content,
  // so it never gets clipped when the page is scrolled to the top.
  useLayoutEffect(() => {
    const update = () => {
      const root = wrapRef.current?.parentElement;
      const content = root?.previousElementSibling;
      if (!root || !content) return;
      const rect = content.getBoundingClientRect();
      const docBottom = rect.bottom + window.scrollY;
      const pad = parseFloat(getComputedStyle(root).paddingBottom) || 0;
      // 28px covers the card's own padding/border plus a little breathing room.
      const available = window.innerHeight - docBottom - pad - 28;
      const cap = Math.floor(Math.max(340, available) * (15 / STAGE_U));
      setMaxWidth(Math.min(1020, cap));
    };
    update();
    const content = wrapRef.current?.parentElement?.previousElementSibling;
    const observer = new ResizeObserver(update);
    if (content) observer.observe(content);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [settings.showKeyboard]);

  const lookup = useMemo(() => (nextChar ? findKeyForChar(nextChar) : null), [nextChar]);
  const targetKeyId = lookup?.key.id ?? null;
  const shiftKeyId = lookup?.shift ? (lookup.shift === 'left' ? 'lshift' : 'rshift') : null;

  const hands = useMemo(() => {
    const result: { left: HandTarget | null; right: HandTarget | null } = { left: null, right: null };
    if (!lookup) return result;
    const side: HandSide = lookup.key.finger.startsWith('l') ? 'left' : 'right';
    result[side] = { key: lookup.key, finger: lookup.key.finger };
    if (lookup.shift) {
      const shiftKey = KEYBOARD.find((k) => k.id === (lookup.shift === 'left' ? 'lshift' : 'rshift'));
      if (shiftKey) result[lookup.shift] = { key: shiftKey, finger: shiftKey.finger };
    }
    return result;
  }, [lookup]);

  const pressedFinger = useMemo(() => (flash ? KEYBOARD.find((k) => k.id === flash.id)?.finger ?? null : null), [flash]);

  useEffect(() => {
    if (!press) return;
    setFlash(press);
    const finger = KEYBOARD.find((k) => k.id === press.id)?.finger;
    const side = finger?.startsWith('l') ? 'l' : 'r';
    if (finger) setDip({ side, seq: press.seq });
    // Only a WRONG key jolts the hand; the class stays until the next press so
    // the animation always runs its full course (keyed remount restarts it).
    setShake(!press.correct && finger ? { side, seq: press.seq } : null);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 150);
  }, [press]);

  useEffect(() => () => {
    window.clearTimeout(flashTimer.current);
    cancelAnimationFrame(dipRaf.current);
  }, []);

  // Cap dip follows the finger curl: same trigger (flash), same spring rates,
  // applied imperatively so the SVG caps track the curl frame-by-frame with
  // no CSS transform transition fighting the motion.
  useEffect(() => {
    const dips = capDips.current;
    for (const entry of dips.values()) entry.t = 0;
    if (flash) {
      const entry = dips.get(flash.id) ?? { v: 0, t: 1 };
      entry.t = 1;
      dips.set(flash.id, entry);
    }
    cancelAnimationFrame(dipRaf.current);
    const step = () => {
      let pending = false;
      for (const [id, entry] of dips) {
        const rate = entry.t > entry.v ? 0.24 : 0.165; // curl rates: 0.3 × 0.8 in / 0.3 × 0.55 out
        const next = entry.v + (entry.t - entry.v) * rate;
        entry.v = Math.abs(entry.t - next) < 0.004 ? entry.t : next;
        const cap = capRefs.current.get(id);
        if (cap) cap.style.transform = entry.v < 0.004 ? '' : `translateY(${(entry.v * 0.09).toFixed(4)}px)`;
        if (entry.v !== entry.t) {
          pending = true;
        } else if (entry.t === 0) {
          dips.delete(id);
        }
      }
      if (pending) dipRaf.current = requestAnimationFrame(step);
    };
    dipRaf.current = requestAnimationFrame(step);
  }, [flash]);

  useEffect(() => {
    if (!showSettings) return;
    const onPointerDown = (event: PointerEvent) => {
      if (popRef.current?.contains(event.target as Node) || btnRef.current?.contains(event.target as Node)) return;
      setShowSettings(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSettings(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showSettings]);

  const toggle = (patch: Partial<UserSettings>) => {
    onUpdateSettings(patch);
    if (settings.websiteSfx) soundManager.playUiClick();
  };

  if (!settings.showKeyboard) {
    return (
      <div className="w-full animate-goal-pop">
        <div className="flex items-center justify-between gap-3 bg-darkcard border border-darkborder rounded-xl px-4 py-2.5 shadow-lg">
          <span className="flex items-center gap-2 text-xs text-mutedtext font-medium"><EyeOff className="w-3.5 h-3.5" />Virtual keyboard hidden</span>
          <button onClick={() => toggle({ showKeyboard: true })} className="text-xs font-bold text-accent hover:text-accent-hover transition-colors">Show keyboard</button>
        </div>
      </div>
    );
  }

  const ky = (row: number) => row * ROW_H;
  const keyNodes = KEYBOARD.map((k) => {
    const isTarget = k.id === targetKeyId || k.id === shiftKeyId;
    const flashMatch = flash?.id === k.id;
    const wrong = flashMatch && flash?.correct === false;
    return (
      <g key={k.id} className={cx('vk-key', isTarget && 'vk-target', flashMatch && 'vk-pressed', wrong && 'vk-err')}>
        {isTarget && <rect className="vk-halo" x={k.x - 0.04} y={ky(k.y) - 0.02} width={k.w + 0.08} height={0.54} rx={0.12} />}
        <rect
          ref={(el) => { if (el) capRefs.current.set(k.id, el); }}
          className="vk-key-cap"
          x={k.x + 0.06}
          y={ky(k.y) + 0.04}
          width={k.w - 0.12}
          height={0.42}
          rx={0.08}
        />
        <KeyLabels k={k} />
        {settings.showFingerZones ? (
          <rect x={k.x + 0.09} y={ky(k.y) + 0.38} width={k.w - 0.18} height={0.065} rx={0.03} fill={FINGER_COLORS[k.finger]} opacity={0.65} />
        ) : k.home ? (
          <rect className="vk-home-bar" x={k.x + k.w / 2 - 0.14} y={ky(k.y) + 0.4} width={0.28} height={0.04} rx={0.02} />
        ) : null}
      </g>
    );
  });

  // "X-ray" echo of the highlighted keys, drawn above the hands so the keys stay
  // clearly visible straight through the translucent bones.
  const echoKeys = KEYBOARD.filter((k) => k.id === targetKeyId || k.id === shiftKeyId);

  const hint = lookup
    ? `next ${nextChar === ' ' ? '"space"' : `"${nextChar}"`} · ${FINGER_LABELS[lookup.key.finger]}`
    : 'home row';

  return (
    <div
      ref={wrapRef}
      className="relative w-full mx-auto animate-goal-pop"
      style={{ maxWidth: maxWidth ?? 1020, transition: 'max-width 0.25s ease' }}
    >
      <div className="relative bg-darkcard border border-darkborder rounded-2xl shadow-lg px-2 pt-2 pb-1.5">
        <button
          ref={btnRef}
          onClick={() => { setShowSettings((value) => !value); if (settings.websiteSfx) soundManager.playUiClick(); }}
          className="absolute right-2.5 bottom-2.5 z-10 flex items-center gap-1.5 text-[11px] font-semibold text-mutedtext hover:text-accent bg-darkbg/80 border border-darkborder hover:border-accent rounded-lg px-2.5 py-1.5 transition-colors"
          aria-expanded={showSettings}
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Keyboard Settings</span>
        </button>
        <div className="absolute left-2.5 bottom-2.5 z-10 flex items-center gap-1.5 text-[11px] font-mono font-semibold text-mutedtext bg-darkbg/80 border border-darkborder rounded-md px-2 py-1 pointer-events-none">
          <span className="text-accent">{hint}</span>
        </div>
        <svg
          viewBox={`0 0 15 ${STAGE_U}`}
          className={`vk-svg block w-full h-auto pointer-events-none ${settings.showFingerZones ? 'vk-zones' : ''}`}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="vkBulb" cx="50%" cy="42%" r="62%">
              <stop offset="0%" stopColor="var(--vk-bone)" stopOpacity="1" />
              <stop offset="55%" stopColor="var(--vk-bone)" stopOpacity="0.88" />
              <stop offset="100%" stopColor="var(--vk-bone)" stopOpacity="0.58" />
            </radialGradient>
            <filter id="vkTissue" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="0.09" />
            </filter>
            <pattern id="vkSpeckle" width="0.08" height="0.08" patternUnits="userSpaceOnUse">
              <circle className="vk-speck" cx={0.014} cy={0.018} r={0.009} />
              <circle className="vk-speck" cx={0.052} cy={0.01} r={0.006} />
              <circle className="vk-speck" cx={0.064} cy={0.056} r={0.0095} />
              <circle className="vk-speck" cx={0.007} cy={0.05} r={0.005} />
              <circle className="vk-speck-hi" cx={0.03} cy={0.062} r={0.005} />
              <circle className="vk-speck-hi" cx={0.073} cy={0.034} r={0.0045} />
            </pattern>
          </defs>
          <g>{keyNodes}</g>
          {settings.showHands && (
            <g className="vk-hands">
              <Hand side="left" target={hands.left} pressedFinger={pressedFinger} shake={shake} dip={dip} />
              <Hand side="right" target={hands.right} pressedFinger={pressedFinger} shake={shake} dip={dip} />
            </g>
          )}
          <g className="vk-echo">
            {echoKeys.map((k) => (
              <g key={k.id}>
                <rect className="vk-echo-halo" x={k.x - 0.04} y={ky(k.y) - 0.02} width={k.w + 0.08} height={0.54} rx={0.12} />
                <rect className="vk-echo-cap" x={k.x + 0.06} y={ky(k.y) + 0.04} width={k.w - 0.12} height={0.42} rx={0.08} />
                <KeyLabels k={k} />
              </g>
            ))}
          </g>
        </svg>
      </div>
      {showSettings && (
        <div ref={popRef} className="absolute right-2 bottom-12 z-20 w-64 bg-darkcard border border-darkborder rounded-xl shadow-2xl p-3 animate-goal-pop">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mutedtext mb-2 px-2">Keyboard Settings</div>
          <div className="flex flex-col gap-0.5">
            <SettingRow label="Virtual keyboard" desc="Show keys below the test" on={settings.showKeyboard} onToggle={() => toggle({ showKeyboard: !settings.showKeyboard })} />
            <SettingRow label="Hands overlay" desc="X-ray skeletal hands" on={settings.showHands} onToggle={() => toggle({ showHands: !settings.showHands })} />
            <SettingRow label="Finger color zones" desc="Color-code keys by finger" on={settings.showFingerZones} onToggle={() => toggle({ showFingerZones: !settings.showFingerZones })} />
          </div>
          <button onClick={() => toggle({ showKeyboard: false })} className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-mutedtext hover:text-wrongred border border-darkborder hover:border-wrongred rounded-lg py-1.5 transition-colors">
            <EyeOff className="w-3.5 h-3.5" />Hide keyboard
          </button>
        </div>
      )}
    </div>
  );
}
