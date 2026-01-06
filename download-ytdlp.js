// ========================================
// Download yt-dlp binary
// ========================================

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const platform = os.platform();
let downloadUrl = "";
let binaryName = "";

if (platform === "win32") {
  downloadUrl =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
  binaryName = "yt-dlp.exe";
} else if (platform === "darwin") {
  downloadUrl =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
  binaryName = "yt-dlp";
} else {
  downloadUrl =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
  binaryName = "yt-dlp";
}

const OUTPUT_PATH = path.join(__dirname, "bin", binaryName);

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    // Create bin directory if it doesn't exist
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`Downloading yt-dlp from: ${url}`);
    console.log(`Saving to: ${dest}`);

    const file = fs.createWriteStream(dest);

    const request = (url) => {
      https
        .get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            console.log(`Redirecting to: ${response.headers.location}`);
            request(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers["content-length"], 10);
          let downloadedSize = 0;

          response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
            process.stdout.write(`\rDownloading: ${percent}%`);
          });

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            console.log("\nDownload complete!");

            if (platform !== "win32") {
              try {
                fs.chmodSync(dest, 0o755);
                console.log("Set executable permissions (chmod +x)");
              } catch (err) {
                console.warn(
                  "Failed to set executable permissions:",
                  err.message
                );
              }
            }

            resolve();
          });
        })
        .on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    };

    request(url);
  });
}

downloadFile(downloadUrl, OUTPUT_PATH)
  .then(() => {
    console.log("yt-dlp is ready to use!");
  })
  .catch((err) => {
    console.error("Failed to download yt-dlp:", err.message);
    process.exit(1);
  });
