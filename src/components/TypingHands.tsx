/**
 * The typing hands: one damped spring per joint, stepped on
 * requestAnimationFrame (with a timer standing in when the view is not being
 * composited) and written straight onto the SVG `transform` attributes.
 *
 * Why not a CSS transition: the browser can only interpolate between two poses,
 * so between two keystrokes it drags a finger towards wherever the next pose is
 * — and a matrix that contains a shear is decomposed into a rotation plus a
 * scale on the way, which lifts a finger off the line it is pinned to and lets
 * its base slide out of the palm. Stepping the *solve* instead (the same
 * stretch, dip and hand shift the pose is built from) keeps every joint on its
 * own rail for the whole movement, so nothing can tear or pop, and a finger can
 * start reaching for the next key while the wrist is still travelling from the
 * last one — which is what makes the movement read as continuous rather than as
 * a series of jumps.
 *
 * The same loop animates the press itself: a struck finger is given a dip
 * target that eases in and back out over a fifth of a second, so the click is a
 * soft tap on the key instead of a step.
 *
 * The rig is drawn in two passes: every piece's outline first, then every
 * piece's body. That is the whole reason the fingers cannot smudge each other —
 * the visible ink is the hand's outline minus the hand's body, so a piece's
 * outline can only ever be seen where the artwork has dark anyway, and never as
 * a stray line lying across the finger next door. Each pass draws the whole
 * hand's contour (utils/handRig.ts) cut to the piece's region with a clipPath,
 * rather than a piece of contour pre-cut by the generator: the cut is a straight
 * line across a contour that turns back on itself at the seams between fingers,
 * and letting the renderer do it keeps those seams exactly as traced.
 *
 * Because this is a requestAnimationFrame loop and not a CSS transition, it runs
 * regardless of `prefers-reduced-motion` — deliberately: the hands are how the
 * board shows which finger owns the next key, so they are information rather
 * than decoration. Under reduced motion they carry the same movement with a
 * higher spring rate, so nothing lingers.
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  LEFT_HAND_INK,
  LEFT_HAND_SKIN,
  RIGHT_HAND_INK,
  RIGHT_HAND_SKIN,
} from '../utils/handRig';
import {
  DIP,
  HAND_ANCHORS,
  REST_FINGER,
  REST_HAND,
  cssMatrix,
  fingerMatrix,
  fingerOfKey,
  handMatrix,
  solveRig,
  targetsFor,
} from '../utils/handPose';
import type { FingerSolve, HandSolve, Matrix, RigSolve, Side } from '../utils/handPose';
import type { FingerId } from '../utils/keyboardLayout';
import type { KeyboardPress } from './VirtualKeyboard';

const SIDES = ['left', 'right'] as const;

/** The whole hand, drawn once and cut per part: outline first, body over it. */
const CONTOURS: Record<Side, { ink: string; skin: string }> = {
  left: { ink: LEFT_HAND_INK, skin: LEFT_HAND_SKIN },
  right: { ink: RIGHT_HAND_INK, skin: RIGHT_HAND_SKIN },
};

/** Every finger the rig moves, in a stable order. */
const FINGER_IDS = [...HAND_ANCHORS.left.parts, ...HAND_ANCHORS.right.parts]
  .map((part) => part.finger)
  .filter((finger): finger is FingerId => finger !== 'palm');

const HAND_KEYS = ['x', 'y', 'lean', 'turn'] as const;
const FINGER_KEYS = ['stretch', 'dip'] as const;

/**
 * Spring rates in radians per second: the wrist crosses to a new key in about a
 * third of a second and settles without overshooting, and each finger follows a
 * third quicker so a reach reads as finger-led. The finger keeps a little
 * overshoot of its own — that is what a tap looks like.
 */
const HAND_RATE = 15;
const HAND_ZETA = 1;
const FINGER_RATE = 21;
const FINGER_ZETA = 0.93;
/** How much quicker everything settles when the user asked for less motion. */
const CALM_RATE = 1.45;

