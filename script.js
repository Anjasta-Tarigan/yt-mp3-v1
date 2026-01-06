// ========================================
// YouTube to MP3 Converter - Frontend JS
// ========================================

const API_BASE = "/api";

// DOM Elements
const urlInput = document.getElementById("youtube-url");
const btnPaste = document.getElementById("btn-paste");
const btnConvert = document.getElementById("btn-convert");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const videoPreview = document.getElementById("video-preview");
const progressContainer = document.getElementById("progress-container");
const progressFill = document.getElementById("progress-fill");
const progressPercent = document.getElementById("progress-percent");
const progressStatus = document.getElementById("progress-status");

// New elements
const btnConvertStart = document.getElementById("btn-convert-start");
const trimToggle = document.getElementById("trim-toggle");
const trimInputs = document.getElementById("trim-inputs");
const trimStartInput = document.getElementById("trim-start");
const trimEndInput = document.getElementById("trim-end");
const trimmedDurationDisplay = document.getElementById("trimmed-duration");
const audioPreview = document.getElementById("audio-preview");
const audioElement = document.getElementById("audio-element");
const btnVersionTrimmed = document.getElementById("btn-version-trimmed");
const btnVersionFull = document.getElementById("btn-version-full");
const btnDownloadSelected = document.getElementById("btn-download-selected");
const trimInfo = document.getElementById("trim-info");
const trimSegments = document.getElementById("trim-segments");
const versionToggle = document.getElementById("version-toggle");

// State
let currentVideoInfo = null;
let currentConvertedData = null;
let selectedVersion = "trimmed";

// ========================================
// Initialization
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  initEventListeners();
});

function initParticles() {
  const container = document.getElementById("particles");
  const particleCount = 25;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.top = Math.random() * 100 + "%";
    particle.style.animationDelay = i * 0.8 + "s";
    particle.style.animationDuration = 20 + Math.random() * 10 + "s";
    container.appendChild(particle);
  }
}

function initEventListeners() {
  btnPaste.addEventListener("click", handlePaste);
  btnConvert.addEventListener("click", handleConvert);

  if (btnConvertStart) {
    btnConvertStart.addEventListener("click", handleConvertStart);
  }

  // Trim toggle
  if (trimToggle) {
    trimToggle.addEventListener("change", () => {
      if (trimInputs) {
        trimInputs.classList.toggle("hidden", !trimToggle.checked);
      }
      updateTrimDuration();
    });
  }

  // Trim input changes
  if (trimStartInput) {
    trimStartInput.addEventListener("input", updateTrimDuration);
  }
  if (trimEndInput) {
    trimEndInput.addEventListener("input", updateTrimDuration);
  }

  // Version toggle buttons
  if (btnVersionTrimmed) {
    btnVersionTrimmed.addEventListener("click", () => selectVersion("trimmed"));
  }
  if (btnVersionFull) {
    btnVersionFull.addEventListener("click", () => selectVersion("full"));
  }

  // Download button
  if (btnDownloadSelected) {
    btnDownloadSelected.addEventListener("click", handleDownload);
  }

  // URL input - auto-detect paste
  urlInput.addEventListener("paste", () => {
    setTimeout(() => {
      if (isValidYouTubeUrl(urlInput.value)) {
        handleConvert();
      }
    }, 100);
  });

  urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleConvert();
    }
  });
}

// ========================================
// Handlers
// ========================================

async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    urlInput.focus();

    if (isValidYouTubeUrl(text)) {
      handleConvert();
    }
  } catch (err) {
    showError("Unable to paste from clipboard. Please paste manually.");
  }
}

