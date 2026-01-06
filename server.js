// ========================================
// YouTube to MP3 Converter - Backend Server
// ========================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn, execSync } = require("child_process");
const ytdl = require("@distube/ytdl-core");

const app = express();
const PORT = process.env.PORT || 3000;

// Path to yt-dlp binary and ffmpeg
const YTDLP_PATH = path.join(__dirname, "bin", "yt-dlp.exe");
const TEMP_DIR = path.join(os.tmpdir(), "yt2mp3");
const CONVERTED_DIR = path.join(__dirname, "converted");

// Store for converted files
const convertedFiles = new Map();

// Get ffmpeg path from ffmpeg-static
let FFMPEG_PATH;
try {
  FFMPEG_PATH = require("ffmpeg-static");
  console.log("[INIT] ffmpeg found at:", FFMPEG_PATH);
} catch (e) {
  console.warn(
    "[WARN] ffmpeg-static not found. Run: npm install ffmpeg-static"
  );
}

// Ensure directories exist
[TEMP_DIR, CONVERTED_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Check if yt-dlp exists
function checkYtdlp() {
  if (fs.existsSync(YTDLP_PATH)) {
    console.log("[INIT] yt-dlp binary found");
    return true;
  }
  console.warn("[WARN] yt-dlp binary not found. Run: npm run download-ytdlp");
  return false;
}

const ytdlpAvailable = checkYtdlp();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use("/converted", express.static(CONVERTED_DIR));

// Cleanup old files periodically (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  convertedFiles.forEach((data, fileId) => {
    if (now - data.timestamp > 30 * 60 * 1000) {
      cleanupFiles(fileId);
    }
  });
}, 5 * 60 * 1000);

// Move cleanupFiles function declaration here to be available for interval
function cleanupFiles(fileId) {
  const fileData = convertedFiles.get(fileId);
  if (!fileData) return;

  console.log(`[CLEANUP] Cleaning up files for: ${fileId}`);

  // Delete trimmed file
  if (fileData.trimmedPath && fs.existsSync(fileData.trimmedPath)) {
    try {
      fs.unlinkSync(fileData.trimmedPath);
      console.log(
        `[CLEANUP] Deleted trimmed: ${path.basename(fileData.trimmedPath)}`
      );
    } catch (e) {
      console.log(`[CLEANUP] Could not delete trimmed: ${e.message}`);
    }
  }

  // Delete full file
  if (fileData.fullPath && fs.existsSync(fileData.fullPath)) {
    try {
      fs.unlinkSync(fileData.fullPath);
      console.log(
        `[CLEANUP] Deleted full: ${path.basename(fileData.fullPath)}`
      );
    } catch (e) {
      console.log(`[CLEANUP] Could not delete full: ${e.message}`);
    }
  }

  // Remove from map
  convertedFiles.delete(fileId);
  console.log(`[CLEANUP] Cleanup complete for: ${fileId}`);
}

// ========================================
// Helper: Parse time string to seconds
// ========================================
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;

  // Handle formats: "1:30", "01:30", "1:30:00", "90" (seconds)
  const parts = timeStr.toString().split(":").map(Number);

  if (parts.length === 1) {
    return parts[0]; // Just seconds
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  return null;
}

// ========================================
// Helper: Format seconds to time string
// ========================================
function formatTime(seconds) {
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

// ========================================
// API Routes
// ========================================

/**
 * GET /api/info
 * Fetch video metadata
 */
app.get("/api/info", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    console.log(`[INFO] Fetching video info for: ${url}`);

    if (ytdlpAvailable) {
      const result = await getInfoWithYtdlp(url);
      res.json(result);
    } else {
      const info = await ytdl.getInfo(url);
      const videoDetails = info.videoDetails;

      const result = {
        title: videoDetails.title || "Unknown Title",
        channel:
          videoDetails.author?.name ||
          videoDetails.ownerChannelName ||
          "Unknown Channel",
        duration: parseInt(videoDetails.lengthSeconds) || 0,
        thumbnail:
          videoDetails.thumbnails?.length > 0
            ? videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url
            : "",
        videoId: videoDetails.videoId,
      };

      res.json(result);
    }
  } catch (error) {
    console.error("[ERROR] Failed to fetch video info:", error.message);
    res.status(500).json({
      error: "Failed to fetch video info. Please check the URL and try again.",
    });
  }
});

