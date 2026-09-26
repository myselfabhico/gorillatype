import type { KeyInsight } from '../types';

/**
 * Accumulated per-key mistake data, persisted in a compact cookie.
 * wrong[key] = times the user pressed a different key where `key` belonged.
 * wrong[key].typed[other] = times `other` was typed where `key` belonged.
 * missed[key] = times `key` was skipped entirely (its word submitted without it).
 */
export interface KeyMistakeStore {
  wrong: Record<string, { wrong: number; typed: Record<string, number> }>;
  missed: Record<string, number>;
}

const MAX_TRACKED_KEYS = 24;

/** Compacts the store so the cookie stays small: keeps the noisiest keys only. */
function compact(store: KeyMistakeStore): KeyMistakeStore {
  const wrongEntries = Object.entries(store.wrong).sort((a, b) => b[1].wrong - a[1].wrong).slice(0, MAX_TRACKED_KEYS);
  const missedEntries = Object.entries(store.missed).sort((a, b) => b[1] - a[1]).slice(0, MAX_TRACKED_KEYS);
  const wrong: KeyMistakeStore['wrong'] = {};
  for (const [key, entry] of wrongEntries) {
    const typedEntries = Object.entries(entry.typed).sort((a, b) => b[1] - a[1]).slice(0, 4);
    wrong[key] = { wrong: entry.wrong, typed: Object.fromEntries(typedEntries) };
  }
  return { wrong, missed: Object.fromEntries(missedEntries) };
}

/** Adds one occurrence: `expected` was needed but `typed` was pressed instead. */
export function recordWrongKey(store: KeyMistakeStore, expected: string, typed: string): void {
  if (!expected || !typed || expected === typed) return;
  const entry = store.wrong[expected] ?? { wrong: 0, typed: {} };
  entry.wrong += 1;
  entry.typed[typed] = (entry.typed[typed] ?? 0) + 1;
  store.wrong[expected] = entry;
}

/** Adds one occurrence: `expected` was needed but never typed at all. */
export function recordMissedKey(store: KeyMistakeStore, expected: string): void {
  if (!expected || expected === ' ') return;
  store.missed[expected] = (store.missed[expected] ?? 0) + 1;
}

/** Merges one test's per-key mistakes into the persistent store. */
export function mergeMistakes(store: KeyMistakeStore, test: KeyMistakeStore): KeyMistakeStore {
  const merged: KeyMistakeStore = { wrong: {}, missed: { ...store.missed } };
  for (const [key, entry] of Object.entries(store.wrong)) {
    merged.wrong[key] = { wrong: entry.wrong, typed: { ...entry.typed } };
  }
  for (const [key, entry] of Object.entries(test.wrong)) {
    const existing = merged.wrong[key] ?? { wrong: 0, typed: {} };
    existing.wrong += entry.wrong;
    for (const [typed, count] of Object.entries(entry.typed)) {
      existing.typed[typed] = (existing.typed[typed] ?? 0) + count;
    }
    merged.wrong[key] = existing;
  }
  for (const [key, count] of Object.entries(test.missed)) {
    merged.missed[key] = (merged.missed[key] ?? 0) + count;
  }
  return compact(merged);
}

/**
 * Ranks the accumulated store and returns the top five problem keys.
 * Score = wrong presses + half a point per missed occurrence, so keys the
 * user both mistypes and skips surface first.
 */
export function getTopKeyInsights(store: KeyMistakeStore, limit = 5): KeyInsight[] {
  const insights: KeyInsight[] = [];
  for (const [key, entry] of Object.entries(store.wrong)) {
    insights.push({
      key,
      wrong: entry.wrong,
      instead: topEntry(entry.typed),
      insteadCount: 0,
      missed: store.missed[key] ?? 0,
    });
  }
  for (const [key, count] of Object.entries(store.missed)) {
    if (!store.wrong[key]) {
      insights.push({ key, wrong: 0, instead: null, insteadCount: 0, missed: count });
    }
  }
  for (const insight of insights) {
    if (insight.instead) {
      insight.insteadCount = store.wrong[insight.key]?.typed[insight.instead] ?? 0;
    }
  }
  return insights
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

function score(insight: KeyInsight): number {
  return insight.wrong + insight.missed * 0.5;
}

function topEntry(typed: Record<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [typedKey, count] of Object.entries(typed)) {
    if (count > bestCount) {
      best = typedKey;
      bestCount = count;
    }
  }
  return best;
}

const DISPLAY: Record<string, string> = {
  ' ': 'Space',
};

function displayKey(key: string): string {
  return DISPLAY[key] ?? key;
}

/** Human advice for one insight line. */
export function keyAdvice(insight: KeyInsight): string {
  const key = displayKey(insight.key);
  if (insight.instead && insight.insteadCount > 0) {
    const instead = displayKey(insight.instead);
    return `You tend to press "${instead}" when "${key}" is needed — slow down on that finger reach and aim one key over.`;
  }
  if (insight.wrong > 0) {
    return `"${key}" trips you up in different ways — rehearse its exact finger position before the next test.`;
  }
  return `You keep skipping "${key}" — make sure to finish each word fully before moving on.`;
}

/** One short summary line for the whole panel (1-2 sentences). */
export function panelSummary(insights: KeyInsight[], store: KeyMistakeStore): string {
  if (insights.length === 0) return 'Clean set — no weak keys detected. Keep this rhythm going!';
  const worst = insights[0];
  const missedTotal = Object.values(store.missed).reduce((sum, count) => sum + count, 0);
  const wrongTotal = Object.values(store.wrong).reduce((sum, entry) => sum + entry.wrong, 0);
  if (missedTotal > wrongTotal) {
    return `${worst.key === ' ' ? 'Space' : `"${worst.key}"`} is your biggest weak spot — most mistakes were skipped keys, so focus on completing every word.`;
  }
  if (worst.instead) {
    return `Your main habit: pressing "${worst.instead}" where ${worst.key === ' ' ? 'Space' : `"${worst.key}"`} belongs. Drill that reach and accuracy climbs fast.`;
  }
  return `${worst.key === ' ' ? 'Space' : `"${worst.key}"`} caused the most errors this set — target it in your next practice.`;
}
