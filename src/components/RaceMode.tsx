import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FC, MouseEvent } from 'react';
import {
  Car,
  Eye,
  Flag,
  Gauge,
  RefreshCw,
  Settings,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { UserSettings } from '../types';
import { soundManager } from '../utils/sound';
import { getRaceQuote, pickRaceQuoteIndex } from '../utils/raceQuotes';
import { getRacePrefs, hasCustomRacePrefs, saveRacePrefs } from '../utils/racePrefs';
import {
  computeAccuracy,
  computePoints,
  computeStartSpeed,
  computeWpm,
  createBotPlans,
  createRacers,
  formatClock,
  ordinal,
  progressPercent,
  quoteWordCount,
  rankUnfinished,
  sortByFinishOrder,
  stepBot,
  timeLimitSeconds,
} from '../utils/raceEngine';
import type { Racer } from '../utils/raceEngine';
import { RaceTrack, TrafficLight } from './RaceLanes';
import { RaceSettingsDrawer } from './RaceSettingsDrawer';
import type { TrafficStage } from './RaceLanes';
import type { RacePrefs } from '../utils/racePrefs';

/**
 * Race Mode — a self-contained TypeRacer-style race.
 *
 * Isolation contract: this component owns its own state machine
 * (lobby -> countdown -> racing -> finished), its own quote bank, its own
 * WPM/accuracy/points math and its own presentation. It never touches the
 * typing-test, text-practice or custom-mode state, and it deliberately does not
 * write into the profile test history.
 *
 * Mechanic note: wrong characters do NOT block progress (matching the typing
 * test). You can keep typing past a mistake; the wrong char simply shows red
 * and counts against accuracy, and fixing it with Backspace is your choice.
 * WPM is driven by correctly completed characters, exactly like the typing
 * test: a wrong char contributes nothing to forward progress, so speed is
 * only earned by what you actually got right.
 */

type RacePhase = 'lobby' | 'countdown' | 'racing' | 'finished';
type DisplayFormat = 'paragraph' | 'line';

const COUNTDOWN_MS = 5000;
const LOBBY_MS = 700;
const TICK_MS = 100;
/** Ignore huge time jumps (backgrounded tabs) so a race can never teleport. */
const MAX_TICK_DELTA_MS = 1000;

interface RaceSummary {
  rank: number;
  totalRacers: number;
  wpm: number;
  accuracy: number;
  points: number;
  startSpeed: number;
  elapsedMs: number;
  finished: boolean;
  keystrokes: number;
  fixes: number;
  samples: number[];
}

interface KeystrokeStats {
  correctKeys: number;
  totalKeys: number;
  firstKeyAtMs: number | null;
}

/** How many characters of `value` match the target at the same position. */
function countMatches(value: string, target: string): number {
  let matches = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === target[index]) matches++;
  }
  return matches;
}

