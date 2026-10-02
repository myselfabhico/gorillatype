# GorillaType

A browser-based typing platform: timed speed tests, paragraph practice, custom
text drills, and a live AI/friend race — all local, no backend required.

## Stack

- **React 19** + **TypeScript** (strict, `verbatimModuleSyntax`)
- **Vite 8** for dev server and production builds
- **Tailwind CSS 3** for layout/utility styling
- **Oxlint** for linting
- Themes are CSS custom properties on `[data-theme]`, so every surface re-skins
  from one token set (see the block at the top of `src/index.css`)
- Persistence is cookie-based (`src/utils/cookies.ts`) — profile, settings,
  daily goal, and the per-key mistake accumulator
- Audio is fully synthesized with the Web Audio API (`src/utils/sound.ts`); no
  audio assets

## Features

| Feature | Entry point |
| --- | --- |
| Timed typing test | `src/components/TypingWorkspace.tsx` |
| Text & literature practice | `src/components/TextPracticeMode.tsx` |
| Custom text drills | `src/components/CustomMode.tsx` |
| Race mode (AI / local rivals) | `src/components/RaceMode.tsx` |
| Results card, chart, problem-key report | `src/components/ResultsCard.tsx` |
| Daily practice goal + celebration | `src/hooks/useDailyGoal.ts` |

Supporting logic lives in `src/utils/`: scoring (`stats.ts`), word generation
(`wordModifiers.ts`, `wordBanks.ts`), per-key mistake insights
(`keyInsights.ts`), and the race engine (`raceEngine.ts`, `racePrefs.ts`,
`raceQuotes.ts`).

## Project structure

```
src/
  components/   UI components, one feature area per file
  hooks/        Stateful logic shared across components
  utils/        Pure logic: stats, word banks, cookies, sound, race engine
  types/        Shared domain types (settings, records, insights)
  assets/       Images bundled by Vite
public/         Brand assets and crawler files, served from the site root
scripts/        Repo tools that generate code and art (not shipped)
```

## Brand assets

The logo is the mascot itself, generated once from the artwork by
`scripts/brand-assets.py` and committed to `public/` — the build only copies it.
The script has no image library to lean on, so it decodes and re-encodes PNGs
itself and resamples with a premultiplied box filter, which is what keeps the
mascot's soft edges free of the dark halo a naive resize would leave against the
tile.

| File | Used for |
| --- | --- |
| `favicon.svg`, `favicon-*.png`, `favicon.ico` | The head on the accent tile, which is the part that reads at 16px where the whole mascot is a smudge; the ICO covers bare `/favicon.ico` lookups |
| `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png`, `site.webmanifest` | Home-screen and installed-app icons. The maskable one is full-bleed, since Android crops the tile to its own shape |
| `og-image.png` | The 1200x630 share card for social previews |
| `gorilla-logo.png` | The in-app logo, on the accent tile in the navbar and the modes drawer |

`index.html` links every one of these with absolute `/` paths, because a crawler
picking a favicon or a share card for a search result does not run the app and
only has the markup to go on. `robots.txt` and `sitemap.xml` are what let those
crawlers find the pages at all.

## Getting started

