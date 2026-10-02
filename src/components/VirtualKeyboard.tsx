import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { CAP_R, DECK, KEYBOARD, STAGE, findKeyForChar } from '../utils/keyboardLayout';
import type { VirtualKey } from '../utils/keyboardLayout';
import { TypingHands } from './TypingHands';

/** One physical keystroke, forwarded so the matching cap can dip. */
export interface KeyboardPress {
  id: string;
  correct: boolean;
  /** Monotonic counter — lets an identical repeat press restart the animation. */
  seq: number;
}

interface VirtualKeyboardProps {
  /** Character the test is waiting for, or null when nothing is being asked. */
  nextChar: string | null;
  press: KeyboardPress | null;
  /** The illustrated hands can be hidden independently of the board. */
  showHands: boolean;
  /** Tints every cap and fingertip by its touch-typing zone. */
  colorZones: boolean;
}

/** Legend sizes and offsets in reference pixels, measured off the reference board. */
const LABEL = { letter: 10.4, symbol: 7.8, mod: 6.9, glyph: 9.2, pad: 4.5 };

function KeyLabels({ k }: { k: VirtualKey }) {
  if (!k.label) return null;
  if (k.shiftLabel) {
    // Symbol keys stack the shifted glyph above the base one, like the reference.
    return (
      <>
        <text className="kb-key-label" x={k.x + k.w / 2} y={k.y + k.h * 0.44} fontSize={LABEL.symbol} textAnchor="middle">{k.shiftLabel}</text>
        <text className="kb-key-label" x={k.x + k.w / 2} y={k.y + k.h * 0.44 + 8.6} fontSize={LABEL.symbol} textAnchor="middle">{k.label}</text>
      </>
    );
  }
  if (!k.mod) {
    return (
      <text className="kb-key-label" x={k.x + k.w / 2} y={k.y + k.h / 2 + 3.6} fontSize={LABEL.letter} textAnchor="middle">{k.label.toUpperCase()}</text>
    );
  }
  // Modifier legends are words set flush to the cap's left edge (Backspace hugs
  // the right instead); the arrow cluster centres its glyph like a letter key.
  const glyph = Boolean(k.center);
  const y = k.y + k.h / 2 + (glyph ? 3.2 : 2.4);
  const anchor = glyph ? 'middle' : k.alignEnd ? 'end' : 'start';
  const x = glyph ? k.x + k.w / 2 : k.alignEnd ? k.x + k.w - LABEL.pad : k.x + LABEL.pad;
  return (
    <text className="kb-key-label" x={x} y={y} fontSize={glyph ? LABEL.glyph : LABEL.mod} textAnchor={anchor}>{k.label}</text>
  );
}

export function VirtualKeyboard({ nextChar, press, showHands, colorZones }: VirtualKeyboardProps) {
  // The key the test is waiting for, plus the Shift it needs when the character
  // is not directly reachable.
  const target = useMemo(() => {
    const lookup = nextChar ? findKeyForChar(nextChar) : null;
    if (!lookup) return { keyId: null as string | null, shiftId: null as string | null };
    return {
      keyId: lookup.key.id,
      shiftId: lookup.shift ? (lookup.shift === 'left' ? 'lshift' : 'rshift') : null,
    };
  }, [nextChar]);

  // Now the hands: the key above decides which finger reaches, how far the wrist
  // travels with it, and where the other hand rests. See components/TypingHands.tsx.

  return (
    <svg
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="kb-svg"
      role="img"
      aria-label="Virtual keyboard showing the typing hands"
    >
      <defs>
        <linearGradient id="kbPlateGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--kb-plate-lo)" />
          <stop offset="100%" stopColor="var(--kb-plate)" />
        </linearGradient>
        <linearGradient id="kbCapGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kb-cap)" />
          <stop offset="100%" stopColor="var(--kb-cap-lo)" />
        </linearGradient>
        <linearGradient id="kbCapEdgeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kb-cap-edge)" />
          <stop offset="100%" stopColor="var(--kb-cap-edge-lo)" />
        </linearGradient>
        <linearGradient id="kbModGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kb-mod)" />
          <stop offset="100%" stopColor="var(--kb-mod-lo)" />
        </linearGradient>
        <linearGradient id="kbModEdgeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kb-mod-edge)" />
          <stop offset="100%" stopColor="var(--kb-mod-edge-lo)" />
        </linearGradient>
        <linearGradient id="kbAccentGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kb-accent)" />
          <stop offset="100%" stopColor="var(--kb-accent-lo)" />
        </linearGradient>
      </defs>

      <rect className="kb-plate" x={DECK.x} y={DECK.y} width={DECK.w} height={DECK.h} rx={DECK.r} />

      <g>
        {KEYBOARD.map((k) => {
          // `press` is cleared shortly after each keystroke by the workspace, so
          // rendering straight from it gives the cap its down/up dip for free.
          const down = press?.id === k.id;
          const wrong = down && press?.correct === false;
          const isTarget = k.id === target.keyId || k.id === target.shiftId;
          return (
            <g
              key={k.id}
              className={[
                'kb-key',
                k.mod && 'kb-key-mod',
                k.tone && `kb-legend-${k.tone}`,
                isTarget && 'kb-key-target',
                down && 'kb-key-down',
                wrong && 'kb-key-err',
              ].filter(Boolean).join(' ')}
            >
              {isTarget && <rect className="kb-key-halo" x={k.x - 2.4} y={k.y - 2.4} width={k.w + 4.8} height={k.h + 4.8} rx={CAP_R + 2.4} />}
              <rect className="kb-key-face" x={k.x} y={k.y} width={k.w} height={k.h} rx={CAP_R} />
              {/* The zone wash sits over the cap but never over the target, whose
                  themed highlight has to stay the one thing that stands out. */}
              {colorZones && !isTarget && (
                <rect
                  className="kb-key-zone-rect"
                  x={k.x}
                  y={k.y}
                  width={k.w}
                  height={k.h}
                  rx={CAP_R}
                  style={{ '--zone': `var(--kb-zone-${k.finger})` } as CSSProperties}
                />
              )}
              <KeyLabels k={k} />
            </g>
          );
        })}
      </g>

      {showHands && <TypingHands nextChar={nextChar} press={press} colorZones={colorZones} />}
    </svg>
  );
}
