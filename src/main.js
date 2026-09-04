(() => {
  "use strict";

  const root = document.documentElement;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 821px)");
  let reduceMotion = motionQuery.matches;
  let pageVisible = !document.hidden;
  let rafId = 0;
  let lastStarFrame = 0;
  let lastExpressionFrame = 0;
  let lastClosingFrame = 0;
  let layoutDirty = true;
  let scrollDirty = true;
  let cachedScrollY = window.scrollY;
  let lastScrollAt = Number.NEGATIVE_INFINITY;
  let lastJourney = Number.NaN;

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
  const historyProgress = document.querySelector("[data-history-progress]");
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

  function updateMobileHistoryProgress() {
    if (!historyTrack || !historyProgress) return;
    const maximum = Math.max(1, historyTrack.scrollWidth - historyTrack.clientWidth);
    const progress = clamp(historyTrack.scrollLeft / maximum);
    historyProgress.style.transform = `scaleX(${progress.toFixed(4)})`;
  }

  if (historyTrack) {
    let historyProgressFrame = 0;
    historyTrack.addEventListener("scroll", () => {
      if (historyProgressFrame) return;
      historyProgressFrame = requestAnimationFrame(() => {
        historyProgressFrame = 0;
        updateMobileHistoryProgress();
      });
    }, { passive: true });
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
      if (reduceMotion || !finePointerQuery.matches || event.pointerType === "touch") return;
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

    row.addEventListener("pointerdown", (event) => {
      if (reduceMotion || event.pointerType === "mouse") return;
      if (suitePointerState.row && suitePointerState.row !== row) clearSuitePointerStyles(suitePointerState.row);
      suitePointerState.row = row;
      suitePointerState.rect = row.getBoundingClientRect();
      suitePointerState.active = true;
      targetSuitePointer(row, event);
      row.classList.add("is-pointer-active");
      requestFrame();
    }, { passive: true });

    row.addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse") return;
      window.setTimeout(resetSuitePointer, 180);
    }, { passive: true });
  });

  /* Living expression field */

  const expressionField = document.querySelector("[data-expression-field]");
  const expressionCanvas = expressionField?.querySelector("[data-expression-canvas]");
  const expressionState = {
    context: null,
    width: 0,
    height: 0,
    dpr: 1,
    visible: true,
    pointerX: 0,
    pointerY: 0,
    targetX: 0,
    targetY: 0,
    cursorX: 0,
    cursorY: 0,
    cursorTargetX: 0,
    cursorTargetY: 0,
    pointerActive: false,
    lastPointerAt: Number.NEGATIVE_INFINITY,
    motes: [],
    flight: null,
    staticDrawn: false
  };

  function cubicPoint(start, controlA, controlB, end, amount) {
    const inverse = 1 - amount;
    const a = inverse * inverse * inverse;
    const b = 3 * inverse * inverse * amount;
    const c = 3 * inverse * amount * amount;
    const d = amount * amount * amount;
    return {
      x: start.x * a + controlA.x * b + controlB.x * c + end.x * d,
      y: start.y * a + controlA.y * b + controlB.y * c + end.y * d
    };
  }

  function cubicTangent(start, controlA, controlB, end, amount) {
    const inverse = 1 - amount;
    return {
      x: 3 * inverse * inverse * (controlA.x - start.x)
        + 6 * inverse * amount * (controlB.x - controlA.x)
        + 3 * amount * amount * (end.x - controlB.x),
      y: 3 * inverse * inverse * (controlA.y - start.y)
        + 6 * inverse * amount * (controlB.y - controlA.y)
        + 3 * amount * amount * (end.y - controlB.y)
    };
  }

  function buildExpressionMotes() {
    if (!expressionCanvas) return;
    const changed = sizeCanvas(expressionCanvas, expressionState);
    if (!changed && expressionState.motes.length) return;
    const random = seeded(8252026);
    const count = desktopQuery.matches
      ? Math.max(140, Math.min(210, Math.round(expressionState.width * expressionState.height / 1350)))
      : Math.max(78, Math.min(112, Math.round(expressionState.width * expressionState.height / 900)));
    expressionState.motes = Array.from({ length: count }, (_, index) => {
      const tint = random();
      return {
        origin: random(),
        lane: (random() - 0.5) * expressionState.height * 0.3,
        phase: random() * Math.PI * 2,
        speed: 0.55 + random() * 0.8,
        depth: 0.3 + random() * 0.7,
        length: 2 + random() * 7,
        width: 0.55 + random() * 1.05,
        alpha: 0.28 + random() * 0.58,
        color: tint < 0.7 ? [199, 241, 229] : tint < 0.86 ? [245, 217, 168] : [188, 169, 244],
        bright: index % 13 === 0,
        cursorOffsetX: 0,
        cursorOffsetY: 0,
        cursorReach: 0.17 + random() * 0.17,
        cursorResponse: 0.035 + random() * 0.075,
        cursorPolarity: random() < 0.76 ? 1 : -0.42,
        cursorCurl: random() * 2 - 1
      };
    });
    expressionState.cursorX = expressionState.width * 0.5;
    expressionState.cursorY = expressionState.height * 0.5;
    expressionState.cursorTargetX = expressionState.cursorX;
    expressionState.cursorTargetY = expressionState.cursorY;
    expressionState.staticDrawn = false;
  }

  function murmurationPoint(mote, amount, seconds) {
    const { width, height, pointerX, pointerY } = expressionState;
    const start = { x: width * 0.02, y: height * 0.69 };
    const controlA = {
      x: width * (0.25 + pointerX * 0.035),
      y: height * (0.08 + pointerY * 0.06)
    };
    const controlB = {
      x: width * (0.7 + pointerX * 0.045),
      y: height * (0.9 + pointerY * 0.075)
    };
    const end = { x: width * 0.99, y: height * 0.29 };
    const point = cubicPoint(start, controlA, controlB, end, amount);
    const tangent = cubicTangent(start, controlA, controlB, end, amount);
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const tangentX = tangent.x / tangentLength;
    const tangentY = tangent.y / tangentLength;
    const flockEnvelope = 0.22 + Math.pow(Math.sin(amount * Math.PI), 0.72) * 0.92;
    const breathingLane = mote.lane * flockEnvelope * (0.76 + Math.sin(seconds * 0.28 + mote.phase) * 0.24);
    const drift = Math.sin(seconds * (0.22 + mote.depth * 0.14) + mote.phase * 1.7) * 7 * mote.depth;
    point.x += -tangentY * (breathingLane + drift);
    point.y += tangentX * (breathingLane + drift);

    return { ...point, tangentX, tangentY };
  }

  function applyMoteCursor(point, mote) {
    const deltaX = point.x - expressionState.cursorX;
    const deltaY = point.y - expressionState.cursorY;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const reach = expressionState.width * mote.cursorReach;
    const influence = expressionState.pointerActive
      ? Math.exp(-Math.pow(distance / reach, 2))
      : 0;
    const radial = influence * 24 * mote.depth * mote.cursorPolarity;
    const curl = influence * 15 * mote.depth * mote.cursorCurl;
    const targetOffsetX = deltaX / distance * radial - deltaY / distance * curl;
    const targetOffsetY = deltaY / distance * radial + deltaX / distance * curl;
    mote.cursorOffsetX += (targetOffsetX - mote.cursorOffsetX) * mote.cursorResponse;
    mote.cursorOffsetY += (targetOffsetY - mote.cursorOffsetY) * mote.cursorResponse;
    point.x += mote.cursorOffsetX;
    point.y += mote.cursorOffsetY;
    return point;
  }

  function updateExpressionPointer() {
    if (!expressionField || reduceMotion) return false;
    const pathDeltaX = expressionState.targetX - expressionState.pointerX;
    const pathDeltaY = expressionState.targetY - expressionState.pointerY;
    const cursorDeltaX = expressionState.cursorTargetX - expressionState.cursorX;
    const cursorDeltaY = expressionState.cursorTargetY - expressionState.cursorY;
    const moving = Math.abs(pathDeltaX) > 0.0004
      || Math.abs(pathDeltaY) > 0.0004
      || Math.abs(cursorDeltaX) > 0.08
      || Math.abs(cursorDeltaY) > 0.08;
    if (!moving) return false;
    expressionState.pointerX += (expressionState.targetX - expressionState.pointerX) * 0.055;
    expressionState.pointerY += (expressionState.targetY - expressionState.pointerY) * 0.055;
    expressionState.cursorX += (expressionState.cursorTargetX - expressionState.cursorX) * 0.14;
    expressionState.cursorY += (expressionState.cursorTargetY - expressionState.cursorY) * 0.14;
    expressionField.style.setProperty("--field-shift-x", `${(expressionState.pointerX * 7).toFixed(2)}px`);
    expressionField.style.setProperty("--field-shift-y", `${(expressionState.pointerY * 5).toFixed(2)}px`);
    return true;
  }

  function paintExpressionField(now) {
    const { context, width, height } = expressionState;
    if (!context || !width || !height || !expressionState.visible) return;
    if (reduceMotion && expressionState.staticDrawn) return;

    const seconds = reduceMotion ? 3.8 : now / 1000;
    context.clearRect(0, 0, width, height);
    if (expressionState.flight) return;
    context.save();
    context.globalCompositeOperation = "lighter";

    const glows = [
      { amount: 0.34, radius: width * 0.18, color: [117, 229, 200], alpha: 0.095 },
      { amount: 0.69, radius: width * 0.16, color: [112, 216, 237], alpha: 0.07 }
    ];
    const guideMote = { lane: 0, phase: 0, depth: 0.5 };
    glows.forEach((glow) => {
      const point = murmurationPoint(guideMote, glow.amount, seconds);
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, glow.radius);
      gradient.addColorStop(0, rgb(glow.color, glow.alpha));
      gradient.addColorStop(1, rgb(glow.color, 0));
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, glow.radius, 0, Math.PI * 2);
      context.fill();
    });

    expressionState.motes.forEach((mote) => {
      const amount = (mote.origin + seconds * 0.0085 * mote.speed) % 1;
      const point = applyMoteCursor(murmurationPoint(mote, amount, seconds), mote);
      const edgeFade = Math.pow(Math.sin(amount * Math.PI), 0.52);
      const shimmer = 0.72 + Math.sin(seconds * 0.7 + mote.phase) * 0.28;
      const alpha = mote.alpha * edgeFade * shimmer;
      const length = mote.length * (0.65 + mote.depth * 0.6);

      if (mote.bright) {
        const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 9 + mote.depth * 7);
        glow.addColorStop(0, rgb(mote.color, alpha * 0.34));
        glow.addColorStop(1, rgb(mote.color, 0));
        context.fillStyle = glow;
        context.beginPath();
        context.arc(point.x, point.y, 9 + mote.depth * 7, 0, Math.PI * 2);
        context.fill();
      }

      context.strokeStyle = rgb(mote.color, alpha);
      context.lineWidth = mote.width;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(point.x - point.tangentX * length * 0.5, point.y - point.tangentY * length * 0.5);
      context.lineTo(point.x + point.tangentX * length * 0.5, point.y + point.tangentY * length * 0.5);
      context.stroke();
    });
    context.restore();

    if (reduceMotion) expressionState.staticDrawn = true;
  }

  function targetExpressionPointer(event) {
    const rect = expressionCanvas.getBoundingClientRect();
    expressionState.targetX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
    expressionState.targetY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    expressionState.cursorTargetX = event.clientX - rect.left;
    expressionState.cursorTargetY = event.clientY - rect.top;
    expressionState.pointerActive = true;
    expressionState.lastPointerAt = performance.now();
    requestFrame();
  }

  if (finePointerQuery.matches && expressionCanvas) {
    window.addEventListener("pointermove", (event) => {
      if (reduceMotion || !expressionState.visible) return;
      targetExpressionPointer(event);
    }, { passive: true });

    document.documentElement.addEventListener("pointerleave", () => {
      expressionState.targetX = 0;
      expressionState.targetY = 0;
      expressionState.pointerActive = false;
      requestFrame();
    }, { passive: true });
  }

  const heroSection = expressionField?.closest(".hero");
  if (heroSection && expressionCanvas) {
    let expressionTouchId = null;
    heroSection.addEventListener("pointerdown", (event) => {
      if (reduceMotion || event.pointerType === "mouse") return;
      expressionTouchId = event.pointerId;
      targetExpressionPointer(event);
    }, { passive: true });
    heroSection.addEventListener("pointermove", (event) => {
      if (reduceMotion || event.pointerId !== expressionTouchId) return;
      targetExpressionPointer(event);
    }, { passive: true });
    const releaseExpressionTouch = (event) => {
      if (event.pointerId !== expressionTouchId) return;
      expressionTouchId = null;
      expressionState.pointerActive = false;
      expressionState.targetX = 0;
      expressionState.targetY = 0;
      requestFrame();
    };
    heroSection.addEventListener("pointerup", releaseExpressionTouch, { passive: true });
    heroSection.addEventListener("pointercancel", releaseExpressionTouch, { passive: true });
  }

  function beginExpressionFlight(event) {
    const detail = event.detail || {};
    const targetX = Number(detail.x);
    const targetY = Number(detail.y);
    if (reduceMotion || !expressionState.visible || !expressionCanvas || !expressionState.motes.length
      || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

    const now = performance.now();
    const seconds = now / 1000;
    const rect = expressionCanvas.getBoundingClientRect();
    const particles = expressionState.motes.map((mote, index) => {
      const amount = (mote.origin + seconds * 0.0085 * mote.speed) % 1;
      const point = applyMoteCursor(murmurationPoint(mote, amount, seconds), mote);
      const angle = index * 2.399963;
      const arrivalRadius = 3 + (index * 11) % 18;
      const startX = rect.left + point.x;
      const startY = rect.top + point.y;
      const distance = Math.hypot(targetX - startX, targetY - startY);
      const normalX = -(targetY - startY) / (distance || 1);
      const normalY = (targetX - startX) / (distance || 1);
      const arc = (18 + (index % 9) * 7) * (index % 2 ? 1 : -1);
      return {
        ...mote,
        startX,
        startY,
        targetX: targetX + Math.cos(angle) * arrivalRadius,
        targetY: targetY + Math.sin(angle) * arrivalRadius * 0.62,
        controlX: (startX + targetX) * 0.5 + normalX * arc,
        controlY: (startY + targetY) * 0.5 + normalY * arc,
        flightDelay: (index % 13) * 6 + (1 - mote.depth) * 34
      };
    });

    expressionState.flight = {
      id: detail.id,
      startedAt: now,
      duration: 920,
      particles
    };
    expressionState.pointerActive = false;
    requestFrame();
  }

  window.addEventListener("porus:stars-converge", beginExpressionFlight);

  function paintExpressionFlight(context, now) {
    const flight = expressionState.flight;
    if (!flight) return;
    const elapsed = now - flight.startedAt;

    context.save();
    context.globalCompositeOperation = "lighter";
    flight.particles.forEach((particle) => {
      const available = Math.max(1, flight.duration - particle.flightDelay);
      const progress = clamp((elapsed - particle.flightDelay) / available);
      const eased = progress * progress * (3 - 2 * progress);
      const previousProgress = clamp(progress - mix(0.045, 0.014, eased));
      const previousEased = previousProgress * previousProgress * (3 - 2 * previousProgress);
      const curvePoint = (amount) => {
        const inverse = 1 - amount;
        return {
          x: inverse * inverse * particle.startX
            + 2 * inverse * amount * particle.controlX
            + amount * amount * particle.targetX,
          y: inverse * inverse * particle.startY
            + 2 * inverse * amount * particle.controlY
            + amount * amount * particle.targetY
        };
      };
      const point = curvePoint(eased);
      const tail = curvePoint(previousEased);
      const arrival = smoothstep((progress - 0.78) / 0.22);
      const alpha = particle.alpha * mix(0.72, 1.45, progress) * (1 - arrival * 0.94);
      const trail = Math.hypot(point.x - tail.x, point.y - tail.y);

      if (trail > 0.8) {
        const gradient = context.createLinearGradient(tail.x, tail.y, point.x, point.y);
        gradient.addColorStop(0, rgb(particle.color, 0));
        gradient.addColorStop(1, rgb(particle.color, Math.min(0.94, alpha)));
        context.strokeStyle = gradient;
        context.lineWidth = particle.width * mix(0.8, 1.35, progress);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(tail.x, tail.y);
        context.lineTo(point.x, point.y);
        context.stroke();
      }

      if (progress < 0.99) {
        context.fillStyle = rgb(particle.color, Math.min(1, alpha));
        context.beginPath();
        context.arc(point.x, point.y, Math.max(0.65, particle.width * 0.72), 0, Math.PI * 2);
        context.fill();
      }
    });
    context.restore();

    if (elapsed >= flight.duration) expressionState.flight = null;
  }

  /* Closing constellation */

  const closingField = document.querySelector("[data-closing-field]");
  const closingCanvas = closingField?.querySelector("[data-closing-stars]");
  const closingState = {
    context: null,
    width: 0,
    height: 0,
    dpr: 1,
    stars: [],
    visible: false,
    entered: false,
    enteredAt: 0,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    pointerTargetX: 0,
    pointerTargetY: 0,
    lastPointerAt: Number.NEGATIVE_INFINITY,
    flight: null,
    staticDrawn: false
  };

  function buildClosingStars() {
    if (!closingCanvas) return;
    const changed = sizeCanvas(closingCanvas, closingState);
    if (!changed && closingState.stars.length) return;
    const random = seeded(19082026);
    const count = Math.max(52, Math.min(118, Math.round(closingState.width * closingState.height / 11800)));
    closingState.stars = Array.from({ length: count }, (_, index) => {
      const baseX = 0.035 + random() * 0.93;
      const baseY = 0.1 + random() * 0.8;
      const fromLeft = baseX < 0.5;
      const tint = random();
      return {
        baseX,
        baseY,
        startX: fromLeft ? -0.07 - random() * 0.08 : 1.07 + random() * 0.08,
        startY: clamp(baseY + (random() - 0.5) * 0.34, -0.08, 1.08),
        entryDelay: random() * 430,
        entryDuration: 720 + random() * 420,
        radius: 0.5 + random() * 1.15,
        alpha: 0.22 + random() * 0.48,
        phase: random() * Math.PI * 2,
        speed: 0.22 + random() * 0.42,
        depth: 0.25 + random() * 0.75,
        color: tint < 0.74 ? [224, 248, 241] : tint < 0.9 ? [168, 235, 218] : [202, 181, 246],
        bright: index % 19 === 0,
        cursorOffsetX: 0,
        cursorOffsetY: 0,
        cursorReach: 0.11 + random() * 0.11,
        cursorResponse: 0.04 + random() * 0.07,
        cursorPolarity: random() < 0.78 ? 1 : -0.38,
        cursorCurl: random() * 2 - 1,
        lastX: baseX * closingState.width,
        lastY: baseY * closingState.height
      };
    });
    closingState.pointerX = closingState.width * 0.5;
    closingState.pointerY = closingState.height * 0.5;
    closingState.pointerTargetX = closingState.pointerX;
    closingState.pointerTargetY = closingState.pointerY;
    closingState.staticDrawn = false;
  }

  function updateClosingPointer() {
    if (!closingCanvas || reduceMotion) return false;
    const deltaX = closingState.pointerTargetX - closingState.pointerX;
    const deltaY = closingState.pointerTargetY - closingState.pointerY;
    const moving = Math.abs(deltaX) > 0.08 || Math.abs(deltaY) > 0.08;
    if (!moving) return false;
    closingState.pointerX += deltaX * 0.13;
    closingState.pointerY += deltaY * 0.13;
    return true;
  }

  function closingStarPoint(star, now) {
    const elapsed = closingState.enteredAt ? now - closingState.enteredAt : 1200;
    const arrival = reduceMotion ? 1 : smoothstep((elapsed - star.entryDelay) / star.entryDuration);
    const seconds = now / 1000;
    const point = {
      x: mix(star.startX, star.baseX, arrival) * closingState.width,
      y: mix(star.startY, star.baseY, arrival) * closingState.height
    };
    point.x += Math.sin(seconds * star.speed + star.phase) * 2.8 * star.depth * arrival;
    point.y += Math.cos(seconds * star.speed * 0.74 + star.phase) * 2.1 * star.depth * arrival;

    const deltaX = point.x - closingState.pointerX;
    const deltaY = point.y - closingState.pointerY;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const reach = closingState.width * star.cursorReach;
    const influence = closingState.pointerActive ? Math.exp(-Math.pow(distance / reach, 2)) : 0;
    const radial = influence * 22 * star.depth * star.cursorPolarity;
    const curl = influence * 12 * star.depth * star.cursorCurl;
    const offsetX = deltaX / distance * radial - deltaY / distance * curl;
    const offsetY = deltaY / distance * radial + deltaX / distance * curl;
    star.cursorOffsetX += (offsetX - star.cursorOffsetX) * star.cursorResponse;
    star.cursorOffsetY += (offsetY - star.cursorOffsetY) * star.cursorResponse;
    point.x += star.cursorOffsetX;
    point.y += star.cursorOffsetY;
    star.lastX = point.x;
    star.lastY = point.y;
    return { ...point, arrival };
  }

  function paintClosingStars(now) {
    const { context, width, height, stars } = closingState;
    if (!context || !width || !height || !closingState.visible || !stars.length) return;
    if (reduceMotion && closingState.staticDrawn) return;
    context.clearRect(0, 0, width, height);
    if (closingState.flight) return;
    context.save();
    context.globalCompositeOperation = "lighter";
    stars.forEach((star) => {
      const point = closingStarPoint(star, now);
      const twinkle = reduceMotion ? 0.82 : 0.72 + Math.sin(now / 1000 * star.speed + star.phase) * 0.28;
      const alpha = star.alpha * twinkle * point.arrival;
      if (star.bright && point.arrival > 0.45) {
        const radius = 9 + star.depth * 8;
        const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        glow.addColorStop(0, rgb(star.color, alpha * 0.28));
        glow.addColorStop(1, rgb(star.color, 0));
        context.fillStyle = glow;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = rgb(star.color, alpha);
      context.beginPath();
      context.arc(point.x, point.y, star.radius, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
    if (reduceMotion) closingState.staticDrawn = true;
  }

  if (finePointerQuery.matches && closingCanvas) {
    closingField.addEventListener("pointerenter", (event) => {
      const rect = closingCanvas.getBoundingClientRect();
      closingState.pointerActive = true;
      closingState.pointerTargetX = event.clientX - rect.left;
      closingState.pointerTargetY = event.clientY - rect.top;
      closingState.lastPointerAt = performance.now();
      requestFrame();
    }, { passive: true });
    closingField.addEventListener("pointermove", (event) => {
      const rect = closingCanvas.getBoundingClientRect();
      closingState.pointerTargetX = event.clientX - rect.left;
      closingState.pointerTargetY = event.clientY - rect.top;
      closingState.lastPointerAt = performance.now();
      requestFrame();
    }, { passive: true });
    closingField.addEventListener("pointerleave", () => {
      closingState.pointerActive = false;
      requestFrame();
    }, { passive: true });
  }

  function beginClosingFlight(event) {
    const detail = event.detail || {};
    const targetX = Number(detail.x);
    const targetY = Number(detail.y);
    if (reduceMotion || !closingState.visible || !closingCanvas || !closingState.stars.length
      || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
    const now = performance.now();
    const rect = closingCanvas.getBoundingClientRect();
    const particles = closingState.stars.map((star, index) => {
      const startX = rect.left + star.lastX;
      const startY = rect.top + star.lastY;
      const angle = index * 2.399963;
      const arrivalRadius = 3 + (index * 7) % 16;
      const distance = Math.hypot(targetX - startX, targetY - startY) || 1;
      const arc = (14 + index % 8 * 5) * (index % 2 ? 1 : -1);
      return {
        ...star,
        startX,
        startY,
        targetX: targetX + Math.cos(angle) * arrivalRadius,
        targetY: targetY + Math.sin(angle) * arrivalRadius * 0.62,
        controlX: (startX + targetX) * 0.5 - (targetY - startY) / distance * arc,
        controlY: (startY + targetY) * 0.5 + (targetX - startX) / distance * arc,
        flightDelay: index % 11 * 7 + (1 - star.depth) * 26
      };
    });
    closingState.flight = { id: detail.id, startedAt: now, duration: 920, particles };
    closingState.pointerActive = false;
    requestFrame();
  }

  window.addEventListener("porus:stars-converge", beginClosingFlight);

  function paintClosingFlight(context, now) {
    const flight = closingState.flight;
    if (!flight) return;
    const elapsed = now - flight.startedAt;
    context.save();
    context.globalCompositeOperation = "lighter";
    flight.particles.forEach((particle) => {
      const available = Math.max(1, flight.duration - particle.flightDelay);
      const progress = clamp((elapsed - particle.flightDelay) / available);
      const eased = progress * progress * progress;
      const previous = clamp(progress - mix(0.05, 0.016, progress));
      const previousEased = previous * previous * previous;
      const pointAt = (amount) => {
        const inverse = 1 - amount;
        return {
          x: inverse * inverse * particle.startX + 2 * inverse * amount * particle.controlX + amount * amount * particle.targetX,
          y: inverse * inverse * particle.startY + 2 * inverse * amount * particle.controlY + amount * amount * particle.targetY
        };
      };
      const point = pointAt(eased);
      const tail = pointAt(previousEased);
      const arrival = smoothstep((progress - 0.76) / 0.24);
      const alpha = particle.alpha * mix(0.8, 1.55, progress) * (1 - arrival * 0.94);
      if (Math.hypot(point.x - tail.x, point.y - tail.y) > 0.8) {
        const gradient = context.createLinearGradient(tail.x, tail.y, point.x, point.y);
        gradient.addColorStop(0, rgb(particle.color, 0));
        gradient.addColorStop(1, rgb(particle.color, Math.min(0.96, alpha)));
        context.strokeStyle = gradient;
        context.lineWidth = particle.radius * mix(0.8, 1.35, progress);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(tail.x, tail.y);
        context.lineTo(point.x, point.y);
        context.stroke();
      }
      if (progress < 0.99) {
        context.fillStyle = rgb(particle.color, Math.min(1, alpha));
        context.beginPath();
        context.arc(point.x, point.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
    });
    context.restore();
    if (elapsed >= flight.duration) closingState.flight = null;
  }

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
    staticDrawn: false,
    pointerX: 0,
    pointerY: 0,
    pointerTargetX: 0,
    pointerTargetY: 0,
    convergence: null
  };

  const STAR_CONVERGENCE_DURATION = 920;

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
        depth: 0.28 + random() * 0.72,
        color: tint < 0.75 ? [255, 255, 255] : tint < 0.91 ? [190, 255, 224] : [168, 224, 255]
      };
    });
    starState.lastPaint = 0;
    starState.staticDrawn = false;
  }

  function starPointerOffset(star) {
    if (reduceMotion) return { x: 0, y: 0 };
    const depth = star.depth || 0.5;
    return {
      x: starState.pointerX * mix(2, 8, depth),
      y: starState.pointerY * mix(1.5, 6, depth)
    };
  }

  function finishStarConvergence() {
    const convergence = starState.convergence;
    if (!convergence) return;
    starState.convergence = null;
    document.body.classList.remove("auth-starflight");
    window.dispatchEvent(new CustomEvent("porus:stars-converged", {
      detail: { id: convergence.id }
    }));
  }

  function beginStarConvergence(event) {
    const detail = event.detail || {};
    const targetX = Number(detail.x);
    const targetY = Number(detail.y);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

    if (reduceMotion || !starCanvas || !starState.stars.length) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("porus:stars-aperture", {
          detail: { id: detail.id }
        }));
      }, 70);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("porus:stars-converged", {
          detail: { id: detail.id }
        }));
      }, 150);
      return;
    }

    const now = performance.now();
    starState.convergence = {
      id: detail.id,
      targetX: clamp(targetX, 0, starState.width),
      targetY: clamp(targetY, 0, starState.height),
      startedAt: now,
      duration: STAR_CONVERGENCE_DURATION,
      apertureOpened: false
    };

    starState.stars.forEach((star, index) => {
      const offset = starPointerOffset(star);
      const angle = index * 2.399963;
      const arrivalRadius = 4 + ((index * 13) % 15);
      star.flightX = star.x * starState.width + offset.x;
      star.flightY = star.y * starState.height + offset.y;
      star.flightTargetX = clamp(targetX + Math.cos(angle) * arrivalRadius, 0, starState.width);
      star.flightTargetY = clamp(targetY + Math.sin(angle) * arrivalRadius * 0.65, 0, starState.height);
      star.flightDelay = (index % 9) * 8 + (star.depth || 0.5) * 28;
    });

    document.body.classList.add("auth-starflight");
    starState.lastPaint = now;
    requestFrame();
  }

  window.addEventListener("porus:stars-converge", beginStarConvergence);

  if (finePointerQuery.matches) {
    window.addEventListener("pointermove", (event) => {
      if (reduceMotion || starState.convergence) return;
      starState.pointerTargetX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      starState.pointerTargetY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
      requestFrame();
    }, { passive: true });

    document.documentElement.addEventListener("pointerleave", () => {
      starState.pointerTargetX = 0;
      starState.pointerTargetY = 0;
      requestFrame();
    }, { passive: true });
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

    if (starState.convergence) {
      const flight = starState.convergence;
      const elapsed = now - flight.startedAt;

      if (!flight.apertureOpened && elapsed >= flight.duration * 0.54) {
        flight.apertureOpened = true;
        window.dispatchEvent(new CustomEvent("porus:stars-aperture", {
          detail: { id: flight.id }
        }));
      }

      context.save();
      context.globalCompositeOperation = "lighter";

      stars.forEach((star) => {
        const available = Math.max(1, flight.duration - star.flightDelay);
        const progress = clamp((elapsed - star.flightDelay) / available);
        const eased = progress * progress * progress;
        const trailStep = mix(0.05, 0.016, smoothstep((progress - 0.52) / 0.48));
        const previousProgress = clamp(progress - trailStep);
        const previousEased = previousProgress * previousProgress * previousProgress;
        const x = mix(star.flightX, star.flightTargetX, eased);
        const y = mix(star.flightY, star.flightTargetY, eased);
        const tailX = mix(star.flightX, star.flightTargetX, previousEased);
        const tailY = mix(star.flightY, star.flightTargetY, previousEased);
        const arrival = smoothstep((progress - 0.74) / 0.26);
        const alpha = star.alpha * mix(0.82, 1.5, progress) * (1 - arrival * 0.9);
        const trail = Math.hypot(x - tailX, y - tailY);

        if (trail > 1.2) {
          const gradient = context.createLinearGradient(tailX, tailY, x, y);
          gradient.addColorStop(0, rgb(star.color, 0));
          gradient.addColorStop(1, rgb(star.color, Math.min(0.98, alpha)));
          context.strokeStyle = gradient;
          context.lineWidth = star.radius * mix(0.9, 1.8, progress);
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(x, y);
          context.stroke();
        }

        if (progress < 0.985) {
          context.fillStyle = rgb(star.color, Math.min(1, alpha));
          context.beginPath();
          context.arc(x, y, star.radius * mix(1, 1.6, progress), 0, Math.PI * 2);
          context.fill();
        }
      });

      paintExpressionFlight(context, now);
      paintClosingFlight(context, now);

      const gather = smoothstep(elapsed / flight.duration);
      const glowFade = 1 - smoothstep((gather - 0.72) / 0.28);
      const glowRadius = mix(4, 42, gather);
      const glow = context.createRadialGradient(
        flight.targetX, flight.targetY, 0,
        flight.targetX, flight.targetY, glowRadius
      );
      glow.addColorStop(0, `rgba(212,255,242,${0.72 * gather * glowFade})`);
      glow.addColorStop(0.28, `rgba(117,229,200,${0.34 * gather * glowFade})`);
      glow.addColorStop(1, "rgba(112,216,237,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(flight.targetX, flight.targetY, glowRadius, 0, Math.PI * 2);
      context.fill();
      context.restore();

      if (elapsed >= flight.duration) finishStarConvergence();
      return;
    }

    stars.forEach((star, index) => {
      const pointerOffset = starPointerOffset(star);
      let x = star.x * width + pointerOffset.x;
      let y = star.y * height + pointerOffset.y;
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

        x = star.x * width + pointerOffset.x;
        y = star.y * height + pointerOffset.y;
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
    if (expressionCanvas) buildExpressionMotes();
    if (closingCanvas) buildClosingStars();
    updateMobileHistoryProgress();
    sizeCinemaCanvases();
    audioPlayers.forEach(sizePlayerCanvas);
    updateHistory();
    updatePlayers();
  }

  function updateJourney(scrollY) {
    const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pageProgress = clamp(scrollY / maximum);
    const bell = Math.sin(pageProgress * Math.PI);
    const journey = smoothstep(bell);
    if (!Number.isFinite(lastJourney) || Math.abs(journey - lastJourney) > 0.0005) {
      root.style.setProperty("--journey", journey.toFixed(3));
      lastJourney = journey;
    }
  }

  function tick(now) {
    rafId = 0;
    if (!pageVisible) return;
    if (layoutDirty) measureAll();

    const scrolling = scrollDirty || now - lastScrollAt < 150;
    if (scrollDirty) {
      cachedScrollY = window.scrollY;
      updateJourney(cachedScrollY);
      updateHistory();
      updateCinemaScroll(now);
      scrollDirty = false;
    }

    updateSuitePointer();
    const expressionPointerMoving = updateExpressionPointer();
    const closingPointerMoving = updateClosingPointer();
    updateCrossfade(now);
    updateCinemaProgress();
    updatePlayers();

    let starPointerMoving = false;
    if (!reduceMotion && !starState.convergence) {
      starPointerMoving = Math.abs(starState.pointerTargetX - starState.pointerX) > 0.0004
        || Math.abs(starState.pointerTargetY - starState.pointerY) > 0.0004;
      starState.pointerX += (starState.pointerTargetX - starState.pointerX) * 0.045;
      starState.pointerY += (starState.pointerTargetY - starState.pointerY) * 0.045;
    }

    const starFrameInterval = scrolling || starState.convergence || starPointerMoving ? 15 : 30;
    if (now - lastStarFrame >= starFrameInterval || reduceMotion) {
      paintStars(now, cachedScrollY);
      lastStarFrame = now;
    }

    const expressionHighRate = expressionPointerMoving
      || now - expressionState.lastPointerAt < 520;
    const expressionFrameInterval = expressionHighRate ? 15 : 30;
    if (expressionState.visible && (now - lastExpressionFrame >= expressionFrameInterval || reduceMotion)) {
      paintExpressionField(now);
      lastExpressionFrame = now;
    }

    const closingHighRate = scrolling
      || closingPointerMoving
      || now - closingState.lastPointerAt < 520
      || (closingState.visible && now - closingState.enteredAt < 1650);
    const closingFrameInterval = closingHighRate ? 15 : 30;
    if (closingState.visible && (now - lastClosingFrame >= closingFrameInterval || reduceMotion)) {
      paintClosingStars(now);
      lastClosingFrame = now;
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
    scrollDirty = true;
    requestFrame();
  }

  window.addEventListener("scroll", () => {
    cachedScrollY = window.scrollY;
    scrollDirty = true;
    lastScrollAt = performance.now();
    requestFrame();
  }, { passive: true });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(markLayoutDirty);
    resizeObserver.observe(document.documentElement);
    if (historyTrack) resizeObserver.observe(historyTrack);
    if (expressionCanvas) resizeObserver.observe(expressionCanvas);
    if (closingCanvas) resizeObserver.observe(closingCanvas);
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
      starState.pointerX = 0;
      starState.pointerY = 0;
      starState.pointerTargetX = 0;
      starState.pointerTargetY = 0;
      expressionState.pointerX = 0;
      expressionState.pointerY = 0;
      expressionState.targetX = 0;
      expressionState.targetY = 0;
      expressionState.pointerActive = false;
      expressionState.flight = null;
      expressionState.motes.forEach((mote) => {
        mote.cursorOffsetX = 0;
        mote.cursorOffsetY = 0;
      });
      closingState.pointerActive = false;
      closingState.flight = null;
      closingState.stars.forEach((star) => {
        star.cursorOffsetX = 0;
        star.cursorOffsetY = 0;
      });
    }
    starState.staticDrawn = false;
    expressionState.staticDrawn = false;
    closingState.staticDrawn = false;
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
      cinemaState.visible = entries.some((entry) => entry.isIntersecting);
      if (cinemaState.visible) requestFrame();
    }, { rootMargin: "20% 0px" });
    cinemaVisibilityObserver.observe(cinemaSection);
  }

  if ("IntersectionObserver" in window && expressionField) {
    const expressionVisibilityObserver = new IntersectionObserver((entries) => {
      expressionState.visible = entries.some((entry) => entry.isIntersecting);
      if (expressionState.visible) requestFrame();
    }, { rootMargin: "15% 0px" });
    expressionVisibilityObserver.observe(expressionField);
  }

  if ("IntersectionObserver" in window && closingField) {
    const closingVisibilityObserver = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      closingState.visible = visible;
      if (visible && !closingState.entered) {
        closingState.entered = true;
        closingState.enteredAt = performance.now();
      }
      if (visible) requestFrame();
    }, { threshold: 0.12, rootMargin: "10% 0px" });
    closingVisibilityObserver.observe(closingField);
  } else if (closingField) {
    closingState.visible = true;
    closingState.entered = true;
    closingState.enteredAt = performance.now();
  }

  window.addEventListener("pageshow", markLayoutDirty, { passive: true });
  window.addEventListener("load", markLayoutDirty, { once: true });
  document.fonts?.ready.then(markLayoutDirty);

  measureAll();
  updateCinemaButton();
  requestFrame();
})();