export const RaceMode: FC<{ settings: UserSettings; playerName?: string; blocked?: boolean }> = ({
  settings,
  playerName,
  blocked = false,
}) => {
  const profileName = playerName && playerName.trim().length > 0 ? playerName.trim() : 'Guest';

  const [quote, setQuote] = useState<{ index: number; text: string }>(() => {
    const index = pickRaceQuoteIndex();
    return { index, text: getRaceQuote(index) };
  });
  const [phase, setPhase] = useState<RacePhase>('lobby');
  const [racers, setRacers] = useState<Racer[]>(() => {
    const prefs = getRacePrefs();
    return createRacers(
      hasCustomRacePrefs() ? prefs.player : { name: profileName, color: prefs.player.color },
      createBotPlans(hasCustomRacePrefs() ? prefs.guests : undefined),
    );
  });
  const [isRaceSettingsOpen, setIsRaceSettingsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [hasError, setHasError] = useState(false);
  const [countdownMs, setCountdownMs] = useState(COUNTDOWN_MS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [statsView, setStatsView] = useState({ correctKeys: 0, totalKeys: 0 });
  const [summary, setSummary] = useState<RaceSummary | null>(null);
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('paragraph');

  const quoteRef = useRef(quote);
  const phaseRef = useRef<RacePhase>('lobby');
  const racersRef = useRef(racers);
  const typedRef = useRef('');
  const hasErrorRef = useRef(false);
  const elapsedRef = useRef(0);
  const countdownRef = useRef(COUNTDOWN_MS);
  const lastTickRef = useRef(0);
  const lastBeepSecondRef = useRef(-1);
  const nextRankRef = useRef(1);
  const statsRef = useRef<KeystrokeStats>({ correctKeys: 0, totalKeys: 0, firstKeyAtMs: null });
  const samplesRef = useRef<number[]>([]);
  const lastSampleSecondRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const quoteBoxRef = useRef<HTMLDivElement | null>(null);
  // Mirrored so the 100ms interval always reads the live preference.
  const sfxRef = useRef(settings.websiteSfx);
  const soundRef = useRef(settings.keyboardSound);
  // Reflected into the grid on save via applyRacePrefs; never mutates app state.
  const playerNameRef = useRef(profileName);

  useEffect(() => {
    sfxRef.current = settings.websiteSfx;
  }, [settings.websiteSfx]);
  useEffect(() => {
    soundRef.current = settings.keyboardSound;
  }, [settings.keyboardSound]);

  const commitQuote = useCallback((next: { index: number; text: string }) => {
    quoteRef.current = next;
    setQuote(next);
  }, []);

  const commitRacers = useCallback((next: Racer[]) => {
    racersRef.current = next;
    setRacers(next);
  }, []);

  const setPhaseSafe = useCallback((next: RacePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const startRacing = useCallback(() => {
    lastTickRef.current = 0;
    countdownRef.current = 0;
    setCountdownMs(0);
    setPhaseSafe('racing');
    if (sfxRef.current) soundManager.playUiClick();
  }, [setPhaseSafe]);

  /** Apply saved race preferences: rebuild the grid with the new identities. */
  const applyRacePrefs = useCallback(
    (prefs: RacePrefs) => {
      playerNameRef.current = prefs.player.name;
      commitRacers(createRacers(prefs.player, createBotPlans(prefs.guests)));
      typedRef.current = '';
      hasErrorRef.current = false;
      elapsedRef.current = 0;
      countdownRef.current = COUNTDOWN_MS;
      lastTickRef.current = 0;
      lastBeepSecondRef.current = -1;
      nextRankRef.current = 1;
      statsRef.current = { correctKeys: 0, totalKeys: 0, firstKeyAtMs: null };
      samplesRef.current = [];
      lastSampleSecondRef.current = 0;
      setTyped('');
      setHasError(false);
      setCountdownMs(COUNTDOWN_MS);
      setElapsedMs(0);
      setStatsView({ correctKeys: 0, totalKeys: 0 });
      setSummary(null);
      setPhaseSafe('lobby');
      if (sfxRef.current) soundManager.playUiClick();
    },
    [commitRacers, setPhaseSafe],
  );

  /** Close out the race: lock the places and build the player's summary. */
  const endRace = useCallback(() => {
    if (phaseRef.current === 'finished') return;
    const ranked = rankUnfinished(racersRef.current, nextRankRef.current);
    commitRacers(ranked);
    const player = ranked.find((racer) => racer.isPlayer);
    const stats = statsRef.current;
    const elapsed = elapsedRef.current;
    const quoteLength = quoteRef.current.text.length;
    const wpm = computeWpm(player?.chars ?? 0, elapsed);
    const next: RaceSummary = {
      rank: player?.rank ?? ranked.length,
      totalRacers: ranked.length,
      wpm,
      accuracy: computeAccuracy(stats.correctKeys, stats.totalKeys),
      points: computePoints(quoteLength, wpm),
      startSpeed: computeStartSpeed(stats.firstKeyAtMs ?? 0),
      elapsedMs: elapsed,
      finished: player?.finished === true,
      keystrokes: stats.totalKeys,
      fixes: Math.max(0, stats.totalKeys - stats.correctKeys),
      samples: [...samplesRef.current],
    };
    setSummary(next);
    setPhaseSafe('finished');
    if (sfxRef.current) {
      if (next.finished && next.rank === 1) soundManager.playVictorySound();
      else soundManager.playFinishSound();
    }
    if (next.finished && next.rank === 1) {
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
    }
  }, [commitRacers, setPhaseSafe]);

  /** Wipe the grid and head back to the lobby with a brand new field. */
  const beginRace = useCallback(
    (nextQuote: { index: number; text: string }) => {
      commitQuote(nextQuote);
      const prefs = getRacePrefs();
      commitRacers(
        createRacers(
          { name: hasCustomRacePrefs() ? prefs.player.name : playerNameRef.current, color: prefs.player.color },
          createBotPlans(hasCustomRacePrefs() ? prefs.guests : undefined),
        ),
      );
      typedRef.current = '';
      hasErrorRef.current = false;
      elapsedRef.current = 0;
      countdownRef.current = COUNTDOWN_MS;
      lastTickRef.current = 0;
      lastBeepSecondRef.current = -1;
      nextRankRef.current = 1;
      statsRef.current = { correctKeys: 0, totalKeys: 0, firstKeyAtMs: null };
      samplesRef.current = [];
      lastSampleSecondRef.current = 0;
      setTyped('');
      setHasError(false);
      setCountdownMs(COUNTDOWN_MS);
      setElapsedMs(0);
      setStatsView({ correctKeys: 0, totalKeys: 0 });
      setSummary(null);
      setPhaseSafe('lobby');
    },
    [commitQuote, commitRacers, setPhaseSafe],
  );

  const raceAgain = useCallback(() => {
    const index = pickRaceQuoteIndex(quoteRef.current.index);
    beginRace({ index, text: getRaceQuote(index) });
  }, [beginRace]);

  const skipCountdown = useCallback(() => {
    if (phaseRef.current === 'lobby') {
      countdownRef.current = COUNTDOWN_MS;
      setCountdownMs(COUNTDOWN_MS);
      setPhaseSafe('countdown');
      return;
    }
    if (phaseRef.current === 'countdown') startRacing();
  }, [setPhaseSafe, startRacing]);

  // Lobby -> countdown on its own, so entering the mode feels like joining a race.
  useEffect(() => {
    if (phase !== 'lobby') return;
    const id = window.setTimeout(() => {
      countdownRef.current = COUNTDOWN_MS;
      setCountdownMs(COUNTDOWN_MS);
      setPhaseSafe('countdown');
    }, LOBBY_MS);
    return () => window.clearTimeout(id);
  }, [phase, setPhaseSafe]);

  const updatePlayerProgress = useCallback(
    (chars: number) => {
      const elapsed = elapsedRef.current;
      const next = racersRef.current.map((racer) =>
        racer.isPlayer ? { ...racer, chars, wpm: computeWpm(chars, elapsed) } : racer,
      );
      commitRacers(next);
    },
    [commitRacers],
  );

  const finishPlayer = useCallback(() => {
    if (phaseRef.current !== 'racing') return;
    const elapsed = elapsedRef.current;
    const quoteLength = quoteRef.current.text.length;
    const rank = nextRankRef.current;
    nextRankRef.current += 1;
    const next = racersRef.current.map((racer) =>
      racer.isPlayer
        ? {
            ...racer,
            chars: quoteLength,
            finished: true,
            rank,
            finishMs: elapsed,
            wpm: computeWpm(quoteLength, elapsed),
          }
        : racer,
    );
    commitRacers(next);
    endRace();
  }, [commitRacers, endRace]);

  /** The one clock: countdown ticks and the racing simulation share it. */
  useEffect(() => {
    if (blocked || isRaceSettingsOpen || (phase !== 'countdown' && phase !== 'racing')) {
      lastTickRef.current = 0;
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      if (lastTickRef.current === 0) lastTickRef.current = now;
      const deltaMs = Math.min(MAX_TICK_DELTA_MS, now - lastTickRef.current);
      lastTickRef.current = now;
      if (deltaMs <= 0) return;

      if (phaseRef.current === 'countdown') {
        const remaining = Math.max(0, countdownRef.current - deltaMs);
        countdownRef.current = remaining;
        setCountdownMs(remaining);
        const second = Math.ceil(remaining / 1000);
        if (second !== lastBeepSecondRef.current) {
          lastBeepSecondRef.current = second;
          if (second > 0 && sfxRef.current) soundManager.playUiClick();
        }
        if (remaining <= 0) startRacing();
        return;
      }

      if (phaseRef.current !== 'racing') return;

      const elapsed = elapsedRef.current + deltaMs;
      elapsedRef.current = elapsed;
      setElapsedMs(elapsed);
      const quoteLength = quoteRef.current.text.length;
      const deltaSec = deltaMs / 1000;

      const next = racersRef.current.map((racer) => {
        if (racer.isPlayer) {
          return racer.finished ? racer : { ...racer, wpm: computeWpm(racer.chars, elapsed) };
        }
        if (racer.finished) return racer;
        const stepped = stepBot(racer, deltaSec, quoteLength);
        if (stepped.chars >= quoteLength) {
          const rank = nextRankRef.current;
          nextRankRef.current += 1;
          return {
            ...stepped,
            chars: quoteLength,
            finished: true,
            rank,
            finishMs: elapsed,
            wpm: computeWpm(quoteLength, elapsed),
          };
        }
        return { ...stepped, wpm: computeWpm(stepped.chars, elapsed) };
      });
      commitRacers(next);

      // One WPM sample per second for the post-race replay graph.
      const second = Math.floor(elapsed / 1000);
      if (second > lastSampleSecondRef.current) {
        lastSampleSecondRef.current = second;
        const player = next.find((racer) => racer.isPlayer);
        samplesRef.current.push(player?.wpm ?? 0);
      }

      if (elapsed >= timeLimitSeconds(quoteLength) * 1000) endRace();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, blocked, isRaceSettingsOpen, startRacing, endRace, commitRacers]);

  // Green light: the input grabs focus on its own.
  useEffect(() => {
    if (phase === 'racing' && !isRaceSettingsOpen) inputRef.current?.focus();
  }, [phase, isRaceSettingsOpen]);

  // Tab must never carry focus out of a live race (and Escape must not break it).
  // The Race Settings drawer counts as "blocked": while it is open the race is
  // paused and keyboard capture hands over to the drawer.
  useEffect(() => {
    if ((phase !== 'countdown' && phase !== 'racing') || isRaceSettingsOpen) return;
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', keepFocus);
    return () => window.removeEventListener('keydown', keepFocus);
  }, [phase, isRaceSettingsOpen]);

  // Single-line mode keeps the current character in view.
  useEffect(() => {
    if (displayFormat !== 'line') return;
    const box = quoteBoxRef.current;
    if (!box) return;
    const active = Math.min(typed.length, quote.text.length - 1);
    const target = box.querySelector<HTMLElement>(`[data-race-char="${active}"]`);
    if (!target) return;
    box.scrollLeft = Math.max(0, target.offsetLeft - box.clientWidth * 0.35);
  }, [typed, displayFormat, quote]);

  /** Record a new buffer value: buffer, error flag and lane progress together. */
  const applyTyped = (value: string) => {
    const target = quoteRef.current.text;
    const matches = countMatches(value, target);
    typedRef.current = value;
    setTyped(value);
    const error = matches < value.length;
    hasErrorRef.current = error;
    setHasError(error);
    updatePlayerProgress(matches);
    return matches;
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (phaseRef.current !== 'racing') return;
    const nextValue = event.target.value;
    const previous = typedRef.current;
    const target = quoteRef.current.text;

    if (nextValue.length < previous.length) {
      // Backspace (always allowed in a race so a mistake can be repaired).
      applyTyped(nextValue);
      return;
    }

    if (nextValue.length > previous.length) {
      // Accept everything (typing-test behavior): wrong characters ride along
      // in the buffer, show red and hurt accuracy, but never block progress.
      const stats = statsRef.current;
      if (stats.firstKeyAtMs === null) stats.firstKeyAtMs = elapsedRef.current;
      for (let offset = previous.length; offset < nextValue.length; offset++) {
        if (offset >= target.length) break;
        stats.totalKeys += 1;
        if (nextValue[offset] === target[offset]) stats.correctKeys += 1;
      }
      setStatsView({ correctKeys: stats.correctKeys, totalKeys: stats.totalKeys });
      if (soundRef.current !== 'mute') soundManager.playKey();
      const candidate = nextValue.slice(0, target.length);
      const matches = applyTyped(candidate);
      if (matches === target.length && candidate.length === target.length) finishPlayer();
    }
  };

  const refocusInput = () => {
    if (phaseRef.current !== 'racing' || isRaceSettingsOpen) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    try {
      input.setSelectionRange(end, end);
    } catch {
      // Some input types reject selection ranges; focus alone is enough.
    }
  };

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, [data-race-drawer]')) return;
    refocusInput();
  };

  const quoteLength = quote.text.length;
  const timeLimit = timeLimitSeconds(quoteLength);
  const remainingSeconds = Math.max(0, timeLimit - elapsedMs / 1000);
  const player = racers.find((racer) => racer.isPlayer);
  const playerWpm = player?.wpm ?? 0;
  const liveAccuracy = computeAccuracy(statsView.correctKeys, statsView.totalKeys);
  const liveProgress = progressPercent(typed.length, quoteLength);

  const trafficStage: TrafficStage =
    phase === 'racing'
      ? 'green'
      : phase === 'finished'
        ? 'off'
        : countdownMs > COUNTDOWN_MS * 0.62
          ? 'red'
          : countdownMs > COUNTDOWN_MS * 0.34
            ? 'yellow'
            : 'green';

  if (phase === 'finished' && summary) {
    const leaderboard = sortByFinishOrder(racers);
    const maxSample = Math.max(1, ...summary.samples);
    const graphPoints = summary.samples
      .map((sample, index, all) => {
        const x = all.length <= 1 ? 0 : (index / (all.length - 1)) * 300;
        const y = 78 - (sample / maxSample) * 68;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in">
        <div className="rounded-2xl bg-darkcard border-2 border-darkborder p-6 shadow-xl text-center animate-pop-in">
          <div className="flex items-center justify-center gap-3">
            <span className={`p-2.5 rounded-xl ${summary.rank === 1 ? 'bg-accent text-black' : 'bg-accentmuted text-accent'}`}>
              <Trophy className="w-6 h-6" />
            </span>
            <div className="text-left">
              <div className="text-3xl sm:text-4xl font-bold text-bodytext text-glow">{ordinal(summary.rank)}</div>
              <p className="text-xs text-mutedtext">
                {summary.finished
                  ? summary.rank === 1
                    ? `You beat ${summary.totalRacers - 1} rival${summary.totalRacers === 2 ? '' : 's'} to the line!`
                    : `You finished ${ordinal(summary.rank)} of ${summary.totalRacers}.`
                  : `The clock ran out — you reached ${Math.round(progressPercent(player?.chars ?? 0, quoteLength))}% of the quote.`}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'WPM', value: `${summary.wpm}`, icon: <Gauge className="w-4 h-4" /> },
            { label: 'Accuracy', value: `${summary.accuracy}%`, icon: <Target className="w-4 h-4" /> },
            { label: 'Points', value: `${summary.points}`, icon: <Trophy className="w-4 h-4" /> },
            { label: 'Start speed', value: summary.startSpeed > 0 ? `${summary.startSpeed}` : '—', icon: <Zap className="w-4 h-4" /> },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="rounded-xl bg-darkcard border border-darkborder p-3.5 text-center stagger-item cell-pop"
              style={{ '--stagger-i': index } as CSSProperties}
            >
              <div className="flex items-center justify-center gap-1.5 text-mutedtext text-[10px] font-bold uppercase tracking-wide">
                {stat.icon}
                {stat.label}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-accent">{stat.value}</div>
            </div>
          ))}
        </div>

        <RaceTrack racers={racers} quoteLength={quoteLength} />

        <div className="rounded-2xl bg-darkcard border border-darkborder overflow-hidden">
          <div className="px-4 py-3 border-b border-darkborder text-xs font-bold text-bodytext flex items-center justify-between">
            <span>Final standings</span>
            <span className="text-mutedtext font-normal">
              {formatClock(summary.elapsedMs / 1000)} • {summary.keystrokes} keystrokes
              {summary.fixes > 0 ? ` • ${summary.fixes} fixed` : ''}
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {leaderboard.map((racer) => {
              const racerProgress = progressPercent(racer.chars, quoteLength);
              return (
                <div
                  key={racer.id}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs ${racer.isPlayer ? 'bg-accentmuted' : ''}`}
                >
                  <span className="w-6 shrink-0 font-mono font-bold text-mutedtext">{racer.rank ?? '—'}</span>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: `${racer.color}22` }}>
                    <Car className="h-3.5 w-3.5" style={{ color: racer.color }} />
                  </span>
                  <span className={`flex-1 truncate font-semibold ${racer.isPlayer ? 'text-accent' : 'text-bodytext'}`}>{racer.name}</span>
                  <span className="hidden sm:inline w-20 text-right text-mutedtext">{racerProgress.toFixed(0)}%</span>
                  <span className="w-16 text-right font-mono font-bold text-bodytext">{racer.wpm} <span className="text-[10px] text-mutedtext">WPM</span></span>
                  <span className="hidden md:inline w-24 text-right text-mutedtext">
                    {racer.isPlayer ? `${summary.accuracy}% acc` : racer.finished ? 'finished' : 'on track'}
                  </span>
                  <span className="w-14 text-right">
                    {racer.finished ? (
                      <Flag className="inline h-3.5 w-3.5 text-accent" />
                    ) : (
                      <span className="text-[10px] font-bold text-mutedtext">DNF</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {settings.showChart && summary.samples.length > 1 && (
          <div className="rounded-2xl bg-darkcard border border-darkborder p-4 animate-rise-in">
            <div className="flex items-center justify-between text-xs font-bold text-bodytext">
              <span>Your speed through the race</span>
              <span className="text-mutedtext font-normal">replay • peak {maxSample} WPM</span>
            </div>
            <svg viewBox="0 0 300 80" className="mt-2 w-full h-20 text-accent" preserveAspectRatio="none" aria-label="WPM over time">
              <polyline points={graphPoints} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <p className="mt-1 text-[10px] text-mutedtext text-center font-mono">
              {formatClock(summary.elapsedMs / 1000)} total • sample every 1s
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
          <button
            onClick={raceAgain}
            className="btn-shine glow-accent flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-all active:scale-95 group"
          >
            <RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" />
            Race Again
          </button>
          <button
            onClick={() => beginRace(quoteRef.current)}
            className="glow-ring flex items-center gap-2 px-4 py-2.5 rounded-xl bg-darkcard border border-darkborder text-bodytext text-sm font-bold hover:border-accent hover:text-accent transition-all active:scale-95"
          >
            <Flag className="w-4 h-4" />
            Same quote, new grid
          </button>
        </div>
      </div>
    );
  }

  const countdownLabel = Math.max(0, Math.ceil(countdownMs / 1000));
  const isPreRace = phase !== 'racing';

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in" onClick={handlePanelClick}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accentmuted text-accent">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Race Mode</h2>
            <p className="text-xs text-mutedtext">
              {phase === 'racing'
                ? 'Green light — type the quote exactly as shown'
                : `Quote of ${quoteWordCount(quoteLength).toFixed(0)} words • ${racers.length - 1} AI rivals on the grid`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-sm font-bold ${phase === 'racing' && remainingSeconds <= 15 ? 'border-wrongred/60 text-wrongred stat-tick' : 'border-darkborder bg-darkcard text-bodytext'}`}>
            <Timer className="w-4 h-4" />
            {formatClock(remainingSeconds)}
          </span>
          <button
            onClick={raceAgain}
            className="glow-ring flex items-center gap-2 px-3.5 py-2 rounded-xl bg-darkcard border border-darkborder text-xs font-bold text-bodytext hover:border-accent hover:text-accent transition-all active:scale-95 group"
          >
            <RefreshCw className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180" />
            New Race
          </button>
          <button
            onClick={() => setIsRaceSettingsOpen(true)}
            className={`glow-ring flex items-center rounded-xl border p-2 transition-all active:scale-90 group ${isRaceSettingsOpen ? 'border-accent text-accent' : 'border-darkborder bg-darkcard text-mutedtext hover:border-accent hover:text-accent'}`}
            title="Race Settings — customize names, car colors and AI speeds"
            aria-label="Race Settings"
          >
            <Settings className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-2xl bg-darkcard border border-darkborder p-4">
        <TrafficLight key={`light-${phase}`} stage={trafficStage} />
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-bold ${phase === 'racing' ? 'text-accent' : 'text-bodytext'}`}>
            {isRaceSettingsOpen && phase !== 'finished' ? 'Race paused' : phase === 'racing' ? 'Go!' : 'The race is about to start!'}
          </div>
          <div className="text-xs text-mutedtext">
            {isRaceSettingsOpen && phase !== 'finished'
              ? 'Close Race Settings to resume.'
              : phase === 'racing'
                ? 'Wrong characters show red and cost accuracy — fix them or keep flowing.'
                : "It's the final countdown!"}
          </div>
          {isPreRace && (
            <div className="count-pop mt-1 font-mono text-2xl font-bold text-accent stat-tick" key={countdownLabel}>
              {countdownLabel}
            </div>
          )}
        </div>
        {isPreRace && (
          <button
            onClick={skipCountdown}
            className="shrink-0 rounded-lg border border-darkborder bg-darkbg px-3 py-1.5 text-[11px] font-bold text-mutedtext hover:text-accent hover:border-accent transition-all active:scale-95"
          >
            Skip countdown
          </button>
        )}
      </div>

      <RaceTrack racers={racers} quoteLength={quoteLength} />

      <div className={`rounded-2xl bg-darkcard border-2 border-darkborder p-4 sm:p-5 shadow-xl transition-opacity ${isPreRace ? 'opacity-60' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-darkborder">
          <span className="text-[11px] font-bold uppercase tracking-wide text-mutedtext">
            {`${quoteLength} characters • ${quoteWordCount(quoteLength).toFixed(0)} words`}
          </span>
          <button
            onClick={() => setDisplayFormat((previous) => (previous === 'paragraph' ? 'line' : 'paragraph'))}
            className="flex items-center gap-1.5 text-[11px] text-mutedtext hover:text-accent transition-colors"
            title="Toggle between the full paragraph and a single scrolling line"
          >
            <Eye className="w-3.5 h-3.5" />
            {displayFormat === 'paragraph' ? 'paragraph view' : 'single line view'} — change display format
          </button>
        </div>
        <div
          ref={quoteBoxRef}
          className={`mt-3 font-mono text-base sm:text-lg leading-loose min-h-[72px] text-left ${
            displayFormat === 'paragraph' ? 'whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'
          }`}
        >
          {quote.text.split('').map((char, index) => {
            const isTyped = index < typed.length;
            const isWrong = isTyped && typed[index] !== char;
            const isCursor = index === typed.length && phase === 'racing';
            const tone = isWrong
              ? 'text-wrongred bg-[var(--color-wrong-bg)] rounded-sm font-semibold'
              : isTyped
                ? 'text-accent font-semibold'
                : 'text-mutedtext';
            return (
              <span
                key={index}
                data-race-char={index}
                className={`${tone} ${isCursor ? 'border-b-2 border-accent' : ''}`}
              >
                {char}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          value={typed}
          onChange={handleInput}
          onPaste={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
          disabled={phase !== 'racing'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Race typing input"
          placeholder={phase === 'racing' ? 'Type the quote exactly as shown...' : 'Type the above text here when the race begins'}
          className="w-full bg-darkbg border-2 border-darkborder focus:border-accent rounded-xl px-4 py-3 font-mono text-base sm:text-lg outline-none text-bodytext placeholder:text-mutedtext shadow-inner disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
        />
        {hasError && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-wrongred animate-slide-down">
            <Car className="w-3.5 h-3.5" />
            Red characters don&#39;t stop your car — but they don&#39;t move it forward either. Backspace fixes them.
          </p>
        )}
        {phase === 'racing' && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mutedtext">
            <span>
              WPM <span className="font-mono font-bold text-accent stat-tick">{playerWpm}</span>
            </span>
            <span>
              ACC <span className="font-mono font-bold text-accent stat-tick">{liveAccuracy}%</span>
            </span>
            <span>
              Progress <span className="font-mono font-bold text-accent stat-tick">{liveProgress.toFixed(0)}%</span>
            </span>
            <span className="hidden sm:inline">
              Typed <span className="font-mono font-bold text-bodytext">{typed.length}</span>/{quoteLength}
            </span>
          </div>
        )}
      </div>

      {isRaceSettingsOpen && (
        <RaceSettingsDrawer
          onClose={() => setIsRaceSettingsOpen(false)}
          onSaved={(prefs) => {
            saveRacePrefs(prefs);
            applyRacePrefs(prefs);
            setIsRaceSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
};
