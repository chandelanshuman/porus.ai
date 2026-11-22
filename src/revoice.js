const studio = document.querySelector('[data-rv-studio]');
if (studio) {
  const tabs = [...studio.querySelectorAll('[data-rv-tab]')];
  const languageButtons = [...studio.querySelectorAll('[data-rv-language]')];
  const audio = Object.fromEntries([...studio.querySelectorAll('[data-rv-audio]')].map(el => [el.dataset.rvAudio, el]));
  const play = studio.querySelector('[data-rv-play]');
  const caption = studio.querySelector('[data-rv-caption]');
  const track = studio.querySelector('[data-rv-track]');
  const seek = studio.querySelector('[data-rv-seek]');
  const time = studio.querySelector('[data-rv-time]');
  const lane = studio.querySelector('[data-rv-lane]');
  const ticks = studio.querySelectorAll('[data-rv-tick]');
  const status = studio.querySelector('[data-rv-status]');
  const line = studio.querySelector('[data-rv-line]');
  const editStatus = studio.querySelector('[data-rv-edit-status]');
  const originalLine = line.value;
  const english = caption.textContent;
  let language = 'en';
  const stop = () => Object.values(audio).forEach(el => el.pause());
  function openTab(tab) {
    stop();
    tabs.forEach(el => {
      const selected = el === tab;
      el.setAttribute('aria-selected', String(selected));
      el.tabIndex = selected ? 0 : -1;
      document.getElementById(el.getAttribute('aria-controls')).hidden = !selected;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => openTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); openTab(tabs[next]); tabs[next].focus();
    });
  });
  function format(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
  function update() {
    const current = audio[language];
    const playing = !current.paused && !current.ended;
    play.textContent = playing ? 'Pause' : 'Play sample';
    play.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${language === 'en' ? 'English source' : 'Hindi rendition'} sample`);
    time.textContent = `${format(current.currentTime)} / ${format(current.duration)}`;
    const progress = Number.isFinite(current.duration) && current.duration > 0
      ? current.currentTime / current.duration * 100 : 0;
    seek.value = String(progress);
    lane?.style.setProperty('--rv-progress', `${progress}%`);
    for (const tick of ticks ?? []) {
      const seconds = current.duration * Number(tick.dataset.rvTick);
      tick.textContent = Number.isFinite(seconds) ? seconds.toFixed(1) + 's' : '';
    }
  }
  languageButtons.forEach(button => button.addEventListener('click', () => {
    stop(); language = button.dataset.rvLanguage;
    languageButtons.forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    caption.textContent = language === 'en' ? english : `“${originalLine}”`;
    caption.lang = language;
    track.textContent = language === 'en' ? 'Source voice' : 'Hindi rendition';
    const preview = document.querySelector(`[data-launch-audio="${language}"]`)?.closest?.('[data-take]');
    const peaks = preview?.querySelectorAll('.rl-preview-wave i');
    studio.querySelector('[data-rv-wave]')?.querySelectorAll('i').forEach((bar, index) => {
      const peak = peaks?.[index]?.style.getPropertyValue('--peak');
      if (peak) bar.style.setProperty('--rv-height', peak);
    });
    status.textContent = 'Press play to hear the selected sample.';
    update();
  }));
  // Pause the studio when a voice-showcase sample starts.
  document.addEventListener('play', event => {
    if (event.target instanceof HTMLMediaElement && !Object.values(audio).includes(event.target)) stop();
  }, true);
  play.addEventListener('click', async () => {
    const current = audio[language];
    if (!current.paused) { current.pause(); status.textContent = 'Paused.'; return; }
    document.querySelectorAll('audio').forEach(el => { if (el !== current) el.pause(); });
    try { await current.play(); status.textContent = 'Playing prerecorded sample.'; }
    catch { status.textContent = 'Unable to play this sample. Please try again.'; }
  });
  for (const el of Object.values(audio)) {
    for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause']) el.addEventListener(event, update);
    el.addEventListener('ended', () => { update(); status.textContent = 'Sample complete. Try the other language.'; });
    el.addEventListener('error', () => { if (el === audio[language]) status.textContent = 'Sample unavailable. Please refresh and try again.'; });
  }
  seek.addEventListener('input', () => {
    const current = audio[language];
    if (Number.isFinite(current.duration)) current.currentTime = Number(seek.value) / 100 * current.duration;
    update();
  });
  line.addEventListener('input', () => { editStatus.textContent = line.value === originalLine ? 'Sample script' : 'Edited in this preview'; });
  studio.querySelector('[data-rv-restore]').addEventListener('click', () => { line.value = originalLine; editStatus.textContent = 'Sample script'; });
  studio.querySelector('[data-rv-reset]').addEventListener('click', () => { openTab(tabs[0]); status.textContent = 'Sample scene selected.'; });
  studio.querySelector('[data-rv-download]').addEventListener('click', () => {
    const blob = new Blob([`Porus Revoice — preview script\n\nEnglish source\n${english}\n\nHindi rendition\n${line.value}\n\nPreview text only. Audio uses prerecorded samples.\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'porus-revoice-preview-script.txt';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Preview script downloaded.';
  });
  update();
}