```bash
npm install
npm run dev        # dev server with HMR
npm run build      # tsc -b && vite build
npm run preview    # serve the production build
npm run lint       # oxlint
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `F1` | Restart the test |
| `F2` | Toggle the timer |
| `F3` | Cycle difficulty |
| `F4` | Open the theme drawer |
| `Tab` | Focus the typing input |
| `Esc` | Close the active drawer/modal |

## Notes

- The app owns both of its light and dark themes, so it tells the browser to
  stop "helping": `index.html` ships `<meta name="color-scheme" content="only light">`
  and each theme block in `src/index.css` declares its own `color-scheme` — `dark`
  for the dark themes, `only light` for the four light ones. Without that, an OS
  dark mode drags the light themes down with it, and Chrome's Auto Dark Theme
  repaints the mascot (a dark logo on a coloured tile is exactly what it inverts,
  and the result reads as a near-white gorilla). `only light` is the documented
  opt-out; the matching `<meta name="darkreader-lock">` covers the *extension*
  dark modes, which do not read `color-scheme` at all. The logo also carries
  `.brand-mark`, a per-element `color-scheme: only light`, so the tile is out of
  reach even if a page-level signal is missed. The trade-off is deliberate: a
  light theme keeps light scrollbars and form controls under an OS dark mode,
  because that is what "a light theme" has to mean.
- Brand assets are committed, so a favicon change only reaches a browser that
  has not cached the old one — expect to hard-reload (Ctrl+Shift+R), and expect
  search results and social previews to lag until the deployed site is re-crawled.
- User settings are stored in a cookie and merged over `DEFAULT_SETTINGS`, so
  unknown or stale cookie keys are ignored safely.
- The on-screen keyboard carries its own settings: the *Keyboard settings* chip
  in the row underneath the board opens a popover with `Virtual keyboard`,
  `Color zones` and `Virtual hands` (all wired through `UserSettings` and
  persisted in the settings cookie). It sits clear of the artwork so it can
  never cover a key, a finger or a wrist. The same board/hands switches also sit
  in the Display row of the settings bar, which is how the board is brought back
  once it has been hidden.
- The board is drawn from the reference design's own measurements in
  `src/utils/keyboardLayout.ts` (a 15-unit ANSI plate: no backquote, short right
  Shift plus an arrow cluster, and a Control/Alt/Code/Fn bottom row).
- The hands type along. The trace of the reference artwork lives in
  `src/utils/handArt.ts`; `scripts/build-hand-rig.mjs` cuts it into a rig — one
  part per finger plus a palm/wrist part, sliced along the seams the drawing
  already has — smooths the trace's stair-stepped borders, and writes
  `src/utils/handRig.ts`. At rest the parts tile back into exactly the traced
  silhouette, and because every cut is a straight line the parts meet without a
  seam while each finger can move on its own. Each part keeps its *whole* hand's
  outline and body, cut to its own region by a `clipPath` at render time rather
  than by the generator: the cut runs across a contour that turns back on itself
  at every seam, and letting the renderer make it keeps those seams exactly as
  traced. `src/utils/handPose.ts` solves the rig: the hand does the aiming — its
  wrist shift, lean and turn are applied to every part at once, so the fingers
  keep their exact relative geometry — and the finger stretches along one axis
  until its tip reaches the key the test is waiting for. That axis is the mean
  of the two cuts the finger shares with its neighbours, so a stretch is a map
  that scales one direction and fixes the perpendicular one, and both cuts stay
  on the lines they were drawn on: a finger that moved straight up instead would
  drag each cut sideways across the neighbour's body by several pixels and leave
  its outline lying on it. A finger is pinned on the line `y = RIG_PIVOT_Y` and
  only ever scaled about it, because that leaves the line where it is — a
  rotation would lift the finger's base out of the palm. The seams the axis
  cannot follow exactly (the thumb's and the little finger's outer side is a
  plain boundary rather than a drawn seam, so neither cut is quite parallel to
  it) slide by a couple of pixels at full stretch, which is why each part's
  region reaches four pixels past its cuts: the neighbours overlap in ink the
  artwork already draws between the fingers, and a slide can then never open a
  gap for a finger to break through.
- The keyboard's materials are deliberately theme-independent: the `--kb-*`
  tokens resolve once in `:root`, so the plate, caps and word legends look
  identical in every theme and under a dark browser chrome. Only the key the
  test is waiting for is themed — it is filled with a pale mix of
  `--color-accent`, with `--kb-wrong` derived the same way for the error flash —
  and the finger that owns it is shadowed in the plain accent, so the guide reads
  on the hands as well as on the caps.
  `Color zones` tints each cap and fingertip with its touch-typing finger zone.
- Rendering costs are kept low by painting each keycap as one path with a
  shared label layer. The hands are animated by `src/components/TypingHands.tsx`,
  which springs every joint itself and writes the `transform` attributes on each
  frame — so a keystroke moves the rig without a single React re-render, the
  movement is smooth at any frame rate, and the press reads as a soft tap on the
  key. The rig is drawn in two passes, every piece's outline first and every
  piece's body over it: the visible dark is then the hand's outline minus the
  hand's body, which is what the artwork draws anyway, and no piece can paint
  its line across a neighbour whatever the two of them are doing. Painting a
  piece's body straight after its own outline instead leaves a faint dark line
  lying along every seam (the next piece's outline crossing it), which is what
  the two passes exist to prevent. The finger that owns the highlighted cap is
  washed in the accent that cap is drawn in, painted with the same contour inside
  the same transformed group so it travels with the finger — and clipped to a
  second region (the `wash` string on each part) rather than to the overlapping
  one: a four-pixel overlap is invisible between bodies painted in the same
  opaque colour, but a tint would show up on the finger next door.

  That region is the finger's own outline dug out of the trace, not a strip
  between its two seam lines. A strip is what a finger with straight sides looks
  like, and the drawn fingers are bent: mid-finger the strip wanders some ten
  units off the finger, and measured over the middle and ring fingers it left a
  fifth of the finger bare on one side while a third of the tint lay off the
  finger altogether — the two ways the highlight used to look wrong. The drawn
  gaps between the fingers are the
  better guide, because they are what the eye reads as a finger's edge: each is a
  dead-end notch in the skin contour, so the outline runs down one side of the
  gap and back up the other, and the finger between two notches is exactly the
  stretch of contour from one notch bottom, round the tip, to the next — closed
  straight across the knuckle, which is where the notches bottom out. The `wash`
  path is that stretch, so the tint is cut from the same drawn skin the body is
  painted from and can neither stop short of the finger's edge nor cross the ink
  line between it and its neighbour. The thumb is the exception: its web is drawn
  as a single line rather than a gap, so it keeps the straight strip.

  It multiplies rather than tints. A wash mixed towards white sits a shade or two
  off the skin for any accent that is already warm — ember's is within a hair of
  it — and those themes lose the finger entirely; multiplying can only ever
  darken, so the highlight is a shadow of the accent and separates from the light
  skin whatever the hue, including a custom one. The washes are a third pass,
  painted over every body, because the finger drawn after its neighbour covers
  the shared seam with an opaque body of its own — under it, the tint would fall
  a few pixels short of that seam.
