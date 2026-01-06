const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  YTDLP_PATH,
  TEMP_DIR,
  FFMPEG_PATH,
  ytdlpAvailable,
} = require("../config");

class YtdlpService {
  /**
   * Get video information using yt-dlp
   */
  static async getInfo(url) {
    return new Promise((resolve, reject) => {
      if (!ytdlpAvailable) {
        reject(new Error("yt-dlp binary not found"));
        return;
      }

      const args = ["-J", "--no-warnings", url];

      const process = spawn(YTDLP_PATH, args);
      let outputData = "";
      let errorData = "";

      process.stdout.on("data", (data) => {
        outputData += data.toString();
      });

      process.stderr.on("data", (data) => {
        errorData += data.toString();
      });

      process.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(errorData || "Failed to fetch video info"));
          return;
        }

        try {
          const info = JSON.parse(outputData);
          const thumbnails = info.thumbnails || [];
          const bestThumbnail = thumbnails.pop() || {}; // Usually last is best

          const result = {
            title: info.title,
            artist: info.artist || info.uploader,
            album: info.album,
            duration: info.duration,
            thumbnail: bestThumbnail.url,
            viewCount: info.view_count,
            channel: info.uploader,
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
   * Convert URL to MP3 using yt-dlp
   */
  static async convertToMp3(url, outputPath) {
    return new Promise((resolve, reject) => {
      if (!FFMPEG_PATH) {
        reject(
          new Error("FFmpeg not available. Please install ffmpeg-static.")
        );
        return;
      }

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
        // Prioritize original metadata if available
        "--parse-metadata",
        "%(artist,creator,uploader,channel)s:%(meta_artist)s",
        "--parse-metadata",
        "%(album,playlist_title,title)s:%(meta_album)s",
        "--parse-metadata",
        "%(title)s:%(meta_title)s",
        "--parse-metadata",
        "%(release_year,date,upload_date>%Y)s:%(meta_date)s",
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
          // Cleanup temp file on failure
          if (fs.existsSync(tempOutputPath)) {
            try {
              fs.unlinkSync(tempOutputPath);
            } catch (e) {}
          }
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
        // Cleanup temp file on error
        if (fs.existsSync(tempOutputPath)) {
          try {
            fs.unlinkSync(tempOutputPath);
          } catch (e) {}
        }
        reject(err);
      });
    });
  }
}

module.exports = YtdlpService;
