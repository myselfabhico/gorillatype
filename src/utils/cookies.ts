import Cookies from 'js-cookie';
import type { UserProfile, UserSettings, TestRecord, ThemeId, DailyGoal } from '../types';
import type { KeyMistakeStore } from './keyInsights';

const PROFILE_COOKIE_KEY = 'gorillatype_user_profile';
const SETTINGS_COOKIE_KEY = 'gorillatype_user_settings';
const GOAL_COOKIE_KEY = 'gorillatype_daily_goal';
const KEY_STORE_COOKIE_KEY = 'gorillatype_key_mistakes';
const options = { expires: 365, sameSite: 'lax' as const, path: '/', secure: location.protocol === 'https:' };

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'default-dark', keyboardSound: 'standard', keyboardVolume: 0.7, websiteSfx: true, backspaceEnabled: true,
  fontSize: 'md', duration: 60,
  showTimer: true, showChart: true, showCaret: true,
  punctuation: false, numbers: false,
  difficulty: 'easy', language: 'english', smoothScroll: true,
  showKeyboard: true, showHands: true, showFingerZones: false,
};

export const DEFAULT_PROFILE: UserProfile = {
  id: crypto.randomUUID(), username: 'GorillaTypist', avatar: 'IO',
  createdAt: new Date().toISOString(), testsCompleted: 0, bestWpm: 0,
  averageWpm: 0, averageAccuracy: 0, totalKeystrokes: 0, history: [],
};

function readCookie(key: string): unknown {
  try {
    return JSON.parse(Cookies.get(key) || 'null');
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTest(value: unknown): value is TestRecord {
  if (!isRecord(value) || !isRecord(value.keystrokes)) return false;
  return ['id', 'date', 'mode', 'difficulty', 'language'].every(key => typeof value[key] === 'string')
    && ['wpm', 'rawWpm', 'accuracy', 'correctWords', 'wrongWords', 'duration'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number(value[key]) >= 0)
    && ['correct', 'wrong', 'total'].every(key => typeof (value.keystrokes as Record<string, unknown>)[key] === 'number');
}

export function getProfileCookie(): UserProfile {
  const value = readCookie(PROFILE_COOKIE_KEY);
  if (!isRecord(value)) return { ...DEFAULT_PROFILE, history: [] };
  const profile = { ...DEFAULT_PROFILE, history: [] } as UserProfile;
  for (const key of ['id', 'username', 'avatar', 'createdAt'] as const) {
    if (typeof value[key] === 'string') profile[key] = value[key].slice(0, 100);
  }
  for (const key of ['testsCompleted', 'bestWpm', 'averageWpm', 'averageAccuracy', 'totalKeystrokes'] as const) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0) profile[key] = value[key];
  }
  profile.history = Array.isArray(value.history) ? value.history.filter(isTest).slice(0, 10) : [];
  return profile;
}

export function saveProfileCookie(profile: UserProfile): void {
  const saved = { ...profile, history: profile.history.slice(0, 10) };
  while (encodeURIComponent(JSON.stringify(saved)).length > 3500 && saved.history.length) saved.history.pop();
  Cookies.set(PROFILE_COOKIE_KEY, JSON.stringify(saved), options);
}

export function addTestRecordToProfile(record: TestRecord): UserProfile {
  const profile = getProfileCookie();
  const count = profile.testsCompleted;
  profile.averageWpm = Math.round((profile.averageWpm * count + record.wpm) / (count + 1));
  profile.averageAccuracy = Math.round((profile.averageAccuracy * count + record.accuracy) / (count + 1) * 10) / 10;
  profile.testsCompleted++;
  profile.bestWpm = Math.max(profile.bestWpm, record.wpm);
  profile.totalKeystrokes += record.keystrokes.total;
  profile.history = [record, ...profile.history];
  saveProfileCookie(profile);
  return getProfileCookie();
}

