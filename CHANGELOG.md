# Porus — Website Rebuild

A single-file, zero-dependency marketing site for **Porus.ai** — an AI dubbing platform that makes video sound like it was made in the audience's language. Built as a complete "liquid glass" cinematic experience with a warm/cool journey palette that flows through the entire page.

**Live:** [porus.ai](https://porus.ai) · **Repo:** [chandelanshuman/porus.ai](https://github.com/chandelanshuman/porus.ai)

---

## What's in the site

| Layer | What it does |
|---|---|
| [index.html](index.html) | The entire site — HTML, CSS, JS in one file, no build step, no dependencies |
| [logo.svg](logo.svg) | Wordmark + P monogram in the warm-gold gradient |
| [favicon.svg](favicon.svg) | Rounded-square P monogram for the browser tab |
| [sample-en.wav](sample-en.wav) | 3.15s English speech ("We were never going to make it through the pass before nightfall") — macOS Samantha voice |
| [sample-hi.wav](sample-hi.wav) | 3.49s Hindi translation, macOS Lekha voice |
| [PITCH.md](PITCH.md) | Source pitch content used to structure the copy |

---

## Design system

### The Liquid Glass aesthetic
- **Ambient backdrop** — two full-viewport gradient layers (warm + cool) that cross-fade via a global `--journey` CSS custom property
- **Three floating orbs** hue-rotate 0° → 220° with the same variable
- **Glass primitive** (`.glass`) — translucent tint, saturated backdrop-blur, inner top-highlight and bottom-shadow (concavity), edge chromatic aberration via `mix-blend-mode: screen`
- **Metallic + gold gradient text** — two treatments: cool silver `.metal` for keynote lines, warm `.gold` for accents
- **Floating pill navigation** with backdrop blur, matching iOS 26 / macOS Tahoe direction
- **Cursor-reactive audio** — hero, timing and stem waveforms use a coupled spring simulation: cursor momentum lifts nearby bars, energy propagates into their neighbours, and the waveform rings down naturally after the pointer passes; champagne-gold by day, aurora green/cyan by night

### The whole-page journey (warm → cool → warm)
The site's ambient palette flows through a single sine-curve arc as you scroll top-to-bottom:

| Section | `--journey` | Palette |
|---|---|---|
| Hero | 0.00 | Warm amber sunrise |
| Highlights | ~0.15 | Warming up |
| **Demo enters** (English) | ~0.40 | Warm peak, amber sun |
| **Demo exits** (Hindi) | ~0.55 | Cool violet moon |
| Timing / Sound / Trust | ~0.75 | Cool violet lingers, warm floor bleeding in |
| Two paths / Availability | ~0.55 | Warming back |
| CTA | ~0.30 | Warm returning |
| Footer | 0.00 | Warm — full circle |

Powered by a single sine function `sin(pageProgress · π)` smoothed with `smoothstep`, updated on `scroll` and `resize` via `requestAnimationFrame`.

### The cinematic demo section
- **Edge-to-edge**: 100vw × 100vh, no border radius, no visible frame
- **Canvas-drawn scene**: parallax mountain silhouettes, sun/moon disc, ambient haze, floating particles, subtle drift over time
- **Language morph**: the title "Watch it become **English**" crossfades to "Watch it become **हिन्दी**"
- **Scroll-driven language switch**: 0–55% scroll = English (warm palette), 55–100% = Hindi (cool palette)
- **Real speech audio**: two macOS TTS voices, gapless crossfade to a shared music bed conceptually (the visual proves "the score survives")
- **Reactive waveform strip** driven by Web Audio API `AnalyserNode` — the bars pulse to the actual speech
- **Seamless section blend**: canvas is masked at top/bottom so the ambient page palette bleeds through the video edges; two halos above/below extend the video's warm/cool palette 70vh into the surrounding sections. The seam vanishes.

### The light / dark theme system
- **Warm off-white** `#F7F3EC` (paper cream, not clinical) for the light mode base
- **Night-sky blue-black** `#04060A` for dark — tinted so the aurora sits on it naturally
- **Time-of-day auto**: `06:00–18:59` → light, `19:00–05:59` → dark on first visit
- **Manual override**: single click pins your choice to `localStorage`
- **Reset to auto**: double-click the sun/moon toggle
- **Live boundary flip**: `setInterval` + `visibilitychange` re-check every minute
- **Meta `theme-color` sync**: mobile browser chrome matches the current mode
- **Smooth 500ms transitions** on every themable surface — no jarring flash
- **The video stays cinematically dark in both modes** (it's a video); its halos still respond to `--journey` so the seam blend works either way

### The theme-reveal moment
Clicking the sun/moon toggle doesn't just swap palettes — the new theme physically spreads from the button:
- **Circular reveal** via the View Transitions API: the incoming theme is clipped to a circle that grows from the toggle until it covers the page (750ms), with a golden glow burst on the button itself
- **Crisp wipe edge**: the default cross-fade is disabled and per-element color transitions are frozen during the wipe, so the circle boundary is a clean line between two fully-settled themes
- **A flock takes flight** once the theme has fully spread: **five bats** scatter right when night falls, **five golden doves** when day breaks — hand-drawn SVG silhouettes launched from the toggle with staggered delays, varied sizes, fan-out paths, and de-synced wing beats so they read as a loose flock
- **Graceful fallbacks**: browsers without View Transitions get the plain switch (flock included); reduced-motion users get neither

### Night mode: aurora + starfield
Dark mode is a night sky, not just an inverted palette:
- **Aurora borealis ambience** — the ambient orbs retint to aurora emerald / polar cyan / violet, the backdrop wash goes emerald with teal-violet fringes, and two blurred aurora curtain bands sway slowly across the top of the sky (26s / 34s cycles, `mix-blend-mode: screen`)
- **The scroll journey stays in-band**: dark mode caps the hue rotation at 60° so scrolling drifts the aurora green → teal → blue instead of swinging into reds (light mode keeps its 220° warm→cool arc)
- **Canvas starfield** between the backdrop and the orbs: up to 220 faint twinkling stars, a few tinted aurora green/cyan, seeded with `19770525` so the sky is identical on every visit
- **Hyperspace morph**: scrolling toward the demo stretches the stars into radial streaks that drift outward — a whisper of the Star Wars jump, peaking as the video fills the viewport — then the effect **plays in reverse after the video**: stars streak and drift inward, easing back to calm points, like dropping out of lightspeed on the far side
- All of it is night-only, one canvas at capped 1.5× DPR, static single-draw under reduced motion

---

## Real audio, real trouble

Getting speech to actually play involved three separate fixes:

1. **Web Audio synthesis was wrong.** The first version used sawtooth + formant filters to fake speech. Sounded like a sci-fi transporter. Scrapped it entirely.

2. **Used macOS `say` for real TTS.** Samantha for English, Lekha for Hindi, piped through `afconvert` to WAV. But `afconvert` pads the audio data offset to 4096 bytes, which strict Chromium contexts reject as an unknown format.

3. **Rewrote WAVs with clean 44-byte headers** via Python's `wave` module. Files became leaner (~277KB / ~307KB) and browser-standards-compliant.

4. **VS Code's Simple Browser still refused `file://` audio playback** even after step 3, though `fetch()` on the same file returned OK. Added `upgradeToBlob()`: on load, fetch each file and swap the `src` for a `blob:` URL. Works around the file:// restriction; invisible no-op over HTTP.

---

## Commit history

| Hash | Description |
|---|---|
| `3833da6` | Liquid Glass redesign + SVG logos |
| `d57a791` | Real audio samples + HTML5 player |
| `df9ea03` | Scroll-triggered cinematic demo |
| `afda60f` | Edge-to-edge video + whole-page journey palette |
| `9970bdd` | Video edge blend with ambient palette |
| `3edaf6e` | Audio playback fix (clean WAV headers + Blob URL) |
| `c053d89` | Cinema halos for seamless section blending |
| `2486215` | Light / dark theme toggle |
| `26ca7c4` | Warm off-white light theme + time-of-day auto theme |
| `4360ca5` | Hero headline: "Say it once" → "Said it once" |
| `f3178fd` | New branding: minimalist P mark + animated sound dot |
| `57670f2` | Bigger brand mark + golden glow |
| `0c7c43e` / `3b278ab` | P logo bottom line for clarity |
| `ad543ed` | Circular theme-reveal animation + always start at top on reload |
| `a600119` | Aurora borealis palette for night mode |
| `31d523f` | Night-mode starfield with scroll-driven hyperspace morph |
| `89abbe5` | Bat released from the theme toggle when night falls |
| `8b1bd2b` | Hyperspace morph plays in reverse after the video |
| `9ba8a70` | Flocks: five doves by day, five bats by night |

---

## How to run it locally

Just open the file — no build, no server, no install:

```
open index.html
```

Or drop the folder into any static host (GitHub Pages, Netlify, Vercel, S3+CloudFront, plain nginx). The `CNAME` file targets `porus.ai`.

For a proper local server (audio works without the blob fallback):

```bash
python3 -m http.server 4173
# then open http://localhost:4173
```

---

## Browser support

- **Chromium (Chrome / Edge / Arc / Brave)** — full support
- **Safari 16.4+ / iOS 16.4+** — full support (uses `color-mix()`, `backdrop-filter`, `aspect-ratio`, `clamp()`)
- **Firefox 113+** — full support
- **Reduced motion** — respected: orb drift, waveform animation, and pinned-scroll transitions disable cleanly
- **Prefers-color-scheme** — respected as a fallback when no manual preference is saved and time-of-day resolution fails

---

## Directions you could push further

- Real speaker photography or a licensed short video clip inside the cinematic viewport instead of the canvas scene
- More language pairs (Tamil, Marathi, Bengali) with the same scroll-morph mechanic
- Testimonial logos strip under the Trust pillar
- Honest changelog page ("what got better this month") — reinforces the "we tell you the edges" positioning
- Contact form + waitlist capture instead of `mailto:` links
- OG image generator (currently referenced but not present)
