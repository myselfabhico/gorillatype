import type { FC } from 'react';
import { Pause, Check } from 'lucide-react';

interface GoalRingProps {
  goalMinutes: number;
  typedSeconds: number;
  running: boolean;
  started: boolean;
  completed: boolean;
  onOpenGoal: () => void;
}

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GoalRing: FC<GoalRingProps> = ({ goalMinutes, typedSeconds, running, started, completed, onOpenGoal }) => {
  const totalSeconds = goalMinutes * 60;
  const progress = totalSeconds > 0 ? Math.min(1, typedSeconds / totalSeconds) : 0;
  const remaining = Math.max(0, totalSeconds - typedSeconds);
  const paused = started && !running && !completed;
  const arcColor = completed ? 'var(--color-correct)' : 'var(--color-accent)';

  return (
    <button
      type="button"
      onClick={onOpenGoal}
      title="Daily Goal — click to manage"
      aria-label={`Daily goal progress: ${formatRemaining(remaining)} remaining of ${goalMinutes} minutes. Open daily goal settings.`}
      className={`goal-ring-enter fixed right-5 top-1/2 -translate-y-1/2 z-30 hidden sm:flex flex-col items-center justify-center rounded-full bg-darkcard/90 backdrop-blur border shadow-xl transition-all hover:scale-[1.04] hover:shadow-2xl ${completed ? 'border-correctgreen' : 'border-darkborder'}`}
      style={{ width: 116, height: 116 }}
    >
      <svg width="116" height="116" viewBox="0 0 116 116" className="absolute inset-0 -rotate-90">
        <circle cx="58" cy="58" r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle
          cx="58" cy="58" r={RADIUS} fill="none" stroke={arcColor} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="goal-ring-arc"
          style={{ filter: completed ? 'drop-shadow(0 0 6px var(--color-correct))' : undefined }}
        />
      </svg>
      <span className={`relative z-10 flex flex-col items-center leading-none transition-opacity duration-300 ${paused ? 'opacity-60' : 'opacity-100'}`}>
        {completed ? (
          <>
            <Check className="w-6 h-6 text-correctgreen" strokeWidth={3} />
            <span className="mt-1 font-mono text-[11px] font-bold text-correctgreen uppercase tracking-wider">Done</span>
          </>
        ) : (
          <>
            <span className={`font-mono text-lg font-bold tabular-nums ${paused ? 'text-mutedtext' : 'text-accent'}`}>{formatRemaining(remaining)}</span>
            <span className="mt-1 font-mono text-[10px] font-semibold text-mutedtext">/ {goalMinutes} min</span>
            {paused && (
              <span className="mt-1 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-mutedtext bg-darkbg border border-darkborder rounded-full px-1.5 py-0.5">
                <Pause className="w-2.5 h-2.5" /> paused
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
};
