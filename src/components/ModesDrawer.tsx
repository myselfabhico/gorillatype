import type { FC, ReactNode } from 'react';
import { X, Keyboard, BookOpen, Sliders, Check } from 'lucide-react';
import type { AppMode } from '../types';

interface ModesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
}

export const ModesDrawer: FC<ModesDrawerProps> = ({ isOpen, onClose, currentMode, onSelectMode }) => {
  if (!isOpen) return null;
  const modes: { id: AppMode; title: string; description: string; icon: ReactNode; badge?: string }[] = [
    { id: 'typing-test', title: 'Typing Test', description: 'Timed speed tests with curated practice word lists', icon: <Keyboard className="w-5 h-5" /> },
    { id: 'text-practice', title: 'Text Practice', description: 'Practice paragraphs, literature excerpts, and code syntax', icon: <BookOpen className="w-5 h-5 text-accent" /> },
    { id: 'custom', title: 'Custom Mode', description: 'Your own text, punctuation, numbers, and test duration', icon: <Sliders className="w-5 h-5 text-accent" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-darkcard border-l border-darkborder p-6 shadow-2xl flex flex-col justify-between gap-6 animate-slide-left text-bodytext overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-darkborder">
              <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-accent text-black font-mono font-bold text-xs flex items-center justify-center">IO</div><h3 className="text-lg font-bold tracking-tight">Typing Modes</h3></div>
              <button onClick={onClose} aria-label="Close modes" className="p-1.5 rounded-lg bg-darkbg hover:bg-darkborder text-mutedtext hover:text-bodytext"><X className="w-4 h-4" /></button>
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              {modes.map((item) => {
                const isActive = currentMode === item.id;
                return (
                  <button key={item.id} onClick={() => { onSelectMode(item.id); onClose(); }} className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 group ${isActive ? 'bg-accentmuted border-accent shadow-md' : 'bg-darkbg border-darkborder hover:border-mutedtext hover:bg-darkcard'}`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-darkbg border border-darkborder shrink-0 group-hover:border-accent">{item.icon}</div>
                      <div><div className="flex items-center gap-2"><span className={`text-sm font-bold ${isActive ? 'text-accent' : 'text-bodytext'}`}>{item.title}</span>{item.badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accentmuted text-accent font-semibold">{item.badge}</span>}</div><p className="text-xs text-mutedtext mt-1 leading-snug">{item.description}</p></div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-accent shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pt-4 border-t border-darkborder text-center text-xs text-mutedtext">Profile and test history are stored locally in cookies</div>
        </div>
      </div>
    </div>
  );
};
