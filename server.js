// ========================================
// YouTube to MP3 Converter - Backend Server
// ========================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const { PORT } = require("./src/config");
const apiRoutes = require("./src/routes/api");
const convertedFiles = require("./src/services/store");
const { cleanupFiles } = require("./src/utils/fileUtils");

const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://i.ytimg.com"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP, please try again later." },
});
app.use(limiter);

// Logging
app.use(morgan("dev"));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use("/converted", express.static(path.join(__dirname, "converted")));

// API Routes
app.use("/api", apiRoutes);

// Cleanup old files periodically (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  convertedFiles.forEach((data, fileId) => {
    if (now - data.timestamp > 30 * 60 * 1000) {
      cleanupFiles(fileId);
    }
  });
}, 5 * 60 * 1000);

// 404 Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

// 500 Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "500.html"));
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