async function handleConvert() {
  const url = urlInput.value.trim();

  if (!url) {
    showError("Please enter a YouTube URL");
    return;
  }

  if (!isValidYouTubeUrl(url)) {
    showError("Please enter a valid YouTube URL");
    return;
  }

  hideError();
  hidePreview();
  hideProgress();
  hideAudioPreview();

  setLoading(true);

  try {
    const response = await fetch(
      `${API_BASE}/info?url=${encodeURIComponent(url)}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch video info");
    }

    currentVideoInfo = data;
    showPreview(data);

    // Reset trim inputs
    if (trimStartInput) trimStartInput.value = "";
    if (trimEndInput) trimEndInput.value = "";
    if (trimToggle) trimToggle.checked = false;
    if (trimInputs) trimInputs.classList.add("hidden");
    updateTrimDuration();
  } catch (err) {
    showError(
      err.message ||
        "Failed to fetch video info. Please check the URL and try again."
    );
  } finally {
    setLoading(false);
  }
}

async function handleConvertStart() {
  if (!currentVideoInfo) return;

  hideError();
  hidePreview();
  showProgress();

  // Reset all terminal steps strictly
  ["step-fetch", "step-download", "step-convert", "step-metadata"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove("active", "done");
        el.classList.add("waiting");
      }
    }
  );

  // Get trim settings
  const isTrimEnabled = trimToggle && trimToggle.checked;
  const trimStart =
    isTrimEnabled && trimStartInput ? trimStartInput.value.trim() : null;
  const trimEnd =
    isTrimEnabled && trimEndInput ? trimEndInput.value.trim() : null;

  try {
    updateProgress(0, "Starting conversion...");

    const url = urlInput.value.trim();

    let progress = 0;
    // Smoother and more realistic simulation
    const progressInterval = setInterval(() => {
      // Slower increment
      if (progress < 30) {
        progress += 1.5; // Fetching phase
      } else if (progress < 60) {
        progress += 0.4; // Downloading (usually slowest)
      } else if (progress < 85) {
        progress += 0.8; // Converting
      } else if (progress < 95) {
        progress += 0.2; // Metadata/Finalizing - stall at 95 until done
      }

      if (progress > 95) progress = 95;

      // Update terminal steps ensuring previous ones are marked done
      if (progress < 25) {
        setStep("step-fetch", "active");
        updateTerminal(progress, "Fetching video info...");
      } else if (progress < 55) {
        setStep("step-fetch", "done");
        setStep("step-download", "active");
        updateTerminal(progress, "Downloading audio stream...");
      } else if (progress < 85) {
        setStep("step-download", "done");
        setStep("step-convert", "active");
        updateTerminal(progress, "Converting to MP3 (HQ)...");
      } else {
        setStep("step-convert", "done");
        setStep("step-metadata", "active");
        updateTerminal(progress, "Embedding metadata...");
      }
    }, 100);

    const validUrl =
      currentVideoInfo.webpage_url ||
      currentVideoInfo.original_url ||
      urlInput.value.trim();

    const response = await fetch(`${API_BASE}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: validUrl, trimStart, trimEnd }),
    });

    clearInterval(progressInterval);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Conversion failed");
    }

    // Finish up
    updateTerminal(100, "Conversion complete!");
    setStep("step-metadata", "done");
    setStep("step-fetch", "done");
    setStep("step-download", "done");
    setStep("step-convert", "done");

    currentConvertedData = data;

    setTimeout(() => {
      hideProgress();
      showAudioPreview(data);
    }, 1000);
  } catch (err) {
    hideProgress();
    showError(err.message || "Conversion failed. Please try again.");
  }
}

// Terminal Helpers
function updateTerminal(percent, status) {
  const fill = document.getElementById("progress-fill");
  const percentText = document.getElementById("progress-percent");
  const statusText = document.getElementById("progress-status");

  if (fill) fill.style.width = `${percent}%`;
  if (percentText) percentText.textContent = `${Math.floor(percent)}%`;
  if (statusText) statusText.textContent = status;
}

function setStep(stepId, status) {
  const step = document.getElementById(stepId);
  if (!step) return;

  step.classList.remove("waiting", "active", "done");
  step.classList.add(status);
}

