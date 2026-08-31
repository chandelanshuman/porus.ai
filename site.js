(() => {
  "use strict";

  const root = document.documentElement;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 821px)");
  let reduceMotion = motionQuery.matches;
  let pageVisible = !document.hidden;
  let rafId = 0;
  let lastStarFrame = 0;
  let layoutDirty = true;

  root.classList.add("js");
  if (!reduceMotion) root.classList.add("motion-enabled");

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smoothstep = (value) => {
    const n = clamp(value);
    return n * n * (3 - 2 * n);
  };
  const rgb = (color, alpha = 1) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  const mixColor = (from, to, amount) => from.map((channel, index) => Math.round(mix(channel, to[index], amount)));

  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder < 10 ? "0" : ""}${remainder}`;
  }

  function setPlayIcon(button, playing) {
    const path = button?.querySelector("path");
    if (!path) return;
    path.setAttribute("d", playing ? "M7 5h4v14H7zm6 0h4v14h-4z" : "M8 5v14l11-7z");
  }

  function sizeCanvas(canvas, state, dprLimit = 1.5) {
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    const changed = canvas.width !== pixelWidth || canvas.height !== pixelHeight;

    if (changed) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.context = context;
    state.width = width;
    state.height = height;
    state.dpr = dpr;
    return changed;
  }

  /* Navigation */

  const menuToggle = document.querySelector(".menu-toggle");
  const siteNav = document.querySelector(".site-nav");

  function closeMenu({ restoreFocus = false } = {}) {
    if (!menuToggle || !siteNav) return;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.querySelector(".sr-only").textContent = "Open navigation";
    siteNav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    if (restoreFocus) menuToggle.focus();
  }

  if (menuToggle && siteNav) {
    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") === "true";
      if (open) {
        closeMenu();
      } else {
        menuToggle.setAttribute("aria-expanded", "true");
        menuToggle.querySelector(".sr-only").textContent = "Close navigation";
        siteNav.classList.add("is-open");
        document.body.classList.add("menu-open");
      }
    });

    siteNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && siteNav.classList.contains("is-open")) {
        closeMenu({ restoreFocus: true });
      }
    });

    document.addEventListener("click", (event) => {
      if (!siteNav.classList.contains("is-open")) return;
      if (!event.target.closest(".nav-shell")) closeMenu();
    });
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* Horizontal human-history passage */

  const historySection = document.querySelector("[data-horizontal]");
  const historyTrack = document.querySelector("[data-horizontal-track]");
  const historyState = {
    enabled: false,
    travel: 0,
    scrollDistance: 1,
    lastX: Number.NaN
  };

  function configureHistory() {
    if (!historySection || !historyTrack) return;
    const shouldEnhance = desktopQuery.matches && !reduceMotion;
    historyState.enabled = shouldEnhance;
    historySection.classList.toggle("is-horizontal", shouldEnhance);

    if (!shouldEnhance) {
      historySection.style.removeProperty("height");
      root.style.setProperty("--history-x", "0px");
      historyState.lastX = 0;
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    historyState.travel = Math.max(0, historyTrack.scrollWidth - viewportWidth);
    historyState.scrollDistance = Math.max(viewportHeight * 3.1, historyState.travel + viewportHeight * 1.5);
    historySection.style.height = `${Math.round(historyState.scrollDistance + viewportHeight)}px`;
  }

  function updateHistory() {
    if (!historyState.enabled || !historySection || !historyTrack) return;
    const rect = historySection.getBoundingClientRect();
    const usable = Math.max(1, rect.height - window.innerHeight);
    const progress = clamp(-rect.top / usable);
    const x = -historyState.travel * progress;
    if (!Number.isFinite(historyState.lastX) || Math.abs(x - historyState.lastX) > 0.15) {
      root.style.setProperty("--history-x", `${x.toFixed(2)}px`);
      historyState.lastX = x;
    }
  }

  /* One-time editorial drift */

  const driftItems = document.querySelectorAll("[data-drift]");
  if (driftItems.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      driftItems.forEach((item) => item.classList.add("is-visible"));
    } else {
      const driftObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.28, rootMargin: "0px 0px -8%" });
      driftItems.forEach((item) => driftObserver.observe(item));
    }
  }

  /* Pointer-responsive product suite */

  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const suiteRows = Array.from(document.querySelectorAll(".suite-row"));
  const suitePointerProperties = [
    "--suite-x",
    "--suite-y",
    "--suite-shift-x",
    "--suite-shift-y",
    "--suite-status-x",
    "--suite-status-y"
  ];
  const suitePointerState = {
    row: null,
    rect: null,
    active: false,
    currentX: 0.5,
    currentY: 0.5,
    targetX: 0.5,
    targetY: 0.5
  };

  function targetSuitePointer(row, event) {
    const rect = suitePointerState.rect || row.getBoundingClientRect();
    suitePointerState.targetX = clamp((event.clientX - rect.left) / Math.max(1, rect.width));
    suitePointerState.targetY = clamp((event.clientY - rect.top) / Math.max(1, rect.height));
  }

  function clearSuitePointerStyles(row) {
    if (!row) return;
    row.classList.remove("is-pointer-active");
    suitePointerProperties.forEach((property) => row.style.removeProperty(property));
  }

  function resetSuitePointer() {
    suitePointerState.active = false;
    suitePointerState.targetX = 0.5;
    suitePointerState.targetY = 0.5;
    suitePointerState.rect = null;
    suitePointerState.row?.classList.remove("is-pointer-active");
  }

  function updateSuitePointer() {
    const row = suitePointerState.row;
    if (!row) return;

    const deltaX = suitePointerState.targetX - suitePointerState.currentX;
    const deltaY = suitePointerState.targetY - suitePointerState.currentY;
    if (suitePointerState.active && Math.abs(deltaX) < 0.0004 && Math.abs(deltaY) < 0.0004) return;

    const response = suitePointerState.active ? 0.18 : 0.24;
    suitePointerState.currentX += deltaX * response;
    suitePointerState.currentY += deltaY * response;

    const shiftX = (suitePointerState.currentX - 0.5) * 12;
    const shiftY = (suitePointerState.currentY - 0.5) * 7;
    row.style.setProperty("--suite-x", `${(suitePointerState.currentX * 100).toFixed(2)}%`);
    row.style.setProperty("--suite-y", `${(suitePointerState.currentY * 100).toFixed(2)}%`);
    row.style.setProperty("--suite-shift-x", `${shiftX.toFixed(2)}px`);
    row.style.setProperty("--suite-shift-y", `${shiftY.toFixed(2)}px`);
    row.style.setProperty("--suite-status-x", `${(-shiftX * 0.32).toFixed(2)}px`);
    row.style.setProperty("--suite-status-y", `${(-shiftY * 0.32).toFixed(2)}px`);

    const settled = Math.abs(suitePointerState.currentX - 0.5) < 0.002 && Math.abs(suitePointerState.currentY - 0.5) < 0.002;
    if (!suitePointerState.active && settled) {
      clearSuitePointerStyles(row);
      suitePointerState.row = null;
      suitePointerState.currentX = 0.5;
      suitePointerState.currentY = 0.5;
    }
  }

  suiteRows.forEach((row) => {
    row.addEventListener("pointerenter", (event) => {
      if (reduceMotion || !finePointerQuery.matches) return;
      if (suitePointerState.row && suitePointerState.row !== row) {
        clearSuitePointerStyles(suitePointerState.row);
        suitePointerState.currentX = 0.5;
        suitePointerState.currentY = 0.5;
      }
      suitePointerState.row = row;
      suitePointerState.rect = row.getBoundingClientRect();
      suitePointerState.active = true;
      targetSuitePointer(row, event);
      row.classList.add("is-pointer-active");
      requestFrame();
    });

    row.addEventListener("pointermove", (event) => {
      if (!suitePointerState.active || suitePointerState.row !== row) return;
      targetSuitePointer(row, event);
    });

    row.addEventListener("pointerleave", resetSuitePointer);
    row.addEventListener("pointercancel", resetSuitePointer);
  });

  /* Starfield and continuous history-to-language warp */

  const starCanvas = document.querySelector(".stars");
  const starState = {
    context: null,
    width: 0,
    height: 0,
    dpr: 1,
    stars: [],
    historyStart: 0,
    historyEnd: 1,
    carryEnd: 2,
    entryPeak: 1,
    entryEnd: 3,
    exitStart: 3,
    exitPeak: 4,
    exitEnd: 5,
    lastPaint: 0,
    staticDrawn: false
  };

  function buildStars() {
    if (!starCanvas) return;
    sizeCanvas(starCanvas, starState);
    const random = seeded(19770525);
    const count = Math.max(72, Math.min(250, Math.round(starState.width * starState.height / 7200)));
    starState.stars = Array.from({ length: count }, () => {
      const tint = random();
      return {
        x: random(),
        y: random(),
        radius: 0.42 + random() * 1.08,
        alpha: 0.18 + random() * 0.48,
        phase: random() * Math.PI * 2,
        speed: 0.24 + random() * 0.9,
        color: tint < 0.75 ? [255, 255, 255] : tint < 0.91 ? [190, 255, 224] : [168, 224, 255]
      };
    });
    starState.lastPaint = 0;
    starState.staticDrawn = false;
  }

  function measureWarp() {
    const cinemaSection = document.querySelector(".cinema-outer");
    const passageSection = document.querySelector(".passage-intro");
    if (!cinemaSection || !passageSection) return;
    const viewportHeight = window.innerHeight;
    const cinemaRect = cinemaSection.getBoundingClientRect();
    const passageRect = passageSection.getBoundingClientRect();
    const historyRect = historySection?.getBoundingClientRect();
    const top = cinemaRect.top + window.scrollY;
    const passageTop = passageRect.top + window.scrollY;
    const pinnedExit = top + Math.max(0, cinemaRect.height - viewportHeight);
    const fallbackHistoryStart = Math.max(0, top - viewportHeight * 4.2);
    const historyTop = historyRect ? historyRect.top + window.scrollY : fallbackHistoryStart;
    const historyTravel = historyRect
      ? Math.max(viewportHeight * 0.85, historyRect.height - viewportHeight)
      : viewportHeight * 2;

    starState.historyStart = Math.max(0, historyTop);
    starState.historyEnd = Math.max(starState.historyStart + 1, historyTop + historyTravel);
    starState.carryEnd = Math.max(starState.historyEnd + 1, passageTop - viewportHeight * 0.92);
    starState.entryPeak = Math.max(starState.carryEnd + 1, top - viewportHeight * 0.34);
    starState.entryEnd = top;
    starState.exitStart = pinnedExit - viewportHeight * 0.34;
    starState.exitPeak = pinnedExit;
    starState.exitEnd = pinnedExit + viewportHeight * 0.92;
  }

  function warpAt(scrollY) {
    if (reduceMotion) return { amount: 0, direction: 1 };

    if (scrollY >= starState.historyStart && scrollY <= starState.historyEnd) {
      const progress = smoothstep((scrollY - starState.historyStart) / (starState.historyEnd - starState.historyStart));
      return {
        amount: mix(0.045, 0.52, progress),
        direction: 1
      };
    }

    if (scrollY > starState.historyEnd && scrollY <= starState.carryEnd) {
      const progress = smoothstep((scrollY - starState.historyEnd) / (starState.carryEnd - starState.historyEnd));
      return {
        amount: mix(0.52, 0.64, progress),
        direction: 1
      };
    }

    if (scrollY > starState.carryEnd && scrollY <= starState.entryPeak) {
      const progress = smoothstep((scrollY - starState.carryEnd) / (starState.entryPeak - starState.carryEnd));
      return {
        amount: mix(0.64, 1, progress),
        direction: 1
      };
    }

    if (scrollY > starState.entryPeak && scrollY <= starState.entryEnd) {
      return {
        amount: 1 - smoothstep((scrollY - starState.entryPeak) / (starState.entryEnd - starState.entryPeak)),
        direction: 1
      };
    }

    if (scrollY >= starState.exitStart && scrollY <= starState.exitPeak) {
      return {
        amount: smoothstep((scrollY - starState.exitStart) / (starState.exitPeak - starState.exitStart)),
        direction: -1
      };
    }

    if (scrollY > starState.exitPeak && scrollY <= starState.exitEnd) {
      return {
        amount: 1 - smoothstep((scrollY - starState.exitPeak) / (starState.exitEnd - starState.exitPeak)),
        direction: -1
      };
    }

    return { amount: 0, direction: 1 };
  }

  function paintStars(now, scrollY) {
    const { context, width, height, stars } = starState;
    if (!context || !width || !height || !stars.length) return;
    if (reduceMotion && starState.staticDrawn) return;

    const seconds = now / 1000;
    const warp = warpAt(scrollY);
    const frameScale = starState.lastPaint ? clamp((now - starState.lastPaint) / 30, 0.45, 2.2) : 1;
    starState.lastPaint = now;
    const centreX = width / 2;
    const centreY = height / 2;
    const farthest = Math.hypot(centreX, centreY);
    context.clearRect(0, 0, width, height);

    stars.forEach((star, index) => {
      let x = star.x * width;
      let y = star.y * height;
      let dx = x - centreX;
      let dy = y - centreY;
      let distance = Math.hypot(dx, dy) || 1;
      let edge = distance / farthest;

      if (warp.amount > 0.012) {
        const velocity = warp.direction * warp.amount * warp.amount * (0.6 + edge * 6.4) * frameScale;
        star.x += (dx / distance) * velocity / width;
        star.y += (dy / distance) * velocity / height;

        if (warp.direction > 0 && (star.x < -0.06 || star.x > 1.06 || star.y < -0.06 || star.y > 1.06)) {
          const angle = (index * 2.399963 + seconds * 0.7) % (Math.PI * 2);
          const radius = 0.035 + ((index * 17) % 90) / 900;
          star.x = 0.5 + Math.cos(angle) * radius;
          star.y = 0.5 + Math.sin(angle) * radius;
        } else if (warp.direction < 0 && edge < 0.045) {
          const angle = (index * 2.399963 + seconds * 0.3) % (Math.PI * 2);
          star.x = 0.5 + Math.cos(angle) * 0.57;
          star.y = 0.5 + Math.sin(angle) * 0.57;
        }

        x = star.x * width;
        y = star.y * height;
        dx = x - centreX;
        dy = y - centreY;
        distance = Math.hypot(dx, dy) || 1;
        edge = distance / farthest;
      }

      const twinkle = reduceMotion ? 0.85 : 0.72 + 0.28 * Math.sin(seconds * star.speed + star.phase);
      const alpha = star.alpha * twinkle * (1 + warp.amount * 0.7);
      const streak = warp.amount * warp.amount * edge * 155;

      if (streak > 1.6) {
        const startX = x - warp.direction * (dx / distance) * streak;
        const startY = y - warp.direction * (dy / distance) * streak;
        if (warp.amount < 0.55) {
          context.strokeStyle = rgb(star.color, Math.min(0.34, alpha * 0.58));
        } else {
          const gradient = context.createLinearGradient(startX, startY, x, y);
          gradient.addColorStop(0, rgb(star.color, 0));
          gradient.addColorStop(1, rgb(star.color, Math.min(0.96, alpha)));
          context.strokeStyle = gradient;
        }
        context.lineWidth = star.radius * (1 + warp.amount * 0.8);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(x, y);
        context.stroke();
      } else {
        context.fillStyle = rgb(star.color, alpha);
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();
      }
    });

    if (reduceMotion) starState.staticDrawn = true;
  }

  /* Cinematic English-to-Hindi passage */

  const cinemaSection = document.querySelector(".cinema-outer");
  const cinemaFrame = cinemaSection?.querySelector(".cinema");
  const cinemaCanvas = cinemaSection?.querySelector(".cinema-canvas");
  const cinemaWaveCanvas = cinemaSection?.querySelector(".cinema-wave-canvas");
  const cinemaButton = cinemaSection?.querySelector(".cinema-play");
  const cinemaProgress = cinemaSection?.querySelector(".cinema-progress i");
  const cinemaEnglish = cinemaSection?.querySelector(".audio-en");
  const cinemaHindi = cinemaSection?.querySelector(".audio-hi");
  const timeCurrent = cinemaSection?.querySelector(".tc-current");
  const timeTotal = cinemaSection?.querySelector(".tc-total");
  const demoAnnouncement = cinemaSection?.querySelector("[data-demo-announcement]");

  const cinemaState = {
    context: null,
    width: 0,
    height: 0,
    dpr: 1,
    waveContext: null,
    waveWidth: 0,
    waveHeight: 0,
    progress: 0,
    visible: false,
    language: "en",
    currentAudio: null,
    playing: false,
    audioContext: null,
    analyser: null,
    frequencyData: null,
    connected: new WeakSet(),
    crossfade: null,
    startedAt: performance.now()
  };

  function sizeCinemaCanvases() {
    if (cinemaCanvas) sizeCanvas(cinemaCanvas, cinemaState, 1.5);
    if (cinemaWaveCanvas) {
      const waveState = {};
      sizeCanvas(cinemaWaveCanvas, waveState, 1.5);
      cinemaState.waveContext = waveState.context;
      cinemaState.waveWidth = waveState.width;
      cinemaState.waveHeight = waveState.height;
    }
  }

  function connectCinemaAudio(audio) {
    if (!audio || cinemaState.connected.has(audio)) return;
    try {
      if (!cinemaState.audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        cinemaState.audioContext = new AudioContext();
        cinemaState.analyser = cinemaState.audioContext.createAnalyser();
        cinemaState.analyser.fftSize = 256;
        cinemaState.frequencyData = new Uint8Array(cinemaState.analyser.frequencyBinCount);
        cinemaState.analyser.connect(cinemaState.audioContext.destination);
      }
      const source = cinemaState.audioContext.createMediaElementSource(audio);
      source.connect(cinemaState.analyser);
      cinemaState.connected.add(audio);
      if (cinemaState.audioContext.state === "suspended") cinemaState.audioContext.resume();
    } catch (error) {
      cinemaState.analyser = null;
      cinemaState.frequencyData = null;
    }
  }

  function activeCinemaAudio(language = cinemaState.language) {
    return language === "hi" ? cinemaHindi : cinemaEnglish;
  }

  function updateCinemaButton() {
    if (!cinemaButton) return;
    const languageName = cinemaState.language === "hi" ? "Hindi test rendition" : "English source sample";
    const action = cinemaState.playing ? "Pause" : cinemaState.currentAudio?.currentTime > 0 ? "Resume" : "Play";
    cinemaButton.setAttribute("aria-label", `${action} the ${languageName}`);
    setPlayIcon(cinemaButton, cinemaState.playing);
    cinemaFrame?.classList.toggle("is-playing", cinemaState.playing);
  }

  function stopCinemaAudio({ reset = false } = {}) {
    [cinemaEnglish, cinemaHindi].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      audio.volume = 1;
      if (reset) audio.currentTime = 0;
    });
    cinemaState.crossfade = null;
    cinemaState.playing = false;
    if (reset) cinemaState.currentAudio = null;
    updateCinemaButton();
  }

  function pauseManualPlayers() {
    audioPlayers.forEach((player) => {
      if (player.audio && !player.audio.paused) player.audio.pause();
    });
  }

  async function playCinemaAudio({ restart = false } = {}) {
    const audio = activeCinemaAudio();
    if (!audio) return;
    pauseManualPlayers();
    connectCinemaAudio(audio);
    if (restart || audio.ended) audio.currentTime = 0;
    cinemaState.currentAudio = audio;
    try {
      await audio.play();
      cinemaState.playing = true;
      updateCinemaButton();
      requestFrame();
    } catch (error) {
      cinemaState.playing = false;
      updateCinemaButton();
    }
  }

  function pauseCinemaAudio() {
    cinemaState.currentAudio?.pause();
    cinemaState.playing = false;
    updateCinemaButton();
  }

  function changeCinemaLanguage(language, now) {
    if (language === cinemaState.language) return;
    const previous = activeCinemaAudio(cinemaState.language);
    cinemaState.language = language;
    const next = activeCinemaAudio(language);
    cinemaSection?.classList.toggle("is-hindi", language === "hi");

    if (demoAnnouncement) {
      demoAnnouncement.textContent = language === "hi" ? "The example is now in Hindi." : "The example is now in English.";
    }

    if (cinemaState.playing && previous && next) {
      const ratio = previous.duration ? previous.currentTime / previous.duration : 0;
      connectCinemaAudio(next);
      next.currentTime = Number.isFinite(next.duration) ? Math.min(next.duration - 0.02, ratio * next.duration) : 0;
      next.volume = 0;
      next.play().then(() => {
        cinemaState.crossfade = { from: previous, to: next, start: now, duration: 260 };
        cinemaState.currentAudio = next;
      }).catch(() => {
        previous.pause();
        previous.volume = 1;
        cinemaState.currentAudio = next;
        cinemaState.playing = false;
        updateCinemaButton();
      });
    } else {
      if (previous) previous.pause();
      cinemaState.currentAudio = next;
    }

    if (timeTotal && next) timeTotal.textContent = formatTime(next.duration);
    updateCinemaButton();
  }

  function updateCrossfade(now) {
    const fade = cinemaState.crossfade;
    if (!fade) return;
    const progress = clamp((now - fade.start) / fade.duration);
    fade.from.volume = 1 - progress;
    fade.to.volume = progress;
    if (progress >= 1) {
      fade.from.pause();
      fade.from.volume = 1;
      fade.to.volume = 1;
      cinemaState.crossfade = null;
    }
  }

  function updateCinemaScroll(now) {
    if (!cinemaSection) return;
    const rect = cinemaSection.getBoundingClientRect();
    cinemaState.visible = rect.top < window.innerHeight && rect.bottom > 0;
    if (!cinemaState.visible) return;
    const usable = Math.max(1, rect.height - window.innerHeight);
    const progress = clamp(-rect.top / usable);
    cinemaState.progress = progress;
    changeCinemaLanguage(progress >= 0.54 ? "hi" : "en", now);
  }

  const warmPalette = {
    sky: [[6, 18, 29], [22, 67, 73], [182, 124, 82]],
    accent: [92, 226, 180],
    horizon: [232, 163, 61],
    disc: [247, 221, 183]
  };

  const coolPalette = {
    sky: [[8, 15, 33], [50, 47, 100], [116, 97, 168]],
    accent: [177, 140, 255],
    horizon: [114, 216, 237],
    disc: [221, 212, 255]
  };

  function paintAuroraRibbon(context, width, height, seconds, color, index, alpha) {
    const y = height * (0.16 + index * 0.075);
    const sway = Math.sin(seconds * (0.11 + index * 0.025) + index * 1.7) * height * 0.04;
    context.save();
    context.globalCompositeOperation = "screen";
    context.strokeStyle = rgb(color, alpha);
    context.lineWidth = height * (0.045 + index * 0.012);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-width * 0.08, y + sway);
    context.bezierCurveTo(
      width * 0.2,
      y - height * 0.13 - sway,
      width * 0.48,
      y + height * 0.12 + sway,
      width * 0.72,
      y - height * 0.03
    );
    context.bezierCurveTo(
      width * 0.88,
      y - height * 0.12,
      width * 1.02,
      y + height * 0.08,
      width * 1.1,
      y
    );
    context.stroke();
    context.restore();
  }

  function paintCinemaScene(now) {
    const context = cinemaState.context;
    const width = cinemaState.width;
    const height = cinemaState.height;
    if (!context || !width || !height) return;

    const seconds = (now - cinemaState.startedAt) / 1000;
    const blend = smoothstep((cinemaState.progress - 0.16) / 0.7);
    const skyTop = mixColor(warmPalette.sky[0], coolPalette.sky[0], blend);
    const skyMiddle = mixColor(warmPalette.sky[1], coolPalette.sky[1], blend);
    const skyBottom = mixColor(warmPalette.sky[2], coolPalette.sky[2], blend);
    const accent = mixColor(warmPalette.accent, coolPalette.accent, blend);
    const horizon = mixColor(warmPalette.horizon, coolPalette.horizon, blend);
    const disc = mixColor(warmPalette.disc, coolPalette.disc, blend);

    context.clearRect(0, 0, width, height);
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, rgb(skyTop));
    sky.addColorStop(0.58, rgb(skyMiddle));
    sky.addColorStop(1, rgb(skyBottom));
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    const hazeX = width * 0.5 + Math.sin(seconds * 0.14) * width * 0.055;
    const hazeY = height * 0.68 + Math.cos(seconds * 0.1) * height * 0.025;
    const haze = context.createRadialGradient(hazeX, hazeY, 0, hazeX, hazeY, width * 0.56);
    haze.addColorStop(0, rgb(horizon, 0.24));
    haze.addColorStop(1, rgb(horizon, 0));
    context.fillStyle = haze;
    context.fillRect(0, 0, width, height);

    paintAuroraRibbon(context, width, height, seconds, accent, 0, 0.11);
    paintAuroraRibbon(context, width, height, seconds, mixColor(accent, [104, 216, 237], 0.45), 1, 0.075);
    paintAuroraRibbon(context, width, height, seconds, mixColor(accent, [205, 138, 245], 0.55), 2, 0.055);

    const discX = width * (0.5 + Math.sin(seconds * 0.075) * 0.045);
    const discY = height * (0.43 - blend * 0.045);
    const discRadius = Math.max(48, height * 0.095);
    const discGlow = context.createRadialGradient(discX, discY, 0, discX, discY, discRadius * 3.4);
    discGlow.addColorStop(0, rgb(disc, 0.76));
    discGlow.addColorStop(0.32, rgb(disc, 0.25));
    discGlow.addColorStop(1, rgb(disc, 0));
    context.fillStyle = discGlow;
    context.fillRect(discX - discRadius * 3.4, discY - discRadius * 3.4, discRadius * 6.8, discRadius * 6.8);
    context.fillStyle = rgb(disc, 0.92);
    context.beginPath();
    context.arc(discX, discY, discRadius, 0, Math.PI * 2);
    context.fill();

    for (let index = 0; index < 44; index += 1) {
      const x = ((index * 137.5 + seconds * 6) % (width + 50)) - 25;
      const y = height * 0.26 + Math.sin(index * 1.7 + seconds * 0.35) * height * 0.14 + (index % 6) * height * 0.018;
      const alpha = 0.08 + 0.13 * (0.5 + Math.sin(index * 1.3 + seconds) * 0.5);
      context.fillStyle = rgb(disc, alpha);
      context.beginPath();
      context.arc(x, y, 0.8 + (index % 3) * 0.25, 0, Math.PI * 2);
      context.fill();
    }

    function mountains(baseY, seed, color, amplitude) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(0, height);
      context.lineTo(0, baseY);
      const peaks = 10;
      for (let index = 0; index <= peaks; index += 1) {
        const x = index / peaks * width;
        const noise = Math.sin(seed + index * 2.31) * 0.5 + 0.5;
        const y = baseY - noise * height * amplitude + Math.sin(seconds * 0.07 + index) * 1.5;
        context.lineTo(x, y);
      }
      context.lineTo(width, height);
      context.closePath();
      context.fill();
    }

    mountains(height * 0.76, 12.3, "rgba(9,18,28,0.56)", 0.2);
    mountains(height * 0.84, 24.7, "rgba(6,13,23,0.76)", 0.19);
    mountains(height * 0.92, 3.1, "rgba(3,9,16,0.94)", 0.16);

    const foreground = context.createLinearGradient(0, height * 0.68, 0, height);
    foreground.addColorStop(0, "rgba(2,7,12,0)");
    foreground.addColorStop(1, "rgba(2,7,12,0.62)");
    context.fillStyle = foreground;
    context.fillRect(0, height * 0.68, width, height * 0.32);
  }

  function paintCinemaWave(now) {
    const context = cinemaState.waveContext;
    const width = cinemaState.waveWidth;
    const height = cinemaState.waveHeight;
    if (!context || !width || !height) return;

    context.clearRect(0, 0, width, height);
    const bars = Math.max(42, Math.min(86, Math.round(width / 14)));
    const slot = width / bars;
    const barWidth = Math.max(1, slot * 0.52);
    const blend = smoothstep((cinemaState.progress - 0.16) / 0.7);
    const color = mixColor([232, 163, 61], [177, 140, 255], blend);
    const seconds = now / 1000;

    if (cinemaState.analyser && cinemaState.frequencyData && cinemaState.playing) {
      cinemaState.analyser.getByteFrequencyData(cinemaState.frequencyData);
    }

    for (let index = 0; index < bars; index += 1) {
      let amplitude;
      if (cinemaState.analyser && cinemaState.frequencyData && cinemaState.playing) {
        const sampleIndex = Math.floor(index / bars * cinemaState.frequencyData.length);
        amplitude = 0.12 + cinemaState.frequencyData[sampleIndex] / 255 * 0.88;
      } else {
        amplitude = 0.1 + Math.abs(Math.sin(index * 0.32 + seconds * 1.35)) * 0.18;
      }
      const barHeight = Math.max(2, amplitude * height);
      context.fillStyle = rgb(color, 0.32 + amplitude * 0.58);
      context.fillRect(index * slot, (height - barHeight) / 2, barWidth, barHeight);
    }
  }

  function updateCinemaProgress() {
    const audio = cinemaState.currentAudio || activeCinemaAudio();
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const progress = duration ? audio.currentTime / duration : 0;
    if (cinemaProgress) cinemaProgress.style.width = `${(progress * 100).toFixed(2)}%`;
    if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
    if (timeTotal) timeTotal.textContent = formatTime(duration);
  }

  if (cinemaButton) {
    cinemaButton.addEventListener("click", () => {
      if (cinemaState.playing) pauseCinemaAudio();
      else playCinemaAudio({ restart: Boolean(cinemaState.currentAudio?.ended) });
    });
  }

  [cinemaEnglish, cinemaHindi].forEach((audio) => {
    if (!audio) return;
    audio.addEventListener("loadedmetadata", () => {
      if (audio === activeCinemaAudio() && timeTotal) timeTotal.textContent = formatTime(audio.duration);
    });
    audio.addEventListener("ended", () => {
      if (audio !== cinemaState.currentAudio) return;
      cinemaState.playing = false;
      updateCinemaButton();
    });
  });

  /* Accessible manual audio proof */

  const audioPlayers = Array.from(document.querySelectorAll("[data-audio-player]")).map((element, index) => ({
    element,
    button: element.querySelector("[data-audio-toggle]"),
    audio: element.querySelector("audio"),
    canvas: element.querySelector("[data-waveform]"),
    status: element.querySelector("[data-audio-status]"),
    time: element.querySelector("[data-audio-time]"),
    context: null,
    width: 0,
    height: 0,
    dpr: 1,
    samples: [],
    seed: 82431 + index * 7193,
    dirty: true
  }));

  let decodeContext = null;

  function makeFallbackSamples(seed, count = 170) {
    const random = seeded(seed);
    return Array.from({ length: count }, (_, index) => {
      const envelope = Math.sin(index / (count - 1) * Math.PI) * 0.7 + 0.3;
      return (0.12 + random() * 0.68) * envelope;
    });
  }

  async function decodeWaveform(player) {
    if (!player.audio?.src) return;
    player.samples = makeFallbackSamples(player.seed);
    player.dirty = true;
    try {
      const response = await fetch(player.audio.src);
      if (!response.ok) throw new Error("Audio unavailable");
      const buffer = await response.arrayBuffer();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Audio decoding unavailable");
      if (!decodeContext) decodeContext = new AudioContext();
      const decoded = await decodeContext.decodeAudioData(buffer.slice(0));
      const channel = decoded.getChannelData(0);
      const count = 190;
      const block = Math.max(1, Math.floor(channel.length / count));
      const samples = [];
      for (let index = 0; index < count; index += 1) {
        const start = index * block;
        const end = Math.min(channel.length, start + block);
        let peak = 0;
        for (let sample = start; sample < end; sample += 1) peak = Math.max(peak, Math.abs(channel[sample]));
        samples.push(peak);
      }
      const maximum = Math.max(...samples, 0.001);
      player.samples = samples.map((sample) => sample / maximum);
      player.dirty = true;
      requestFrame();
    } catch (error) {
      player.samples = player.samples.length ? player.samples : makeFallbackSamples(player.seed);
      player.dirty = true;
    }
  }

  function sizePlayerCanvas(player) {
    if (!player.canvas) return;
    const changed = sizeCanvas(player.canvas, player, 1.5);
    if (changed) player.dirty = true;
  }

  function drawPlayerWave(player) {
    const { context, width, height, samples } = player;
    if (!context || !width || !height || !samples.length) return;
    const audio = player.audio;
    const progress = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
    context.clearRect(0, 0, width, height);

    const count = Math.min(samples.length, Math.max(72, Math.floor(width / 4)));
    const step = samples.length / count;
    const slot = width / count;
    const barWidth = Math.max(1, slot * 0.48);

    for (let index = 0; index < count; index += 1) {
      const sample = samples[Math.floor(index * step)];
      const barHeight = Math.max(2, sample * height * 0.88);
      const active = index / count <= progress;
      context.fillStyle = active ? "rgba(22,36,38,0.92)" : "rgba(73,101,98,0.27)";
      context.fillRect(index * slot, (height - barHeight) / 2, barWidth, barHeight);
    }
    player.dirty = false;
  }

  function updatePlayerState(player) {
    const playing = Boolean(player.audio && !player.audio.paused && !player.audio.ended);
    player.element.classList.toggle("is-playing", playing);
    setPlayIcon(player.button, playing);
    if (player.button) {
      const label = player.element.querySelector("strong")?.textContent || "audio sample";
      player.button.setAttribute("aria-label", `${playing ? "Pause" : player.audio?.currentTime > 0 ? "Resume" : "Play"} ${label}`);
    }
    if (player.status) player.status.textContent = playing ? "Playing" : player.audio?.currentTime > 0 && !player.audio?.ended ? "Paused" : "Ready";
    player.dirty = true;
  }

  function pauseOtherPlayers(activePlayer) {
    audioPlayers.forEach((player) => {
      if (player === activePlayer || !player.audio) return;
      player.audio.pause();
      updatePlayerState(player);
    });
    stopCinemaAudio();
  }

  audioPlayers.forEach((player) => {
    if (!player.audio || !player.button) return;
    decodeWaveform(player);

    player.button.addEventListener("click", async () => {
      if (!player.audio.paused) {
        player.audio.pause();
        updatePlayerState(player);
        return;
      }
      pauseOtherPlayers(player);
      if (player.audio.ended) player.audio.currentTime = 0;
      try {
        await player.audio.play();
      } catch (error) {
        if (player.status) player.status.textContent = "Playback unavailable";
      }
      updatePlayerState(player);
      requestFrame();
    });

    player.audio.addEventListener("loadedmetadata", () => {
      if (player.time) player.time.textContent = formatTime(player.audio.duration);
      player.dirty = true;
      requestFrame();
    });

    player.audio.addEventListener("play", () => updatePlayerState(player));
    player.audio.addEventListener("pause", () => updatePlayerState(player));
    player.audio.addEventListener("ended", () => {
      player.audio.currentTime = 0;
      updatePlayerState(player);
      if (player.time) player.time.textContent = formatTime(player.audio.duration);
    });
  });

  function updatePlayers() {
    audioPlayers.forEach((player) => {
      const playing = Boolean(player.audio && !player.audio.paused && !player.audio.ended);
      if (playing) {
        if (player.time) player.time.textContent = `${formatTime(player.audio.currentTime)} / ${formatTime(player.audio.duration)}`;
        player.dirty = true;
      }
      if (player.dirty) drawPlayerWave(player);
    });
  }

  /* Measurement and animation coordinator */

  function measureAll() {
    layoutDirty = false;
    configureHistory();
    buildStars();
    measureWarp();
    sizeCinemaCanvases();
    audioPlayers.forEach(sizePlayerCanvas);
    updateHistory();
    updatePlayers();
  }

  function updateJourney() {
    const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pageProgress = clamp(window.scrollY / maximum);
    const bell = Math.sin(pageProgress * Math.PI);
    const journey = smoothstep(bell);
    root.style.setProperty("--journey", journey.toFixed(3));
  }

  function tick(now) {
    rafId = 0;
    if (!pageVisible) return;
    if (layoutDirty) measureAll();

    updateJourney();
    updateHistory();
    updateSuitePointer();
    updateCinemaScroll(now);
    updateCrossfade(now);
    updateCinemaProgress();
    updatePlayers();

    if (now - lastStarFrame >= 30 || reduceMotion) {
      paintStars(now, window.scrollY);
      lastStarFrame = now;
    }

    if (cinemaState.visible) {
      paintCinemaScene(now);
      paintCinemaWave(now);
    }

    const anyAudio = cinemaState.playing || audioPlayers.some((player) => player.audio && !player.audio.paused);
    if (!reduceMotion || anyAudio || cinemaState.crossfade) requestFrame();
  }

  function requestFrame() {
    if (!rafId && pageVisible) rafId = requestAnimationFrame(tick);
  }

  function markLayoutDirty() {
    layoutDirty = true;
    requestFrame();
  }

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(markLayoutDirty);
    resizeObserver.observe(document.documentElement);
    if (historyTrack) resizeObserver.observe(historyTrack);
    if (cinemaCanvas) resizeObserver.observe(cinemaCanvas);
    audioPlayers.forEach((player) => {
      if (player.canvas) resizeObserver.observe(player.canvas);
    });
  } else {
    window.addEventListener("resize", markLayoutDirty, { passive: true });
  }

  function handleMotionPreference(event) {
    reduceMotion = event.matches;
    root.classList.toggle("motion-enabled", !reduceMotion);
    if (reduceMotion) {
      const activeSuiteRow = suitePointerState.row;
      resetSuitePointer();
      clearSuitePointerStyles(activeSuiteRow);
      suitePointerState.row = null;
      suitePointerState.currentX = 0.5;
      suitePointerState.currentY = 0.5;
    }
    starState.staticDrawn = false;
    layoutDirty = true;
    requestFrame();
  }

  if (motionQuery.addEventListener) motionQuery.addEventListener("change", handleMotionPreference);
  else motionQuery.addListener(handleMotionPreference);

  function handleDesktopPreference() {
    layoutDirty = true;
    closeMenu();
    requestFrame();
  }

  if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", handleDesktopPreference);
  else desktopQuery.addListener(handleDesktopPreference);

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (pageVisible) {
      cinemaState.startedAt = performance.now();
      requestFrame();
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  });

  if ("IntersectionObserver" in window && cinemaSection) {
    const cinemaVisibilityObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) requestFrame();
    }, { rootMargin: "20% 0px" });
    cinemaVisibilityObserver.observe(cinemaSection);
  }

  window.addEventListener("pageshow", markLayoutDirty, { passive: true });
  window.addEventListener("load", markLayoutDirty, { once: true });
  document.fonts?.ready.then(markLayoutDirty);

  measureAll();
  updateCinemaButton();
  requestFrame();
})();
