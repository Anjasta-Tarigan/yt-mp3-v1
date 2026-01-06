const { spawn } = require("child_process");
const { FFMPEG_PATH } = require("../config");
const path = require("path");

class FfmpegService {
  /**
   * Trim audio file using ffmpeg
   */
  static async trimAudio(
    inputPath,
    outputPath,
    startSeconds,
    endSeconds,
    totalDuration
  ) {
    return new Promise((resolve, reject) => {
      if (!FFMPEG_PATH) {
        reject(new Error("FFmpeg not available"));
        return;
      }

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
}

module.exports = FfmpegService;
