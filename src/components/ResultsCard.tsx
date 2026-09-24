import { useEffect, useState } from 'react';
import type { FC } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Share2, Check, TrendingUp } from 'lucide-react';
import type { TestRecord, KeystrokePoint } from '../types';

interface ResultsCardProps {
  record: TestRecord;
  historyPoints: KeystrokePoint[];
  onRestart: () => void;
  showChart?: boolean;
}

export const ResultsCard: FC<ResultsCardProps> = ({ record, historyPoints, onRestart }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    if (record.wpm >= 40) {
      confetti({ particleCount: record.wpm > 80 ? 120 : 60, spread: 70, origin: { y: 0.6 } });
    }
  }, [record.wpm]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleShare = async () => {
    const text = `GorillaType Result:
WPM: ${record.wpm} (${record.rawWpm} Raw)
Accuracy: ${record.accuracy}%
Keystrokes: (${record.keystrokes.correct} correct | ${record.keystrokes.wrong} wrong) ${record.keystrokes.total} total
Duration: ${record.duration}s
Mode: ${record.mode} | Language: ${record.language} | Difficulty: ${record.difficulty}`;
    setCopied(false);
    setCopyError('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopyError('Could not copy. You can select and copy your results manually.');
    }
  };

  const renderChart = () => {
    if (historyPoints.length < 2) return null;
    const maxWpm = Math.max(...historyPoints.map((p) => Math.max(p.wpm, p.rawWpm)), 30) + 10;
    const width = 600;
    const height = 140;
    const padding = 20;
    const points = historyPoints.map((p, idx) => ({
      ...p,
      x: padding + (idx / (historyPoints.length - 1)) * (width - padding * 2),
      y: height - padding - (p.wpm / maxWpm) * (height - padding * 2),
      rawY: height - padding - (p.rawWpm / maxWpm) * (height - padding * 2),
    }));
    const pathWpm = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const pathRaw = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.rawY}`).join(' ');
    return (
      <div className="w-full bg-darkbg p-4 rounded-xl border border-darkborder mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mutedtext mb-2">
          <span className="flex items-center gap-2 font-semibold uppercase tracking-wider text-bodytext"><TrendingUp className="w-3.5 h-3.5 text-accent" />Speed over time</span>
          <div className="flex gap-3"><span className="text-accent">Net WPM</span><span>Raw WPM (dashed)</span><span className="text-wrongred">Errors</span></div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[150px]" role="img" aria-label="Recorded net and raw typing speed over time; red points mark errors">
          {[padding, height / 2, height - padding].map((y) => <line key={y} x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 3" />)}
          <path d={pathRaw} fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeDasharray="4 2" />
          <path d={pathWpm} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
          {points.map((p, idx) => <circle key={idx} cx={p.x} cy={p.y} r={p.errors > 0 ? 6 : 3} fill={p.errors > 0 ? 'var(--color-wrong)' : 'var(--color-accent)'} />)}
        </svg>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-6 bg-darkcard border-2 border-darkborder rounded-2xl p-6 sm:p-8 shadow-xl animate-fade-in text-bodytext">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-darkborder">
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 shrink-0 rounded-2xl bg-darkbg border-2 border-accent flex flex-col items-center justify-center shadow-lg">
            <span className="text-4xl font-mono font-black text-accent leading-none">{record.wpm}</span>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-mutedtext mt-1">WPM</span>
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-accentmuted text-accent font-bold text-xs uppercase tracking-wide">Test complete</span>
            <h2 className="text-xl font-bold mt-2">Your speed: {record.wpm} WPM</h2>
            <p className="text-xs text-mutedtext mt-1">{record.duration}s test • {record.rawWpm} raw WPM</p>
          </div>
        </div>
        <button onClick={onRestart} className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accenthover text-black font-extrabold rounded-xl shadow-lg active:scale-95 text-sm shrink-0" title="Restart Test"><RotateCcw className="w-4 h-4" />Try Again</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        <div className="flex items-center justify-between p-3.5 bg-darkbg rounded-xl border border-darkborder">
          <span className="text-xs text-mutedtext">Keystrokes:</span>
          <span className="font-mono text-sm font-bold"><span className="text-accent">({record.keystrokes.correct}</span><span className="text-mutedtext"> | </span><span className="text-wrongred">{record.keystrokes.wrong})</span> {record.keystrokes.total}</span>
        </div>
        <div className="flex items-center justify-between p-3.5 bg-darkbg rounded-xl border border-darkborder"><span className="text-xs text-mutedtext">Accuracy:</span><span className="font-mono font-bold text-accent">{record.accuracy}%</span></div>
        <div className="flex items-center justify-between p-3.5 bg-darkbg rounded-xl border border-darkborder"><span className="text-xs text-mutedtext">Correct words:</span><span className="font-mono text-sm font-bold text-accent">{record.correctWords}</span></div>
        <div className="flex items-center justify-between p-3.5 bg-darkbg rounded-xl border border-darkborder"><span className="text-xs text-mutedtext">Wrong words:</span><span className="font-mono text-sm font-bold text-wrongred">{record.wrongWords}</span></div>
      </div>
      {historyPoints.length >= 2 && renderChart()}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-darkborder">
        <button onClick={handleShare} className="flex items-center gap-2 px-3.5 py-2 bg-darkbg hover:bg-darkborder rounded-lg border border-darkborder text-xs font-medium">
          {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Share2 className="w-3.5 h-3.5" />}<span>{copied ? 'Copied to Clipboard!' : 'Copy Result'}</span>
        </button>
        <span className="text-xs text-mutedtext font-mono">Language: <strong className="text-bodytext capitalize">{record.language}</strong> ({record.difficulty})</span>
      </div>
      {copyError && <p role="status" className="text-xs text-wrongred mt-3">{copyError}</p>}
    </div>
  );
};
