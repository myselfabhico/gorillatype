import { useState, useRef } from 'react';
import type { FC, ChangeEvent, CSSProperties } from 'react';
import { BookOpen, RefreshCw, CheckCircle2, FileText } from 'lucide-react';
import { TEXT_PRACTICE_PARAGRAPHS } from '../utils/wordBanks';
import type { UserSettings } from '../types';
import { soundManager } from '../utils/sound';
import confetti from 'canvas-confetti';

export const TextPracticeMode: FC<{ settings: UserSettings }> = ({ settings }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const correctPresses = useRef(0);
  const wrongPresses = useRef(0);
  const currentParagraph = TEXT_PRACTICE_PARAGRAPHS[selectedIdx];
  const targetText = currentParagraph.text;

  const resetPractice = (idx: number = selectedIdx) => {
    setSelectedIdx(idx);
    setInputVal('');
    setStartTime(null);
    setIsFinished(false);
    setWpm(0);
    setAccuracy(100);
    correctPresses.current = 0;
    wrongPresses.current = 0;
    inputRef.current?.focus();
  };

  // MonkeyType net characters: only words typed exactly right (no uncorrected
  // error) contribute their characters plus the trailing space to WPM.
  const netChars = (typed: string, target: string): number => {
    const typedWords = typed.split(' ');
    const targetWords = target.split(' ');
    let chars = 0;
    for (let i = 0; i < typedWords.length && i < targetWords.length; i++) {
      if (typedWords[i] === targetWords[i]) chars += typedWords[i].length + 1;
    }
    // The in-progress final word hasn't received its trailing space yet.
    const lastIdx = Math.min(typedWords.length, targetWords.length) - 1;
    if (lastIdx >= 0 && typedWords[lastIdx] === targetWords[lastIdx] && !typed.endsWith(' ')) chars -= 1;
    return Math.max(0, chars);
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished) return;
    const val = e.target.value;
    // Backspace disabled: swallow deletions (including undo) so mistakes can't be erased.
    if (!settings.backspaceEnabled && (val.length < inputVal.length || (e.nativeEvent as InputEvent).inputType === 'historyUndo')) return;
    if (startTime === null && val.length > 0) setStartTime(Date.now());
    if (settings.keyboardSound !== 'mute') soundManager.playKey();
    // Every keypress is recorded — deletions never restore accuracy.
    let prefix = 0;
    while (prefix < inputVal.length && prefix < val.length && inputVal[prefix] === val[prefix]) prefix++;
    for (let i = prefix; i < val.length; i++) {
      if (val[i] === targetText[i]) correctPresses.current++;
      else wrongPresses.current++;
    }
    setInputVal(val);
    const presses = correctPresses.current + wrongPresses.current;
    setAccuracy(presses === 0 ? 100 : Math.round((correctPresses.current / presses) * 100));
    if (startTime !== null) {
      const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.001);
      setWpm(Math.round((netChars(val, targetText) / 5) / (elapsedSec / 60)));
    }
    if (val === targetText) {
      setIsFinished(true);
      if (settings.websiteSfx) soundManager.playFinishSound();
      confetti({ particleCount: 80, spread: 60 });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 animate-fade-in text-bodytext">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-darkborder">
        <div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-accentmuted text-accent"><BookOpen className="w-6 h-6" /></div><div><h2 className="text-xl font-bold">Text & Literature Practice</h2><p className="text-xs text-mutedtext">Type complete sentences, paragraphs, and prose with punctuation</p></div></div>
        <button onClick={() => resetPractice()} className="flex items-center gap-2 px-4 py-2 bg-darkcard hover:bg-darkborder text-bodytext hover:text-accent border border-darkborder rounded-xl text-xs font-bold transition-all active:scale-90 group"><RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" />Restart</button>
      </div>
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {TEXT_PRACTICE_PARAGRAPHS.map((paragraph, idx) => <button key={idx} onClick={() => resetPractice(idx)} aria-pressed={selectedIdx === idx} className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-2 active:scale-90 ${selectedIdx === idx ? 'bg-accent text-black border-accent shadow-md' : 'bg-darkcard border-darkborder text-mutedtext hover:text-bodytext'}`}><FileText className="w-3.5 h-3.5" />{paragraph.title}</button>)}
      </div>
      <div className="bg-darkcard border-2 border-darkborder rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mutedtext pb-3 border-b border-darkborder stagger-item" style={{ '--stagger-i': 0 } as CSSProperties}>
          <span className="font-semibold text-bodytext italic">"{currentParagraph.title}" — {currentParagraph.author}</span>
          <div className="flex items-center gap-4 font-mono font-bold"><span className="text-accent">{wpm} WPM</span><span>{accuracy}% ACC</span></div>
        </div>
        <div className="p-5 bg-darkbg rounded-xl border border-darkborder font-mono text-base sm:text-lg leading-relaxed text-left min-h-[140px] whitespace-pre-wrap stagger-item" style={{ '--stagger-i': 1 } as CSSProperties}>
          {targetText.split('').map((char, idx) => {
            const typed = inputVal[idx];
            const charStyle = typed === undefined ? 'text-mutedtext' : typed === char ? 'text-accent font-semibold' : 'text-wrongred bg-[var(--color-wrong-bg)]';
            return <span key={idx} className={charStyle}>{char}</span>;
          })}
        </div>
        <textarea ref={inputRef} value={inputVal} onChange={handleInput} onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} readOnly={isFinished} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} aria-label="Practice text input" placeholder="Start typing the text above exactly as written..." rows={4} className="w-full bg-darkbg border-2 border-darkborder focus:border-accent rounded-xl p-4 font-mono text-base sm:text-lg outline-none text-bodytext resize-none placeholder:text-mutedtext shadow-inner" />
        {isFinished && <div className="p-4 bg-accentmuted border border-accent rounded-xl text-center flex items-center justify-center gap-2 text-accent font-bold animate-pop-in"><CheckCircle2 className="w-5 h-5" /><span>Completed! Speed: {wpm} WPM • Accuracy: {accuracy}%</span></div>}
      </div>
    </div>
  );
};
