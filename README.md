# Porus.ai website

The global company homepage for Porus.ai, positioned as the human expression company.

The site presents Porus as a long-term product company while keeping the present boundary explicit: Porus Studio is a technical alpha with one evidenced English to Hindi short-form test route, and the wider suite is a roadmap.

## Local preview

No build step or package install is required.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Structure

| File | Purpose |
|---|---|
| `index.html` | Semantic page structure, global company narrative, product truth, and metadata |
| `styles.css` | Porus visual system, responsive layouts, aurora, horizontal history, and cinematic passage |
| `site.js` | Motion coordinator, hyperspace canvas, language passage, navigation, and real audio players |
| `DESIGN.md` | Design tokens, interaction grammar, narrative rhythm, and guardrails |
| `logo.svg` | Existing Porus.ai wordmark, intentionally preserved |
| `favicon.svg` | Existing Porus.ai mark, intentionally preserved |
| `sample-en.wav` / `sample-hi.wav` | Prerecorded technical-alpha audio example |
| `assets/*.woff2` | Self-hosted open-source display and interface fonts |

## Signature experience

- A living emerald, cyan, and violet aurora over a lifted midnight-blue field
- Faint seeded stars that gather speed through the horizontal history and reappear in the next-frontier chapter already in motion
- One desktop horizontal story of speech, writing, print, recording, the internet, and understanding
- A full-viewport, scroll-pinned English to Hindi scene with real prerecorded samples
- A stable pointer-responsive light and depth treatment across the future product suite, with no layout shift
- Bright editorial sections that interrupt the night field and prevent an all-black page rhythm
- Restrained glass used for navigation and controls, not as generic page furniture

## Product-claim boundary

- Studio is described as a technical alpha, not a generally available product.
- English to Hindi is the only currently represented test route.
- The audio samples use preset synthetic test voices and are not presented as a benchmark.
- API, Live, Archive, and the integrated review workflow are visibly labelled as future or in-development directions.
- The global company story remains separate from the India public-mission narrative.

## Accessibility and performance

- Keyboard-accessible mobile navigation, skip link, visible focus, and labelled audio controls
- One-at-a-time audio playback and a pausable cinematic sample
- Dynamic durations from real media metadata and decoded sample waveforms
- Live language announcement for the scroll-driven sample
- Reduced-motion mode removes pinned horizontal travel, freezes kinetic language, shortens the cinematic section, and presents both language states together
- Canvas resolution is capped at 1.5 times device pixel ratio and resized only when layout changes
- Low-intensity history streaks use inexpensive flat strokes; gradient streaks are reserved for the short peak and velocity is normalized across frame rates
- A single animation coordinator pauses with the page and avoids competing scroll handlers

## Validation

The current build is checked in local Chromium at 1440 by 1000 and 390 by 844, plus a reduced-motion context. JavaScript is also parsed with JavaScriptCore. See `CHANGELOG.md` for the current redesign notes.
