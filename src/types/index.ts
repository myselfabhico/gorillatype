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

export type DifficultyMode = 'normal' | 'advanced';

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
  errors: number;
}

export interface DailyGoal {
  date: string;
  minutes: number;
  typedSeconds: number;
  completed: boolean;
}


