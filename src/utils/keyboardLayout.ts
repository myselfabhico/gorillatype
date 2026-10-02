export type FingerId =
  | 'lpinky' | 'lring' | 'lmiddle' | 'lindex'
  | 'rindex' | 'rmiddle' | 'rring' | 'rpinky'
  | 'lthumb' | 'rthumb';

/** Colour of a modifier legend, taken from the reference board. */
export type LegendTone = 'blue' | 'green' | 'amber' | 'orange' | 'neutral';

export interface VirtualKey {
  id: string;
  /** Glyph shown on the cap. Empty for the space bar. */
  label: string;
  /** Second, smaller legend stacked above `label` (symbol keys). */
  shiftLabel?: string;
  /** Cap rectangle, in reference pixels relative to the plate's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  finger: FingerId;
  /** Modifier key — drawn as a dark cap with a small left-aligned legend. */
  mod?: boolean;
  /** Legend colour of a modifier key. */
  tone?: LegendTone;
  /** Legend hugs the right edge instead of the left (Backspace). */
  alignEnd?: boolean;
  /** Glyph-only keys (the arrow cluster) centre their legend like letters do. */
  center?: boolean;
}

/*
 * Every number below was measured off the reference board — a 15-unit, five-row
 * plate whose caps are nearly square, sit almost flush vertically, and are
 * framed by a wide dark case. The coordinate space is the reference image's own
 * pixels, scaled so the plate lands exactly on DECK below, origin at the
 * plate's top-left corner; the SVG viewBox uses the same space.
 */
const UNIT = 31.4;      // one key unit (keycap pitch)
const KEY_GAP = 2.8;    // dark seam between neighbouring caps
const ROW_PITCH = 32.2;
const CAP_H = 29.4;
const BOARD_X = 12.5;
const BOARD_Y = 10.7;

/** Rounded plate the caps sit on. */
export const DECK = { x: 0, y: 0, w: 492, h: 180, r: 6 };
/** Full drawing area: the plate plus the hand zone reaching the frame's bottom. */
export const STAGE = { w: 492, h: 261.5 };
/** Corner radius of a keycap. */
export const CAP_R = 2.8;

type KeyStyle = Pick<VirtualKey, 'mod' | 'tone' | 'alignEnd' | 'center'>;
type KeyDef = [id: string, label: string, shiftLabel: string | null, w: number, finger: FingerId, style?: KeyStyle];

/**
 * The reference board is a 15-unit ANSI layout: no backquote, a shortened right
 * Shift with an arrow cluster beside it, and a bottom row of
 * Control / Alt / Code / Space / Alt / Fn / ← ↓ →.
 */
