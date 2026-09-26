import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC, CSSProperties } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import confetti from 'canvas-confetti';
import { RotateCcw, Share2, Check, ChartLine, Target } from 'lucide-react';
import type { TestRecord, KeystrokePoint, KeyInsight } from '../types';
import { keyAdvice } from '../utils/keyInsights';

interface ResultsCardProps {
  record: TestRecord;
  historyPoints: KeystrokePoint[];
  onRestart: () => void;
  /** Present only on every fifth finished test — drives the problem-keys report. */
  keyInsights?: KeyInsight[] | null;
  keyInsightsSummary?: string;
  showChart?: boolean;
}

const CHART_W = 760;
const CHART_H = 220;
const PAD = { top: 14, right: 46, bottom: 26, left: 46 };

interface Hover {
  index: number;
  x: number;
  y: number;
}

/** Number that counts up from its previous value when the results appear. */
function AnimatedValue({ value, format, className }: { value: number; format?: (value: number) => string; className?: string }) {
  const display = useCountUp(value);
  return <div className={className}>{format ? format(display) : Math.round(display)}</div>;
}

export const ResultsCard: FC<ResultsCardProps> = ({ record, historyPoints, onRestart, keyInsights, keyInsightsSummary }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [hover, setHover] = useState<Hover | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
    const chars = record.charStats;
    const text = `GorillaType Result:
WPM: ${record.wpm} (${record.rawWpm} Raw)
Accuracy: ${record.accuracy}%
Consistency: ${record.consistency ?? '—'}%
Keystrokes: (${record.keystrokes.correct} correct | ${record.keystrokes.wrong} wrong) ${record.keystrokes.total} total${chars ? `\nCharacters: ${chars.correct}/${chars.incorrect}/${chars.extra}/${chars.missed}` : ''}${record.correctedWords ? `\nCorrected: ${record.correctedKeys ?? 0} keystrokes in ${record.correctedWords} word(s), fixed with backspace` : ''}
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

  // Prepend the mandatory (0,0) starting point, like MonkeyType.
  const series = useMemo(() => {
    const points: KeystrokePoint[] = [{ second: 0, wpm: 0, rawWpm: 0, errors: 0, burst: 0 }, ...historyPoints];
    const xMax = Math.max(points.at(-1)?.second ?? 1, 1);
    const yMaxRaw = Math.max(...points.map((p) => Math.max(p.rawWpm, p.burst, p.wpm)), 30);
    const yMax = Math.ceil((yMaxRaw + 10) / 10) * 10;
    const toX = (second: number) => PAD.left + (second / xMax) * (CHART_W - PAD.left - PAD.right);
    const toY = (wpm: number) => CHART_H - PAD.bottom - (wpm / yMax) * (CHART_H - PAD.top - PAD.bottom);
    const smooth = (field: 'wpm' | 'rawWpm' | 'burst') => {
      const pts = points.map((p) => ({ x: toX(p.second), y: toY(p[field]) }));
      if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
      }
      return d;
    };
    return { points, xMax, yMax, toX, toY, smooth };
  }, [historyPoints]);

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CHART_W;
    const { points, toX } = series;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(toX(p.second) - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHover({ index: best, x: series.toX(points[best].second), y: series.toY(points[best].wpm) });
  };

  // Right-side error axis: X markers are positioned by their per-second count.
  const errMax = Math.max(1, ...series.points.map((p) => p.errors));
  const toErrY = (count: number) => CHART_H - PAD.bottom - (count / errMax) * (CHART_H - PAD.top - PAD.bottom);
  const errorMarkers = series.points.map((p, i) => ({ ...p, i })).filter((p) => p.errors > 0);
  const hasErrors = errorMarkers.length > 0;
  const hoverPoint = hover ? series.points[hover.index] : null;
  const chars = record.charStats;
  const charText = chars ? `${chars.correct}/${chars.incorrect}/${chars.extra}/${chars.missed}` : `${record.keystrokes.correct}/${record.keystrokes.wrong}`;

  const renderChart = () => (
    <div className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full select-none"
        role="img"
        aria-label="Words per minute, raw speed, burst speed and errors over time"
        onMouseMove={onMove}
      >
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = CHART_H - PAD.bottom - fraction * (CHART_H - PAD.top - PAD.bottom);
          const value = Math.round(series.yMax * fraction);
          return (
            <g key={fraction}>
              <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="var(--color-border)" strokeWidth={fraction === 0 ? 1.5 : 1} opacity={fraction === 0 ? 1 : 0.55} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)" className="font-mono">{value}</text>
            </g>
          );
        })}
        {/* x axis ticks */}
        {series.points.map((p, i) => {
          const step = Math.max(1, Math.ceil(series.points.length / 16));
          if (Math.round(p.second) % step !== 0) return null;
          return <text key={`x${i}`} x={series.toX(p.second)} y={CHART_H - 8} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)" className="font-mono">{Math.round(p.second)}</text>;
        })}
        <text x={12} y={CHART_H / 2} fontSize="10" fill="var(--color-text-muted)" transform={`rotate(-90 12 ${CHART_H / 2})`} textAnchor="middle" className="font-mono">words per minute</text>
        {/* right error axis (only when errors happened) */}
        {hasErrors && (
          <g>
            {Array.from({ length: errMax + 1 }, (_, count) => (
              <text key={`err${count}`} x={CHART_W - PAD.right + 12} y={toErrY(count) + 4} fontSize="10" fill="var(--color-text-muted)" className="font-mono">{count}</text>
            ))}
            <text x={CHART_W - 8} y={CHART_H / 2} fontSize="10" fill="var(--color-text-muted)" transform={`rotate(90 ${CHART_W - 8} ${CHART_H / 2})`} textAnchor="middle" className="font-mono">Errors</text>
          </g>
        )}

        {/* soft area fill under the wpm line, revealed as the line draws */}
        <defs>
          <linearGradient id="wpmAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${series.smooth('wpm')} L ${series.toX(series.points.at(-1)?.second ?? 1)} ${CHART_H - PAD.bottom} L ${series.toX(0)} ${CHART_H - PAD.bottom} Z`}
          fill="url(#wpmAreaFill)"
          className="chart-fade-late"
        />
        {/* burst line (thin, muted, with data dots like the reference) */}
        <path d={series.smooth('burst')} fill="none" stroke="var(--color-text-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" pathLength={1} className="chart-line chart-line-delayed" />
        <g className="chart-fade-late">
          {series.points.map((p, i) => (
            <circle key={`bd${i}`} cx={series.toX(p.second)} cy={series.toY(p.burst)} r={2} fill="var(--color-text-dim)" />
          ))}
        </g>
        {/* raw line (dashed) */}
        <path d={series.smooth('rawWpm')} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="7 5" strokeLinecap="round" opacity="0.75" className="chart-fade-late" />
        {/* wpm line (hero) — draws in left-to-right on entry */}
        <path d={series.smooth('wpm')} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="chart-line" />
        {/* error markers: x crosses positioned on the error axis */}
        {errorMarkers.map((p) => {
          const x = series.toX(p.second);
          const y = toErrY(p.errors);
          return (
            <g key={`err${p.i}`} stroke="var(--color-wrong)" strokeWidth="2" strokeLinecap="round" className="chart-fade-late">
              <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} />
              <line x1={x - 4} y1={y + 4} x2={x + 4} y2={y - 4} />
            </g>
          );
        })}
        {/* hover guide */}
        {hover && hoverPoint && (
          <g>
            <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={CHART_H - PAD.bottom} stroke="var(--color-border)" strokeWidth="1" />
            <circle cx={hover.x} cy={series.toY(hoverPoint.wpm)} r="4.5" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && hoverPoint && (
        <div
          className="absolute pointer-events-none z-10 px-3 py-2 rounded-lg bg-darkbg border border-darkborder shadow-xl font-mono text-xs leading-relaxed"
          style={{
            left: `min(max(0px, ${(hover.x / CHART_W) * 100}% - 60px), calc(100% - 128px))`,
            top: `${(hover.y / CHART_H) * 100}%`,
            transform: 'translateY(-110%)',
          }}
        >
          <div className="font-bold text-bodytext mb-1">{Math.round(hoverPoint.second)}</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'var(--color-wrong)' }} />errors: {hoverPoint.errors}</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'var(--color-accent)' }} />wpm: {hoverPoint.wpm}</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block opacity-55" style={{ background: 'var(--color-accent)' }} />raw: {hoverPoint.rawWpm}</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'var(--color-text-dim)' }} />burst: {hoverPoint.burst}</div>
        </div>
      )}
      {/* legend */}
      <div className="flex items-center justify-end gap-4 text-xs font-mono text-mutedtext mt-1 pr-2">
        <span className="flex items-center gap-1.5"><ChartLine className="w-3.5 h-3.5" />scale</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: 'var(--color-accent)' }} />raw</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2" style={{ borderColor: 'var(--color-text-dim)' }} />burst</span>
        <span className="flex items-center gap-1.5"><span style={{ color: 'var(--color-wrong)' }}>x</span>errors</span>
      </div>
    </div>
  );

  const labelClass = 'text-xs sm:text-sm font-semibold text-mutedtext';
  const valueClass = 'text-xl sm:text-2xl font-bold text-accent font-mono';

  return (
    <div className="w-full max-w-4xl mx-auto my-6 bg-darkcard border border-darkborder rounded-2xl p-6 sm:p-8 shadow-xl animate-rise-in text-bodytext">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(150px,220px)_1fr] gap-6 lg:gap-8">
        {/* left column: hero stats */}
        <div className="flex flex-row lg:flex-col items-center lg:items-start justify-center gap-6 lg:gap-2">
          <div>
            <div className="text-mutedtext font-semibold text-lg leading-tight">wpm</div>
              <AnimatedValue value={record.wpm} className="text-accent font-mono font-extrabold text-6xl sm:text-7xl leading-none text-glow" />
          </div>
          <div className="lg:mt-5">
            <div className="text-mutedtext font-semibold text-lg leading-tight">acc</div>
            <AnimatedValue value={record.accuracy} format={(value) => `${Number(value.toFixed(1))}%`} className="text-accent font-mono font-extrabold text-4xl sm:text-5xl leading-none text-glow" />
          </div>
        </div>
        {/* right column: chart */}
        <div className="min-w-0">
          {historyPoints.length >= 2 ? renderChart() : (
            <div className="h-full min-h-[160px] flex items-center justify-center text-sm text-mutedtext font-mono">Not enough data for a graph — run a slightly longer test.</div>
          )}
        </div>
      </div>

      {/* every-5th-test problem-key report */}
      {keyInsights && keyInsights.length > 0 && (
        <div className="mt-7 rounded-2xl border border-accent bg-accentmuted/40 p-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-accent uppercase tracking-wider">Your 5 weakest keys</span>
            <span className="text-[11px] text-mutedtext font-mono ml-auto">since your last report</span>
          </div>
          <p className="text-xs text-mutedtext mb-4">{keyInsightsSummary}</p>
          <div className="grid gap-2.5">
            {keyInsights.map((insight, index) => {
              const label = insight.key === ' ' ? 'Space' : insight.key;
              return (
                <div key={`${insight.key}-${index}`} className="flex items-center gap-3 bg-darkbg border border-darkborder rounded-xl px-3.5 py-2.5 stagger-item" style={{ '--stagger-i': index } as CSSProperties}>
                  <span className="w-6 text-center font-mono text-xs text-mutedtext">#{index + 1}</span>
                  <kbd className="min-w-[2.25rem] text-center px-2 py-1 rounded-lg bg-darkcard border-2 border-accent text-accent font-mono font-bold text-sm shadow-sm">{label}</kbd>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono min-w-0">
                    <span className="text-wrongred font-bold">{insight.wrong + insight.missed} mistakes</span>
                    {insight.instead && insight.insteadCount > 0 && (
                      <span className="text-mutedtext">pressed <span className="text-bodytext font-bold">"{insight.instead === ' ' ? 'Space' : insight.instead}"</span> instead ×{insight.insteadCount}</span>
                    )}
                    {insight.missed > 0 && <span className="text-mutedtext">skipped ×{insight.missed}</span>}
                  </div>
                  <span className="ml-auto hidden md:block text-[11px] text-mutedtext italic text-right max-w-[46%]">{keyAdvice(insight)}</span>
                </div>
              );
            })}
          </div>
          <p className="md:hidden text-[11px] text-mutedtext italic mt-3">{keyInsights[0] ? keyAdvice(keyInsights[0]) : ''}</p>
        </div>
      )}

      {/* bottom stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 items-start gap-x-4 gap-y-5 mt-7 pt-6 border-t border-darkborder">
        <div className="min-w-0 stagger-item cell-pop" style={{ '--stagger-i': 0 } as CSSProperties}>
          <div className={labelClass}>test type</div>
          <div className={`${valueClass} !text-base sm:!text-lg leading-snug`}>{record.mode === 'custom' ? 'custom' : record.mode === 'text-practice' ? 'practice' : 'time'} {record.duration}s</div>
          <div className="text-xs text-mutedtext capitalize">{record.language.replace('-', ' ')} · {record.difficulty}</div>
          {record.accuracy < 75 && <div className="text-xs font-mono text-accent mt-0.5">invalid (accuracy)</div>}
        </div>
        <div className="min-w-0 stagger-item cell-pop" style={{ '--stagger-i': 1 } as CSSProperties}>
          <div className={labelClass}>raw</div>
          <AnimatedValue value={record.rawWpm} className={`${valueClass} !text-2xl sm:!text-3xl`} />
        </div>
        <div className="min-w-0 stagger-item cell-pop" style={{ '--stagger-i': 2 } as CSSProperties}>
          <div className={labelClass}>characters</div>
          <div className={`${valueClass} !text-2xl sm:!text-3xl [overflow-wrap:anywhere]`}>{charText}</div>
          <div className="text-[11px] text-mutedtext font-mono">correct / incorrect / extra / missed</div>
          {record.correctedWords !== undefined && record.correctedWords > 0 && (
            <div className="text-[11px] font-mono text-accent mt-0.5">
              +{record.correctedKeys ?? 0} keystrokes corrected across {record.correctedWords} {record.correctedWords === 1 ? 'word' : 'words'} (fixed with backspace)
            </div>
          )}
        </div>
        <div className="min-w-0 stagger-item cell-pop" style={{ '--stagger-i': 3 } as CSSProperties}>
          <div className={labelClass}>consistency</div>
          {record.consistency != null ? <AnimatedValue value={record.consistency} format={(value) => `${Math.round(value)}%`} className={`${valueClass} !text-2xl sm:!text-3xl`} /> : <div className={`${valueClass} !text-2xl sm:!text-3xl`}>—</div>}
        </div>
        <div className="min-w-0 stagger-item cell-pop" style={{ '--stagger-i': 4 } as CSSProperties}>
          <div className={labelClass}>time</div>
          <div className={`${valueClass} !text-2xl sm:!text-3xl`}>{record.duration}s</div>
          <div className="text-[11px] text-mutedtext font-mono">{new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} session</div>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-7 pt-5 border-t border-darkborder">
        <button onClick={handleShare} className="flex items-center gap-2 px-3.5 py-2 bg-darkbg hover:bg-darkborder rounded-lg border border-darkborder text-xs font-medium glow-ring">
          {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Share2 className="w-3.5 h-3.5" />}<span>{copied ? 'Copied to Clipboard!' : 'Copy Result'}</span>
        </button>
        <button onClick={onRestart} className="btn-shine flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accenthover text-black font-extrabold rounded-xl glow-accent active:scale-95 text-sm shrink-0" title="Restart Test (F1)">
          <RotateCcw className="w-4 h-4" />Next Test
        </button>
      </div>
      {copyError && <p role="status" className="text-xs text-wrongred mt-3">{copyError}</p>}
    </div>
  );
};
