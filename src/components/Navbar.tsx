import type { FC } from 'react';
import { Palette, Languages, Menu, Target } from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  onOpenModes: () => void;
  onOpenTheme: () => void;
  onOpenLanguage: () => void;
  onOpenAuth: () => void;
  onOpenGoal: () => void;
  goalActive: boolean;
  goalCompleted: boolean;
  profile: UserProfile;
  currentModeName: string;
}

export const Navbar: FC<NavbarProps> = ({ onOpenModes, onOpenTheme, onOpenLanguage, onOpenAuth, onOpenGoal, goalActive, goalCompleted, profile, currentModeName }) => {

  return (
    <header className="w-full bg-darkcard border-b border-darkborder select-none sticky top-0 z-30 shadow-md animate-slide-down">
      <div className="max-w-6xl mx-auto px-4 min-h-16 py-3 flex flex-wrap gap-3 items-center justify-between">
        <button onClick={onOpenModes} className="flex items-center gap-3 group text-left !overflow-visible" title="GorillaType - Switch modes">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center font-mono font-black text-black text-lg shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 group-active:scale-95">IO</div>
          <div>
            <span className="font-extrabold tracking-wider text-xl text-bodytext group-hover:text-accent transition-colors">GORILLATYPE</span>
            <span className="block text-[11px] text-mutedtext font-medium">Typing Speed Test & Local Practice</span>
          </div>
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onOpenModes} className="flex items-center gap-2 px-3.5 py-1.5 bg-darkbg hover:bg-darkborder text-bodytext border border-darkborder rounded-lg text-sm font-semibold transition-all hover:border-accent hover:-translate-y-px active:translate-y-0 active:scale-95 glow-ring" title="Open Modes Menu">
            <Menu className="w-4 h-4 text-accent" /><span className="hidden sm:inline">{currentModeName}</span>
          </button>
          <button onClick={onOpenTheme} className="p-2 bg-darkbg hover:bg-darkborder text-mutedtext hover:text-accent hover:rotate-12 rounded-lg border border-darkborder transition-all active:scale-90 glow-ring" title="Change Theme & Appearance" aria-label="Theme Selection"><Palette className="w-4 h-4" /></button>
          <button onClick={onOpenLanguage} className="px-2.5 py-1.5 bg-darkbg hover:bg-darkborder text-mutedtext hover:text-accent rounded-lg border border-darkborder transition-all flex items-center gap-1 font-mono text-xs font-bold glow-ring active:scale-90" title="Change Language & Word Pool" aria-label="Language Selector"><Languages className="w-4 h-4" /><span>文A</span></button>
          <div className="h-5 w-px bg-darkborder mx-1 hidden sm:block" />
          <button onClick={onOpenGoal} className={`relative p-2 bg-darkbg hover:bg-darkborder rounded-lg border transition-colors !overflow-visible ${goalActive ? 'border-accent text-accent' : 'border-darkborder text-mutedtext hover:text-accent'}`} title="Daily Goal" aria-label="Daily Goal">
            <Target className="w-4 h-4" />
            {goalCompleted && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-correctgreen animate-pulse-subtle" />}
          </button>
          <button onClick={onOpenAuth} className="flex items-center gap-2 px-3 py-1.5 bg-darkbg hover:bg-darkborder text-bodytext border border-darkborder hover:border-accent rounded-lg text-xs font-semibold transition-all hover:-translate-y-px active:scale-95 glow-ring" title="Manage Local Profile & High Scores">
            <span className="text-base leading-none">{profile.avatar}</span><span className="max-w-[80px] sm:max-w-[110px] truncate">{profile.username}</span>
            <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-accentmuted text-accent font-mono text-[10px]">{profile.bestWpm > 0 ? `${profile.bestWpm} WPM` : 'NEW'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
