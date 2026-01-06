const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const ytdl = require("@distube/ytdl-core");

const { CONVERTED_DIR, ytdlpAvailable } = require("../config");
const { parseTimeToSeconds, formatTime } = require("../utils/helpers");
const { cleanupFiles } = require("../utils/fileUtils");
const convertedFiles = require("../services/store");
const YtdlpService = require("../services/ytdlpService");
const FfmpegService = require("../services/ffmpegService");

class MediaController {
  /**
   * GET /api/info
   */
  static async getInfo(req, res) {
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
        const result = await YtdlpService.getInfo(url);
        res.json(result);
      } else {
        // Fallback to ytdl-core if ytdlp is not available
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;

        const result = {
          title: videoDetails.title || "Unknown Title",
          artist: videoDetails.author.name || "Unknown Artist",
          album: "YouTube",
          duration: parseInt(videoDetails.lengthSeconds),
          thumbnail:
            videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url,
          viewCount: videoDetails.viewCount,
          channel: videoDetails.author.name,
          chapters: [],
        };
        console.log(`[INFO] Video (fallback): "${result.title}"`);
        res.json(result);
      }
    } catch (error) {
      console.error("[ERROR] Failed to fetch info:", error.message);
      res.status(500).json({ error: "Failed to fetch video info" });
    }
  }

  /**
   * POST /api/convert
   */
  static async convert(req, res) {
    const { url, trimStart, trimEnd } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
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
      // Prefer ytdlp if available
      let info;
      if (ytdlpAvailable) {
        info = await YtdlpService.getInfo(url);
      } else {
        // Fallback to minimal info if needed, but YtdlpService is preferred
        const basicInfo = await ytdl.getBasicInfo(url);
        info = {
          title: basicInfo.videoDetails.title,
          duration: parseInt(basicInfo.videoDetails.lengthSeconds),
        };
      }

      // Convert full version first
      console.log("[CONVERT] Converting full version...");
      const fullOutputPath = path.join(CONVERTED_DIR, `${fileId}_full.mp3`);

      await YtdlpService.convertToMp3(url, fullOutputPath);

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
          await FfmpegService.trimAudio(
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
  }

  /**
   * GET /api/stream/:fileId
   */
  static stream(req, res) {
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
  }

  /**
   * GET /api/download/:fileId
   */
  static download(req, res) {
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
  }
}

module.exports = MediaController;