function selectVersion(version) {
  selectedVersion = version;

  btnVersionTrimmed.classList.toggle("active", version === "trimmed");
  btnVersionFull.classList.toggle("active", version === "full");

  if (currentConvertedData) {
    const streamUrl = `${API_BASE}/stream/${currentConvertedData.fileId}?version=${version}`;
    audioElement.src = streamUrl;
    audioElement.load();
  }
}

async function handleDownload() {
  if (!currentConvertedData) return;

  const downloadUrl = `${API_BASE}/download/${currentConvertedData.fileId}?version=${selectedVersion}`;

  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = currentConvertedData.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  const versionLabel = selectedVersion === "trimmed" ? "Trimmed" : "Full";
  const size =
    selectedVersion === "trimmed" && currentConvertedData.trimmedSize
      ? (currentConvertedData.trimmedSize / (1024 * 1024)).toFixed(2)
      : (currentConvertedData.fullSize / (1024 * 1024)).toFixed(2);

  Swal.fire({
    icon: "success",
    title: "Download Started!",
    html: `
      <div style="text-align: left; padding: 10px 0;">
        <p style="margin: 8px 0;"><strong>File:</strong> ${currentConvertedData.filename}</p>
        <p style="margin: 8px 0;"><strong>Version:</strong> ${versionLabel}</p>
        <p style="margin: 8px 0;"><strong>Size:</strong> ${size} MB</p>
      </div>
    `,
    confirmButtonText: "Convert Another",
    confirmButtonColor: "#7c3aed",
    background: "#1a1a2e",
    color: "#ffffff",
    iconColor: "#10b981",
  }).then(() => {
    // Reset page after download
    resetPage();
  });
}

/**
 * Reset the page to initial state
 */
function resetPage() {
  // Clear state
  currentVideoInfo = null;
  currentConvertedData = null;
  selectedVersion = "trimmed";

  // Clear input
  urlInput.value = "";

  // Hide all sections
  hideError();
  hidePreview();
  hideProgress();
  hideAudioPreview();

  // Reset trim inputs
  if (trimToggle) trimToggle.checked = false;
  if (trimInputs) trimInputs.classList.add("hidden");
  if (trimStartInput) trimStartInput.value = "";
  if (trimEndInput) trimEndInput.value = "";
  if (trimmedDurationDisplay) trimmedDurationDisplay.textContent = "--:--";

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });

  console.log("[RESET] Page reset complete");
}

// ========================================
// UI Helpers
// ========================================

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;

  const parts = timeStr.toString().split(":").map(Number);

  if (parts.some(isNaN)) return null;

  if (parts.length === 1) {
    return parts[0];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function updateTrimDuration() {
  if (!currentVideoInfo || !trimmedDurationDisplay) return;

  const startSeconds = parseTimeToSeconds(trimStartInput?.value) || 0;
  const endSeconds =
    parseTimeToSeconds(trimEndInput?.value) || currentVideoInfo.duration;

  if (endSeconds > startSeconds && endSeconds <= currentVideoInfo.duration) {
    const duration = endSeconds - startSeconds;
    trimmedDurationDisplay.textContent = formatDuration(duration);
  } else if (!trimEndInput?.value && startSeconds < currentVideoInfo.duration) {
    const duration = currentVideoInfo.duration - startSeconds;
    trimmedDurationDisplay.textContent = formatDuration(duration);
  } else {
    trimmedDurationDisplay.textContent = "--:--";
  }
}

function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/v\/[\w-]+/,
    /^(https?:\/\/)?m\.youtube\.com\/watch\?v=[\w-]+/,
  ];

  return patterns.some((pattern) => pattern.test(url));
}

function setLoading(loading) {
  if (loading) {
    btnConvert.classList.add("loading");
    btnConvert.disabled = true;
  } else {
    btnConvert.classList.remove("loading");
    btnConvert.disabled = false;
  }
}

function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.remove("hidden");
}

function hideError() {
  errorMessage.classList.add("hidden");
}

