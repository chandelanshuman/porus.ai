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
    let index = 0;

    function advance() {
      if (index >= PIPELINE_STEPS.length) {
        completeJob(card, job);
        return;
      }
      const step = PIPELINE_STEPS[index];
      const stepEl = card.querySelector(`[data-step="${step.key}"]`);
      stepEl?.classList.add("is-active");
      window.setTimeout(() => {
        stepEl?.classList.remove("is-active");
        stepEl?.classList.add("is-done");
        index += 1;
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
