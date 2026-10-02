import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';
import { RefreshCw, Settings, ChevronDown, Clock, AlertTriangle, MousePointerClick, AtSign, Hash } from 'lucide-react';
import type { UserSettings, TestRecord, KeystrokePoint } from '../types';
import { generateWords } from '../utils/wordModifiers';
import { calculateWpm, calculateRawWpm, calculateAccuracy } from '../utils/stats';
import { recordWrongKey, recordMissedKey } from '../utils/keyInsights';
import type { KeyMistakeStore } from '../utils/keyInsights';
import { soundManager } from '../utils/sound';
import { findKeyForChar } from '../utils/keyboardLayout';
import { VirtualKeyboard } from './VirtualKeyboard';
import type { KeyboardPress } from './VirtualKeyboard';
import { KeyboardSettings } from './KeyboardSettings';

interface TypingWorkspaceProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onFinishTest: (record: TestRecord, historyPoints: KeystrokePoint[], keyMistakes: KeyMistakeStore) => void;
  onToggleSettingsBar: () => void;
  isSettingsOpen: boolean;
  onOpenLanguageModal: () => void;
  customText?: string;
  mode?: 'typing-test' | 'custom';
  blocked?: boolean;
  /** Reports whether a test is currently running (first keystroke starts it; every session reset clears it). */
  onTestActiveChange?: (active: boolean) => void;
}

interface WordStatus {
  word: string;
  typedText?: string;
}

function createSession(settings: UserSettings, customText?: string) {
  const customWords = customText?.trim().split(/\s+/).filter(Boolean);
  return {
    words: (customWords?.length ? customWords : generateWords(settings, 300)).map((word): WordStatus => ({ word })),
    finite: Boolean(customWords?.length),
    index: 0,
    input: '',
    startedAt: null as number | null,
    lastActivity: 0,
    finished: false,
    correctAttempts: 0,
    wrongAttempts: 0,
    correctCharacters: 0,
    totalCharacters: 0,
    correctWords: 0,
    wrongWords: 0,
    /** Words that contained mistakes but were fully fixed before submission. */
    correctedWords: 0,
    correctedKeys: 0,
    /** Wrong/extra keypresses made in the current word (backspace-reversible). */
    wordMistakeCount: 0,
    /** Outcome of every keystroke in the current word, so backspace can undo them. */
    wordKeyLog: [] as Array<'correct' | 'wrong' | 'extra'>,
    elapsed: 0,
    idleWarning: false,
    history: [] as KeystrokePoint[],
    charStats: { correct: 0, incorrect: 0, extra: 0, missed: 0 },
    lastErrorTotal: 0,
    burstTotal: 0,
    lastSampleAt: 0,
    keyMistakes: { wrong: {}, missed: {} } as KeyMistakeStore,
  };
}

type Session = ReturnType<typeof createSession>;

function getMetrics(session: Session, elapsed: number) {
  const target = Array.from(session.words[session.index]?.word ?? '');
  const typed = Array.from(session.input);
  // MonkeyType net WPM: only characters of words without uncorrected errors
  // count. The word in progress counts provisionally while it is still perfect.
  const currentWordPerfect = typed.length <= target.length && typed.every((char, index) => char === target[index]);
  const netChars = session.correctCharacters + (currentWordPerfect ? typed.length : 0);
  const rawChars = session.totalCharacters + typed.length;
  return {
    wpm: calculateWpm(netChars, elapsed),
    rawWpm: calculateRawWpm(rawChars, elapsed),
    // Accuracy reflects the FINAL text: mistakes erased with backspace are
    // removed from both counters, so a corrected word costs nothing.
    accuracy: calculateAccuracy(session.correctAttempts, session.correctAttempts + session.wrongAttempts),
  };
}

export function TypingWorkspace(props: TypingWorkspaceProps) {
  const [restart, setRestart] = useState(0);
  const { settings, customText, mode } = props;
  const key = JSON.stringify([settings.language, settings.difficulty, settings.duration, settings.punctuation, settings.numbers, customText, mode, restart]);
  return <TypingSession key={key} {...props} onRestart={() => setRestart((value) => value + 1)} />;
}