/* =========================================================
   Star-linked auth portal + full-screen sign-in
   ========================================================= */
(() => {
  "use strict";

  const portal = document.querySelector("[data-auth-portal]");
  if (!portal) return;

  const openers = document.querySelectorAll("[data-auth-open]");
  const closeBtn = portal.querySelector("[data-auth-close]");
  const scene = portal.querySelector(".auth-scene");
  const tabs = Array.from(portal.querySelectorAll("[data-auth-tab]"));
  const underline = portal.querySelector(".auth-tab-underline");
  const forms = {
    signin: portal.querySelector('[data-auth-form="signin"]'),
    signup: portal.querySelector('[data-auth-form="signup"]'),
  };
  const titleEl = portal.querySelector("[data-auth-title]");
  const subEl = portal.querySelector("[data-auth-sub]");

  const copy = {
    signin: {
      title: "Enter the studio",
      sub: "Sign in with the account you use for authorized clip access.",
    },
    signup: {
      title: "Create your account",
      sub: "Tell us who you are. We keep human authority throughout every review.",
    },
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastOpener = null;
  let currentMode = "signin";
  let sceneListener = null;
  let opening = false;
  let openingId = 0;

  function setAuroraOrigin(el) {
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    if (el && typeof el.getBoundingClientRect === "function") {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height) {
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
    }
    portal.style.setProperty("--lx", `${x}px`);
    portal.style.setProperty("--ly", `${y}px`);
  }

  function positionUnderline() {
    if (!underline) return;
    const active = tabs.find((tab) => tab.classList.contains("is-active"));
    if (!active) return;
    const tabsRect = active.parentElement.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    underline.style.width = `${rect.width}px`;
    underline.style.transform = `translateX(${rect.left - tabsRect.left - 6}px)`;
  }

  function switchTab(mode) {
    if (mode !== "signin" && mode !== "signup") return;
    currentMode = mode;
    tabs.forEach((tab) => {
      const isActive = tab.dataset.authTab === mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    Object.entries(forms).forEach(([key, form]) => {
      if (!form) return;
      if (key === mode) form.removeAttribute("hidden");
      else form.setAttribute("hidden", "");
    });
    if (titleEl) titleEl.textContent = copy[mode].title;
    if (subEl) subEl.textContent = copy[mode].sub;
    requestAnimationFrame(positionUnderline);
  }

  function openPortal(fromEl) {
    if (!portal.hasAttribute("hidden") && portal.classList.contains("is-open")) return;
    lastOpener = fromEl || null;
    setAuroraOrigin(fromEl);
    portal.hidden = false;
    portal.setAttribute("aria-hidden", "false");
    document.body.classList.add("auth-active");
    portal.classList.remove("is-closing", "is-open");
    portal.classList.add("is-priming");

    // Let the clipped scene paint once before the aperture expands.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        portal.classList.remove("is-priming");
        portal.classList.add("is-folding", "is-open");
        requestAnimationFrame(positionUnderline);
      });
    });

    window.setTimeout(() => {
      portal.classList.remove("is-folding");
      const focusable = portal.querySelector(
        `.auth-form[data-auth-form="${currentMode}"] input, .auth-form:not([hidden]) input`
      );
      if (focusable) focusable.focus({ preventScroll: true });
    }, reduceMotion ? 220 : 900);
  }

  function beginPortalSequence(fromEl) {
    if (opening || (!portal.hasAttribute("hidden") && portal.classList.contains("is-open"))) return;
    opening = true;
    lastOpener = fromEl || null;
    openingId += 1;
    const id = openingId;
    const rect = fromEl?.getBoundingClientRect();
    const x = rect?.width ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect?.height ? rect.top + rect.height / 2 : window.innerHeight / 2;
    fromEl?.classList.add("is-gathering-stars");

    let completed = false;
    let portalStarted = false;
    let fallback = 0;
    const matchesIntent = (event) => !event || event.detail?.id === id;
    const startPortal = (event) => {
      if (portalStarted || !matchesIntent(event)) return;
      portalStarted = true;
      openPortal(fromEl);
    };
    const finish = (event) => {
      if (completed || !matchesIntent(event)) return;
      completed = true;
      startPortal();
      window.removeEventListener("porus:stars-aperture", startPortal);
      window.removeEventListener("porus:stars-converged", finish);
      window.clearTimeout(fallback);
      fromEl?.classList.remove("is-gathering-stars");
      opening = false;
    };

    window.addEventListener("porus:stars-aperture", startPortal);
    window.addEventListener("porus:stars-converged", finish);
    fallback = window.setTimeout(() => finish(), reduceMotion ? 240 : 1180);
    window.dispatchEvent(new CustomEvent("porus:stars-converge", {
      detail: { id, x, y }
    }));
  }

  function closePortal() {
    if (portal.hasAttribute("hidden")) return;
    portal.classList.remove("is-priming", "is-folding");
    portal.classList.add("is-closing");

    if (sceneListener) scene.removeEventListener("animationend", sceneListener);
    sceneListener = (event) => {
      if (event.target !== scene) return;
      scene.removeEventListener("animationend", sceneListener);
      sceneListener = null;
      finalizeClose();
    };
    scene.addEventListener("animationend", sceneListener);
    // Safety fallback
    window.setTimeout(finalizeClose, reduceMotion ? 260 : 900);
  }

  let finalized = false;
  function finalizeClose() {
    if (finalized) return;
    finalized = true;
    portal.classList.remove("is-open", "is-closing", "is-folding", "is-priming");
    portal.hidden = true;
    portal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("auth-active");
    if (lastOpener && typeof lastOpener.focus === "function") {
      try { lastOpener.focus({ preventScroll: false }); } catch (_) { /* noop */ }
    }
    // Allow reopening
    window.setTimeout(() => { finalized = false; }, 60);
  }

  openers.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      beginPortalSequence(btn);
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    closePortal();
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      switchTab(tab.dataset.authTab);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = event.key === "ArrowRight" ? "signup" : "signin";
      switchTab(next);
      const target = tabs.find((t) => t.dataset.authTab === next);
      if (target) target.focus();
    });
  });

  // Focus trap-lite + escape
  document.addEventListener("keydown", (event) => {
    if (portal.hasAttribute("hidden")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closePortal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = portal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (!portal.hasAttribute("hidden")) positionUnderline();
  }, { passive: true });

  // Form submit handlers (stubbed — ready for backend/SSO wiring)
  Object.entries(forms).forEach(([mode, form]) => {
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const submit = form.querySelector(".auth-submit");
      if (submit) {
        const original = submit.textContent;
        submit.disabled = true;
        submit.textContent = mode === "signin" ? "Signing in…" : "Creating account…";
        window.setTimeout(() => {
          submit.disabled = false;
          submit.textContent = original;
          console.info(`[porus.auth] ${mode} payload`, data);
        }, 900);
      }
    });
  });

  portal.querySelectorAll("[data-auth-provider]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.dataset.authProvider;
      const clientIds = {
        google: import.meta.env?.VITE_AUTH_GOOGLE_CLIENT_ID || "",
        github: import.meta.env?.VITE_AUTH_GITHUB_CLIENT_ID || "",
      };
      const clientId = clientIds[provider] || "";
      console.info(`[porus.auth] SSO requested`, { provider, clientIdConfigured: Boolean(clientId) });
      btn.animate(
        [{ transform: "scale(1)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    });
  });

  // Initialize tab underline once fonts settle
  window.addEventListener("load", () => requestAnimationFrame(positionUnderline), { once: true });
})();