/**
 * Get video info using yt-dlp with complete metadata
 */
function getInfoWithYtdlp(url) {
  return new Promise((resolve, reject) => {
    const args = ["--dump-json", "--no-warnings", url];

    const process = spawn(YTDLP_PATH, args);
    let output = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || "Failed to get video info"));
        return;
      }

      try {
        const info = JSON.parse(output);

        // Find best audio format bitrate
        let audioBitrate = null;
        if (info.formats && info.formats.length > 0) {
          const audioFormats = info.formats.filter(
            (f) =>
              (f.acodec && f.acodec !== "none" && !f.vcodec) ||
              f.vcodec === "none"
          );
          if (audioFormats.length > 0) {
            const bestAudio = audioFormats.sort(
              (a, b) => (b.abr || 0) - (a.abr || 0)
            )[0];
            audioBitrate = bestAudio.abr || null;
          }
        }

        // Estimate file size
        const duration = info.duration || 0;
        const estimatedMB = (duration / 60) * 1.8;
        let estimatedFileSize = null;
        if (estimatedMB > 0) {
          estimatedFileSize =
            estimatedMB < 1
              ? Math.round(estimatedMB * 1024) + " KB"
              : "~" + estimatedMB.toFixed(1) + " MB";
        }

        // Extract year
        let year = null;
        if (info.release_year) {
          year = String(info.release_year);
        } else if (info.upload_date) {
          year = info.upload_date.substring(0, 4);
        }

        const result = {
          title: info.title || "Unknown Title",
          channel: info.uploader || info.channel || "Unknown Channel",
          duration: duration,
          thumbnail: info.thumbnail || "",
          videoId: info.id,
          audioBitrate: audioBitrate,
          estimatedFileSize: estimatedFileSize,
          artist: info.artist || info.creator || info.uploader || null,
          album: info.album || null,
          track: info.track || info.title || null,
          genre: info.genre || null,
          year: year,
          tags: info.tags ? info.tags.slice(0, 5) : [],
          chapters: info.chapters || [],
        };

        console.log(
          `[INFO] Video: "${result.title}" by ${
            result.artist || result.channel
          }`
        );
        resolve(result);
      } catch (e) {
        reject(new Error("Failed to parse video info"));
      }
    });
  });
}

/**
 * POST /api/convert
 * Convert video to MP3 with optional manual trim
 */
