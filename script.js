// ========================================
// YouTube to MP3 Converter - Frontend JS
// ========================================

const API_BASE = "http://localhost:3000/api";

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
const btnDownload = document.getElementById("btn-download");

// State
let currentVideoInfo = null;

// ========================================
// Initialization
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  initEventListeners();
});

// Create floating particles with staggered animations
function initParticles() {
  const container = document.getElementById("particles");
  const particleCount = 25;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.top = Math.random() * 100 + "%";
    // Stagger animation delays for smoother overall effect
    particle.style.animationDelay = i * 0.8 + "s";
    particle.style.animationDuration = 20 + Math.random() * 10 + "s";
    container.appendChild(particle);
  }
}

// Initialize event listeners
function initEventListeners() {
  // Paste button
  btnPaste.addEventListener("click", handlePaste);

  // Convert button
  btnConvert.addEventListener("click", handleConvert);

  // Download button
  btnDownload.addEventListener("click", handleDownload);

  // URL input - auto-detect paste
  urlInput.addEventListener("paste", () => {
    setTimeout(() => {
      if (isValidYouTubeUrl(urlInput.value)) {
        handleConvert();
      }
    }, 100);
  });

  // Enter key to convert
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

    // Auto-convert if valid URL
    if (isValidYouTubeUrl(text)) {
      handleConvert();
    }
  } catch (err) {
    showError("Unable to paste from clipboard. Please paste manually.");
  }
}

async function handleConvert() {
  const url = urlInput.value.trim();

  // Validate URL
  if (!url) {
    showError("Please enter a YouTube URL");
    return;
  }

  if (!isValidYouTubeUrl(url)) {
    showError("Please enter a valid YouTube URL");
    return;
  }

  // Hide previous results
  hideError();
  hidePreview();
  hideProgress();

  // Show loading state
  setLoading(true);

  try {
    // Fetch video info
    const response = await fetch(
      `${API_BASE}/info?url=${encodeURIComponent(url)}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch video info");
    }

    currentVideoInfo = data;
    showPreview(data);
  } catch (err) {
    showError(
      err.message ||
        "Failed to fetch video info. Please check the URL and try again."
    );
  } finally {
    setLoading(false);
  }
}

async function handleDownload() {
  if (!currentVideoInfo) return;

  hideError();
  showProgress();

  try {
    // Start download
    updateProgress(0, "Initializing download...");

    const url = urlInput.value.trim();
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(url)}`;

    // Simulate progress while downloading
    let progress = 0;
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 12;
        progress = Math.min(progress, 90);
        updateProgress(progress, "Downloading highest quality audio...");
      }
    }, 600);

    // Fetch the file
    const response = await fetch(downloadUrl);

    clearInterval(progressInterval);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Download failed");
    }

    updateProgress(95, "Preparing download...");

    // Get the blob
    const blob = await response.blob();

    // Get filename from header or generate one
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = currentVideoInfo.title.replace(/[^\w\s-]/g, "") + ".mp3";

    if (contentDisposition) {
      const match = contentDisposition.match(
        /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i
      );
      if (match && match[1]) {
        filename = decodeURIComponent(match[1].replace(/['"]/g, ""));
      }
    }

    updateProgress(100, "Download complete!");

    // Trigger download
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);

    // Hide progress
    hideProgress();

    // Show success notification with SweetAlert2
    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

    Swal.fire({
      icon: "success",
      title: "Download Complete!",
      html: `
                <div style="text-align: left; padding: 10px 0;">
                    <p style="margin: 8px 0;"><strong>File:</strong> ${filename}</p>
                    <p style="margin: 8px 0;"><strong>Size:</strong> ${fileSizeMB} MB</p>
                    <p style="margin: 8px 0;"><strong>Quality:</strong> Highest Available</p>
                </div>
            `,
      confirmButtonText: "Great!",
      confirmButtonColor: "#7c3aed",
      background: "#1a1a2e",
      color: "#ffffff",
      iconColor: "#10b981",
      showClass: {
        popup: "animate__animated animate__fadeInUp animate__faster",
      },
      hideClass: {
        popup: "animate__animated animate__fadeOutDown animate__faster",
      },
    });
  } catch (err) {
    hideProgress();

    // Show error notification with SweetAlert2
    Swal.fire({
      icon: "error",
      title: "Download Failed",
      text: err.message || "An error occurred. Please try again.",
      confirmButtonText: "OK",
      confirmButtonColor: "#ff3366",
      background: "#1a1a2e",
      color: "#ffffff",
    });
  }
}

// ========================================
// UI Helpers
// ========================================

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

  // Audio quality
  const qualityEl = document.getElementById("preview-quality");
  if (info.audioBitrate) {
    qualityEl.textContent = info.audioBitrate + " kbps";
  } else {
    qualityEl.textContent = "Best Quality";
  }

  // Estimated file size
  const filesizeEl = document.getElementById("preview-filesize");
  if (info.estimatedFileSize) {
    filesizeEl.textContent = info.estimatedFileSize;
  } else if (info.duration) {
    // Estimate: ~1.8 MB per minute for high quality MP3
    const estimatedMB = (info.duration / 60) * 1.8;
    if (estimatedMB < 1) {
      filesizeEl.textContent = Math.round(estimatedMB * 1024) + " KB";
    } else {
      filesizeEl.textContent = "~" + estimatedMB.toFixed(1) + " MB";
    }
  } else {
    filesizeEl.textContent = "-- MB";
  }

  videoPreview.classList.remove("hidden");
}

function hidePreview() {
  videoPreview.classList.add("hidden");
}

function showProgress() {
  progressContainer.classList.remove("hidden");
  videoPreview.classList.add("hidden");
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
