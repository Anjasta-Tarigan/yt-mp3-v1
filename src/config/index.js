const path = require("path");
const os = require("os");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

// Determine platform-specific binary name
const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

// Paths
const ROOT_DIR = path.resolve(__dirname, "../../");
const YTDLP_PATH = path.join(ROOT_DIR, "bin", binaryName);
const TEMP_DIR = path.join(os.tmpdir(), "yt2mp3");
const CONVERTED_DIR = path.join(ROOT_DIR, "converted");

// Ensure directories exist
[TEMP_DIR, CONVERTED_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Check dependencies
let FFMPEG_PATH;
try {
  FFMPEG_PATH = require("ffmpeg-static");
  console.log("[INIT] ffmpeg found at:", FFMPEG_PATH);
} catch (e) {
  console.warn(
    "[WARN] ffmpeg-static not found. Run: npm install ffmpeg-static"
  );
}

const checkYtdlp = () => {
  if (fs.existsSync(YTDLP_PATH)) {
    console.log("[INIT] yt-dlp binary found");
    return true;
  }
  console.warn("[WARN] yt-dlp binary not found. Run: npm run download-ytdlp");
  return false;
};

module.exports = {
  PORT,
  ROOT_DIR,
  YTDLP_PATH,
  TEMP_DIR,
  CONVERTED_DIR,
  FFMPEG_PATH,
  ytdlpAvailable: checkYtdlp(),
};
