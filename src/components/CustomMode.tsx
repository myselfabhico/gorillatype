import { useState } from 'react';
import type { FC } from 'react';
import { Sliders, Play, Check } from 'lucide-react';

export const CustomMode: FC<{
  onStartCustomTest: (customText: string, customDuration: number) => void;
}> = ({ onStartCustomTest }) => {
  const [customText, setCustomText] = useState('The quick brown fox jumps over the lazy dog. Programming is thinking, not typing. Master your keyboard and achieve maximum speed.');
  const [customDuration, setCustomDuration] = useState(60);
  const [includePunctuation, setIncludePunctuation] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(false);

  const handleLaunch = () => {
    let text = customText.trim() || 'The quick brown fox jumps over the lazy dog.';
    if (!includePunctuation) {
      text = text.replace(/\p{P}/gu, '').replace(/\s+/g, ' ').trim();
      if (!text) text = 'The quick brown fox jumps over the lazy dog';
    }
    if (includeNumbers) text += ' 12345 67890 2026';
    onStartCustomTest(text, customDuration);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 animate-fade-in text-bodytext">
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-darkborder">
        <div className="p-2.5 rounded-xl bg-accentmuted text-accent"><Sliders className="w-6 h-6" /></div>
        <div><h2 className="text-xl font-bold">Custom Practice Mode</h2><p className="text-xs text-mutedtext">Paste your own words, code, or custom test parameters</p></div>
      </div>
      <div className="bg-darkcard border-2 border-darkborder rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <label htmlFor="custom-text" className="text-xs font-bold uppercase tracking-wider text-mutedtext block mb-2">Custom Words / Text</label>
          <textarea id="custom-text" value={customText} onChange={(e) => setCustomText(e.target.value)} rows={5} className="w-full bg-darkbg border-2 border-darkborder focus:border-accent rounded-xl p-4 font-mono text-sm sm:text-base outline-none text-bodytext resize-none shadow-inner" placeholder="Paste your custom words or practice paragraphs here..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-mutedtext block mb-2">Test Duration (Seconds)</span>
            <div className="flex flex-wrap items-center gap-2">
              {[30, 60, 120, 300].map((duration) => <button key={duration} onClick={() => setCustomDuration(duration)} aria-pressed={customDuration === duration} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${customDuration === duration ? 'bg-accent text-black border-accent' : 'bg-darkbg border-darkborder text-mutedtext hover:text-bodytext'}`}>{duration}s</button>)}
            </div>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-mutedtext block mb-2">Modifiers</span>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setIncludePunctuation((value) => !value)} role="switch" aria-checked={includePunctuation} aria-label="Keep punctuation" className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${includePunctuation ? 'bg-accentmuted border-accent text-accent' : 'bg-darkbg border-darkborder text-mutedtext'}`}>{includePunctuation && <Check className="w-3.5 h-3.5" />}Punctuation</button>
              <button onClick={() => setIncludeNumbers((value) => !value)} role="switch" aria-checked={includeNumbers} aria-label="Append practice numbers" className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${includeNumbers ? 'bg-accentmuted border-accent text-accent' : 'bg-darkbg border-darkborder text-mutedtext'}`}>{includeNumbers && <Check className="w-3.5 h-3.5" />}Numbers</button>
            </div>
            <p className="text-xs text-mutedtext mt-2">Punctuation keeps your original marks when on and removes them when off. Numbers appends practice digits.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-darkborder flex justify-end"><button onClick={handleLaunch} className="px-6 py-3 bg-accent hover:bg-accenthover text-black font-extrabold rounded-xl text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-95"><Play className="w-4 h-4 fill-current" />Launch Custom Test</button></div>
      </div>
    </div>
  );
};
