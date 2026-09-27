/**
 * Race Mode engine — pure, self-contained race math and racer construction.
 *
 * Everything here is intentionally independent from the typing-test timer and
 * word-list logic: a race is one fixed quote plus a set of lane positions.
 *
 * The formulas mirror TypeRacer's, which is what this mode is modelled on:
 *   - one "word" is 5 characters (never space-separated words)
 *   - live / final WPM = (correct chars / 5) / elapsed minutes
 *   - accuracy         = correct keystrokes / all keystrokes (fixes still cost)
 *   - points           = words in quote * final WPM
 *   - start speed      = 12000 / milliseconds until the first keystroke
 */

export const CHARS_PER_WORD = 5;

/** Speed the race clock is generous against — nobody can stall forever. */
export const SLOWEST_RACER_WPM = 20;

/** Bot speed wobble: how far a bot may drift from its target WPM. */
const MIN_BOT_DRIFT = 0.88;
const MAX_BOT_DRIFT = 1.12;

import type { GuestIdentity } from './racePrefs';

export const PLAYER_COLOR = '#f97316';

const BOT_COLORS = ['#8b5cf6', '#ef4444', '#ec4899', '#84cc16', '#06b6d4', '#eab308'];

export interface BotPlan {
  name: string;
  color: string;
  targetWpm: number;
}

export interface Racer {
  id: string;
  name: string;
  color: string;
  isPlayer: boolean;
  /** Bot target speed in WPM (0 for the player). */
  targetWpm: number;
  /** Characters of the quote completed (for the player: correctly typed chars). */
  chars: number;
  /** Live WPM shown next to the lane. */
  wpm: number;
  finished: boolean;
  /** 1-based finishing place, locked in the moment the racer crosses the line. */
  rank: number | null;
  /** Elapsed milliseconds at the moment the racer finished. */
  finishMs: number | null;
  /** Internal random-walk factor that keeps bot motion from looking robotic. */
  drift: number;
}

/** One "word" is 5 characters — the industry-standard unit TypeRacer uses. */
export function quoteWordCount(quoteLength: number): number {
  return quoteLength / CHARS_PER_WORD;
}

export function computeWpm(chars: number, elapsedMs: number): number {
  if (chars <= 0 || elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60000;
  return Math.round(chars / CHARS_PER_WORD / minutes);
}

export function computeAccuracy(correctKeys: number, totalKeys: number): number {
  if (totalKeys <= 0) return 100;
  return Math.round((correctKeys / totalKeys) * 100);
}

/** TypeRacer's start-speed formula: how fast the racer reacted to the green light. */
export function computeStartSpeed(msToFirstKey: number): number {
  if (msToFirstKey <= 0) return 0;
  return Math.round(12000 / msToFirstKey);
}

/** Points reward both speed and quote length, exactly like TypeRacer. */
export function computePoints(quoteLength: number, finalWpm: number): number {
  return Math.round(quoteWordCount(quoteLength) * finalWpm);
}

export function progressPercent(chars: number, quoteLength: number): number {
  if (quoteLength <= 0) return 0;
  return Math.min(100, Math.max(0, (chars / quoteLength) * 100));
}

/**
 * Time cap for a race: roughly twice what a slow (20 WPM) typist would need,
 * which is the same generous allowance TypeRacer gives its racers.
 */
export function timeLimitSeconds(quoteLength: number): number {
  const words = quoteWordCount(quoteLength);
  return Math.max(60, Math.round((words / SLOWEST_RACER_WPM) * 60 * 2));
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ordinal(place: number): string {
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
}

function randomInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Fallback field (used before the player customizes guests): varied tiers. */
function createDefaultBotPlans(): BotPlan[] {
  const tiers = [randomInt(16, 28), randomInt(34, 52), randomInt(40, 70), randomInt(62, 95)];
  const count = Math.random() < 0.5 ? 3 : 4;
  const colors = shuffled(BOT_COLORS).slice(0, count);
  return tiers.slice(0, count).map((targetWpm, index) => ({
    name: `Guest ${index + 1}`,
    color: colors[index],
    targetWpm,
  }));
}

/**
 * Build the bot field. If the user has customized their guests in Race
 * Settings, those three identities race with the configured speeds (plus a
 * small ±8% roll per race so it is never a pure constant-speed affair).
 * Otherwise a fresh randomized field is drawn.
 */
export function createBotPlans(guests?: GuestIdentity[]): BotPlan[] {
  if (!guests || guests.length === 0) return createDefaultBotPlans();
  return guests.map((guest) => ({
    name: guest.name,
    color: guest.color,
    targetWpm: Math.max(5, Math.round(guest.wpm * (0.92 + Math.random() * 0.16))),
  }));
}

/** Build the starting grid: the player is always pinned to the top lane. */
export function createRacers(player: { name: string; color: string }, plans: BotPlan[]): Racer[] {
  const hero: Racer = {
    id: 'player',
    name: `${player.name} (you)`,
    color: player.color,
    isPlayer: true,
    targetWpm: 0,
    chars: 0,
    wpm: 0,
    finished: false,
    rank: null,
    finishMs: null,
    drift: 1,
  };
  const bots: Racer[] = plans.map((plan, index) => ({
    id: `bot-${index}`,
    name: plan.name,
    color: plan.color,
    isPlayer: false,
    targetWpm: plan.targetWpm,
    chars: 0,
    wpm: 0,
    finished: false,
    rank: null,
    finishMs: null,
    drift: 1,
  }));
  return [hero, ...bots];
}

function clampDrift(value: number): number {
  return Math.min(MAX_BOT_DRIFT, Math.max(MIN_BOT_DRIFT, value));
}

/**
 * Advance one bot by `deltaSec` seconds. Bots move at a roughly constant speed
 * with a small random walk on top, so their cars glide instead of stepping
 * perfectly linearly. Pure aside from the jitter roll.
 */
export function stepBot(racer: Racer, deltaSec: number, quoteLength: number): Racer {
  if (racer.isPlayer || racer.finished) return racer;
  const drift = clampDrift(racer.drift + (Math.random() - 0.5) * 0.14);
  const charsPerSecond = ((racer.targetWpm * CHARS_PER_WORD) / 60) * drift;
  const chars = Math.min(quoteLength, racer.chars + charsPerSecond * deltaSec);
  return { ...racer, chars, drift };
}

/**
 * Close out a race: every racer that crossed the line keeps the place it locked
 * in, and everyone still on the track is ordered behind them by how far they
 * had travelled. Ranks are therefore strictly finish-order based.
 */
export function rankUnfinished(racers: Racer[], nextRank: number): Racer[] {
  const pending = racers
    .filter((racer) => !racer.finished)
    .sort((a, b) => b.chars - a.chars);
  const rankById = new Map<string, number>();
  pending.forEach((racer, index) => rankById.set(racer.id, nextRank + index));
  return racers.map((racer) =>
    racer.finished ? racer : { ...racer, rank: rankById.get(racer.id) ?? nextRank },
  );
}

export function sortByFinishOrder(racers: Racer[]): Racer[] {
  return [...racers].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
}
