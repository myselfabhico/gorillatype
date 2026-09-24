import { useState, useRef, useEffect, useCallback } from 'react';
import type { DailyGoal } from '../types';
import { getGoalCookie, saveGoalCookie, rollGoalToToday, getTodayKey } from '../utils/cookies';
import { soundManager } from '../utils/sound';

/** Pause the goal timer after this much inactivity. */
const IDLE_PAUSE_MS = 4000;
const TICK_MS = 250;
const SAVE_THROTTLE_MS = 10000;

export interface DailyGoalState {
  goal: DailyGoal | null;
  typedSeconds: number;
  /** True while the 4s idle countdown is NOT expired and typing has started. */
  running: boolean;
  /** True once the user has pressed a key since the goal was set (timer started). */
  started: boolean;
  /** Victory screen is visible. */
  celebrating: boolean;
  /** Goal hit mid-test; victory waits for the test to finish. */
  waitingForTest: boolean;
  setGoal: (minutes: number) => void;
  clearGoal: () => void;
  dismissVictory: () => void;
}

function isTypingKey(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const ignored = new Set([
    'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ContextMenu', 'NumLock', 'ScrollLock', 'Pause', 'Insert', 'PrintScreen',
  ]);
  if (ignored.has(event.key)) return false;
  if (/^F\d{1,2}$/.test(event.key)) return false;
  return true;
}

export function useDailyGoal(options: { testInProgress: boolean; soundEnabled: boolean }): DailyGoalState {
  const { testInProgress, soundEnabled } = options;
  const [goal, setGoalState] = useState<DailyGoal | null>(() => rollGoalToToday(getGoalCookie()));
  const [typedSeconds, setTypedSeconds] = useState(() => goal?.typedSeconds ?? 0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [waitingForTest, setWaitingForTest] = useState(false);

  const goalRef = useRef<DailyGoal | null>(goal);
  const lastActivityRef = useRef(0);
  const lastSaveRef = useRef(0);
  const waitingRef = useRef(false);
  const latestRef = useRef({ testInProgress, soundEnabled });

  useEffect(() => {
    latestRef.current = { testInProgress, soundEnabled };
  }, [testInProgress, soundEnabled]);

  const persist = useCallback((force = false) => {
    const current = goalRef.current;
    if (!current) return;
    const now = performance.now();
    if (!force && now - lastSaveRef.current < SAVE_THROTTLE_MS) return;
    lastSaveRef.current = now;
    saveGoalCookie(current);
  }, []);

  const startCelebration = useCallback(() => {
    setCelebrating(true);
    if (latestRef.current.soundEnabled) soundManager.playVictorySound();
  }, []);

  // Completion + rollover tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = goalRef.current;
      if (!current) return;
      // New day -> reset progress, keep the same goal minutes.
      if (current.date !== getTodayKey()) {
        const rolled: DailyGoal = { ...current, date: getTodayKey(), typedSeconds: 0, completed: false };
        goalRef.current = rolled;
        setGoalState(rolled);
        setTypedSeconds(0);
        saveGoalCookie(rolled);
        lastActivityRef.current = 0;
        setStarted(false);
        setRunning(false);
        return;
      }
      if (current.completed) return;
      const now = performance.now();
      const active = lastActivityRef.current > 0 && now - lastActivityRef.current < IDLE_PAUSE_MS;
      setRunning(active);
      if (active) {
        current.typedSeconds = Math.min(current.minutes * 60, current.typedSeconds + TICK_MS / 1000);
        setTypedSeconds(current.typedSeconds);
        persist();
        if (current.typedSeconds >= current.minutes * 60) {
          current.completed = true;
          setRunning(false);
          saveGoalCookie(current);
          if (latestRef.current.testInProgress) {
            waitingRef.current = true;
            setWaitingForTest(true);
          } else {
            startCelebration();
          }
        }
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [persist, startCelebration]);

  // Waiting for an in-progress test to finish -> celebrate once it does.
  useEffect(() => {
    if (waitingRef.current && !testInProgress) {
      waitingRef.current = false;
      setWaitingForTest(false);
      startCelebration();
    }
  }, [testInProgress, startCelebration]);

  // Keystroke activity: starts, resumes, and feeds the 4s idle watchdog.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || !isTypingKey(event)) return;
      const current = goalRef.current;
      if (!current || current.completed) return;
      lastActivityRef.current = performance.now();
      setStarted(true);
      setRunning(true);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Flush progress when the tab is hidden or closed.
  useEffect(() => {
    const flush = () => persist(true);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('beforeunload', flush);
      persist(true);
    };
  }, [persist]);

  const setGoal = useCallback((minutes: number) => {
    const fresh: DailyGoal = { date: getTodayKey(), minutes, typedSeconds: 0, completed: false };
    goalRef.current = fresh;
    lastActivityRef.current = 0;
    lastSaveRef.current = 0;
    waitingRef.current = false;
    setGoalState(fresh);
    setTypedSeconds(0);
    setStarted(false);
    setRunning(false);
    setWaitingForTest(false);
    setCelebrating(false);
    saveGoalCookie(fresh);
  }, []);

  const clearGoal = useCallback(() => {
    goalRef.current = null;
    lastActivityRef.current = 0;
    waitingRef.current = false;
    setGoalState(null);
    setTypedSeconds(0);
    setStarted(false);
    setRunning(false);
    setWaitingForTest(false);
    setCelebrating(false);
    saveGoalCookie(null);
  }, []);

  const dismissVictory = useCallback(() => setCelebrating(false), []);

  return { goal, typedSeconds, running, started, celebrating, waitingForTest, setGoal, clearGoal, dismissVictory };
}
