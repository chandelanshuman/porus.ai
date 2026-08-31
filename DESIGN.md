# Porus.ai design system

Status: active global-company website direction, August 2026.

## 1. Design thesis

Porus should feel like a new communication medium becoming visible, not like a SaaS landing-page kit. The visual world is a luminous polar night in which language behaves like light, sound, distance, and memory.

The page begins close to one human voice, travels laterally through the history of communication while faint stars gather speed, and lands inside one language-crossing moment. It then settles into product proof, company scope, and trust.

The emotional tone is ambitious, intimate, and calm. Porus is not loud futurism. It is human history continuing.

## 2. Core principles

1. **The thesis comes before the interface.** The first viewport communicates the company idea, not a navigation scaffold or product screenshot.
2. **Motion carries the story.** History moves sideways, distance compresses into hyperspace, and language changes inside one pinned moment.
3. **Light creates depth.** Aurora, atmosphere, and full-width surface changes do more work than cards and shadows.
4. **Glass has a job.** Use it for navigation and media controls where foreground must remain legible over changing imagery.
5. **Proof stays honest.** Released capability, technical-alpha evidence, target architecture, and long-horizon ideas must never share the same status language.
6. **The logo remains unchanged.** `logo.svg` and `favicon.svg` are the current identity assets until a separate identity project replaces them.

## 3. Atmosphere and surfaces

The dark field is midnight blue and blue-green, never pure black. Bright editorial chapters provide deliberate daybreak moments after the long cinematic sequences.

| Token | Value | Role |
|---|---:|---|
| Midnight | `#071522` | Primary night field |
| Deep night | `#050f1a` | Footer and deepest canvas |
| Night teal | `#0b2832` | Lifted dark surface and aurora floor |
| Night violet | `#211a3b` | Cool-language destination |
| Night ink | `#f4f5ef` | Primary text on dark |
| Night secondary | `#c2d1ce` | Body text on dark |
| Paper | `#e8eee9` | Bright editorial chapter |
| Paper ink | `#162426` | Primary text on light |
| Paper secondary | `#536665` | Body text on light |
| Porus gold | `#e8a33d` | Existing logo accent, source-language state, high-value emphasis |
| Aurora green | `#75e5c8` | Living atmosphere and focus |
| Polar cyan | `#70d8ed` | Secondary atmospheric light |
| Passage violet | `#b18cff` | Hindi destination state and cool atmosphere |

Aurora color is atmosphere, not a button fill. Porus gold is scarce and should remain tied to the logo, the source-language state, or one important emphasis.

## 4. Typography

### Display

Newsreader at weight 300 is the editorial voice. It carries hero language, chapter titles, historical concepts, and philosophical statements.

- Maximum display size: `6rem`
- Typical line height: `0.91` to `0.98`
- Tracking: `-0.025em` to `-0.035em`
- Never set display copy in a heavy weight
- Keep headings short enough to read as composed statements

### Interface and body

Manrope carries navigation, body copy, controls, evidence labels, and metadata.

- Body range: `0.84rem` to `1.04rem`
- Lead range: `1.13rem` to `1.55rem`
- Default line height: `1.6`
- Use weight 600 only for controls, status boundaries, and concise emphasis

### Font provenance

The website self-hosts Latin WOFF2 subsets downloaded from Google Fonts on 31 August 2026:

