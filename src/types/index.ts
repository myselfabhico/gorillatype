export type ThemeId =
  | 'default-dark'
  | 'nordic'
  | 'ember'
  | 'dracula'
  | 'default-light'
  | 'classic'
  | 'serene'
  | 'parchment';

export type LanguageId =
  | 'english'
  | 'english-advanced'
  | 'spanish'
  | 'french'
  | 'german'
  | 'italian'
  | 'portuguese'
  | 'russian'
  | 'code';

export type DifficultyMode = 'easy' | 'medium' | 'hard';

export type KeyboardSoundId = 'standard' | 'mute';

export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type AppMode =
  | 'typing-test'
  | 'text-practice'
  | 'custom';

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  createdAt: string;
  testsCompleted: number;
  bestWpm: number;
  averageWpm: number;
  averageAccuracy: number;
  totalKeystrokes: number;
  history: TestRecord[];
}

export interface TestRecord {
  id: string;
  date: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  keystrokes: {
    correct: number;
    wrong: number;
    total: number;
  };
  correctWords: number;
  wrongWords: number;
  mode: AppMode;
  difficulty: DifficultyMode;
  language: LanguageId;
  duration: number;
  /** Keystroke outcome counts, MonkeyType style: correct / incorrect / extra / missed. */
  charStats?: { correct: number; incorrect: number; extra: number; missed: number };
  /** Words whose mistakes were fully fixed with backspace before submission. */
  correctedWords?: number;
  /** Individual keystrokes that were fixed with backspace inside those words. */
  correctedKeys?: number;
  /** Steady-pace score, 0..100 — how evenly the test was typed. */
  consistency?: number;
}

/** One entry of the "problem keys" report shown on every fifth test. */
export interface KeyInsight {
  /** The character that should have been typed (' ' for space). */
  key: string;
  /** Times it was pressed wrong in the tracked window. */
  wrong: number;
  /** The wrong key most often typed instead, if any. */
  instead: string | null;
  /** How many times that wrong key was typed instead. */
  insteadCount: number;
  /** Times the key was skipped/dropped entirely (word submitted without it). */
  missed: number;
}

export interface UserSettings {
  theme: ThemeId;
  keyboardSound: KeyboardSoundId;
  /** Keyboard sound volume, 0..1. */
  keyboardVolume: number;
  websiteSfx: boolean;
  /** Whether the Backspace key may be used to fix mistakes while typing. */
  backspaceEnabled: boolean;
  fontSize: FontSize;
  duration: number;
  showTimer: boolean;
  showChart: boolean;
  showCaret: boolean;
  /** Monkeytype-style decoration of generated words (capitals, commas, quotes…). */
  punctuation: boolean;
  /** Monkeytype-style chance for some words to be replaced by a 4-digit number. */
  numbers: boolean;
  difficulty: DifficultyMode;
  language: LanguageId;
  smoothScroll: boolean;
  showKeyboard: boolean;
  showHands: boolean;
  showFingerZones: boolean;
}

export interface KeystrokePoint {
  second: number;
  wpm: number;
  rawWpm: number;
  /** Errors made within this one-second slice (not cumulative). */
  errors: number;
  /** Instant speed of that slice in WPM — the "burst" line on the results chart. */
  burst: number;
}

export interface DailyGoal {
  date: string;
  minutes: number;
  typedSeconds: number;
  completed: boolean;
}


