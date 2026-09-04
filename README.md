# Porus.ai website

The global company homepage for Porus.ai, positioned as the human expression company.

The site presents Porus as a long-term product company while keeping the present boundary explicit: Porus Studio is a technical alpha with one evidenced English to Hindi short-form test route, and the wider suite is a roadmap.

## Local preview

Node 18+ and npm required. The site is a Vite project.

```bash
npm install
npm run dev        # http://localhost:4173
```

Production build:

```bash
npm run build      # emits dist/
npm run preview    # serves dist/ locally
```

## Structure

```
.
├─ index.html              Vite entry, semantic page structure
├─ package.json            Vite scripts + deps
├─ vite.config.js          Build config (dist/, cache-busting hashes)
├─ src/
│  ├─ main.js              Motion coordinator, canvas, audio, auth portal
│  └─ styles.css           Design system + auth portal + glass tokens
├─ public/                 Served as-is at /
│  ├─ CNAME                GitHub Pages domain pin
│  ├─ favicon.svg
│  ├─ logo.svg
│  ├─ sample-en.wav
│  ├─ sample-hi.wav
│  └─ assets/*.woff2       Self-hosted display + interface fonts
├─ DESIGN.md               Design tokens, interaction grammar, guardrails
├─ PITCH.md                Company narrative
└─ CHANGELOG.md            Human-readable history
```

## Extending the framework

- **Add a page** — drop a new `.html` file at the repo root and register it in `vite.config.js` under `build.rollupOptions.input`. Vite treats each entry as its own document with its own script.
- **Add React / Vue / Svelte** — `npm i @vitejs/plugin-react` (or the matching plugin) and mount islands from `src/main.js`. The existing vanilla animations keep working.
- **Add TypeScript** — rename `main.js` to `main.ts`, add `tsconfig.json` with `"allowJs": true, "strict": false` to migrate gradually.
- **Wire real SSO** — the auth portal already emits `console.info("[porus.auth] SSO requested", provider)` and submit payloads. Point those at your auth backend (e.g. NextAuth, Clerk, Supabase Auth, Auth.js).
- **Deploy** — `npm run build` produces a static `dist/` you can push to any host (GitHub Pages, Vercel, Netlify, Cloudflare Pages, S3).

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
