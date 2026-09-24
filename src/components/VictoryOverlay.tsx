import type { FC } from 'react';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';

interface VictoryOverlayProps {
  goalMinutes: number;
  onDismiss: () => void;
}

const GREEN_PALETTE = ['#22c55e', '#4ade80', '#86efac', '#80C050', '#16a34a'];

export const VictoryOverlay: FC<VictoryOverlayProps> = ({ goalMinutes, onDismiss }) => {
  useEffect(() => {
    const fire = (originX: number) => {
      confetti({ particleCount: 90, spread: 75, origin: { x: originX, y: 0.6 }, colors: GREEN_PALETTE, ticks: 220 });
    };
    fire(0.25);
    const mid = window.setTimeout(() => fire(0.5), 180);
    const right = window.setTimeout(() => fire(0.75), 360);
    const burst = window.setTimeout(() => {
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.5 }, colors: GREEN_PALETTE, scalar: 1.1, ticks: 260 });
    }, 560);
    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(right);
      window.clearTimeout(burst);
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center select-none animate-fade-in" role="alertdialog" aria-modal="true" aria-label="Daily goal achieved">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />
      <div className="victory-glow relative w-[min(92vw,420px)] bg-darkcard border-2 border-correctgreen rounded-3xl p-8 text-center shadow-2xl animate-goal-pop">
        <div className="mx-auto w-20 h-20 rounded-full bg-correctgreen/15 border-2 border-correctgreen flex items-center justify-center victory-icon-pop">
          <Trophy className="w-10 h-10 text-correctgreen" />
        </div>
        <h2 className="mt-5 text-2xl md:text-3xl font-extrabold tracking-tight text-correctgreen victory-text-glow">
          Victory: Daily Goal Achieved
        </h2>
        <p className="mt-3 text-sm text-bodytext leading-relaxed">
          You typed for <span className="font-mono font-bold text-correctgreen">{goalMinutes} minutes</span> today. Consistency is speed — gorilla approved! 🦍
        </p>
        <button
          onClick={onDismiss}
          className="mt-6 px-8 py-3 rounded-xl bg-correctgreen hover:brightness-110 text-black font-bold text-sm shadow-lg transition-all hover:scale-[1.03] active:scale-[0.98]"
        >
          Keep Going
        </button>
        <p className="mt-3 text-[11px] text-mutedtext">The goal ring stays green until midnight</p>
      </div>
    </div>
  );
};
