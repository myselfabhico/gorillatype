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
  /** Steady-pace score, 0..100 — how evenly the test was typed. */
  consistency?: number;
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


