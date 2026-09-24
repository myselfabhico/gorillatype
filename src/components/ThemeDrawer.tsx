import type { FC } from 'react';
import { X, Palette, Check, Sun, Moon } from 'lucide-react';
import type { ThemeId } from '../types';

interface ThemeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
}

interface ThemeOption {
  id: ThemeId;
  name: string;
  category: 'dark' | 'light';
  bgColor: string;
  accentColor: string;
  description: string;
}

export const ThemeDrawer: FC<ThemeDrawerProps> = ({ isOpen, onClose, currentTheme, onSelectTheme }) => {
  if (!isOpen) return null;
  const themes: ThemeOption[] = [
    { id: 'default-dark', name: 'Charcoal Green', category: 'dark', bgColor: '#222222', accentColor: '#80C050', description: 'Deep charcoal with a calm foliage green — the GorillaType signature' },
    { id: 'nordic', name: 'Nordic', category: 'dark', bgColor: '#2E3440', accentColor: '#88C0D0', description: 'Cool slate blue with a frosty glacial accent' },
    { id: 'ember', name: 'Ember', category: 'dark', bgColor: '#262220', accentColor: '#D9A45B', description: 'Warm coffee dark with soft amber and brass tones' },
    { id: 'dracula', name: 'Dracula', category: 'dark', bgColor: '#282A36', accentColor: '#BD93F9', description: 'Refined purple dark, softened borders for late-night typing' },
    { id: 'default-light', name: 'Paper Green', category: 'light', bgColor: '#F4F5F7', accentColor: '#489920', description: 'Clean paper white with crisp foliage green' },
    { id: 'classic', name: 'Classic Blue', category: 'light', bgColor: '#EFF2F6', accentColor: '#2563EB', description: 'Cool ice white with confident academic blue' },
    { id: 'serene', name: 'Serene Sage', category: 'light', bgColor: '#F4F6F3', accentColor: '#467B68', description: 'Soft misty green — easy on the eyes for long sessions' },
    { id: 'parchment', name: 'Parchment', category: 'light', bgColor: '#F6F1E6', accentColor: '#9C6B3C', description: 'Warm book-page cream with rich walnut brown' },
  ];

  const renderThemeButton = (theme: ThemeOption) => {
    const isSelected = currentTheme === theme.id;
    return (
      <button key={theme.id} onClick={() => onSelectTheme(theme.id)} aria-pressed={isSelected} className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between gap-2 group ${isSelected ? 'bg-accentmuted border-accent shadow-md' : 'bg-darkbg border-darkborder hover:border-mutedtext hover:bg-darkcard'}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-1.5 p-1 bg-darkbg rounded-lg border border-darkborder shrink-0">
            <div className="w-5 h-5 rounded-full border border-darkborder shadow-sm" style={{ backgroundColor: theme.bgColor }} title={`Background: ${theme.bgColor}`} />
            <div className="w-5 h-5 rounded-full border border-darkborder shadow-sm" style={{ backgroundColor: theme.accentColor }} title={`Accent: ${theme.accentColor}`} />
          </div>
          <div className="text-left"><span className={`text-sm font-bold block ${isSelected ? 'text-accent' : 'text-bodytext'}`}>{theme.name}</span><span className="text-[11px] text-mutedtext block leading-tight">{theme.description}</span></div>
        </div>
        {isSelected && <div className="p-1 rounded-full bg-accent text-black"><Check className="w-3.5 h-3.5 stroke-[3]" /></div>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-darkcard border-l border-darkborder p-6 shadow-2xl flex flex-col justify-between animate-slide-left overflow-y-auto text-bodytext">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-darkborder">
              <div className="flex items-center gap-2"><Palette className="w-5 h-5 text-accent" /><h3 className="text-lg font-bold tracking-tight">Theme Palette</h3></div>
              <button onClick={onClose} aria-label="Close themes" className="p-1.5 rounded-lg bg-darkbg hover:bg-darkborder text-mutedtext hover:text-bodytext"><X className="w-4 h-4" /></button>
            </div>
            <div className="mt-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mutedtext mb-3"><Moon className="w-3.5 h-3.5 text-accent" />Dark Themes</div>
              <div className="flex flex-col gap-2">{themes.filter((theme) => theme.category === 'dark').map(renderThemeButton)}</div>
            </div>
            <div className="mt-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mutedtext mb-3"><Sun className="w-3.5 h-3.5 text-accent" />Light Themes</div>
              <div className="flex flex-col gap-2">{themes.filter((theme) => theme.category === 'light').map(renderThemeButton)}</div>
            </div>
          </div>
          <div className="pt-6 border-t border-darkborder mt-6 text-center text-xs text-mutedtext">Themes applied instantly and saved to cookie settings</div>
        </div>
      </div>
    </div>
  );
};