/** The tap: down fast, back out gently, and never more than ~0.23s all told. */
const TAP_DOWN = 0.06;
const TAP_UP = 0.17;
/** Integration step for the springs, and the longest frame that can be integrated. */
const SUBSTEP = 1 / 120;
const SUBSTEPS = 64;
/** How long to wait for a frame before assuming this view will not give us one. */
const TICK_MS = 16;
const TAP_TOTAL = TAP_DOWN + TAP_UP;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** 0 at the start and end of a strike, 1 at the bottom of the press. */
function tapDepth(age: number) {
  if (age <= 0) return 0;
  if (age < TAP_DOWN) return smoothstep(age / TAP_DOWN);
  const out = (age - TAP_DOWN) / TAP_UP;
  return out >= 1 ? 0 : 1 - smoothstep(out);
}

/** A critically-ish damped spring, integrated in small enough steps to be stable. */
class Spring {
  pos: number;
  vel = 0;

  constructor(pos: number) {
    this.pos = pos;
  }

  /**
   * `rate` is the undamped angular frequency, `zeta` the damping ratio. The
   * elapsed time is integrated in small steps, so a slow or throttled frame
   * lands on the pose it would have had anyway rather than lagging behind it.
   */
  step(target: number, rate: number, zeta: number, dt: number) {
    const count = Math.min(SUBSTEPS, Math.max(1, Math.ceil(dt / SUBSTEP)));
    if (count >= SUBSTEPS) {
      // Away for longer than this many steps can span: the pose is simply where
      // it would have settled, and there is nothing to animate through.
      this.snap(target);
      return;
    }
    const k = rate * rate;
    const c = 2 * zeta * rate;
    const h = dt / count;
    for (let i = 0; i < count; i++) {
      this.vel += ((target - this.pos) * k - this.vel * c) * h;
      this.pos += this.vel * h;
    }
  }

  /**
   * Close enough that the remaining motion could not be seen: a thousandth of a
   * reference pixel, so even a joint whose whole range is a tenth (the hand's
   * lean) is never parked while it is still visibly short of its target.
   */
  settled(target: number) {
    return Math.abs(target - this.pos) < 0.001 && Math.abs(this.vel) < 0.02;
  }

  snap(target: number) {
    this.pos = target;
    this.vel = 0;
  }
}

type HandSprings = { [K in keyof HandSolve]: Spring };
type FingerSprings = { [K in keyof FingerSolve]: Spring };

interface RigState {
  /** Multiplier on every spring rate; higher is stiffer, calmer motion. */
  rate: number;
  hands: Record<Side, HandSprings>;
  fingers: Record<FingerId, FingerSprings>;
  /** The pose the springs are heading for. */
  target: RigSolve;
  /** Fingers pressing a key, keyed by the time since that keystroke. */
  strikes: Partial<Record<FingerId, { age: number; depth: number }>>;
}

function createState(): RigState {
  const hands = {} as Record<Side, HandSprings>;
  for (const side of SIDES) {
    const rest = REST_HAND;
    hands[side] = {
      x: new Spring(rest.x),
      y: new Spring(rest.y),
      lean: new Spring(rest.lean),
      turn: new Spring(rest.turn),
    };
  }
  const fingers = {} as Record<FingerId, FingerSprings>;
  for (const id of FINGER_IDS) {
    fingers[id] = { stretch: new Spring(1), dip: new Spring(0) };
  }
  return {
    rate: 1,
    hands,
    fingers,
    target: { hands: { left: { ...REST_HAND }, right: { ...REST_HAND } }, fingers: {} },
    strikes: {},
  };
}

const toHand = (joint: HandSprings): HandSolve => ({
  x: joint.x.pos,
  y: joint.y.pos,
  lean: joint.lean.pos,
  turn: joint.turn.pos,
});

