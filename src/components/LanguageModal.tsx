import type { FC, CSSProperties } from 'react';
import { X, Languages, Check } from 'lucide-react';
import type { LanguageId } from '../types';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: LanguageId;
  onSelectLanguage: (lang: LanguageId) => void;
}

interface LanguageItem {
  id: LanguageId;
  name: string;
  nativeName: string;
  flag: string;
}

export const LanguageModal: FC<LanguageModalProps> = ({ isOpen, onClose, currentLanguage, onSelectLanguage }) => {
  if (!isOpen) return null;

  const languages: LanguageItem[] = [
    { id: 'english', name: 'English (Normal)', nativeName: 'Common practice words', flag: '🇺🇸' },
    { id: 'english-advanced', name: 'English (Advanced)', nativeName: 'Top words + Punctuation', flag: '🇬🇧' },
    { id: 'spanish', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { id: 'french', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { id: 'german', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { id: 'italian', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    { id: 'portuguese', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
    { id: 'russian', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { id: 'code', name: 'Code Mode', nativeName: 'JavaScript & Python Keywords', flag: '💻' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-darkcard border-2 border-darkborder rounded-2xl p-6 shadow-2xl z-10 text-bodytext animate-pop-in">
        <div className="flex items-center justify-between pb-4 border-b border-darkborder">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-bodytext">Select Language & Word List</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-darkbg hover:bg-darkborder text-mutedtext hover:text-bodytext transition-all active:scale-90 group"><X className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5 max-h-[60vh] overflow-y-auto pr-1">
          {languages.map((lang, index) => {
            const isSelected = currentLanguage === lang.id;
            return (
              <button key={lang.id} onClick={() => { onSelectLanguage(lang.id); onClose(); }} className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between stagger-item ${isSelected ? 'bg-darkbg border-accent text-accent shadow-md' : 'bg-darkbg border-darkborder hover:border-mutedtext text-bodytext'}`} style={{ '--stagger-i': index } as CSSProperties}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <span className="text-xs font-bold block">{lang.name}</span>
                    <span className="text-[11px] text-mutedtext block">{lang.nativeName}</span>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="pt-4 border-t border-darkborder mt-5 flex items-center justify-between text-xs text-mutedtext">
          <span>Curated word lists for typing practice</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-accent text-black font-bold rounded-lg hover:bg-accenthover btn-shine glow-accent active:scale-95">Done</button>
        </div>
      </div>
    </div>
  );
};
