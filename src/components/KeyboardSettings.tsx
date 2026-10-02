import { useState } from 'react';
import { Hand, Keyboard, Palette, SlidersHorizontal } from 'lucide-react';
import type { UserSettings } from '../types';

interface KeyboardSettingsProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

/** The three switches that shape the illustrated board. */
const SWITCHES: Array<{ key: 'showKeyboard' | 'colorZones' | 'showHands'; label: string; hint: string; Icon: typeof Keyboard }> = [
  { key: 'showKeyboard', label: 'Virtual keyboard', hint: 'Show the illustrated board below the test', Icon: Keyboard },
  { key: 'colorZones', label: 'Color zones', hint: 'Tint every key and finger with its touch-typing zone', Icon: Palette },
  { key: 'showHands', label: 'Virtual hands', hint: 'Rest the illustrated hands on the board', Icon: Hand },
];

/**
 * The board's own settings affordance. It sits in the row underneath the plate —
 * never on top of it — so it can not cover a key, a finger or a wrist however
 * the hands move. Its panel opens away from the board, into the page.
 */
export function KeyboardSettings({ settings, onUpdateSettings }: KeyboardSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Keyboard settings"
        className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          open
            ? 'border-accent bg-accentmuted text-accent'
            : 'border-darkborder bg-darkcard text-mutedtext hover:border-accent hover:text-accent'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Keyboard settings</span>
      </button>

      {open && (
        <div
          role="group"
          aria-label="Keyboard settings"
          className="animate-pop-in absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-darkborder bg-darkcard p-2 shadow-2xl"
        >
          {SWITCHES.map(({ key, label, hint, Icon }) => {
            const on = settings[key];
            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onUpdateSettings({ [key]: !on })}
                title={hint}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-darkbg"
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${on ? 'text-accent' : 'text-mutedtext'}`} />
                <span className={`flex-1 text-xs font-medium ${on ? 'text-bodytext' : 'text-mutedtext'}`}>{label}</span>
                <span className={`relative h-4 w-8 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-darkborder'}`}>
                  <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
                </span>
              </button>
            );
          })}
          <p className="px-2 pt-1.5 text-[10px] leading-snug text-mutedtext/80">Color zones follow the touch-typing finger map.</p>
        </div>
      )}
    </div>
  );
}