export function getSettingsCookie(): UserSettings {
  const value = readCookie(SETTINGS_COOKIE_KEY);
  const settings = { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) return settings;
  const allowed: Record<string, string[]> = {
    theme: ['default-dark', 'nordic', 'ember', 'dracula', 'default-light', 'classic', 'serene', 'parchment'],
    keyboardSound: ['standard', 'mute'],
    fontSize: ['xs', 'sm', 'md', 'lg', 'xl'],
    difficulty: ['easy', 'medium', 'hard'],
    language: ['english', 'english-advanced', 'spanish', 'french', 'german', 'italian', 'portuguese', 'russian', 'code'],
  };
  for (const key of Object.keys(allowed) as Array<keyof typeof allowed>) {
    if (typeof value[key] === 'string' && allowed[key].includes(value[key])) Object.assign(settings, { [key]: value[key] });
  }
  // Migration: users with the old `sound` cookie keep their on/off preference.
  if (value.keyboardSound === undefined && 'sound' in value) {
    settings.keyboardSound = value.sound === 'mute' ? 'mute' : 'standard';
  }
  for (const key of ['websiteSfx', 'backspaceEnabled'] as const) {
    if (typeof value[key] === 'boolean') settings[key] = value[key];
  }
  if (typeof value.keyboardVolume === 'number' && Number.isFinite(value.keyboardVolume) && value.keyboardVolume >= 0 && value.keyboardVolume <= 1) settings.keyboardVolume = value.keyboardVolume;
  for (const key of ['showTimer', 'showChart', 'showCaret', 'smoothScroll', 'showKeyboard', 'showHands', 'showFingerZones', 'punctuation', 'numbers'] as const) {
    if (typeof value[key] === 'boolean') settings[key] = value[key];
  }
  if (typeof value.duration === 'number' && Number.isInteger(value.duration) && value.duration >= 15 && value.duration <= 1800) settings.duration = value.duration;
  return settings;
}

export function saveSettingsCookie(settings: UserSettings): void {
  Cookies.set(SETTINGS_COOKIE_KEY, JSON.stringify(settings), options);
}

export function getThemeCookie(): ThemeId {
  return getSettingsCookie().theme;
}

export function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getGoalCookie(): DailyGoal | null {
  const value = readCookie(GOAL_COOKIE_KEY);
  if (!isRecord(value) || typeof value.date !== 'string' || typeof value.minutes !== 'number') return null;
  const minutes = value.minutes;
  const typedSeconds = typeof value.typedSeconds === 'number' && Number.isFinite(value.typedSeconds) && value.typedSeconds >= 0 ? value.typedSeconds : 0;
  const goal: DailyGoal = {
    date: value.date,
    minutes: Number.isInteger(minutes) && minutes >= 1 && minutes <= 600 ? minutes : 0,
    typedSeconds,
    completed: value.completed === true,
  };
  if (goal.minutes === 0 || goal.typedSeconds > goal.minutes * 60) return null;
  return goal;
}

export function saveGoalCookie(goal: DailyGoal | null): void {
  if (!goal) {
    Cookies.remove(GOAL_COOKIE_KEY, { path: '/' });
    return;
  }
  Cookies.set(GOAL_COOKIE_KEY, JSON.stringify(goal), options);
}

/* ---------- per-key mistake accumulator (drives the every-5th-test report) ---------- */

function isKeyMistakeStore(value: unknown): value is KeyMistakeStore {
  if (!isRecord(value) || !isRecord(value.wrong) || !isRecord(value.missed)) return false;
  for (const entry of Object.values(value.wrong)) {
    if (!isRecord(entry) || typeof entry.wrong !== 'number' || !isRecord(entry.typed)) return false;
  }
  return Object.values(value.missed).every((count) => typeof count === 'number');
}

export function getKeyMistakeStore(): KeyMistakeStore {
  const value = readCookie(KEY_STORE_COOKIE_KEY);
  return isKeyMistakeStore(value) ? value : { wrong: {}, missed: {} };
}

export function saveKeyMistakeStore(store: KeyMistakeStore): void {
  Cookies.set(KEY_STORE_COOKIE_KEY, JSON.stringify(store), options);
}

/** Clears the accumulator after a milestone report has been shown. */
export function clearKeyMistakeStore(): void {
  Cookies.set(KEY_STORE_COOKIE_KEY, JSON.stringify({ wrong: {}, missed: {} }), options);
}

export function rollGoalToToday(goal: DailyGoal | null): DailyGoal | null {
  if (!goal) return null;
  const today = getTodayKey();
  if (goal.date === today) return goal;
  const rolled: DailyGoal = { ...goal, date: today, typedSeconds: 0, completed: false };
  saveGoalCookie(rolled);
  return rolled;
}