function TypingSession({ settings, customText, mode = 'typing-test', blocked = false, onUpdateSettings, onFinishTest, onToggleSettingsBar, isSettingsOpen, onOpenLanguageModal, onRestart, onTestActiveChange }: TypingWorkspaceProps & { onRestart: () => void }) {
  const [view, setView] = useState(() => createSession(settings, customText));
  const sessionRef = useRef(view);
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  // Drives the virtual keyboard: which key the test is asking for, and the last
  // physical key that was struck (for the cap dip / error tint).
  const [press, setPress] = useState<KeyboardPress | null>(null);
  const pressSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const composingRef = useRef(false);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  // Brief ok/bad flash on the word that was just submitted.
  const [flash, setFlash] = useState<{ index: number; ok: boolean } | null>(null);
  const latestRef = useRef({ settings, blocked, onFinishTest, onRestart, mode, onTestActiveChange });

  useLayoutEffect(() => {
    latestRef.current = { settings, blocked, onFinishTest, onRestart, mode, onTestActiveChange };
  }, [settings, blocked, onFinishTest, onRestart, mode, onTestActiveChange]);

  useEffect(() => {
    // A fresh session (mount, reset button, idle reset, difficulty change) means no test is running.
    onTestActiveChange?.(false);
  }, [onTestActiveChange]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  // The keyboard only needs the keystroke long enough to play its cap dip.
  useEffect(() => {
    if (!press) return;
    const timer = window.setTimeout(() => setPress(null), 150);
    return () => window.clearTimeout(timer);
  }, [press]);

  const publish = useCallback(() => {
    const session = sessionRef.current;
    setView({ ...session, words: [...session.words], history: [...session.history] });
  }, []);

  const finish = useCallback((elapsed: number) => {
    const session = sessionRef.current;
    if (session.finished || session.startedAt === null) return;
    session.finished = true;
    latestRef.current.onTestActiveChange?.(false);
    session.elapsed = Math.max(0.001, elapsed);
    session.idleWarning = false;
    const { settings: currentSettings, onFinishTest: complete, mode: currentMode } = latestRef.current;
    const metrics = getMetrics(session, session.elapsed);
    const sliceErrors = Math.max(0, session.wrongAttempts - session.lastErrorTotal);
    session.lastErrorTotal = session.wrongAttempts;
    // Burst: per-minute rate of the keystrokes typed since the last sample.
    const finishNow = session.startedAt + session.elapsed * 1000;
    const windowSec = session.lastSampleAt > 0 ? Math.max(0.2, (finishNow - session.lastSampleAt) / 1000) : Math.min(session.elapsed, 1);
    const finalBurst = session.burstTotal > 0 ? Math.round((session.burstTotal / windowSec / 5) * 60) : session.history.at(-1)?.burst ?? 0;
    const point = { second: session.elapsed, wpm: metrics.wpm, rawWpm: metrics.rawWpm, errors: sliceErrors, burst: finalBurst };
    session.history = [...session.history.filter((item) => item.second < point.second), point];
    // Missed characters: the untyped tail of an unfinished word that already contains an error.
    const partialTarget = Array.from(session.words[session.index]?.word ?? '');
    const partialPerfect = session.input.length <= partialTarget.length && Array.from(session.input).every((char, index) => char === partialTarget[index]);
    if (session.input.length > 0 && !partialPerfect) {
      session.charStats.missed += Math.max(0, partialTarget.length - session.input.length);
      // Track WHICH keys were skipped — same attribution as mid-test word submissions.
      for (let i = session.input.length; i < partialTarget.length; i++) recordMissedKey(session.keyMistakes, partialTarget[i]);
    }
    // Consistency: 100 minus the coefficient of variation of the per-second net speeds.
    const samples = session.history.map((item) => item.wpm).filter((value) => value > 0);
    let consistency = 100;
    if (samples.length >= 2) {
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
      consistency = Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(variance) / mean) * 100)));
    }
    const partial = session.input.length > 0;
    const matches = partial && session.input === session.words[session.index]?.word;
    if (matches && session.wordMistakeCount > 0) {
      session.correctedWords++;
      session.correctedKeys += session.wordMistakeCount;
      session.wordMistakeCount = 0;
      session.wordKeyLog = [];
    }
    const record: TestRecord = {
      id: 'test_' + Date.now(),
      date: new Date().toISOString(),
      ...metrics,
      keystrokes: { correct: session.correctAttempts, wrong: session.wrongAttempts, total: session.correctAttempts + session.wrongAttempts },
      correctWords: session.correctWords + Number(matches),
      wrongWords: session.wrongWords + Number(partial && !matches),
      mode: currentMode,
      difficulty: currentSettings.difficulty,
      language: currentSettings.language,
      duration: Math.round(session.elapsed * 10) / 10,
      charStats: { ...session.charStats },
      consistency,
      correctedWords: session.correctedWords,
      correctedKeys: session.correctedKeys,
    };
    publish();
    if (currentSettings.websiteSfx) soundManager.playFinishSound();
    complete(record, [...session.history], session.keyMistakes);
  }, [publish]);

  useEffect(() => {
    if (settings.duration <= 0) return;
    const timer = window.setInterval(() => {
      const session = sessionRef.current;
      if (session.startedAt === null || session.finished) {
        return;
      }
      const now = performance.now();
      const elapsed = (now - session.startedAt) / 1000;
      const duration = latestRef.current.settings.duration;
      if (elapsed >= duration) {
        finish(duration);
        return;
      }
      const idle = now - session.lastActivity;
      if (idle >= 12000) {
        session.finished = true;
        latestRef.current.onRestart();
        return;
      }
      session.elapsed = elapsed;
      session.idleWarning = idle >= 7000;
      const last = session.history.at(-1);
      if (elapsed >= 1 && (!last || Math.floor(elapsed) > Math.floor(last.second))) {
        const metrics = getMetrics(session, elapsed);
        const sliceErrors = Math.max(0, session.wrongAttempts - session.lastErrorTotal);
        session.lastErrorTotal = session.wrongAttempts;
        // Burst: raw speed of the slice since the previous sample (0 while idle).
        const nowMs = session.startedAt + elapsed * 1000;
        const windowSec = session.lastSampleAt > 0 ? Math.max(0.2, (nowMs - session.lastSampleAt) / 1000) : Math.min(elapsed, 1);
        const burst = session.burstTotal > 0 ? Math.round((session.burstTotal / windowSec / 5) * 60) : 0;
        session.history.push({ second: elapsed, wpm: metrics.wpm, rawWpm: metrics.rawWpm, errors: sliceErrors, burst });
        session.burstTotal = 0;
        session.lastSampleAt = nowMs;
      }
      publish();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finish, publish, settings.duration]);

  useEffect(() => {
    if (blocked) {
      inputRef.current?.blur();
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (!latestRef.current.blocked && (document.activeElement === document.body || document.activeElement === canvasRef.current)) {
        inputRef.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [blocked]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (blocked || event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target !== inputRef.current && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'F1') {
        event.preventDefault();
        onRestart();
      } else if (event.key === 'F2') {
        event.preventDefault();
        onUpdateSettings({ showTimer: !settings.showTimer });
      } else if (event.key === 'F3') {
        event.preventDefault();
        onUpdateSettings({ difficulty: settings.difficulty === 'easy' ? 'medium' : settings.difficulty === 'medium' ? 'hard' : 'easy' });
      } else if (event.key === 'Tab' && !event.shiftKey && (target === document.body || target === canvasRef.current)) {
        event.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
      } else if (event.key === 'Escape' && target === inputRef.current) {
        inputRef.current?.blur();
      } else if (event.key === 'Backspace') {
        if (!settings.backspaceEnabled) event.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blocked, onRestart, onUpdateSettings, settings.showTimer, settings.difficulty, settings.backspaceEnabled]);

  useLayoutEffect(() => {
    const scrollToCaret = () => {
      const container = wordsContainerRef.current;
      const marker = caretRef.current;
      if (!container || !marker) return;
      const box = container.getBoundingClientRect();
      const position = marker.getBoundingClientRect();
      const top = position.top - box.top + container.scrollTop;
      const lineHeight = parseFloat(getComputedStyle(container).lineHeight) || position.height;
      const desired = Math.max(0, top - lineHeight);
      container.scrollTo({ top: desired, behavior: settings.smoothScroll ? 'smooth' : 'auto' });
      if (position.left < box.left || position.right > box.right) {
        container.scrollLeft += position.left - box.left - box.width / 2;
      }
    };
    scrollToCaret();
    const observer = new ResizeObserver(scrollToCaret);
    if (wordsContainerRef.current) observer.observe(wordsContainerRef.current);
    return () => observer.disconnect();
  }, [view.index, view.input, caret, settings.fontSize, settings.smoothScroll]);

  const applyInput = (value: string, selection: number | null, inputType = '') => {
    const session = sessionRef.current;
    if (blocked || session.finished || /paste|drop|history/i.test(inputType)) return;
    const now = performance.now();
    if (session.startedAt !== null && now - session.startedAt >= settings.duration * 1000) {
      finish(settings.duration);
      return;
    }
    // Backspace disabled: swallow all deletion edits (and Ctrl+Z history undo) outright.
    if (inputType.startsWith('delete') && !latestRef.current.settings.backspaceEnabled) return;
    const previous = session.input;
    const range = selectionRef.current;
    selectionRef.current = null;
    let start = 0;
    let end = value.length;
    if (range && value.startsWith(previous.slice(0, range.start)) && value.endsWith(previous.slice(range.end)) && value.length >= previous.length - (range.end - range.start)) {
      start = range.start;
      end = value.length - (previous.length - range.end);
    } else {
      while (start < previous.length && start < value.length && previous[start] === value[start]) start++;
      let oldEnd = previous.length;
      while (oldEnd > start && end > start && previous[oldEnd - 1] === value[end - 1]) {
        oldEnd--;
        end--;
      }
    }
    const inserted = inputType.startsWith('delete') ? '' : value.slice(start, end);
    if (!previous && !value.trim()) {
      setDraft('');
      return;
    }
    if (session.startedAt === null && inserted.length === 0) return;
    if (session.startedAt === null) {
      session.startedAt = now;
      session.lastSampleAt = now;
      onTestActiveChange?.(true);
    }
    const wasIdle = now - session.lastActivity > 5000;
    if (wasIdle && inserted.length > 0) {
      session.lastActivity = now;
    }
    session.idleWarning = false;
    session.elapsed = (now - session.startedAt) / 1000;
    const target = session.words[session.index]?.word;
    if (target === undefined) return;
    const targetChars = Array.from(target);
    let position = Array.from(value.slice(0, start)).length;
    let lastKeyId: string | null = null;
    let lastCorrect = false;
    for (const char of Array.from(inserted)) {
      const isExtra = position > targetChars.length;
      const expected = position === targetChars.length ? ' ' : targetChars[position] ?? '';
      const correct = !isExtra && char === expected;
      const pressedKey = findKeyForChar(char);
      if (pressedKey) {
        lastKeyId = pressedKey.key.id;
        lastCorrect = correct;
      }
      if (isExtra) {
        session.charStats.extra++;
        session.wordMistakeCount++;
        session.wordKeyLog.push('extra');
      }
      else if (correct) {
        session.charStats.correct++;
        session.correctAttempts++;
        session.wordKeyLog.push('correct');
      }
      else {
        session.charStats.incorrect++;
        session.wrongAttempts++;
        session.wordMistakeCount++;
        session.wordKeyLog.push('wrong');
        // Attribute the slip to the key that SHOULD have been pressed.
        if (expected && expected !== ' ') recordWrongKey(session.keyMistakes, expected, char);
        else if (expected === ' ') recordWrongKey(session.keyMistakes, ' ', char);
      }
      session.burstTotal++;
      position++;
    }
    // A deletion erases the newest characters of the current word — undo their
    // recorded outcomes so a fully corrected word leaves zero mistakes behind.
    const deletedCount = Math.max(0, Array.from(previous).length - Array.from(value).length);
    for (let i = 0; i < deletedCount; i++) {
      const outcome = session.wordKeyLog.pop();
      if (outcome === 'correct') {
        session.charStats.correct--;
        session.correctAttempts--;
      } else if (outcome === 'wrong') {
        session.charStats.incorrect--;
        session.wrongAttempts--;
      } else if (outcome === 'extra') {
        session.charStats.extra--;
      }
    }
    if (lastKeyId) setPress({ id: lastKeyId, correct: lastCorrect, seq: ++pressSeq.current });
    if (inserted && settings.keyboardSound !== 'mute') {
      void soundManager.playKey();
    }
    const submitted = inserted.endsWith(' ') && value.endsWith(' ');
    session.input = submitted ? value.slice(0, -1) : value;
    const lastWord = session.finite && session.index === session.words.length - 1;
    if (lastWord && (submitted || session.input === target)) {
      setDraft(session.input);
      publish();
      if (submitted && session.input === target && settings.websiteSfx) soundManager.playWordSuccess();
      finish((now - session.startedAt) / 1000);
      return;
    }
    if (submitted) {
      const typed = Array.from(session.input);
      const correct = session.input === target;
      // MonkeyType: a correct word contributes all its characters plus the
      // trailing space to net WPM; a word containing an uncorrected error
      // contributes nothing (the space still counts toward raw WPM).
      if (correct) {
        session.correctCharacters += typed.length + 1;
        session.correctWords++;
        // Mistakes existed in this word but the submitted text is perfect —
        // they must have been fixed with backspace. Credit the word as corrected.
        if (session.wordMistakeCount > 0) {
          session.correctedWords++;
          session.correctedKeys += session.wordMistakeCount;
        }
        if (settings.websiteSfx) soundManager.playWordSuccess();
      } else {
        session.wrongWords++;
        // MonkeyType: characters of a failed word that were never typed count as missed.
        const skipped = Math.max(0, targetChars.length - typed.length);
        session.charStats.missed += skipped;
        // Track WHICH keys were skipped, for the problem-key report.
        for (let i = typed.length; i < targetChars.length; i++) recordMissedKey(session.keyMistakes, targetChars[i]);
        if (settings.websiteSfx) soundManager.playWordWrong();
      }
      session.totalCharacters += typed.length + 1;
      session.burstTotal++; // the space keypress belongs to the burst window
      session.words[session.index] = { word: target, typedText: session.input };
      setFlash({ index: session.index, ok: correct });
      session.index++;
      session.input = '';
      session.wordMistakeCount = 0;
      session.wordKeyLog = [];
      if (!session.finite && session.index >= session.words.length - 50) {
        session.words.push(...generateWords(settings, 300).map((word) => ({ word })));
      }
    }
    setDraft(session.input);
    setCaret(submitted ? 0 : (selection ?? session.input.length));
    publish();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (composingRef.current) {
      setDraft(event.target.value);
      return;
    }
    applyInput(event.target.value, event.target.selectionStart, (event.nativeEvent as InputEvent).inputType);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    applyInput(event.currentTarget.value, event.currentTarget.selectionStart);
  };

  const timeLeft = Math.max(0, Math.ceil(settings.duration - view.elapsed));
  const metrics = getMetrics(view, view.elapsed);
  // The word viewport always shows exactly three full lines (plus a 4px
  // sliver of the next, like monkeytype) no matter the font size or the
  // user's browser zoom: the height is derived from the line-height itself
  // (6em for `leading-loose`, 4.875em for `leading-relaxed`) plus the two
  // 8px flex row gaps. Fixed pixel heights drift with zoom; em does not.
  const fontClasses = { xs: 'text-base leading-relaxed h-[calc(4.875em_+_1.25rem)]', sm: 'text-lg leading-relaxed h-[calc(4.875em_+_1.25rem)]', md: 'text-xl md:text-2xl leading-loose h-[calc(6em_+_1.25rem)]', lg: 'text-2xl md:text-3xl leading-loose h-[calc(6em_+_1.25rem)]', xl: 'text-3xl md:text-4xl leading-loose h-[calc(6em_+_1.25rem)]' };
  const chartPoints = [{ second: 0, wpm: 0, rawWpm: 0, errors: 0, burst: 0 }, ...view.history];
  const maximum = Math.max(30, ...chartPoints.map((point) => point.rawWpm));
  const chartPath = (field: 'wpm' | 'rawWpm') => chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${10 + point.second / Math.max(1, view.elapsed) * 580} ${110 - point[field] / maximum * 100}`).join(' ');
  const buttonClass = 'p-1.5 bg-darkcard hover:bg-darkbg text-mutedtext hover:text-accent rounded-lg border border-darkborder hover:border-accent transition-all shadow-sm active:scale-95';
  // What the board should light up: the next character of the current word, or a
  // space once the word is complete. Null before the test produces anything.
  const nextChar = view.finished ? null : (() => {
    const chars = Array.from(view.words[view.index]?.word ?? '');
    if (chars.length === 0) return null;
    const typed = Array.from(view.input).length;
    return typed >= chars.length ? ' ' : chars[typed] ?? ' ';
  })();

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-2 select-none" inert={blocked}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 [@media(max-height:830px)]:mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onOpenLanguageModal} className={`${buttonClass} flex items-center gap-2 px-3 text-xs font-semibold`}>
            <span className="capitalize">{mode === 'custom' ? 'Custom text' : settings.language.replace('-', ' ')}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {mode !== 'custom' && (
            <div role="group" aria-label="Word modifiers" className="flex items-center gap-1 bg-darkcard p-0.5 rounded-lg border border-darkborder text-xs font-semibold">
              <button onClick={() => onUpdateSettings({ punctuation: !settings.punctuation })} aria-pressed={settings.punctuation} title="Add capitals, commas and sentence punctuation (regenerates the test)" className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${settings.punctuation ? 'bg-darkbg text-accent border-b-2 border-accent font-bold' : 'text-mutedtext hover:text-bodytext'}`}><AtSign className="w-3.5 h-3.5" />punctuation</button>
              <button onClick={() => onUpdateSettings({ numbers: !settings.numbers })} aria-pressed={settings.numbers} title="Replace some words with 4-digit numbers (regenerates the test)" className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${settings.numbers ? 'bg-darkbg text-accent border-b-2 border-accent font-bold' : 'text-mutedtext hover:text-bodytext'}`}><Hash className="w-3.5 h-3.5" />numbers</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-darkcard p-0.5 rounded-lg border border-darkborder text-xs font-semibold">
            {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
              <button key={difficulty} onClick={() => onUpdateSettings({ difficulty })} className={`px-3 py-1 rounded-md capitalize ${settings.difficulty === difficulty ? 'bg-darkbg text-accent border-b-2 border-accent font-bold' : 'text-mutedtext hover:text-bodytext'}`}>{difficulty}</button>
            ))}
          </div>
          <div role="group" aria-label="Live typing speed" title="Live words per minute" className="flex items-baseline gap-1.5 px-3 py-1 bg-darkbg border border-darkborder rounded-lg font-mono">
            <span data-testid="live-wpm" key={metrics.wpm} className="min-w-[3ch] text-right text-lg font-bold tabular-nums text-accent stat-tick">{metrics.wpm}</span>
            <span className="text-xs font-semibold text-mutedtext">WPM</span>
          </div>
          {settings.showTimer && <div className="flex items-center gap-1.5 px-3 py-1 bg-darkbg border border-darkborder rounded-lg font-mono font-bold text-accent text-sm"><Clock className="w-3.5 h-3.5 text-mutedtext" /><span>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span></div>}
          <button onClick={onRestart} className={`${buttonClass} group`} title="Restart Test (F1)" aria-label="Restart Test"><RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" /></button>
          <button onClick={onToggleSettingsBar} className={`${buttonClass} group ${isSettingsOpen ? 'text-accent border-accent' : ''}`} title="Toggle Settings Bar" aria-label="Settings"><Settings className="w-4 h-4 transition-transform duration-500 group-hover:rotate-90" /></button>
        </div>
      </div>
      <input
        ref={inputRef}
        aria-label="Typing input"
        className="sr-only-absolute"
        type="text"
        value={draft}
        onChange={handleChange}
        onBeforeInput={(event) => {
          selectionRef.current = { start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 };
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={handleCompositionEnd}
        onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} onDragOver={(event) => event.preventDefault()}
        onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} disabled={blocked || view.finished}
      />
      <div ref={canvasRef} tabIndex={-1} onClick={(event) => {
        if (!blocked && !(event.target as HTMLElement).closest('button')) inputRef.current?.focus({ preventScroll: true });
      }} className={`relative w-full bg-darkcard border-2 border-darkborder rounded-2xl p-6 md:p-8 shadow-2xl cursor-text overflow-hidden animate-rise-in typing-card ${isFocused ? 'typing-card-focused' : ''}`}>
        {view.idleWarning && <div role="status" className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-wrongred text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4" /><span>Keep typing! The test will reset in 5 seconds.</span></div>}
        <div className="relative">
          {!isFocused && !blocked && <div onClick={() => inputRef.current?.focus({ preventScroll: true })} className="absolute inset-0 z-10 bg-darkbg/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-bodytext cursor-pointer animate-fade-in"><MousePointerClick className="w-8 h-8 text-accent float-y" /><span>Click here to continue (or press TAB)</span></div>}
          <div ref={wordsContainerRef} className={`relative w-full overflow-hidden font-mono ${fontClasses[settings.fontSize]} flex content-start flex-wrap gap-x-3 gap-y-2 tracking-wide text-left [mask-image:linear-gradient(to_bottom,black_calc(100%_-_16px),transparent)]`}>
            {view.words.map((item, index) => {
              const current = index === view.index;
              const showCaretEl = settings.showCaret && isFocused;
              if (!current) {
                const typedChars = Array.from(item.typedText ?? '');
                return (
                  <span key={index} className={`max-w-full break-all ${flash?.index === index ? (flash.ok ? 'word-flash-ok' : 'word-flash-bad') : ''}`}>
                    {Array.from(item.word).map((char, charIndex) => {
                      const typedChar = typedChars[charIndex];
                      return <span key={charIndex} className={typedChar === undefined ? 'text-mutedtext' : typedChar === char ? 'text-accent' : 'text-wrongred'}>{char}</span>;
                    })}
                    {typedChars.length > item.word.length && <span className="text-wrongred">{typedChars.slice(item.word.length).join('')}</span>}
                  </span>
                );
              }
              const typedChars = Array.from(view.input);
              const caretCharIndex = Math.min(Array.from(view.input.slice(0, caret)).length, typedChars.length);
              const extras = typedChars.length > item.word.length ? typedChars.slice(item.word.length).join('') : '';
              return (
                <span key={index} className="relative max-w-full break-all">
                  {Array.from(item.word).map((char, charIndex) => {
                    const typedChar = typedChars[charIndex];
                    const isWrong = typedChar !== undefined && typedChar !== char;
                    return (
                      <span key={charIndex} className="relative">
                        {charIndex === caretCharIndex && <span ref={caretRef} aria-hidden="true" className={`absolute left-0 top-0 h-full border-l-2 ${showCaretEl ? 'border-accent caret-pulse' : 'border-transparent'}`} />}
                        <span className={typedChar === undefined ? 'text-mutedtext/40' : isWrong ? 'text-wrongred' : 'text-accent'}>{char}</span>
                      </span>
                    );
                  })}
                  {extras ? (
                    <span className="relative text-wrongred">
                      {extras}
                      <span ref={caretRef} aria-hidden="true" className={`absolute right-0 top-0 h-full border-l-2 ${showCaretEl ? 'border-accent caret-pulse' : 'border-transparent'}`} />
                    </span>
                  ) : caretCharIndex >= item.word.length && (
                    <span ref={caretRef} aria-hidden="true" className={`absolute right-0 top-0 h-full border-l-2 ${showCaretEl ? 'border-accent caret-pulse' : 'border-transparent'}`} />
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-darkborder flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 text-xs text-mutedtext font-medium">Type in the paragraph above — it captures your keystrokes directly.</div>
          <button onClick={onRestart} className={`${buttonClass} px-5 py-3 flex items-center gap-2 text-sm font-bold group`} title="Restart Test"><RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" /><span className="hidden sm:inline">Reset</span></button>
        </div>
      </div>
      {/* The stats strip that used to sit here is gone; the card is now just the
          optional speed curve, so it only takes up room when that is switched on. */}
      {settings.showChart && (
        <div className="mt-5 [@media(max-height:830px)]:mt-3 bg-darkcard border-2 border-darkborder rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="relative">
            {view.history.length > 0 ? (
              <svg viewBox="0 0 600 120" role="img" aria-label="Live WPM and raw WPM chart" className="w-full h-32"><path d="M 10 110 H 590" fill="none" stroke="var(--color-border)" /><path d={chartPath('rawWpm')} fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeDasharray="4 2" /><path d={chartPath('wpm')} fill="none" stroke="var(--color-accent)" strokeWidth="3" /></svg>
            ) : (
              <div className="h-32 flex items-center justify-center border-b border-darkborder text-xs text-mutedtext/70">your speed curve appears here as you type</div>
            )}
          </div>
        </div>
      )}
      {/* The board is ~73% of the rail wide in the reference layout, and sits one
          comfortable gap below the stats card. Its settings chip lives in the row
          underneath, out of the artwork, so it can never cover a key or a hand. */}
      {settings.showKeyboard && (
        <div className="mx-auto mt-9 [@media(max-height:830px)]:mt-5 w-full max-w-[606px]">
          <div
            className="relative"
            onClick={() => { if (!blocked) inputRef.current?.focus({ preventScroll: true }); }}
          >
            <VirtualKeyboard nextChar={nextChar} press={press} showHands={settings.showHands} colorZones={settings.colorZones} />
          </div>
          <div className="mt-2 flex items-center justify-end">
            <KeyboardSettings settings={settings} onUpdateSettings={onUpdateSettings} />
          </div>
        </div>
      )}
    </div>
  );
}
