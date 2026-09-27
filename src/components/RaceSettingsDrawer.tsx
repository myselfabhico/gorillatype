import { useEffect, useState } from 'react';
import type { ChangeEvent, CSSProperties, FC } from 'react';
// (mount-seeded draft keeps lint clean: no setState inside effects)
import { Car, Palette, RefreshCw, Timer, User, X } from 'lucide-react';
import type { GuestIdentity, RacePrefs } from '../utils/racePrefs';
import { getRacePrefs } from '../utils/racePrefs';

/**
 * Race Settings drawer — customize your racer identity and the three AI
 * guests (name, car color, target speed). Mirrors the ModesDrawer pattern:
 * dimmed backdrop, right-side card, Escape/X to close, zero app-state coupling.
 */

interface RaceSettingsDrawerProps {
  onClose: () => void;
  onSaved: (prefs: RacePrefs) => void;
}

const CAR_COLORS = ['#f97316', '#8b5cf6', '#ef4444', '#ec4899', '#84cc16', '#06b6d4', '#eab308', '#14b8a6', '#3b82f6', '#f43f5e'];

const MAX_NAME = 14;
const MIN_WPM = 5;
const MAX_WPM = 250;

function clampName(value: string): string {
  return value.slice(0, MAX_NAME);
}

function clampWpm(value: number): number {
  if (!Number.isFinite(value)) return MIN_WPM;
  return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(value)));
}

const ColorSwatch: FC<{ color: string; active: boolean; onSelect: () => void; label: string }> = ({ color, active, onSelect, label }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-label={label}
    title={label}
    aria-pressed={active}
    className={`h-6 w-6 rounded-full transition-transform active:scale-90 hover:scale-110 ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-darkcard scale-110' : 'ring-1 ring-darkborder'}`}
    style={{ background: color }}
  />
);

export const RaceSettingsDrawer: FC<RaceSettingsDrawerProps> = ({ onClose, onSaved }) => {
  // Seeded once at mount — the parent mounts this drawer fresh each time it
  // opens, so the form always starts from the saved cookie values.
  const [draft, setDraft] = useState<RacePrefs>(() => getRacePrefs());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updatePlayer = (patch: Partial<RacePrefs['player']>) =>
    setDraft((previous) => (previous ? { ...previous, player: { ...previous.player, ...patch } } : previous));

  const updateGuest = (index: number, patch: Partial<GuestIdentity>) =>
    setDraft((previous) =>
      previous
        ? { ...previous, guests: previous.guests.map((guest, i) => (i === index ? { ...guest, ...patch } : guest)) }
        : previous,
    );

  const handleName = (event: ChangeEvent<HTMLInputElement>) => clampName(event.target.value);

  const handleSave = () => onSaved(draft);

  const restoreDefaults = () => setDraft(getRacePrefs());

  const identityRow = (identity: { name: string; color: string }, onName: (v: string) => void, onColor: (v: string) => void, label: string) => (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={identity.color}
        onChange={(event) => onColor(event.target.value)}
        className="race-color h-9 w-9 shrink-0"
        aria-label={`${label} car color`}
        title={`${label} car color`}
      />
      <input
        type="text"
        value={identity.name}
        maxLength={MAX_NAME}
        onChange={(event) => onName(handleName(event))}
        placeholder={label}
        aria-label={`${label} name`}
        className="min-w-0 flex-1 rounded-lg border-2 border-darkborder bg-darkbg px-3 py-2 text-sm font-semibold text-bodytext outline-none transition-colors placeholder:text-mutedtext focus:border-accent"
      />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${identity.color}22` }}>
        <Car className="h-4 w-4" style={{ color: identity.color }} />
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fade-in" data-race-drawer>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="race-drawer-in flex w-screen max-w-sm flex-col gap-5 overflow-y-auto border-l border-darkborder bg-darkcard p-6 text-bodytext shadow-2xl">
          <div className="flex items-center justify-between border-b border-darkborder pb-4">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-black">
                <Palette className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Race Settings</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close race settings"
              className="group rounded-lg bg-darkbg p-1.5 text-mutedtext transition-all hover:bg-darkborder hover:text-bodytext active:scale-90"
            >
              <X className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            </button>
          </div>

          {/* Player identity */}
          <section className="rounded-xl border border-darkborder bg-darkbg/60 p-3.5">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mutedtext">
              <User className="h-3.5 w-3.5 text-accent" />
              You
            </div>
            {identityRow(draft.player, (name) => updatePlayer({ name }), (color) => updatePlayer({ color }), 'Your racer name')}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {CAR_COLORS.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  active={draft.player.color.toLowerCase() === color}
                  onSelect={() => updatePlayer({ color })}
                  label={`Use ${color} for your car`}
                />
              ))}
            </div>
          </section>

          {/* The three guests */}
          {draft.guests.map((guest, index) => (
            <section
              key={index}
              className="rounded-xl border border-darkborder bg-darkbg/60 p-3.5 stagger-item"
              style={{ '--stagger-i': index + 1 } as CSSProperties}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mutedtext">
                  <Car className="h-3.5 w-3.5 text-accent" />
                  Guest {index + 1}
                </div>
                <span className="rounded-md bg-accentmuted px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
                  AI
                </span>
              </div>
              {identityRow(guest, (name) => updateGuest(index, { name }), (color) => updateGuest(index, { color }), `Guest ${index + 1} name`)}
              <div className="mt-2.5 flex items-center gap-2.5">
                <Timer className="h-3.5 w-3.5 shrink-0 text-mutedtext" />
                <input
                  type="range"
                  min={MIN_WPM}
                  max={MAX_WPM}
                  step={1}
                  value={guest.wpm}
                  onChange={(event) => updateGuest(index, { wpm: clampWpm(Number(event.target.value)) })}
                  style={{ accentColor: 'var(--color-accent)' }}
                  className="min-w-0 flex-1 cursor-pointer"
                  aria-label={`Guest ${index + 1} typing speed`}
                  title={`Guest ${index + 1} typing speed: ${guest.wpm} WPM`}
                />
                <span className="w-16 shrink-0 text-right font-mono text-sm font-bold text-accent">{guest.wpm} WPM</span>
              </div>
            </section>
          ))}

          <div className="mt-auto flex items-center gap-2.5 border-t border-darkborder pt-4">
            <button
              onClick={restoreDefaults}
              className="glow-ring flex items-center gap-2 rounded-xl border border-darkborder bg-darkbg px-4 py-2.5 text-sm font-bold text-bodytext transition-all hover:border-accent hover:text-accent active:scale-95"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={handleSave}
              className="btn-shine glow-accent flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition-all hover:bg-accent-hover active:scale-95"
            >
              Save &amp; Race
            </button>
          </div>
          <p className="text-center text-[11px] text-mutedtext">Saved locally in cookies — applied to every new race.</p>
        </div>
      </div>
    </div>
  );
};
