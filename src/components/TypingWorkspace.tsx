import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, CompositionEvent } from 'react';
import { RefreshCw, Settings, ChevronDown, Clock, AlertTriangle, MousePointerClick } from 'lucide-react';
import type { UserSettings, TestRecord, KeystrokePoint } from '../types';
import { getRandomWords } from '../utils/wordBanks';
import { calculateWpm, calculateRawWpm, calculateAccuracy } from '../utils/stats';
import { findKeyForChar } from '../utils/keyboardLayout';
import { soundManager } from '../utils/sound';
import { VirtualKeyboard } from './VirtualKeyboard';
import type { KeyboardPress } from './VirtualKeyboard';

interface TypingWorkspaceProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onFinishTest: (record: TestRecord, historyPoints: KeystrokePoint[]) => void;
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
    words: (customWords?.length ? customWords : getRandomWords(settings.language, settings.difficulty, 300)).map((word): WordStatus => ({ word })),
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
     backspacePresses: 0,
     elapsed: 0,
     idleWarning: false,
     history: [] as KeystrokePoint[],
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
    // Every keypress counts, including backspaces — deleting never restores accuracy.
    accuracy: calculateAccuracy(session.correctAttempts, session.correctAttempts + session.wrongAttempts + session.backspacePresses),
  };
}

export function TypingWorkspace(props: TypingWorkspaceProps) {
  const [restart, setRestart] = useState(0);
  const { settings, customText, mode } = props;
  const key = JSON.stringify([settings.language, settings.difficulty, settings.duration, customText, mode, restart]);
  return <TypingSession key={key} {...props} onRestart={() => setRestart((value) => value + 1)} />;
}