app.post("/api/convert", async (req, res) => {
  const { url, trimStart, trimEnd } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  if (!ytdlpAvailable || !FFMPEG_PATH) {
    return res.status(500).json({ error: "yt-dlp or ffmpeg not available" });
  }

  // Parse trim times
  const startSeconds = parseTimeToSeconds(trimStart);
  const endSeconds = parseTimeToSeconds(trimEnd);
  const hasTrimSettings = startSeconds !== null || endSeconds !== null;

  try {
    const fileId = crypto.randomBytes(8).toString("hex");
    console.log(`[CONVERT] Starting conversion: ${url}`);
    if (hasTrimSettings) {
      console.log(
        `[CONVERT] Trim: ${startSeconds || 0}s to ${endSeconds || "end"}`
      );
    }

    // Get video info for metadata
    const info = await getInfoWithYtdlp(url);

    // Convert full version first
    console.log("[CONVERT] Converting full version...");
    const fullOutputPath = path.join(CONVERTED_DIR, `${fileId}_full.mp3`);

    await convertToMp3(url, fullOutputPath);

    const fullStats = fs.statSync(fullOutputPath);
    let trimmedPath = null;
    let trimmedSize = null;
    let trimmedDuration = null;

    // If trim settings provided, create trimmed version using ffmpeg
    if (hasTrimSettings) {
      console.log("[CONVERT] Creating trimmed version...");
      const trimmedOutputPath = path.join(
        CONVERTED_DIR,
        `${fileId}_trimmed.mp3`
      );

      try {
        await trimAudioWithFfmpeg(
          fullOutputPath,
          trimmedOutputPath,
          startSeconds,
          endSeconds,
          info.duration
        );

        if (fs.existsSync(trimmedOutputPath)) {
          const trimStats = fs.statSync(trimmedOutputPath);
          trimmedPath = trimmedOutputPath;
          trimmedSize = trimStats.size;

          // Calculate trimmed duration
          const effectiveStart = startSeconds || 0;
          const effectiveEnd = endSeconds || info.duration;
          trimmedDuration = effectiveEnd - effectiveStart;

          console.log(
            `[CONVERT] Trimmed: ${formatTime(effectiveStart)} to ${formatTime(
              effectiveEnd
            )} (${formatTime(trimmedDuration)})`
          );
        }
      } catch (trimError) {
        console.error("[CONVERT] Trim failed:", trimError.message);
      }
    }

    // Store file info
    const fileData = {
      timestamp: Date.now(),
      info: info,
      fullPath: fullOutputPath,
      fullSize: fullStats.size,
      fullDuration: info.duration,
      trimmedPath: trimmedPath,
      trimmedSize: trimmedSize,
      trimmedDuration: trimmedDuration,
      trimStart: startSeconds,
      trimEnd: endSeconds,
    };

    convertedFiles.set(fileId, fileData);

    // Get original filename
    const sanitizedTitle = info.title.replace(/[<>:"/\\|?*]/g, "").trim();

    res.json({
      success: true,
      fileId: fileId,
      title: info.title,
      filename: `${sanitizedTitle}.mp3`,
      duration: info.duration,
      fullSize: fullStats.size,
      trimmedSize: trimmedSize,
      trimmedDuration: trimmedDuration,
      hasTrimmedVersion: !!trimmedPath,
      trimInfo: hasTrimSettings
        ? {
            start: startSeconds || 0,
            end: endSeconds || info.duration,
            startFormatted: formatTime(startSeconds || 0),
            endFormatted: formatTime(endSeconds || info.duration),
          }
        : null,
      previewUrl: `/api/stream/${fileId}?version=${
        trimmedPath ? "trimmed" : "full"
      }`,
    });
  } catch (error) {
    console.error("[ERROR] Conversion failed:", error.message);
    res.status(500).json({ error: "Conversion failed. Please try again." });
  }
});

/**
 * Convert URL to MP3 using yt-dlp
 * Downloads to TEMP_DIR first to avoid file locking issues
 */
function convertToMp3(url, outputPath) {
  return new Promise((resolve, reject) => {
    const tempFilename = `temp_${Date.now()}_${crypto
      .randomBytes(4)
      .toString("hex")}.mp3`;
    const tempOutputPath = path.join(TEMP_DIR, tempFilename);

    const args = [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--embed-thumbnail",
      "--embed-metadata",
      "--parse-metadata",
      "%(artist,uploader,channel)s:%(meta_artist)s",
      "--parse-metadata",
      "%(album,title)s:%(meta_album)s",
      "--parse-metadata",
      "%(track,title)s:%(meta_title)s",
      "--parse-metadata",
      "%(release_year,upload_date>%Y)s:%(meta_date)s",
      "--convert-thumbnails",
      "jpg",
      "--ffmpeg-location",
      path.dirname(FFMPEG_PATH),
      "-o",
      tempOutputPath,
      "--no-playlist",
      "--no-warnings",
      url,
    ];

    const ytdlpProcess = spawn(YTDLP_PATH, args);
    let errorOutput = "";

    ytdlpProcess.stdout.on("data", (data) => {
      console.log(`[YTDLP] ${data.toString().trim()}`);
    });

    ytdlpProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ytdlpProcess.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || "Conversion failed"));
        return;
      }

      // Wait a bit for file handles to be released (Windows issue)
      await new Promise((r) => setTimeout(r, 500));

      // Copy to final location with retry
      let retries = 3;
      while (retries > 0) {
        try {
          if (fs.existsSync(tempOutputPath)) {
            fs.copyFileSync(tempOutputPath, outputPath);
            // Delete temp file
            try {
              fs.unlinkSync(tempOutputPath);
            } catch (e) {
              /* ignore */
            }
            resolve(outputPath);
            return;
          }
        } catch (e) {
          console.log(`[CONVERT] Copy retry ${4 - retries}/3: ${e.message}`);
          await new Promise((r) => setTimeout(r, 500));
          retries--;
        }
      }

      if (fs.existsSync(tempOutputPath)) {
        resolve(tempOutputPath);
      } else {
        reject(new Error("Output file not found"));
      }
    });

    ytdlpProcess.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Trim audio file using ffmpeg
 */
