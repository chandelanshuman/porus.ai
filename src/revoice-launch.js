const menu = document.querySelector('.rl-menu');
const links = document.querySelector('.rl-links');
function closeNavigation() {
  menu?.setAttribute('aria-expanded', 'false');
  links?.classList.remove('is-open');
}
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  links?.classList.toggle('is-open', open);
});
links?.addEventListener('click', event => { if (event.target.closest('a')) closeNavigation(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
    closeNavigation(); menu.focus();
  }
});
matchMedia('(min-width: 761px)').addEventListener('change', closeNavigation);
const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (!motion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-visible'); observer.unobserve(entry.target);
    }
  }, { threshold: 0.06 });
  document.documentElement.classList.add('rl-animate');
  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
  motion.addEventListener('change', event => {
    if (event.matches) { observer.disconnect(); document.documentElement.classList.remove('rl-animate'); }
  });
}
const samples = [...document.querySelectorAll('[data-launch-audio]')].map(audio => {
  const id = audio.dataset.launchAudio;
  return { audio, id, button: document.querySelector(`[data-launch-play="${id}"]`), progress: document.querySelector(`[data-launch-progress="${id}"]`), time: document.querySelector(`[data-launch-time="${id}"]`), name: id === 'en' ? 'English source' : 'Hindi rendition' };
});
const audioStatus = document.querySelector('[data-launch-status]');
const captions = document.querySelectorAll('[data-launch-caption] span');
function format(seconds) { return Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00'; }
// This standalone page has no cinematic crossfade: only one audio element plays.
document.addEventListener('play', event => {
  if (event.target instanceof HTMLMediaElement) document.querySelectorAll('audio').forEach(audio => { if (audio !== event.target) audio.pause(); });
}, true);
for (const sample of samples) {
  const update = () => {
    const playing = !sample.audio.paused && !sample.audio.ended;
    sample.button.closest('[data-take]')?.classList.toggle('is-playing', playing);
    sample.button.setAttribute('aria-pressed', String(playing));
    sample.button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${sample.name} sample`);
    sample.button.querySelector('path').setAttribute('d', playing ? 'M7 5h4v14H7zM14 5h4v14h-4z' : 'M9 5v14l11-7z');
    sample.progress.value = sample.audio.duration > 0 ? sample.audio.currentTime / sample.audio.duration * 100 : 0;
    sample.time.textContent = format(playing ? sample.audio.currentTime : sample.audio.duration);
  };
  sample.button.addEventListener('click', async () => {
    if (!sample.audio.paused) { sample.audio.pause(); return; }
    document.querySelectorAll('audio').forEach(audio => { if (audio !== sample.audio) audio.pause(); });
    try { await sample.audio.play(); audioStatus.textContent = `Playing ${sample.name.toLowerCase()} sample.`; }
    catch { audioStatus.textContent = 'Playback unavailable. Please try again.'; }
  });
  sample.audio.addEventListener('play', () => {
    for (const caption of captions) caption.hidden = caption.lang !== sample.id;
  });
  for (const event of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'ended']) sample.audio.addEventListener(event, update);
  sample.audio.addEventListener('error', () => { audioStatus.textContent = 'A sample could not load. Please refresh and try again.'; });
  update();
}
