/**
 * Race Mode quote bank.
 *
 * Self-contained on purpose: Race Mode uses fixed quotes (never the scrolling
 * word lists), so it owns its own bank of 1–3 sentence passages in the style of
 * TypeRacer's library — short-to-medium (roughly 130–240 characters), with real
 * punctuation and capitalization that must be typed exactly.
 *
 * Only plain ASCII is used (letters, spaces, . , ' " ? ! ; : -) so every
 * character is reachable on a standard keyboard.
 */
export const RACE_QUOTES: string[] = [
  'The only thing we have to fear is fear itself, nameless, unreasoning, unjustified terror which paralyzes needed efforts to convert retreat into advance.',
  'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief.',
  'All that we see or seem is but a dream within a dream. The boundaries which divide life from death are at best shadowy and vague.',
  'Sometimes all you need is twenty seconds of insane courage, just twenty seconds of embarrassing bravery, and I promise you something great will come of it.',
  'The greatest trick the devil ever pulled was convincing the world he did not exist, and just like that, he was gone, vanished like a whisper.',
  'Do not go where the path may lead; go instead where there is no path and leave a trail, for the world needs pioneers more than it needs followers.',
  'Happiness can be found even in the darkest of times, if one only remembers to turn on the light, and keeps a little hope in a pocket full of promises.',
  'I have seen things you people would not believe. Attack ships on fire off the shoulder of Orion, and stars glittering in the dark near the Tannhauser gate.',
  'Somewhere, something incredible is waiting to be known. The universe is not required to be in perfect harmony with human ambition, and that is fine.',
  'Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference in the long run, though nobody was watching.',
  'Life is what happens to you while you are busy making other plans, so pay attention to the small moments that quietly shape the rest of your days.',
  'The sky above the port was the color of television, tuned to a dead channel, and the rain fell like static across a fractured and humming mirror.',
  'In a hole in the ground there lived a hobbit, and it was not a nasty, dirty, wet hole filled with the ends of worms and an oozy smell, not at all.',
  'Ask not what your country can do for you, ask what you can do for your country, and remember that courage is nothing more than grace under pressure.',
  'Any sufficiently advanced technology is indistinguishable from magic, and any sufficiently careless sentence is indistinguishable from pure nonsense.',
  'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife and a quiet place to read.',
  'Keep your face always toward the sunshine and shadows will fall behind you, even when the road ahead feels longer than you happen to remember.',
  'We are what we repeatedly do. Excellence, then, is not an act but a habit, and small daily discipline beats rare flashes of inspiration every time.',
  'There is nothing either good or bad, but thinking makes it so, and the readiness is all when the moment finally arrives at last, unannounced.',
  'So we beat on, boats against the current, borne back ceaselessly into the past, while the green light flickers at the far edge of the dark bay.',
  'The best way to predict your future is to create it, one honest hour at a time, with a little patience for all of the noise along the way.',
  'It does not do to dwell on dreams and forget to live, and it is our choices that show what we truly are, far more than our raw abilities.',
  'A computer would deserve to be called intelligent if it could deceive a human into believing that it was human, and we are closer than we think.',
  'The nitrogen in our DNA, the calcium in our teeth, the iron in our blood, we are made of star stuff, and the wide cosmos is within us all.',
  'Begin at the beginning and go on until you come to the end, then stop, rest for a while, and begin again whenever you are ready to start.',
  'There is no greater agony than bearing an untold story inside you, so let it out, word by careful word, until the silence finally gives way.',
  'We choose to go to the moon in this decade and do the other things, not because they are easy, but because they are hard and worth the cost.',
  'All animals are equal, but some animals are more equal than others, and the pigs had a remarkable talent for rewriting the rules overnight.',
  'Time is the fire in which we burn, and yet we spend it as though it were a coin that could be saved up and spent again on another day.',
  'The question is not whether machines think but whether men do, and the answer is written in the quiet habits we practice when nobody is asking.',
];

/**
 * Pick a random quote, avoiding an immediate repeat of `excludeIndex`.
 * Returns the index so the caller can feed it back on the next race.
 */
export function pickRaceQuoteIndex(excludeIndex?: number): number {
  if (RACE_QUOTES.length <= 1) return 0;
  const index = Math.floor(Math.random() * RACE_QUOTES.length);
  // Never serve the same passage twice in a row.
  if (excludeIndex !== undefined && index === excludeIndex) {
    return (index + 1) % RACE_QUOTES.length;
  }
  return index;
}

export function getRaceQuote(index: number): string {
  return RACE_QUOTES[index] ?? RACE_QUOTES[0];
}
