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
- **Deep near-black** `#050506` for dark
- **Time-of-day auto**: `06:00–18:59` → light, `19:00–05:59` → dark on first visit
- **Manual override**: single click pins your choice to `localStorage`
- **Reset to auto**: double-click the sun/moon toggle
- **Live boundary flip**: `setInterval` + `visibilitychange` re-check every minute
- **Meta `theme-color` sync**: mobile browser chrome matches the current mode
- **Smooth 500ms transitions** on every themable surface — no jarring flash
- **The video stays cinematically dark in both modes** (it's a video); its halos still respond to `--journey` so the seam blend works either way

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
