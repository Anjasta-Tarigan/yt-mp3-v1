// ========================================
// YouTube to MP3 Converter - Backend Server
// ========================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const ytdl = require("@distube/ytdl-core");

const app = express();
const PORT = process.env.PORT || 3000;

// Path to yt-dlp binary and ffmpeg
const YTDLP_PATH = path.join(__dirname, "bin", "yt-dlp.exe");
const TEMP_DIR = path.join(os.tmpdir(), "yt2mp3");

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

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

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

// ========================================
// API Routes
// ========================================

/**
 * GET /api/info
 * Fetch video metadata (title, duration, thumbnail)
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

    // Use yt-dlp for info if available
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

      console.log(`[INFO] Video info fetched: ${result.title}`);
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

        // Estimate file size (approximately 1.8 MB per minute for high quality MP3)
        const duration = info.duration || 0;
        const estimatedMB = (duration / 60) * 1.8;
        let estimatedFileSize = null;
        if (estimatedMB > 0) {
          if (estimatedMB < 1) {
            estimatedFileSize = Math.round(estimatedMB * 1024) + " KB";
          } else {
            estimatedFileSize = "~" + estimatedMB.toFixed(1) + " MB";
          }
        }

        // Extract year from upload date or release year
        let year = null;
        if (info.release_year) {
          year = String(info.release_year);
        } else if (info.upload_date) {
          year = info.upload_date.substring(0, 4);
        }

        // Build result with complete metadata
        const result = {
          title: info.title || "Unknown Title",
          channel: info.uploader || info.channel || "Unknown Channel",
          duration: duration,
          thumbnail: info.thumbnail || "",
          videoId: info.id,
          audioBitrate: audioBitrate,
          estimatedFileSize: estimatedFileSize,
          // Enhanced metadata
          artist: info.artist || info.creator || info.uploader || null,
          album: info.album || null,
          track: info.track || info.title || null,
          genre: info.genre || null,
          year: year,
          tags: info.tags ? info.tags.slice(0, 5) : [],
        };

        console.log(
          `[INFO] Video: "${result.title}" by ${
            result.artist || result.channel
          }`
        );
        if (result.album) console.log(`[INFO] Album: ${result.album}`);
        if (result.year) console.log(`[INFO] Year: ${result.year}`);
        if (result.genre) console.log(`[INFO] Genre: ${result.genre}`);

        resolve(result);
      } catch (e) {
        reject(new Error("Failed to parse video info"));
      }
    });
  });
}

/**
 * GET /api/download
 * Download and convert video to MP3 with highest quality and album art
 */
app.get("/api/download", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  if (!ytdlpAvailable) {
    return res.status(500).json({
      error: "yt-dlp is not installed. Please run: npm run download-ytdlp",
    });
  }

  if (!FFMPEG_PATH) {
    return res.status(500).json({
      error: "ffmpeg is not installed. Please run: npm install ffmpeg-static",
    });
  }

  try {
    console.log(`[DOWNLOAD] Starting download: ${url} (highest quality)`);

    // Generate unique filename
    const timestamp = Date.now();
    const outputTemplate = path.join(
      TEMP_DIR,
      `${timestamp}_%(title)s.%(ext)s`
    );

    // yt-dlp arguments for highest quality with complete metadata
    const args = [
      "-x", // Extract audio
      "--audio-format",
      "mp3", // Convert to MP3
      "--audio-quality",
      "0", // Best quality (0 = best)
      "--embed-thumbnail", // Embed thumbnail as album art
      "--embed-metadata", // Embed all available metadata
      "--parse-metadata",
      "%(artist,uploader,channel)s:%(meta_artist)s", // Set artist from video info
      "--parse-metadata",
      "%(album,title)s:%(meta_album)s", // Set album
      "--parse-metadata",
      "%(track,title)s:%(meta_title)s", // Set track title
      "--parse-metadata",
      "%(release_year,upload_date>%Y)s:%(meta_date)s", // Set year
      "--convert-thumbnails",
      "jpg", // Convert thumbnail to jpg for better MP3 compatibility
      "--ffmpeg-location",
      path.dirname(FFMPEG_PATH),
      "-o",
      outputTemplate,
      "--no-playlist",
      "--no-warnings",
      "--progress",
      url,
    ];

    console.log(
      `[DOWNLOAD] Running yt-dlp with highest quality + album art...`
    );

    // Run yt-dlp
    const ytdlpProcess = spawn(YTDLP_PATH, args);

    let errorOutput = "";
    let outputFile = "";
    let videoTitle = "";

    ytdlpProcess.stdout.on("data", (data) => {
      const line = data.toString();
      console.log(`[YTDLP] ${line.trim()}`);

      // Try to capture the output filename
      const destMatch = line.match(/\[ExtractAudio\] Destination: (.+)/);
      if (destMatch) {
        outputFile = destMatch[1].trim();
      }

      // Capture video title
      const titleMatch = line.match(/\[download\] Downloading video/);
      if (titleMatch) {
        const infoMatch = line.match(/: (.+)/);
        if (infoMatch) {
          videoTitle = infoMatch[1];
        }
      }
    });

    ytdlpProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`[YTDLP ERROR] ${data.toString().trim()}`);
    });

    ytdlpProcess.on("close", async (code) => {
      if (code !== 0) {
        console.error("[ERROR] yt-dlp failed:", errorOutput);
        if (!res.headersSent) {
          res.status(500).json({ error: "Download failed. Please try again." });
        }
        return;
      }

      // Find the output file
      if (!outputFile || !fs.existsSync(outputFile)) {
        // Search for the file
        const files = fs
          .readdirSync(TEMP_DIR)
          .filter((f) => f.startsWith(`${timestamp}_`) && f.endsWith(".mp3"));

        if (files.length > 0) {
          outputFile = path.join(TEMP_DIR, files[0]);
        }
      }

      if (!outputFile || !fs.existsSync(outputFile)) {
        console.error("[ERROR] Output file not found");
        if (!res.headersSent) {
          res
            .status(500)
            .json({ error: "Conversion completed but file not found" });
        }
        return;
      }

      const stats = fs.statSync(outputFile);

      // Get the original filename (remove timestamp prefix)
      let originalFilename = path.basename(outputFile).replace(/^\d+_/, "");

      console.log(
        `[DOWNLOAD] Sending file: ${originalFilename} (${Math.round(
          stats.size / 1024
        )} KB)`
      );

      // Send file with original name
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(originalFilename)}`
      );
      res.setHeader("Content-Length", stats.size);

      const readStream = fs.createReadStream(outputFile);
      readStream.pipe(res);

      readStream.on("end", () => {
        // Cleanup
        setTimeout(() => {
          if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile);
            console.log("[CLEANUP] Removed temp file");
          }
        }, 5000);
      });

      readStream.on("error", (err) => {
        console.error("[STREAM ERROR]", err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to stream file" });
        }
      });
    });

    ytdlpProcess.on("error", (err) => {
      console.error("[ERROR] Failed to run yt-dlp:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to start download process" });
      }
    });
  } catch (error) {
    console.error("[ERROR] Download failed:", error.message);

    if (!res.headersSent) {
      res.status(500).json({ error: "Download failed. Please try again." });
    }
  }
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
  console.log("║     ✨ Highest quality + Album art enabled   ║");
  console.log("║                                              ║");
  if (!ytdlpAvailable) {
    console.log("║     ⚠️  Run: npm run download-ytdlp          ║");
    console.log("║                                              ║");
  }
  if (!FFMPEG_PATH) {
    console.log("║     ⚠️  Run: npm install ffmpeg-static       ║");
    console.log("║                                              ║");
  }
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
});
