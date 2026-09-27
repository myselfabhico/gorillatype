import type { FC, CSSProperties } from 'react';
import { Car, Flag } from 'lucide-react';
import type { Racer } from '../utils/raceEngine';
import { ordinal, progressPercent } from '../utils/raceEngine';
import { hexTint } from '../utils/racePrefs';

export type TrafficStage = 'off' | 'red' | 'yellow' | 'green';

/** Theme-aware checkerboard (START banner + finish line) built on app tokens. */
const CHECKER: CSSProperties = {
  backgroundImage: 'repeating-conic-gradient(var(--color-highlight) 0% 25%, transparent 0% 50%)',
  backgroundSize: '14px 14px',
};

/** Traffic-light bulbs: wrong-red, amber, and the theme's own accent green. */
const LIGHTS: Record<Exclude<TrafficStage, 'off'>, string> = {
  red: 'var(--color-wrong)',
  yellow: '#facc15',
  green: 'var(--color-accent)',
};

/** The three stacked bulbs that light up in sequence before a green-light start. */
export const TrafficLight: FC<{ stage: TrafficStage }> = ({ stage }) => (
  <div className="flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border-2 border-darkborder bg-darkbg px-2.5 py-3 shadow-xl">
    {(Object.keys(LIGHTS) as Exclude<TrafficStage, 'off'>[]).map((light) => {
      const lit = stage === light;
      return (
        <span
          key={light}
          className="h-4 w-4 rounded-full transition-all duration-200"
          style={{
            background: LIGHTS[light],
            opacity: lit ? 1 : 0.18,
            boxShadow: lit ? `0 0 10px 2px ${LIGHTS[light]}` : 'none',
            transform: lit ? 'scale(1.12)' : 'scale(1)',
          }}
        />
      );
    })}
  </div>
);

const Lane: FC<{ racer: Racer; quoteLength: number }> = ({ racer, quoteLength }) => {
  const progress = progressPercent(racer.chars, quoteLength);
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors duration-200 sm:gap-3 ${
        racer.isPlayer ? 'bg-accentmuted ring-1 ring-[color-mix(in_srgb,var(--color-accent)_45%,transparent)]' : ''
      } ${racer.finished ? 'lane-finish' : ''}`}
    >
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
        style={{ background: hexTint(racer.color, 0.16) }}
      >
        <Car className="h-3.5 w-3.5" style={{ color: racer.color }} />
      </span>
      <span
        className={`w-16 shrink-0 truncate text-[11px] font-semibold sm:w-32 sm:text-xs ${
          racer.isPlayer ? 'text-accent' : 'text-bodytext'
        }`}
        title={racer.name}
      >
        {racer.name}
      </span>
      <div className="relative h-7 min-w-0 flex-1">
        <div className="absolute inset-y-0 left-0 right-3.5">
          <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-darkborder" />
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-150 ease-linear"
            style={{ left: `${progress}%` }}
          >
            <Car
              className={`h-5 w-5 ${racer.finished ? '' : 'car-idle'}`}
              style={{
                color: racer.color,
                filter: `drop-shadow(0 2px 5px ${hexTint(racer.color, 0.5)})`,
              }}
              aria-label={`${racer.name} car`}
            />
          </span>
        </div>
        <div className="absolute inset-y-1 right-0 w-2.5 rounded-[2px]" style={CHECKER} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] font-bold text-bodytext sm:w-16 sm:text-xs">
        {racer.wpm}
        <span className="ml-0.5 text-[9px] font-semibold text-mutedtext sm:text-[10px]">WPM</span>
      </span>
      <span className="flex w-7 shrink-0 items-center justify-end">
        {racer.finished && racer.rank !== null && (
          <span
            className="flex items-center gap-0.5 rounded bg-accent px-1 py-0.5 text-[9px] font-bold text-black shadow-md"
            title={`Finished ${ordinal(racer.rank)}`}
          >
            {racer.rank === 1 ? <Flag className="h-2.5 w-2.5" /> : null}
            {racer.rank}
          </span>
        )}
      </span>
    </div>
  );
};

/**
 * The race panel — fully theme-matched: card surface, borders, text and the
 * finish checkerboard all use the app's CSS variables, so the track follows
 * whichever of the eight themes is active.
 */
export const RaceTrack: FC<{ racers: Racer[]; quoteLength: number }> = ({ racers, quoteLength }) => (
  <div className="relative overflow-hidden rounded-2xl border-2 border-darkborder bg-darkcard shadow-xl">
    <div className="h-2.5 w-full" style={CHECKER} />
    <div className="relative flex flex-col gap-1 bg-darkcard px-2 py-2 sm:px-3 sm:py-3">
      {racers.map((racer) => (
        <Lane key={racer.id} racer={racer} quoteLength={quoteLength} />
      ))}
    </div>
    <div className="h-2.5 w-full" style={CHECKER} />
  </div>
);
