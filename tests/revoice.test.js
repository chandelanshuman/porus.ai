import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/revoice.js', import.meta.url), 'utf8');
class Element {
  constructor() { this.attrs = {}; this.handlers = {}; this.dataset = {}; this.textContent = ''; this.value = ''; this.hidden = false; }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  addEventListener(event, callback) { (this.handlers[event] ??= []).push(callback); }
  async emit(event, extra = {}) { for (const cb of this.handlers[event] ?? []) await cb({ target: this, preventDefault() {}, ...extra }); }
  click() { return this.emit('click'); }
  focus() { this.focused = true; }
  remove() {}
}
class Media extends Element {
  constructor() { super(); this.paused = true; this.currentTime = 0; this.duration = 10; this.ended = false; }
  pause() { this.paused = true; this.emit('pause'); }
  async play() { this.paused = false; await this.emit('play'); }
}
function setup() {
  const names = ['play', 'caption', 'track', 'seek', 'time', 'status', 'line', 'edit-status', 'restore', 'reset', 'download'];
  const nodes = Object.fromEntries(names.map(name => [name, new Element()]));
  nodes.line.value = 'मूल पंक्ति'; nodes.caption.textContent = 'English source.';
  const panels = {};
  const tabs = ['listen', 'direct', 'deliver'].map(name => {
    const tab = new Element(); tab.dataset.rvTab = name; tab.setAttribute('aria-controls', name); panels[name] = new Element(); return tab;
  });
  const languages = ['en', 'hi'].map(name => { const el = new Element(); el.dataset.rvLanguage = name; return el; });
  const media = ['en', 'hi'].map(name => { const el = new Media(); el.dataset.rvAudio = name; return el; });
  const studio = {
    querySelector: selector => nodes[selector.slice(9, -1)],
    querySelectorAll: selector => ({ '[data-rv-tab]': tabs, '[data-rv-language]': languages, '[data-rv-audio]': media })[selector],
  };
  const document = new Element();
  const cinemaPause = { click: vi.fn() };
  const heroAudio = new Media();
  document.querySelectorAll = () => [heroAudio];
  document.querySelector = selector => selector === '[data-rv-studio]' ? studio : cinemaPause;
  document.getElementById = name => panels[name];
  document.body = { append: vi.fn() };
  const anchor = new Element(); document.createElement = () => anchor;
  const urls = { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() };
  vm.runInNewContext(source, { document, HTMLMediaElement: Media, Blob, URL: urls, setTimeout: vi.fn() });
  return { nodes, panels, tabs, languages, media, document, cinemaPause, heroAudio, urls, anchor };
}
describe('Revoice studio preview', () => {
  it('supports keyboard tab changes and pauses media when leaving listening', async () => {
    const f = setup(); await f.nodes.play.click();
    await f.tabs[0].emit('keydown', { key: 'ArrowRight' });
    expect(f.media[0].paused).toBe(true);
    expect(f.panels.listen.hidden).toBe(true);
    expect(f.panels.direct.hidden).toBe(false);
    expect(f.tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(f.tabs[1].focused).toBe(true);
  });
  it('switches language without overlapping playback and seeks the selected audio', async () => {
    const f = setup(); f.heroAudio.paused = false; await f.nodes.play.click();
    expect(f.heroAudio.paused).toBe(true);
    await f.languages[1].click();
    expect(f.media[0].paused).toBe(true);
    expect(f.nodes.caption.lang).toBe('hi');
    await f.nodes.play.click(); expect(f.media[1].paused).toBe(false);
    f.nodes.seek.value = '50'; await f.nodes.seek.emit('input');
    expect(f.media[1].currentTime).toBe(5);
    expect(f.nodes.time.textContent).toBe('0:05 / 0:10');
  });
  it('keeps text edits separate from sample audio and exports the edited script', async () => {
    const f = setup(); f.nodes.line.value = 'संशोधित पंक्ति'; await f.nodes.line.emit('input');
    expect(f.nodes['edit-status'].textContent).toBe('Edited in this preview');
    await f.languages[1].click(); expect(f.nodes.caption.textContent).toContain('मूल पंक्ति');
    await f.nodes.download.click();
    expect(await f.urls.createObjectURL.mock.calls[0][0].text()).toContain('संशोधित पंक्ति');
    expect(f.anchor.download).toBe('porus-revoice-preview-script.txt');
    await f.nodes.restore.click(); expect(f.nodes.line.value).toBe('मूल पंक्ति');
  });
  it('reports playback failures and pauses studio audio for the voice showcase', async () => {
    const f = setup(); f.media[0].play = vi.fn().mockRejectedValue(new Error('unavailable'));
    await f.nodes.play.click(); expect(f.nodes.status.textContent).toContain('Unable to play');
    f.media[1].paused = false;
    const cinema = new Media(); cinema.paused = false;
    await f.document.emit('play', { target: cinema });
    expect(f.media[1].paused).toBe(true);
    expect(cinema.paused).toBe(false);
  });
});