- Manrope: `assets/manrope-latin.woff2`, source family [Manrope](https://fonts.google.com/specimen/Manrope)
- Newsreader: `assets/newsreader-latin.woff2`, source family [Newsreader](https://fonts.google.com/specimen/Newsreader)

Both families are distributed under the SIL Open Font License. Devanagari falls back to `Noto Sans Devanagari` and the visitor's sans-serif script fallback.

## 5. Layout and rhythm

- Maximum content shell: `1240px`
- Fluid gutter: `20px` to `56px`
- Major chapter spacing: roughly `130px` to `230px`
- Body measure: no more than `72ch`, usually `35ch` to `54ch`
- Desktop compositions may use asymmetry, but reading order remains linear in the HTML
- Full-width bands, not repeated cards, divide the story
- Bright and night surfaces change by chapter, not every component

The principal sequence is:

1. Kinetic human premise
2. Horizontal history of communication
3. Bright explanation of what literal translation loses, briefly occluding the moving starfield
4. Next-frontier chapter with the warp already in motion
5. Full-viewport English to Hindi passage
6. Bright Studio proof and real audio
7. Night company platform and product suite
8. Bright trust principles
9. Aurora close

## 6. Signature interaction

The website has one orchestrated motion thesis:

> Human history moves laterally, faint lights compress distance, one human moment crosses language, and the interface settles into proof.

### Horizontal history

Desktop uses a sticky horizontal passage through Presence, Time, Scale, Performance, Reach, and Understanding. Touch layouts expose the same sequence as horizontal scroll-snap. Reduced motion leaves it in normal flow.

Only one horizontal narrative is allowed per page. Do not add marquees or a second scroll-jacked rail.

### Starfield and hyperspace

Stars begin as seeded, faint points. Their outward velocity rises with the lateral history passage, continues unseen behind the bright loss chapter, and is already legible when the next-frontier chapter arrives. It then peaks sharply before the demo and lands as the cinematic scene fills the viewport. A shorter inward passage marks the exit.

The warp belongs only to the history-to-language journey. It must not continue into the product and trust chapters or become a generic full-page background effect.

### Language passage

The scene pins for one scroll chapter. Progress changes the sky from warm teal and gold toward violet, changes English to Hindi, switches the real prerecorded sample after user initiation, and announces the language state to assistive technology.

Audio is always user-initiated and pausable. The samples are labelled as prerecorded preset synthetic voices and not a quality benchmark.

## 7. Depth and glass

Depth comes from light and composition first.

| Level | Treatment | Use |
|---|---|---|
| Field | Full-width color and atmospheric light | Primary chapters |
| Ruled content | One hairline, no shadow | Workflow, audio rows, trust principles |
| Lifted chapter | Surface color shift | Current product row |
| Functional glass | Blur, one border, inner top light, soft offset shadow | Navigation and media controls only |

Do not place glass cards inside glass cards. Do not use blur simply to make a section look premium. Do not combine a visible border with a broad decorative shadow unless the element is a control floating over imagery.

## 8. Components

### Navigation

A single rounded rectangle floats near the viewport edge. It remains dark enough to work over night and bright sections. The current SVG wordmark is rendered at roughly `154px` desktop and `138px` mobile.

### Buttons

Buttons use a modest `10px` radius, not a pill. The primary action is light paper on night. The secondary action is functional glass. On light fields, text links with a visible underline are preferred over additional boxes.

### Product suite

Products are full-width rows, not equal card tiles. Status sits opposite the product name. Only Studio receives a lifted atmospheric surface because it is the current proof.

On fine pointers, a restrained local light field follows the pointer within the active row while the product copy and status move a few pixels in opposing depth. The row never changes size, Studio never loses its permanent gradient, and informational rows keep the native cursor because they are not links. Touch and reduced-motion layouts remain static.

### Real audio

Audio rows use real media, decoded waveforms, duration metadata, exclusive playback, and clear play, pause, and ready states. Circular geometry is reserved for the play control.

## 9. Responsive behavior

- The company premise remains complete within the first mobile viewport.
- Decorative signal labels disappear on mobile so they cannot collide with reading copy.
- Horizontal history becomes user-controlled scroll-snap below `821px`.
- All two-column editorial sections collapse to one reading column.
- The mobile menu is a keyboard-operable glass panel with Escape dismissal.
- The pinned demo shortens from `300vh` to `250vh` on mobile.
- Reduced motion removes horizontal pinning, freezes the first kinetic word, makes the demo one viewport tall, presents English and Hindi together, and uses a static starfield.

## 10. Browser surfaces and accessibility

- Aurora-green focus ring with a `5px` offset
- Palette-aware text selection and scrollbars
- Skip link before the navigation
- Semantic headings and ordered history/workflow sequences
- Visible and labelled pause states for all audio
- Live announcement when the language passage changes
- Minimum target size of roughly `44px` for primary controls
- Text contrast target: WCAG AA or better

## 11. Product and copy guardrails

Current truth:

- Porus Studio is a technical alpha.
- One English to Hindi short-form test route is evidenced.
- Samples use preset synthetic voices.
- The integrated review experience, secure media handling, and repeatable benchmarks are in development.

Do not claim:

- Every language or broad language support
- General availability
- Self-hosting or secure deployment before it exists in practice
- Guaranteed emotional preservation, exact timing, or original-voice retention
- A live demo when the example is prerecorded
- Released API, Live, Archive, passport, or approval controls

The India narrative belongs on a separate page and campaign system. It may share the Porus principles of meaning, emotion, trust, and human authority, but it must not be folded into this global homepage as a patriotic reskin.

## 12. External design references

The direction uses the requested tools as critical references, not templates:

- [Taste](https://www.tasteskill.dev/) for audit-first decisions, one motion thesis, restrained density, and avoidance of generic AI landing-page habits
- [Impeccable](https://impeccable.style/) for an explicit visual contract, craft-floor checks, responsive finish review, and documentation
- [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md) for repeatable design-system structure
- ElevenLabs analysis for light editorial type and atmospheric color
- Runway analysis for cinema-wide pacing and an interface that recedes behind the authored experience
- Framer analysis for motion-led chapter changes
- Renault analysis for decisive full-width color blocking rather than a page made from cards

Porus should never reproduce another company's recognizable layout or trade dress. These references inform discipline, not identity.

## 13. Do and do not

Do:

- Let one strong authored moment carry each chapter
- Alternate night and bright fields deliberately
- Keep glass rare and functional
- Use real audio and honest status language
- Preserve asymmetry, calm, and generous pacing
- Review the actual copy at desktop and mobile widths

Do not:

- Return to an all-black canvas
- Use a generated portrait as a substitute for the product idea
- Reintroduce “Change the language. Keep the human.”
- Build the page from same-size cards
- Add generic grids, neon borders, gradient text, or decorative dashboards
- Add another horizontal rail or unrelated reveal effect
- Restore unsupported claims from the earlier website
