import type { UserSettings } from '../types';
import { getRandomWords } from './wordBanks';

/**
 * Word decoration ported from monkeytype's words-generator.ts. When the
 * "punctuation" toggle is on, generated words get capitals, commas, sentence
 * ends, quotes, brackets, colons and contractions ("don't", "it's"…). When
 * "numbers" is on, ~10% of words become a random 4-digit number.
 */

/** Words that monkeytype knows a contraction for — checked case-insensitively. */
const CONTRACTION_WORDS = new Set([
  'are', 'can', 'could', 'did', 'does', 'do', 'had', 'has', 'have', 'is', 'it',
  'i', 'you', 'that', 'must', 'there', 'he', 'she', 'we', 'they', 'should',
  'was', 'were', 'will', 'would', 'going',
]);

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A word with no trailing punctuation is eligible for decoration. */
function isClean(word: string): boolean {
  const last = word.charAt(word.length - 1);
  return last !== '.' && last !== ',';
}

/** Pick a contraction replacement, e.g. "you" → "you'll". */
function maybeContraction(word: string): string | null {
  if (Math.random() >= 0.5) return null;
  const bare = word.toLowerCase();
  if (!CONTRACTION_WORDS.has(bare)) return null;
  const pick = (options: string[]): string => options[Math.floor(Math.random() * options.length)];
  switch (bare) {
    case 'are': return "aren't";
    case 'can': return "can't";
    case 'could': return "couldn't";
    case 'did': return "didn't";
    case 'does': return "doesn't";
    case 'do': return "don't";
    case 'had': return "hadn't";
    case 'has': return "hasn't";
    case 'have': return "haven't";
    case 'is': return "isn't";
    case 'it': return Math.random() < 0.5 ? "it's" : "it'll";
    case 'i': return pick(["i'm", "i'll", "i've", "i'd"]);
    case 'you': return pick(["you'll", "you're", "you've", "you'd"]);
    case 'that': return pick(["that's", "that'll", "that'd"]);
    case 'must': return Math.random() < 0.5 ? "mustn't" : "must've";
    case 'there': return pick(["there's", "there'll", "there'd"]);
    case 'he': return pick(["he's", "he'll", "he'd"]);
    case 'she': return pick(["she's", "she'll", "she'd"]);
    case 'we': return pick(["we're", "we'll", "we'd"]);
    case 'they': return pick(["they're", "they'll", "they'd"]);
    case 'should': return Math.random() < 0.1 ? "shouldn't" : "should've";
    case 'was': return "wasn't";
    case 'were': return "weren't";
    case 'will': return "won't";
    case 'would': return pick(["wouldn't", "would've"]);
    case 'going': return "goin'";
    default: return null;
  }
}

/** ~10% of words become a random 4-digit number (monkeytype's rule). */
function maybeNumber(): string {
  let digits = '';
  for (let i = 0; i < 4; i++) digits += String(Math.floor(Math.random() * 10));
  return digits;
}

/**
 * Applies monkeytype's punctuateWord probabilities to one word, given the
 * word before it and its position in the stream (index of maxIndex - 1 is
 * always a sentence end, monkeytype-style).
 */
function punctuateWord(word: string, previousWord: string | undefined, index: number, maxIndex: number): string {
  // Start of the test (or right after a sentence end): capitalize.
  if (index === 0) return capitalize(word);
  const previousLast = previousWord?.charAt(previousWord.length - 1);
  if (previousLast === '.' || previousLast === '?' || previousLast === '!') return capitalize(word);

  if (index === maxIndex - 1) {
    const roll = Math.random();
    if (roll <= 0.8) return `${word}.`;
    if (roll <= 0.9) return `${word}?`;
    return `${word}!`;
  }

  if (isClean(word)) {
    // ~1% each: quotes, apostrophes, brackets, colon, dash, semicolon.
    const roll = Math.random();
    if (roll < 0.01) return `"${word}"`;
    if (roll < 0.011) return `'${word}'`;
    if (roll < 0.012) return `(${word})`;
    if (roll < 0.013) return `${word}:`;
    if (roll < 0.014) return '-';
    if (roll < 0.015) return `${word};`;

    // 20%: comma.
    if (Math.random() < 0.2) return `${word},`;
  }

  // 50%: turn supported words into contractions ("do" → "don't").
  return maybeContraction(word) ?? word;
}

/** Produces the word shown at position `index`, carrying the previous word. */
function nextWord(pool: string[], previousWord: string | undefined, index: number, maxIndex: number, punctuation: boolean, numbers: boolean): string {
  let word = pool[Math.floor(Math.random() * pool.length)];
  if (numbers && Math.random() < 0.1) return maybeNumber();
  if (punctuation) return punctuateWord(word, previousWord, index, maxIndex);
  return word;
}

/**
 * Builds the word list for a normal (non-custom) test, applying the toggles.
 * Custom text passes through untouched.
 */
export function generateWords(settings: Pick<UserSettings, 'language' | 'difficulty' | 'punctuation' | 'numbers'>, count: number): string[] {
  if (!settings.punctuation && !settings.numbers) return getRandomWords(settings.language, settings.difficulty, count);

  // Defensive filters (banks are lowercase, but the hard tier decorates words).
  let pool = getRandomWords(settings.language, settings.difficulty, count).filter((word) => {
    if (!settings.punctuation && /[.,;:"'!?()-]/.test(word)) return false;
    return !/[0-9]/.test(word);
  });
  if (pool.length === 0) pool = ['type'];

  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(nextWord(pool, words[i - 1], i, count, settings.punctuation, settings.numbers));
  }
  return words;
}
