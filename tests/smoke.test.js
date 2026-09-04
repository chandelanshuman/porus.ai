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
    const opens = html.match(/data-auth-open/g) ?? [];
    expect(opens.length).toBe(3);
  });

  it("styles.css defines the shared glass tokens", () => {
    const css = readFileSync(resolve(root, "src/styles.css"), "utf8");
    for (const token of ["--glass-bg", "--glass-border", "--glass-blur", "--r-pill"]) {
      expect(css).toContain(token);
    }
  });

  it("main.js wires the auth portal open/close and tabs", () => {
    const js = readFileSync(resolve(root, "src/main.js"), "utf8");
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
  });
});