const toFinger = (joint: FingerSprings): FingerSolve => ({
  stretch: joint.stretch.pos,
  dip: joint.dip.pos,
});

/** A piece's groups, one per paint pass; a joint moves all of them together. */
type ElMap = Record<string, (SVGGElement | null)[]>;
/** The last transform written to each element, so a still frame costs nothing. */
const written = new WeakMap<Element, string>();

function writeTransform(els: (SVGGElement | null)[] | undefined, matrix: Matrix) {
  if (!els) return;
  const value = cssMatrix(matrix);
  for (const el of els) {
    if (!el || written.get(el) === value) continue;
    written.set(el, value);
    el.setAttribute('transform', value);
  }
}

/**
 * Steps the rig by one frame and writes the result out. Returns true while
 * anything is still moving, so the caller knows whether to keep the loop alive.
 */
function advance(state: RigState, dt: number, hands: ElMap, fingers: ElMap): boolean {
  const target = state.target;
  let busy = false;

  // Strikes age first: they are what drives the struck finger's dip below.
  for (const id of FINGER_IDS) {
    const strike = state.strikes[id];
    if (!strike) continue;
    strike.age += dt;
    if (strike.age > TAP_TOTAL) delete state.strikes[id];
  }

  for (const side of SIDES) {
    const joint = state.hands[side];
    const goal = target.hands[side];
    for (const key of HAND_KEYS) {
      const spring = joint[key];
      const value = goal[key];
      if (spring.settled(value)) spring.snap(value);
      else {
        spring.step(value, HAND_RATE * state.rate, HAND_ZETA, dt);
        busy = true;
      }
    }
    writeTransform(hands[side], handMatrix(toHand(joint), HAND_ANCHORS[side].wrist));
  }

  for (const side of SIDES) {
    for (const part of HAND_ANCHORS[side].parts) {
      if (part.finger === 'palm') continue;
      const joint = state.fingers[part.finger];
      if (!joint) continue;
      const goal = target.fingers[part.finger] ?? REST_FINGER;
      const strike = state.strikes[part.finger];
      for (const key of FINGER_KEYS) {
        const spring = joint[key];
        const value = key === 'dip' ? (strike ? strike.depth * tapDepth(strike.age) : 0) : goal[key];
        if (spring.settled(value)) spring.snap(value);
        else {
          spring.step(value, FINGER_RATE * state.rate, FINGER_ZETA, dt);
          busy = true;
        }
      }
      writeTransform(fingers[part.finger], fingerMatrix(part, toFinger(joint)));
    }
  }

  return busy;
}

/**
 * The paint passes: outlines first, then the bodies that cover them, then the
 * accent washes over both. A wash has to be last: the finger next door is drawn
 * after its neighbour and its body is opaque with a region that reaches past the
 * shared seam, so a tint painted with its own finger's body would be covered for
 * the last few pixels before that seam — a strip of bare skin left inside the
 * highlight, right where the eye is watching it end.
 */
const INKS = 0;
const BODIES = 1;
const WASHES = 2;

interface TypingHandsProps {
  /** Character the test is waiting for, or null when nothing is being asked. */
  nextChar: string | null;
  /** The keystroke that just happened, while it is still fresh. */
  press: KeyboardPress | null;
  /** Tints every fingertip by its touch-typing zone. */
  colorZones: boolean;
}