function trimAudioWithFfmpeg(
  inputPath,
  outputPath,
  startSeconds,
  endSeconds,
  totalDuration
) {
  return new Promise((resolve, reject) => {
    const args = ["-y", "-i", inputPath];

    // Add start time
    if (startSeconds && startSeconds > 0) {
      args.push("-ss", startSeconds.toString());
    }

    // Add end time (duration from start)
    if (endSeconds && endSeconds < totalDuration) {
      const duration = endSeconds - (startSeconds || 0);
      args.push("-t", duration.toString());
    }

    // Output settings - preserve quality and metadata
    args.push(
      "-c:a",
      "libmp3lame",
      "-q:a",
      "0",
      "-map_metadata",
      "0",
      "-id3v2_version",
      "3",
      outputPath
    );

    console.log(`[FFMPEG] Trimming: ${args.join(" ")}`);

    const ffmpegProcess = spawn(FFMPEG_PATH, args);
    let errorOutput = "";

    ffmpegProcess.stderr.on("data", (data) => {
      const line = data.toString();
      // Only log non-progress lines
      if (!line.includes("size=") && !line.includes("time=")) {
        console.log(`[FFMPEG] ${line.trim()}`);
      }
      errorOutput += line;
    });

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("FFmpeg trim failed"));
        return;
      }
      resolve(outputPath);
    });

    ffmpegProcess.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * GET /api/stream/:fileId
 * Stream audio for preview
 */
app.get("/api/stream/:fileId", (req, res) => {
  const { fileId } = req.params;
  const { version = "trimmed" } = req.query;

  const fileData = convertedFiles.get(fileId);
  if (!fileData) {
    return res.status(404).json({ error: "File not found or expired" });
  }

  const filePath =
    version === "trimmed" && fileData.trimmedPath
      ? fileData.trimmedPath
      : fileData.fullPath;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "audio/mpeg",
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "audio/mpeg",
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * GET /api/download/:fileId
 * Download the converted file and cleanup after completion
 */
app.get("/api/download/:fileId", (req, res) => {
  const { fileId } = req.params;
  const { version = "full" } = req.query;

  const fileData = convertedFiles.get(fileId);
  if (!fileData) {
    return res.status(404).json({ error: "File not found or expired" });
  }

  const filePath =
    version === "trimmed" && fileData.trimmedPath
      ? fileData.trimmedPath
      : fileData.fullPath;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const sanitizedTitle = fileData.info.title
    .replace(/[<>:"/\\|?*]/g, "")
    .trim();
  const suffix = version === "trimmed" ? " (Trimmed)" : "";
  const filename = `${sanitizedTitle}${suffix}.mp3`;

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  res.setHeader("Content-Length", fs.statSync(filePath).size);

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);

  // Cleanup after download completes
  res.on("finish", () => {
    cleanupFiles(fileId);
  });

  res.on("error", () => {
    cleanupFiles(fileId);
  });
});

// ========================================
// Server Startup
// ========================================

app.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║                                              ║");
  console.log("║     🎵 YT2MP3 Server Running!                ║");
  console.log("║                                              ║");
  console.log(`║     📍 http://localhost:${PORT}                  ║`);
  console.log("║                                              ║");
  console.log("║     ✨ Manual Trim + Preview enabled         ║");
  console.log("║                                              ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
});