const ROW_DEFS: KeyDef[][] = [
  [
    ['esc', 'Esc', null, 1, 'lpinky', { mod: true, tone: 'orange' }],
    ['1', '1', '!', 1, 'lpinky'], ['2', '2', '@', 1, 'lring'], ['3', '3', '#', 1, 'lmiddle'],
    ['4', '4', '$', 1, 'lindex'], ['5', '5', '%', 1, 'lindex'], ['6', '6', '^', 1, 'rindex'],
    ['7', '7', '&', 1, 'rindex'], ['8', '8', '*', 1, 'rmiddle'], ['9', '9', '(', 1, 'rring'],
    ['0', '0', ')', 1, 'rpinky'], ['minus', '-', '_', 1, 'rpinky'], ['equal', '=', '+', 1, 'rpinky'],
    ['backspace', '←Backspace', null, 2, 'rpinky', { mod: true, tone: 'blue', alignEnd: true }],
  ],
  [
    ['tab', 'Tab', null, 1.5, 'lpinky', { mod: true, tone: 'blue' }],
    ['q', 'q', null, 1, 'lpinky'], ['w', 'w', null, 1, 'lring'], ['e', 'e', null, 1, 'lmiddle'],
    ['r', 'r', null, 1, 'lindex'], ['t', 't', null, 1, 'lindex'], ['y', 'y', null, 1, 'rindex'],
    ['u', 'u', null, 1, 'rindex'], ['i', 'i', null, 1, 'rmiddle'], ['o', 'o', null, 1, 'rring'],
    ['p', 'p', null, 1, 'rpinky'], ['bracket-left', '[', '{', 1, 'rpinky'], ['bracket-right', ']', '}', 1, 'rpinky'],
    ['backslash', '\\', '|', 1.5, 'rpinky'],
  ],
  [
    ['caps', 'Caps Lock', null, 1.75, 'lpinky', { mod: true, tone: 'green' }],
    ['a', 'a', null, 1, 'lpinky'], ['s', 's', null, 1, 'lring'], ['d', 'd', null, 1, 'lmiddle'],
    ['f', 'f', null, 1, 'lindex'], ['g', 'g', null, 1, 'lindex'], ['h', 'h', null, 1, 'rindex'],
    ['j', 'j', null, 1, 'rindex'], ['k', 'k', null, 1, 'rmiddle'], ['l', 'l', null, 1, 'rring'],
    ['semicolon', ';', ':', 1, 'rpinky'], ['quote', "'", '"', 1, 'rpinky'],
    ['enter', 'Return', null, 2.25, 'rpinky', { mod: true, tone: 'green' }],
  ],
  [
    ['lshift', 'Shift', null, 2.25, 'lpinky', { mod: true, tone: 'amber' }],
    ['z', 'z', null, 1, 'lpinky'], ['x', 'x', null, 1, 'lring'], ['c', 'c', null, 1, 'lmiddle'],
    ['v', 'v', null, 1, 'lindex'], ['b', 'b', null, 1, 'lindex'], ['n', 'n', null, 1, 'rindex'],
    ['m', 'm', null, 1, 'rindex'], ['comma', ',', '<', 1, 'rmiddle'], ['period', '.', '>', 1, 'rring'],
    ['rshift', 'Shift', null, 1.75, 'rpinky', { mod: true, tone: 'amber' }],
    ['arrow-up', '↑', null, 1, 'rpinky', { mod: true, tone: 'neutral', center: true }],
    ['meta', 'Meta', null, 1, 'rpinky', { mod: true, tone: 'blue' }],
  ],
  [
    ['lctrl', 'Control', null, 1.75, 'lpinky', { mod: true, tone: 'blue' }],
    ['lalt', 'Alt', null, 1, 'lpinky', { mod: true, tone: 'blue' }],
    ['code', 'Code', null, 1, 'lpinky', { mod: true, tone: 'orange' }],
    ['space', '', null, 6.25, 'rthumb'],
    ['ralt', 'Alt', null, 1, 'rpinky', { mod: true, tone: 'blue' }],
    ['fn', 'Fn', null, 1, 'rpinky', { mod: true, tone: 'amber' }],
    ['arrow-left', '←', null, 1, 'rpinky', { mod: true, tone: 'neutral', center: true }],
    ['arrow-down', '↓', null, 1, 'rpinky', { mod: true, tone: 'neutral', center: true }],
    ['arrow-right', '→', null, 1, 'rpinky', { mod: true, tone: 'neutral', center: true }],
  ],
];

export const KEYBOARD: VirtualKey[] = ROW_DEFS.flatMap((row, y) => {
  let x = BOARD_X;
  return row.map(([id, label, shiftLabel, w, finger, style]): VirtualKey => {
    const key: VirtualKey = {
      id,
      label,
      shiftLabel: shiftLabel ?? undefined,
      x,
      y: BOARD_Y + y * ROW_PITCH,
      w: w * UNIT - KEY_GAP,
      h: CAP_H,
      finger,
      ...style,
    };
    x += w * UNIT;
    return key;
  });
});

export const BY_ID = new Map(KEYBOARD.map((key) => [key.id, key]));

const byChar = new Map<string, VirtualKey>();
const byShiftChar = new Map<string, VirtualKey>();
for (const key of KEYBOARD) {
  if (key.label.length === 1) byChar.set(key.label, key);
  if (key.shiftLabel) byShiftChar.set(key.shiftLabel, key);
}
byChar.set(' ', BY_ID.get('space')!);

export interface KeyLookup {
  key: VirtualKey;
  /** Which Shift key must be held, when the character needs one. */
  shift: 'left' | 'right' | null;
}

/** Maps a character to its physical key using standard US QWERTY touch-typing rules. */
export function findKeyForChar(char: string): KeyLookup | null {
  if (!char) return null;
  // Shift is pressed with the hand opposite the striking finger.
  const shiftSide = (key: VirtualKey): 'left' | 'right' => (key.finger.startsWith('l') ? 'right' : 'left');
  if (/[A-Z]/.test(char)) {
    const key = byChar.get(char.toLowerCase());
    return key ? { key, shift: shiftSide(key) } : null;
  }
  const shifted = byShiftChar.get(char);
  if (shifted) return { key: shifted, shift: shiftSide(shifted) };
  const key = byChar.get(char);
  return key ? { key, shift: null } : null;
}