function TypingSession({ settings, customText, mode = 'typing-test', blocked = false, onUpdateSettings, onFinishTest, onToggleSettingsBar, isSettingsOpen, onOpenLanguageModal, onRestart, onTestActiveChange }: TypingWorkspaceProps & { onRestart: () => void }) {
  const [view, setView] = useState(() => createSession(settings, customText));
  const sessionRef = useRef(view);
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const composingRef = useRef(false);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [nextChar, setNextChar] = useState<string | null>(null);
  const [press, setPress] = useState<KeyboardPress | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const pressSeq = useRef(0);
  const latestRef = useRef({ settings, blocked, onFinishTest, onRestart, mode, onTestActiveChange });

  useLayoutEffect(() => {
    latestRef.current = { settings, blocked, onFinishTest, onRestart, mode, onTestActiveChange };
  }, [settings, blocked, onFinishTest, onRestart, mode, onTestActiveChange]);

  useEffect(() => {
    setPortalRoot(document.getElementById('virtual-keyboard-root'));
    const first = sessionRef.current.words[0]?.word;
    setNextChar(first ? Array.from(first)[0] ?? null : null);
  }, []);

  useEffect(() => {
    // A fresh session (mount, reset button, idle reset, difficulty change) means no test is running.
    onTestActiveChange?.(false);
  }, [onTestActiveChange]);

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
    setNextChar(null);
    session.idleWarning = false;
    const { settings: currentSettings, onFinishTest: complete, mode: currentMode } = latestRef.current;
    const metrics = getMetrics(session, session.elapsed);
    const point = { second: session.elapsed, wpm: metrics.wpm, rawWpm: metrics.rawWpm, errors: session.wrongAttempts };
    session.history = [...session.history.filter((item) => item.second < point.second), point];
    const partial = session.input.length > 0;
    const matches = partial && session.input === session.words[session.index]?.word;
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
    };
    publish();
    if (currentSettings.websiteSfx) soundManager.playFinishSound();
    complete(record, [...session.history]);
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
        session.history.push({ second: elapsed, wpm: metrics.wpm, rawWpm: metrics.rawWpm, errors: session.wrongAttempts });
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
        onUpdateSettings({ difficulty: settings.difficulty === 'normal' ? 'advanced' : 'normal' });
      } else if (event.key === 'Tab' && !event.shiftKey && (target === document.body || target === canvasRef.current)) {
        event.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
      } else if (event.key === 'Escape' && target === inputRef.current) {
        inputRef.current?.blur();
      } else if (event.key === 'Backspace') {
        const session = sessionRef.current;
        if (session.startedAt !== null && !session.finished) session.backspacePresses++;
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
    let lastChar = '';
    let lastCorrect = false;
    for (const char of Array.from(inserted)) {
      const correct = char === (targetChars[position] ?? (position === targetChars.length ? ' ' : ''));
      if (correct) session.correctAttempts++;
      else session.wrongAttempts++;
      lastChar = char;
      lastCorrect = correct;
      position++;
    }
    if (lastChar) {
      const stroke = findKeyForChar(lastChar);
      if (stroke) setPress({ id: stroke.key.id, correct: lastCorrect, seq: ++pressSeq.current });
    }
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
        if (settings.websiteSfx) soundManager.playWordSuccess();
      } else {
        session.wrongWords++;
        if (settings.websiteSfx) soundManager.playWordWrong();
      }
      session.totalCharacters += typed.length + 1;
      session.words[session.index] = { word: target, typedText: session.input };
      session.index++;
      session.input = '';
      if (!session.finite && session.index >= session.words.length - 50) {
        session.words.push(...getRandomWords(settings.language, settings.difficulty, 300).map((word) => ({ word })));
      }
    }
    const upcoming = session.words[session.index]?.word;
    let next: string | null = null;
    if (upcoming !== undefined) {
      next = submitted
        ? Array.from(upcoming)[0] ?? null
        : session.input === target
          ? ' '
          : Array.from(upcoming)[Array.from(session.input).length] ?? ' ';
    }
    setNextChar(next);
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
  const fontClasses = { xs: 'text-base leading-relaxed', sm: 'text-lg leading-relaxed', md: 'text-xl md:text-2xl leading-loose', lg: 'text-2xl md:text-3xl leading-loose', xl: 'text-3xl md:text-4xl leading-loose' };
  const chartPoints = [{ second: 0, wpm: 0, rawWpm: 0, errors: 0 }, ...view.history];
  const maximum = Math.max(30, ...chartPoints.map((point) => point.rawWpm));
  const chartPath = (field: 'wpm' | 'rawWpm') => chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${10 + point.second / Math.max(1, view.elapsed) * 580} ${110 - point[field] / maximum * 100}`).join(' ');
  const buttonClass = 'p-1.5 bg-darkcard hover:bg-darkbg text-mutedtext hover:text-accent rounded-lg border border-darkborder hover:border-accent transition-all shadow-sm';

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-2 select-none" inert={blocked}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <button onClick={onOpenLanguageModal} className={`${buttonClass} flex items-center gap-2 px-3 text-xs font-semibold`}>
          <span className="capitalize">{mode === 'custom' ? 'Custom text' : settings.language.replace('-', ' ')}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-darkcard p-0.5 rounded-lg border border-darkborder text-xs font-semibold">
            {(['normal', 'advanced'] as const).map((difficulty) => (
              <button key={difficulty} onClick={() => onUpdateSettings({ difficulty })} className={`px-3 py-1 rounded-md capitalize ${settings.difficulty === difficulty ? 'bg-darkbg text-accent border-b-2 border-accent font-bold' : 'text-mutedtext hover:text-bodytext'}`}>{difficulty}</button>
            ))}
          </div>
          <div role="group" aria-label="Live typing speed" title="Live words per minute" className="flex items-baseline gap-1.5 px-3 py-1 bg-darkbg border border-darkborder rounded-lg font-mono">
            <span data-testid="live-wpm" className="min-w-[3ch] text-right text-lg font-bold tabular-nums text-accent">{metrics.wpm}</span>
            <span className="text-xs font-semibold text-mutedtext">WPM</span>
          </div>
          {settings.showTimer && <div className="flex items-center gap-1.5 px-3 py-1 bg-darkbg border border-darkborder rounded-lg font-mono font-bold text-accent text-sm"><Clock className="w-3.5 h-3.5 text-mutedtext" /><span>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span></div>}
          <button onClick={onRestart} className={buttonClass} title="Restart Test (F1)" aria-label="Restart Test"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={onToggleSettingsBar} className={`${buttonClass} ${isSettingsOpen ? 'text-accent border-accent' : ''}`} title="Toggle Settings Bar" aria-label="Settings"><Settings className="w-4 h-4" /></button>
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
      }} className="relative w-full bg-darkcard border-2 border-darkborder rounded-2xl p-6 md:p-8 shadow-2xl cursor-text overflow-hidden">
        {view.idleWarning && <div role="status" className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-wrongred text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4" /><span>Keep typing! The test will reset in 5 seconds.</span></div>}
        <div className="relative">
          {!isFocused && !blocked && <div onClick={() => inputRef.current?.focus({ preventScroll: true })} className="absolute inset-0 z-10 bg-darkbg/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-bodytext cursor-pointer"><MousePointerClick className="w-8 h-8 text-accent" /><span>Click here to continue (or press TAB)</span></div>}
          <div ref={wordsContainerRef} className={`relative w-full h-32 overflow-hidden font-mono ${fontClasses[settings.fontSize]} flex content-start flex-wrap gap-x-3 gap-y-2 tracking-wide text-left`}>
            {view.words.map((item, index) => {
              const current = index === view.index;
              const showCaretEl = settings.showCaret && isFocused;
              if (!current) {
                const typedChars = Array.from(item.typedText ?? '');
                return (
                  <span key={index} className="max-w-full break-all">
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
        <div className="mt-6 pt-5 border-t border-darkborder flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 text-xs text-mutedtext font-medium">Type in the paragraph above — it captures your keystrokes directly.</div>
          <button onClick={onRestart} className={`${buttonClass} px-5 py-3 flex items-center gap-2 text-sm font-bold`} title="Restart Test"><RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Reset</span></button>
        </div>
      </div>
      <div className="mt-4 bg-darkcard border border-darkborder rounded-xl p-4">
        <div className="flex flex-wrap justify-between gap-3 text-xs text-mutedtext font-mono"><span>WPM <strong className="text-accent">{metrics.wpm}</strong></span><span>Raw <strong className="text-bodytext">{metrics.rawWpm}</strong></span><span>Accuracy <strong className="text-accent">{metrics.accuracy}%</strong></span><span>Errors <strong className="text-wrongred">{view.wrongAttempts}</strong></span></div>
        {settings.showChart && <svg viewBox="0 0 600 120" role="img" aria-label="Live WPM and raw WPM chart" className="w-full h-32 mt-3"><path d="M 10 110 H 590" fill="none" stroke="var(--color-border)" /><path d={chartPath('rawWpm')} fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeDasharray="4 2" /><path d={chartPath('wpm')} fill="none" stroke="var(--color-accent)" strokeWidth="3" /></svg>}
      </div>
      {portalRoot && createPortal(
        <VirtualKeyboard nextChar={nextChar} press={press} settings={settings} onUpdateSettings={onUpdateSettings} />,
        portalRoot,
      )}
    </div>
  );
}