function showPreview(info) {
  document.getElementById("preview-image").src = info.thumbnail;
  document.getElementById("preview-title").textContent = info.title;
  document.getElementById("preview-channel").textContent =
    info.channel || "Unknown Channel";
  document.getElementById("preview-duration").textContent = formatDuration(
    info.duration
  );
  document.getElementById("preview-length").textContent = formatDuration(
    info.duration
  );

  const qualityEl = document.getElementById("preview-quality");
  if (info.audioBitrate) {
    qualityEl.textContent = info.audioBitrate + " kbps";
  } else {
    qualityEl.textContent = "Best Quality";
  }

  const filesizeEl = document.getElementById("preview-filesize");
  if (info.estimatedFileSize) {
    filesizeEl.textContent = info.estimatedFileSize;
  } else if (info.duration) {
    const estimatedMB = (info.duration / 60) * 1.8;
    filesizeEl.textContent =
      estimatedMB < 1
        ? Math.round(estimatedMB * 1024) + " KB"
        : "~" + estimatedMB.toFixed(1) + " MB";
  } else {
    filesizeEl.textContent = "-- MB";
  }

  // Display metadata
  const metadataContainer = document.getElementById("preview-metadata");

  const artistRow = document.getElementById("metadata-artist");
  if (info.artist && info.artist !== info.channel) {
    document.getElementById("meta-artist").textContent = info.artist;
    artistRow.style.display = "flex";
  } else {
    artistRow.style.display = "none";
  }

  const albumRow = document.getElementById("metadata-album");
  if (info.album) {
    document.getElementById("meta-album").textContent = info.album;
    albumRow.style.display = "flex";
  } else {
    albumRow.style.display = "none";
  }

  const yearRow = document.getElementById("metadata-year");
  if (info.year) {
    document.getElementById("meta-year").textContent = info.year;
    yearRow.style.display = "flex";
  } else {
    yearRow.style.display = "none";
  }

  const genreRow = document.getElementById("metadata-genre");
  if (info.genre) {
    document.getElementById("meta-genre").textContent = info.genre;
    genreRow.style.display = "flex";
  } else {
    genreRow.style.display = "none";
  }

  const hasMetadata = info.artist || info.album || info.year || info.genre;
  metadataContainer.style.display = hasMetadata ? "grid" : "none";

  videoPreview.classList.remove("hidden");
}

function hidePreview() {
  videoPreview.classList.add("hidden");
}

function showAudioPreview(data) {
  document.getElementById("player-thumbnail").src = currentVideoInfo.thumbnail;
  document.getElementById("player-title").textContent = data.title;
  document.getElementById("player-artist").textContent =
    currentVideoInfo.artist || currentVideoInfo.channel;

  if (data.hasTrimmedVersion) {
    selectedVersion = "trimmed";
    audioElement.src = `${API_BASE}/stream/${data.fileId}?version=trimmed`;
    versionToggle.style.display = "flex";
    btnVersionTrimmed.classList.add("active");
    btnVersionFull.classList.remove("active");

    // Show trim info
    if (data.trimInfo) {
      trimInfo.classList.remove("hidden");
      trimSegments.innerHTML = `
        <li>Start: ${data.trimInfo.startFormatted}</li>
        <li>End: ${data.trimInfo.endFormatted}</li>
        <li>Duration: ${formatDuration(data.trimmedDuration)}</li>
      `;
    } else {
      trimInfo.classList.add("hidden");
    }
  } else {
    selectedVersion = "full";
    audioElement.src = `${API_BASE}/stream/${data.fileId}?version=full`;
    versionToggle.style.display = "none";
    trimInfo.classList.add("hidden");
  }

  audioPreview.classList.remove("hidden");
}

function hideAudioPreview() {
  audioPreview.classList.add("hidden");
  audioElement.pause();
  audioElement.src = "";
}

function showProgress() {
  progressContainer.classList.remove("hidden");
}

function hideProgress() {
  progressContainer.classList.add("hidden");
}

function updateProgress(percent, status) {
  progressFill.style.width = percent + "%";
  progressPercent.textContent = Math.round(percent) + "%";
  progressStatus.textContent = status;
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
