(() => {
  "use strict";

  const SESSION_KEY = "porus:session";
  const JOBS_KEY = "porus:jobs";

  const session = readSession();
  if (!session) {
    window.location.replace("/");
    return;
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function readJobs() {
    try {
      const raw = localStorage.getItem(JOBS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeJobs(jobs) {
    try {
      localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
    } catch {
      /* storage unavailable — job list stays in-memory only */
    }
  }

  const userEl = document.querySelector("[data-app-user]");
  if (userEl) {
    const label = session.name || session.email || "";
    if (label) {
      userEl.textContent = label;
      userEl.hidden = false;
    }
  }

  document.querySelector("[data-app-signout]")?.addEventListener("click", () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  });

  /* Upload */

  const dropzone = document.querySelector("[data-dropzone]");
  const fileInput = document.querySelector("[data-file-input]");
  const dropzoneFile = document.querySelector("[data-dropzone-file]");
  const glossaryInput = document.querySelector("[data-glossary-input]");
  const startButton = document.querySelector("[data-start-dub]");
  let pendingFile = null;

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / 1024 ** exponent;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
  }

  function setPendingFile(file) {
    pendingFile = file || null;
    if (!dropzoneFile || !startButton) return;
    if (pendingFile) {
      dropzoneFile.textContent = `${pendingFile.name}${pendingFile.size ? ` — ${formatBytes(pendingFile.size)}` : ""}`;
      dropzoneFile.hidden = false;
      startButton.disabled = false;
    } else {
      dropzoneFile.hidden = true;
      startButton.disabled = true;
    }
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener("change", () => {
      setPendingFile(fileInput.files?.[0] || null);
    });

    ["dragenter", "dragover"].forEach((type) => {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-drag-active");
      });
    });

    ["dragleave", "dragend", "drop"].forEach((type) => {
      dropzone.addEventListener(type, () => dropzone.classList.remove("is-drag-active"));
    });

    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) setPendingFile(file);
    });
  }

  /* Job pipeline (simulated — no backend wired up yet) */

  const PIPELINE_STEPS = [
    { key: "separate", duration: 900 },
    { key: "translate", duration: 1100 },
    { key: "voice", duration: 1500 },
    { key: "check", duration: 900 }
  ];

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Pipeline starfield — each stage is a gravity well ("black hole"). A burst
     of stars erupts from the stage that just went active, spirals across,
     and gets pulled into the next stage's well right as that stage lights
     up — then that well erupts its own burst toward the one after it, and
     so on down the line until the last stage swallows the final burst. */

  const STAR_COLORS = [
    [224, 233, 255], // frost
    [236, 202, 128], // gold
    [168, 196, 240] // blue
  ];

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function easeInStrong(t) {
    return t * t * t;
  }

  function createPipelineStarfield(canvas, anchorCount) {
    const context = canvas.getContext("2d");
    if (!context) return null;

    const PARTICLES_PER_BURST = 100;
    const anchorFracs = Array.from({ length: anchorCount }, (_, i) => i / (anchorCount - 1));
    const random = seededRandom((Date.now() ^ 0x9e3779b9) >>> 0);

    let width = 0;
    let height = 0;
    let particles = [];
    let rafId = 0;
    let running = false;
    let activeIndex = -1;

    function anchorPoint(index) {
      return { x: anchorFracs[index] * width, y: height / 2 };
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // A burst travels from stage `fromIndex` toward `toIndex` (or settles in
    // place if `toIndex` is null, for the final stage). Its base path is a
    // straight interpolation timed to `duration`, so it reliably arrives
    // exactly when the destination stage goes active — a spiral wobble on
    // top (wide at the source, tightening to nothing at the target) is what
    // actually reads as "erupting out, then pulled in and swallowed."
    function setActive(index) {
      activeIndex = index;
    }

    function burst(fromIndex, toIndex, duration) {
      const now = performance.now();
      for (let i = 0; i < PARTICLES_PER_BURST; i += 1) {
        const tint = random();
        particles.push({
          fromIndex,
          toIndex,
          // Spread across the whole stage so the stream is continuous —
          // always some stars near the source, some mid-flight, some
          // arriving — rather than one clump moving together.
          spawnAt: now + random() * duration * 0.8,
          duration: 380 + random() * 260,
          swirlAmp: 3 + random() * 8,
          swirlPhase: random() * Math.PI * 2,
          spinSpeed: (random() < 0.5 ? -1 : 1) * (2.2 + random() * 1.8),
          radius: 0.5 + random() * 0.8,
          depth: 0.4 + random() * 0.6,
          color: STAR_COLORS[tint < 0.55 ? 0 : tint < 0.82 ? 1 : 2]
        });
      }
    }

    function drawWell(point, strength, color) {
      if (strength <= 0.02) return;
      const radius = 8 + strength * 7;
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.4 * strength})`);
      gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }

    function step(now) {
      if (!running) return;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      const pulse = 0.85 + Math.sin(now / 260) * 0.15;
      anchorFracs.forEach((_frac, i) => {
        const point = anchorPoint(i);
        if (i === activeIndex) {
          drawWell(point, pulse, STAR_COLORS[1]);
        } else if (i < activeIndex) {
          drawWell(point, 0.4, STAR_COLORS[0]);
        } else {
          drawWell(point, 0.12, STAR_COLORS[0]);
        }
      });

      particles = particles.filter((particle) => {
        const elapsed = now - particle.spawnAt;
        if (elapsed < 0) return true;
        const progress = Math.min(1, elapsed / particle.duration);

        const from = anchorPoint(particle.fromIndex);
        const angle = particle.swirlPhase + (now / 1000) * particle.spinSpeed;
        let x;
        let y;

        if (particle.toIndex === null) {
          // No destination (the final stage) — orbit the well in place,
          // the loop tightening down to nothing as it gets swallowed.
          const decay = Math.max(0, 1 - progress);
          x = from.x + Math.cos(angle) * particle.swirlAmp * decay;
          y = from.y + Math.sin(angle) * particle.swirlAmp * decay * 0.6;
        } else {
          const to = anchorPoint(particle.toIndex);
          const eased = easeInStrong(progress);
          const baseX = from.x + (to.x - from.x) * eased;
          const baseY = from.y + (to.y - from.y) * eased;

          // Perpendicular spiral: wide near the source (the burst), narrowing
          // to zero at the target (getting pulled in and swallowed).
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const pathLength = Math.hypot(dx, dy) || 1;
          const perpX = -dy / pathLength;
          const perpY = dx / pathLength;
          const spiralEnvelope = Math.max(0, 1 - eased);
          const wobble = Math.sin(angle) * particle.swirlAmp * spiralEnvelope;

          x = baseX + perpX * wobble;
          y = baseY + perpY * wobble;
        }

        const fadeIn = Math.min(1, progress * 10);
        const fadeOut = Math.min(1, (1 - progress) * 8);
        const flash = progress > 0.9 ? 1 + (progress - 0.9) * 6 : 1;
        const alpha = fadeIn * fadeOut * (0.55 + particle.depth * 0.45);

        if (alpha > 0.015) {
          const glowRadius = particle.radius * 3.2 * flash;
          const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius);
          glow.addColorStop(0, `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${Math.min(1, alpha * 0.9)})`);
          glow.addColorStop(1, `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, 0)`);
          context.fillStyle = glow;
          context.beginPath();
          context.arc(x, y, glowRadius, 0, Math.PI * 2);
          context.fill();

          context.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${Math.min(1, alpha + 0.15)})`;
          context.beginPath();
          context.arc(x, y, particle.radius * flash, 0, Math.PI * 2);
          context.fill();
        }

        return progress < 1;
      });

      context.restore();
      rafId = requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      resize();
      particles = [];
      running = true;
      rafId = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      particles = [];
      context.clearRect(0, 0, width, height);
    }

    window.addEventListener("resize", () => {
      if (running) resize();
    }, { passive: true });

    return { start, stop, burst, setActive };
  }

  const jobListEl = document.querySelector("[data-job-list]");
  const jobEmptyEl = document.querySelector("[data-job-empty]");
  const jobTemplate = document.querySelector("[data-job-template]");

  function refreshEmptyState() {
    if (!jobEmptyEl || !jobListEl) return;
    jobEmptyEl.hidden = jobListEl.children.length > 0;
  }

  function buildQualityReport() {
    const backtranslation = 90 + Math.round(Math.random() * 8);
    const rate = 92 + Math.round(Math.random() * 7);
    return {
      backtranslation: `${backtranslation}%`,
      rate: `${rate}%`,
      hearback: "Passed"
    };
  }

  function downloadTextFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function buildSubtitleFile(jobName) {
    return [
      "1",
      "00:00:00,000 --> 00:00:03,200",
      "[Demo subtitle — dub pipeline output for " + jobName + "]",
      "",
      "2",
      "00:00:03,200 --> 00:00:06,000",
      "यह एक नमूना उपशीर्षक है।",
      ""
    ].join("\n");
  }

  function renderJobCard(job) {
    if (!jobTemplate || !jobListEl) return null;
    const fragment = jobTemplate.content.cloneNode(true);
    const card = fragment.querySelector("[data-job-card]");
    card.dataset.jobId = job.id;
    card.querySelector("[data-job-name]").textContent = job.name;
    card.querySelector("[data-job-meta]").textContent = "English → Hindi";
    jobListEl.prepend(card);
    refreshEmptyState();
    return card;
  }

  function setJobStatus(card, status) {
    const statusEl = card.querySelector("[data-job-status]");
    if (!statusEl) return;
    statusEl.textContent = status;
    statusEl.dataset.status = status.toLowerCase().replace(/\s+/g, "-");
  }

  function runPipeline(card, job) {
    setJobStatus(card, "Processing");
    const pipelineEl = card.querySelector("[data-pipeline-steps]");
    const visualEl = card.querySelector("[data-pipeline-visual]");
    const canvasEl = card.querySelector("[data-pipeline-canvas]");
    const starfield = !prefersReducedMotion && canvasEl
      ? createPipelineStarfield(canvasEl, PIPELINE_STEPS.length)
      : null;

    if (starfield) {
      visualEl?.classList.add("has-starfield");
      starfield.start();
    }

    let index = 0;

    function advance() {
      if (index >= PIPELINE_STEPS.length) {
        starfield?.stop();
        completeJob(card, job);
        return;
      }
      const step = PIPELINE_STEPS[index];
      const stepEl = card.querySelector(`[data-step="${step.key}"]`);
      stepEl?.classList.add("is-active");
      const nextIndex = index + 1 < PIPELINE_STEPS.length ? index + 1 : null;
      starfield?.setActive(index);
      starfield?.burst(index, nextIndex, step.duration);
      window.setTimeout(() => {
        stepEl?.classList.remove("is-active");
        stepEl?.classList.add("is-done");
        index += 1;
        pipelineEl?.style.setProperty("--progress", String(index / PIPELINE_STEPS.length));
        advance();
      }, step.duration);
    }

    advance();
  }

  function completeJob(card, job) {
    setJobStatus(card, "Complete");
    const report = buildQualityReport();
    const reportEl = card.querySelector("[data-job-report]");
    if (!reportEl) return;
    reportEl.querySelector("[data-metric-backtranslation]").textContent = report.backtranslation;
    reportEl.querySelector("[data-metric-rate]").textContent = report.rate;
    reportEl.querySelector("[data-metric-hearback]").textContent = report.hearback;
    reportEl.hidden = false;

    const dubLink = reportEl.querySelector("[data-download-dub]");
    if (dubLink) {
      dubLink.href = "/sample-hi.wav";
      dubLink.download = `${job.name.replace(/\.[^.]+$/, "")}-hindi.wav`;
    }

    reportEl.querySelector("[data-download-subtitles]")?.addEventListener("click", () => {
      downloadTextFile(`${job.name.replace(/\.[^.]+$/, "")}-hindi.srt`, buildSubtitleFile(job.name), "text/plain");
    });

    const jobs = readJobs();
    jobs.unshift({ id: job.id, name: job.name, completedAt: Date.now(), report });
    writeJobs(jobs.slice(0, 20));
  }

  startButton?.addEventListener("click", () => {
    if (!pendingFile || !jobListEl) return;
    const job = { id: `job-${Date.now()}`, name: pendingFile.name };
    const card = renderJobCard(job);
    if (card) runPipeline(card, job);

    if (fileInput) fileInput.value = "";
    if (glossaryInput) glossaryInput.value = "";
    setPendingFile(null);
  });

  refreshEmptyState();
})();
