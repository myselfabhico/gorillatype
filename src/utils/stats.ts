export function calculateWpm(correctKeystrokes: number, timeInSeconds: number): number {
  if (timeInSeconds <= 0) return 0;
  const minutes = timeInSeconds / 60;
  const wpm = (correctKeystrokes / 5) / minutes;
  return Math.max(0, Math.round(wpm));
}

export function calculateRawWpm(totalKeystrokes: number, timeInSeconds: number): number {
  if (timeInSeconds <= 0) return 0;
  const minutes = timeInSeconds / 60;
  const rawWpm = (totalKeystrokes / 5) / minutes;
  return Math.max(0, Math.round(rawWpm));
}

export function calculateAccuracy(correctKeystrokes: number, totalKeystrokes: number): number {
  if (totalKeystrokes <= 0) return 100;
  const acc = (correctKeystrokes / totalKeystrokes) * 100;
  return Math.min(100, Math.max(0, Math.round(acc * 10) / 10));
}