/**
 * The two illustrated hands, drawn as one part per finger plus the palm and
 * animated by the loop above.
 *
 * Every piece is in both passes, under the same transform: in the first pass the
 * piece contributes the artwork's outline, in the second its body. Outlines are
 * laid down under every body, so the dark that shows is the part of the artwork's
 * outline that no body covers — the drawn rim and the seams between fingers — and
 * a piece can never paint its line across a neighbour, whatever the two of them
 * are doing at the time.
 *
 * `fill-rule` is left at its default (nonzero): the generated paths are made of
 * disjoint loops wound the same way, so they fill as one region with no seams
 * between the pieces.
 *
 * The finger that owns the key the test is waiting for is washed in the accent
 * the highlighted cap is drawn in, painted with the same body contour inside the
 * same transformed group — so it travels with the finger and can only ever tint
 * skin. What limits it to that one finger is the finger's own traced outline
 * (utils/handRig.ts): the tint is the body cut to it, so it covers the whole
 * finger and stops on the ink line it shares with the finger next door instead of
 * beside it. A straight strip between the seam lines cannot do that — the drawn
 * fingers are bent, and the strip wanders off them — which is why the outline is
 * taken from the trace. The wash is painted after every body for the same reason
 * its clip is the outline: the finger next door is painted after its neighbour
 * and is opaque, so a tint drawn with its own finger's body would be covered for
 * the last few pixels before the seam — a strip of bare skin left inside the
 * highlight, right where the eye is watching it end.
 */
