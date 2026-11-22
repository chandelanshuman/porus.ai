import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

describe("porus.ai bundle contract", () => {
  it("index.html has an auth portal and three build-with-us openers", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    expect(html).toContain("data-auth-portal");
    expect(html).toContain("data-expression-canvas");
    expect(html).toContain("data-closing-stars");
    expect(html).toContain("data-history-progress");
    const opens = html.match(/data-auth-open/g) ?? [];
    expect(opens.length).toBe(3);
  });

  it("keeps the original story and separates the model from Revoice", () => {
    const home = readFileSync(resolve(root, "index.html"), "utf8");
    const revoice = readFileSync(resolve(root, "PorusRevoice/index.html"), "utf8");
    const story = ['class="kinetic-words"', 'id="mission"', 'class="loss-field"', 'class="passage-intro"', 'id="demo"'];
    let previous = -1;
    for (const marker of story) {
      const position = home.indexOf(marker);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    expect(home).toContain('id="porus-ai"');
    expect(home).toContain('href="/PorusRevoice/"');
    expect(revoice).toContain('href="/#porus-ai"');
    expect(revoice).toContain('data-rv-studio');
    expect(revoice).toContain('id="compare"');
    expect(revoice).toContain('src="/sample-hi.wav"');
    expect(home).toContain('href="/src/styles.css"');
    expect(home).toContain('src="/src/main.ts"');
    expect(revoice).toContain('href="/src/revoice.css"');
    expect(revoice).not.toContain('href="/src/styles.css"');
    expect(revoice).not.toContain('src="/src/main.ts"');
    for (const html of [home, revoice]) {
      expect(html).not.toContain('marketing.css');
      expect(html).not.toContain('Porus Studio');
    }
  });

  it("styles.css defines the shared glass tokens", () => {
    const css = readFileSync(resolve(root, "src/styles.css"), "utf8");
    for (const token of ["--glass-bg", "--glass-border", "--glass-blur", "--r-pill"]) {
      expect(css).toContain(token);
    }
  });

  it("main.js wires the auth portal open/close and tabs", () => {
    const js = readFileSync(resolve(root, "src/main.ts"), "utf8");
    expect(js).toContain("data-auth-portal");
    expect(js).toContain("openPortal");
    expect(js).toContain("switchTab");
    expect(js).toContain("porus:stars-converge");
    expect(js).toContain("porus:stars-aperture");
    expect(js).toContain("beginPortalSequence");
    expect(js).toContain("paintExpressionField");
    expect(js).toContain("beginExpressionFlight");
    expect(js).toContain("paintExpressionFlight");
    expect(js).toContain("paintClosingStars");
    expect(js).toContain("paintClosingFlight");
    expect(js).toContain("updateMobileHistoryProgress");
    expect(js).toContain("targetExpressionPointer");
  });
});
