/**
 * Race Mode preferences — the only user-customizable part of Race Mode.
 *
 * Isolation: these live in their own cookie (`gorilla_racer`), never in the
 * typing-test settings object, and are applied only by the race components.
 *
 * Stored shape (v2):
 * {
 *   version: 2,
 *   player:  { name: string, color: string },
 *   guests:  [{ name, color, wpm } x3]  // wpm = the bot's target speed
 * }
 */
import { PLAYER_COLOR } from './raceEngine';

export interface RaceIdentity {
  name: string;
  color: string;
}

export interface GuestIdentity extends RaceIdentity {
  wpm: number;
}

export interface RacePrefs {
  player: RaceIdentity;
  guests: GuestIdentity[];
}

const COOKIE_KEY = 'gorilla_racer';

export const PLAYER_NAME_PLACEHOLDER = 'Guest';

const DEFAULT_PLAYER: RaceIdentity = { name: PLAYER_NAME_PLACEHOLDER, color: PLAYER_COLOR };

/** Bot colors — removed the player's orange so defaults never collide. */
const DEFAULT_GUEST_COLORS = ['#8b5cf6', '#ef4444', '#ec4899', '#84cc16', '#06b6d4', '#eab308'];

function defaultGuests(): GuestIdentity[] {
  return [1, 2, 3].map((index) => ({
    name: `Guest ${index}`,
    color: DEFAULT_GUEST_COLORS[(index - 1) % DEFAULT_GUEST_COLORS.length],
    wpm: [45, 60, 75][index - 1],
  }));
}

function defaultPrefs(): RacePrefs {
  return { player: { ...DEFAULT_PLAYER }, guests: defaultGuests() };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeIdentity(raw: unknown, fallbackName: string, fallbackColor: string): RaceIdentity {
  if (typeof raw !== 'object' || raw === null) return { name: fallbackName, color: fallbackColor };
  const record = raw as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim().slice(0, 16) : '';
  const color = typeof record.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(record.color) ? record.color : fallbackColor;
  return { name: name.length > 0 ? name : fallbackName, color };
}

/** Read prefs from the cookie, repairing anything missing or malformed. */
export function getRacePrefs(): RacePrefs {
  const fallback = defaultPrefs();
  if (typeof document === 'undefined') return fallback;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE_KEY}=`));
  if (!match) return fallback;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match.slice(COOKIE_KEY.length + 1)));
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const record = parsed as Record<string, unknown>;
    const rawGuests = Array.isArray(record.guests) ? record.guests : [];
    const guests = [0, 1, 2].map((index) => {
      const fallbackGuest = fallback.guests[index];
      const raw = rawGuests[index];
      const identity = sanitizeIdentity(raw, fallbackGuest.name, fallbackGuest.color);
      const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
      return { ...identity, wpm: clampInt(source.wpm, 5, 250, fallbackGuest.wpm) };
    });
    return { player: sanitizeIdentity(record.player, fallback.player.name, fallback.player.color), guests };
  } catch {
    return fallback;
  }
}

/** True once the player has saved customized racers (cookie exists). */
export function hasCustomRacePrefs(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE_KEY}=`));
}

/** Persist prefs (1-year cookie, same policy as the rest of the app). */
export function saveRacePrefs(prefs: RacePrefs): void {
  if (typeof document === 'undefined') return;
  const payload = JSON.stringify({ version: 2, player: prefs.player, guests: prefs.guests });
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(payload)}; max-age=31536000; path=/; SameSite=Lax`;
}

/** Hex color -> rgba() string, used for soft tints behind cars and swatches. */
export function hexTint(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = /^[0-9a-fA-F]{6}$/.test(clean) ? clean : '888888';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