export function TypingHands({ nextChar, press, colorZones }: TypingHandsProps) {
  // Clipping is referenced by id, and those ids have to be unique on the page.
  const clipPrefix = `kb-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const clipId = (side: Side, finger: string) => `${clipPrefix}-${side}-${finger}`;
  const washId = (side: Side, finger: string) => `${clipPrefix}-${side}-${finger}-wash`;
  // The rig's joints are not React state: they change on every frame and are
  // written straight to the DOM, so they live in a store the loop owns.
  const store = useRef<RigState | null>(null);
  const handEls = useRef<ElMap>({});
  const fingerEls = useRef<ElMap>({});

  /** Set by the loop effect; the effects below use it to wake the loop up. */
  const wake = useRef<() => void>(() => {});

  // Where the hands want to be: the key the test is waiting for, plus the shift
  // it needs. Only solving when the character changes keeps the pose still while
  // a keystroke is flashing.
  const goal = useMemo(() => solveRig(targetsFor(nextChar)), [nextChar]);

  // The same keys decide which fingers are lit: the board highlights the cap the
  // test is waiting for (and its Shift), and the finger that owns it is washed in
  // the identical accent, so the guide reads on the hands as well as the caps.
  const asked = useMemo(() => {
    const fingers = new Set<FingerId>();
    for (const id of targetsFor(nextChar)) {
      const finger = fingerOfKey(id);
      if (finger) fingers.add(finger);
    }
    return fingers;
  }, [nextChar]);

  // One loop for the whole rig. It parks itself the moment every spring has
  // settled, and any new key or strike wakes it up again.
  useEffect(() => {
    const state = createState();
    state.rate = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? CALM_RATE : 1;
    const hands = handEls.current;
    const fingers = fingerEls.current;
    store.current = state;
    let frame = 0;
    let timer = 0;
    let pending = false;
    let last = 0;

    const schedule = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(tick);
      timer = window.setTimeout(tick, TICK_MS);
    };

    // Whichever clock gets here first drives the frame; the other is dropped.
    // requestAnimationFrame is the right one, but a view that is not being
    // composited never fires it, and then the movement would never happen at
    // all — so a timer stands in until the frames come back.
    const tick = () => {
      if (!pending) return;
      pending = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      const now = performance.now();
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      if (advance(state, dt, hands, fingers)) schedule();
    };

    wake.current = () => {
      last = 0;
      schedule();
    };
    wake.current();
    return () => {
      pending = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      wake.current = () => {};
      if (store.current === state) store.current = null;
    };
  }, []);

  // The pose the springs are heading for. Declared after the loop so the store
  // already exists by the time this runs.
  useEffect(() => {
    const state = store.current;
    if (!state) return;
    state.target = goal;
    wake.current();
  }, [goal]);

  // The click: the finger that hit the key presses it, on top of whatever it is
  // already doing. Keyed on the keystroke, not the key, so a repeat restarts it.
  useEffect(() => {
    const state = store.current;
    if (!state || !press) return;
    const finger = fingerOfKey(press.id);
    if (!finger) return;
    state.strikes[finger] = { age: 0, depth: press.correct ? DIP : DIP * 1.5 };
    wake.current();
  }, [press]);

  const outlinePass = (
    <g className="kb-inks">
      {SIDES.map((side) => (
        <g
          key={side}
          className="kb-hand"
          ref={(element) => {
            (handEls.current[side] ??= [])[INKS] = element;
          }}
        >
          {HAND_ANCHORS[side].parts.map((part) => (
            <g
              key={part.finger}
              className="kb-finger"
              ref={(element) => {
                (fingerEls.current[part.finger] ??= [])[INKS] = element;
              }}
            >
              <path
                className="hand-outer"
                d={CONTOURS[side].ink}
                clipPath={`url(#${clipId(side, part.finger)})`}
              />
            </g>
          ))}
        </g>
      ))}
    </g>
  );

  return (
    <g className="kb-hands">
      <defs>
        {SIDES.map((side) =>
          HAND_ANCHORS[side].parts.map((part) => (
            <clipPath key={`${side}-${part.finger}`} id={clipId(side, part.finger)} clipPathUnits="userSpaceOnUse">
              <path d={part.region} />
            </clipPath>
          )),
        )}
        {/* The wash clips are each finger's own outline, so a tint covers the
            whole finger and stops on the drawn gap between it and its
            neighbour rather than wandering across either. */}
        {SIDES.map((side) =>
          HAND_ANCHORS[side].parts.map((part) => (
            <clipPath key={`${side}-${part.finger}-wash`} id={washId(side, part.finger)} clipPathUnits="userSpaceOnUse">
              <path d={part.wash} />
            </clipPath>
          )),
        )}
      </defs>
      {outlinePass}
      <g className="kb-bodies">
        {SIDES.map((side) => (
          <g
            key={side}
            className="kb-hand"
            ref={(element) => {
              (handEls.current[side] ??= [])[BODIES] = element;
            }}
          >
            {HAND_ANCHORS[side].parts.map((part) => (
              <g
                key={part.finger}
                className="kb-finger"
                ref={(element) => {
                  (fingerEls.current[part.finger] ??= [])[BODIES] = element;
                }}
              >
                <path
                  className="hand-skin"
                  d={CONTOURS[side].skin}
                  clipPath={`url(#${clipId(side, part.finger)})`}
                />
                {colorZones && part.finger !== 'palm' && (
                  <ellipse
                    className="hand-zone"
                    cx={part.tip[0]}
                    cy={part.tip[1] + 3}
                    rx={6.4}
                    ry={8.2}
                    style={{ '--zone': `var(--kb-zone-${part.finger})` } as CSSProperties}
                  />
                )}
              </g>
            ))}
          </g>
        ))}
      </g>
      {/* The accents, over every body. Each is the hand's own body contour
          again, so it tints skin and nothing else — the outline, the seams and
          the rest of the hand are holes in that contour — and it is cut to that
          finger's traced outline, so it stops where the dark seam ink begins. */}
      <g className="kb-washes">
        {SIDES.map((side) => (
          <g
            key={side}
            className="kb-hand"
            ref={(element) => {
              (handEls.current[side] ??= [])[WASHES] = element;
            }}
          >
            {HAND_ANCHORS[side].parts.map((part) => (
              <g
                key={part.finger}
                className="kb-finger"
                ref={(element) => {
                  (fingerEls.current[part.finger] ??= [])[WASHES] = element;
                }}
              >
                {part.finger !== 'palm' && asked.has(part.finger) && (
                  <path
                    className="hand-target"
                    d={CONTOURS[side].skin}
                    clipPath={`url(#${washId(side, part.finger)})`}
                  />
                )}
              </g>
            ))}
          </g>
        ))}
      </g>
    </g>
  );
}
