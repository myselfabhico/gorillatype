import type { FC, UIEvent, CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { X, Target, Check, Trash2 } from 'lucide-react';
import type { DailyGoal } from '../types';

interface GoalModalProps {
  goal: DailyGoal | null;
  typedSeconds: number;
  onSetGoal: (minutes: number) => void;
  onClearGoal: () => void;
  onClose: () => void;
}

const MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 480, 600];
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const SNAPSHOT_MS = 120;

export const GoalModal: FC<GoalModalProps> = ({ goal, typedSeconds, onSetGoal, onClearGoal, onClose }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => (goal?.minutes && MINUTE_OPTIONS.includes(goal.minutes) ? goal.minutes : 15));
  const initialIndex = Math.max(0, MINUTE_OPTIONS.indexOf(selected));

  // Center the initial selection once the list is mounted (modal mounts on open).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      listRef.current?.scrollTo({ top: initialIndex * ITEM_HEIGHT, behavior: 'instant' as ScrollBehavior });
    }, SNAPSHOT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSeconds = goal?.minutes ? goal.minutes * 60 : 0;
  const progress = totalSeconds > 0 ? Math.min(100, Math.round((typedSeconds / totalSeconds) * 100)) : 0;
  const pickerHeight = ITEM_HEIGHT * VISIBLE_ITEMS;
  const padStyle = { height: (pickerHeight - ITEM_HEIGHT) / 2 };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const index = Math.round(event.currentTarget.scrollTop / ITEM_HEIGHT);
    const clamped = Math.min(MINUTE_OPTIONS.length - 1, Math.max(0, index));
    setSelected(MINUTE_OPTIONS[clamped]);
  };

  const handleSelect = (minutes: number) => {
    setSelected(minutes);
    const index = MINUTE_OPTIONS.indexOf(minutes);
    listRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden select-none animate-fade-in" role="dialog" aria-modal="true" aria-label="Daily goal settings">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[min(92vw,380px)] bg-darkcard border border-darkborder rounded-2xl p-6 shadow-2xl animate-goal-pop text-bodytext">
        <div className="flex items-center justify-between pb-4 border-b border-darkborder">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accentmuted border border-accent flex items-center justify-center">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight leading-none">Daily Goal</h3>
              <p className="text-[11px] text-mutedtext mt-1">Pick your typing time for today</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close daily goal" className="p-1.5 rounded-lg bg-darkbg hover:bg-darkborder text-mutedtext hover:text-bodytext transition-all active:scale-90 group">
            <X className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
          </button>
        </div>

        {goal && (
          <div className="mt-4 bg-darkbg border border-darkborder rounded-xl px-4 py-3 flex items-center justify-between gap-3 stagger-item" style={{ '--stagger-i': 1 } as CSSProperties}>
            <div className="text-xs text-mutedtext leading-relaxed">
              <span className="font-semibold text-bodytext">Today:</span> {goal.completed ? 'completed 🎉' : `${Math.floor(typedSeconds / 60)}m ${Math.floor(typedSeconds % 60)}s typed`}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-24 h-1.5 rounded-full bg-darkborder overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="font-mono text-[11px] font-bold text-accent">{progress}%</span>
            </div>
          </div>
        )}

        <div className="mt-4 stagger-item" style={{ '--stagger-i': 2 } as CSSProperties}>
          <div className="relative rounded-xl border border-darkborder bg-darkbg overflow-hidden" style={{ height: pickerHeight }}>
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[44px] bg-accentmuted border-y border-accent/60 pointer-events-none z-10" />
            <div ref={listRef} onScroll={handleScroll} className="h-full overflow-y-scroll no-scrollbar snap-y snap-mandatory">
              <div style={padStyle} />
              {MINUTE_OPTIONS.map((minutes) => {
                const isSelected = selected === minutes;
                return (
                  <div
                    key={minutes}
                    onClick={() => handleSelect(minutes)}
                    className={`h-[44px] snap-always flex items-center justify-center font-mono font-bold cursor-pointer transition-all duration-150 ${isSelected ? 'text-accent text-xl scale-105' : 'text-mutedtext text-base'}`}
                    title={`Select ${minutes} minutes`}
                  >
                    {minutes}
                    <span className={`ml-1.5 text-[11px] font-semibold ${isSelected ? 'text-accent' : 'text-mutedtext'}`}>min</span>
                  </div>
                );
              })}
              <div style={padStyle} />
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-mutedtext">Scroll or tap a value — the highlighted number is selected</p>
        </div>

        <div className="mt-5 flex items-center gap-2.5 stagger-item" style={{ '--stagger-i': 3 } as CSSProperties}>
          <button
            onClick={() => { onSetGoal(selected); onClose(); }}
            className="btn-shine glow-accent flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accenthover text-black font-bold text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
            Set Goal
          </button>
          {goal && (
            <button
              onClick={() => { onClearGoal(); onClose(); }}
              className="p-3 rounded-xl bg-darkbg border border-darkborder hover:border-wrongred text-mutedtext hover:text-wrongred transition-all hover:scale-105 active:scale-90"
              title="Remove today's goal"
              aria-label="Remove daily goal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
