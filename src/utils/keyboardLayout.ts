export type FingerId =
  | 'lpinky' | 'lring' | 'lmiddle' | 'lindex'
  | 'rindex' | 'rmiddle' | 'rring' | 'rpinky'
  | 'lthumb' | 'rthumb';

export interface Pos {
  x: number;
  y: number;
}

export interface VirtualKey {
  id: string;
  label: string;
  shiftLabel?: string;
  x: number;
  y: number;
  w: number;
  finger: FingerId;
  mod?: boolean;
  home?: boolean;
}

/** Keyboard coordinate system: 15 key units wide, 5 flat rows (0.5u each). */
export const ROW_H = 0.5;
/** Full stage height in units: keyboard rows + a hand zone below. */
export const STAGE_U = 3.6;

type KeyDef = [id: string, label: string, shiftLabel: string | null, w: number, finger: FingerId, mod?: boolean];

const HOME_IDS = ['a', 's', 'd', 'f', 'j', 'k', 'l', 'semicolon'];

const ROW_DEFS: KeyDef[][] = [
  [
    ['backquote', '`', '~', 1, 'lpinky'], ['1', '1', '!', 1, 'lpinky'], ['2', '2', '@', 1, 'lring'], ['3', '3', '#', 1, 'lmiddle'],
    ['4', '4', '$', 1, 'lindex'], ['5', '5', '%', 1, 'lindex'], ['6', '6', '^', 1, 'rindex'], ['7', '7', '&', 1, 'rindex'],
    ['8', '8', '*', 1, 'rmiddle'], ['9', '9', '(', 1, 'rring'], ['0', '0', ')', 1, 'rpinky'], ['minus', '-', '_', 1, 'rpinky'],
    ['equal', '=', '+', 1, 'rpinky'], ['backspace', '⌫', null, 2, 'rpinky', true],
  ],
  [
    ['tab', 'tab', null, 1.5, 'lpinky', true], ['q', 'q', null, 1, 'lpinky'], ['w', 'w', null, 1, 'lring'], ['e', 'e', null, 1, 'lmiddle'],
    ['r', 'r', null, 1, 'lindex'], ['t', 't', null, 1, 'lindex'], ['y', 'y', null, 1, 'rindex'], ['u', 'u', null, 1, 'rindex'],
    ['i', 'i', null, 1, 'rmiddle'], ['o', 'o', null, 1, 'rring'], ['p', 'p', null, 1, 'rpinky'], ['bracket-left', '[', '{', 1, 'rpinky'],
    ['bracket-right', ']', '}', 1, 'rpinky'], ['backslash', '\\', '|', 1.5, 'rpinky'],
  ],
  [
    ['caps', 'caps', null, 1.75, 'lpinky', true], ['a', 'a', null, 1, 'lpinky'], ['s', 's', null, 1, 'lring'], ['d', 'd', null, 1, 'lmiddle'],
    ['f', 'f', null, 1, 'lindex'], ['g', 'g', null, 1, 'lindex'], ['h', 'h', null, 1, 'rindex'], ['j', 'j', null, 1, 'rindex'],
    ['k', 'k', null, 1, 'rmiddle'], ['l', 'l', null, 1, 'rring'], ['semicolon', ';', ':', 1, 'rpinky'], ['quote', "'", '"', 1, 'rpinky'],
    ['enter', '⏎', null, 2.25, 'rpinky', true],
  ],
  [
    ['lshift', 'shift', null, 2.25, 'lpinky', true], ['z', 'z', null, 1, 'lpinky'], ['x', 'x', null, 1, 'lring'], ['c', 'c', null, 1, 'lmiddle'],
    ['v', 'v', null, 1, 'lindex'], ['b', 'b', null, 1, 'lindex'], ['n', 'n', null, 1, 'rindex'], ['m', 'm', null, 1, 'rindex'],
    ['comma', ',', '<', 1, 'rmiddle'], ['period', '.', '>', 1, 'rring'], ['slash', '/', '?', 1, 'rpinky'], ['rshift', 'shift', null, 2.75, 'rpinky', true],
  ],
  [
    ['lctrl', 'ctrl', null, 1.25, 'lpinky', true], ['lwin', 'win', null, 1.25, 'lpinky', true], ['lalt', 'alt', null, 1.25, 'lpinky', true],
    ['space', '', null, 6.25, 'rthumb', true], ['ralt', 'alt', null, 1.25, 'rpinky', true], ['fn', 'fn', null, 1.25, 'rpinky', true],
    ['menu', 'menu', null, 1.25, 'rpinky', true], ['rctrl', 'ctrl', null, 1.25, 'rpinky', true],
  ],
];

export const KEYBOARD: VirtualKey[] = ROW_DEFS.flatMap((row, y) => {
  let x = 0;
  return row.map(([id, label, shiftLabel, w, finger, mod]): VirtualKey => {
    const key: VirtualKey = {
      id,
      label,
      shiftLabel: shiftLabel ?? undefined,
      x,
      y,
      w,
      finger,
      mod,
      home: HOME_IDS.includes(id),
    };
    x += w;
    return key;
  });
});

const byChar = new Map<string, VirtualKey>();
const byShiftChar = new Map<string, VirtualKey>();
for (const key of KEYBOARD) {
  if (key.label) byChar.set(key.label, key);
  if (key.shiftLabel) byShiftChar.set(key.shiftLabel, key);
}
byChar.set(' ', KEYBOARD.find((key) => key.id === 'space')!);

export interface KeyLookup {
  key: VirtualKey;
  /** Which Shift key must be held, when the character requires one. */
  shift: 'left' | 'right' | null;
}

/** Maps a character to its physical key using standard US QWERTY touch-typing rules. */
export function findKeyForChar(char: string): KeyLookup | null {
  if (!char) return null;
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

export function keyCenter(key: VirtualKey): Pos {
  return { x: key.x + key.w / 2, y: (key.y + 0.5) * ROW_H };
}

/** One subtle hue per finger type so zone hints stay readable across every theme. */
export const FINGER_COLORS: Record<FingerId, string> = {
  lpinky: '#f472b6', lring: '#a78bfa', lmiddle: '#60a5fa', lindex: '#34d399',
  rindex: '#34d399', rmiddle: '#60a5fa', rring: '#a78bfa', rpinky: '#f472b6',
  lthumb: '#fbbf24', rthumb: '#fbbf24',
};
