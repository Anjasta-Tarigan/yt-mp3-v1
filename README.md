# 🎵 YT2MP3 - YouTube to MP3 Converter

A modern, feature-rich web application for converting YouTube videos to high-quality MP3 audio files.

![YT2MP3 Logo](assets/images/brand.png)

## ✨ Features

- **🎧 High-Quality Audio** - Downloads the best available audio quality (up to 320kbps)
- **📱 Audio Preview** - Listen to the converted audio before downloading
- **✂️ Custom Trimming** - Remove intros/outros by specifying start and end times
- **🖼️ Album Art** - Automatically embeds video thumbnail as album cover
- **📝 Full Metadata** - Preserves artist, title, album, year, and genre information
- **🔄 Version Toggle** - Switch between trimmed and full version before download
- **🚀 Fast Conversion** - Powered by yt-dlp for reliable, fast downloads
- **🎨 Modern UI** - Beautiful dark theme with glassmorphism effects

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Audio Processing**: yt-dlp, ffmpeg
- **UI Library**: SweetAlert2

## 📦 Installation

### Prerequisites

- Node.js v18 or higher
- npm (comes with Node.js)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/yt-mp3-v1.git
   cd yt-mp3-v1
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Download yt-dlp binary**

   ```bash
   npm run download-ytdlp
   ```

4. **Start the server**

   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 Usage

1. **Paste YouTube URL** - Copy any YouTube video URL and paste it into the input field

2. **View Video Info** - Click "Search" or press Enter to fetch video information

3. **Configure Trimming** (Optional)

   - Toggle "✂️ Trim Audio" to enable
   - Enter start time (e.g., `0:15` for 15 seconds)
   - Enter end time (e.g., `3:45` for 3 minutes 45 seconds)
   - Leave end time empty to trim only the intro

4. **Convert** - Click "Convert to MP3" to start conversion

5. **Preview** - Listen to the audio preview using the built-in player

6. **Select Version** - Choose between "Trimmed" or "Full" version

7. **Download** - Click "Download MP3" to save the file

## ⏱️ Time Format

The trim inputs accept multiple formats:

- `15` - 15 seconds
- `1:30` - 1 minute 30 seconds
- `1:30:00` - 1 hour 30 minutes

## 📁 Project Structure

```
yt-mp3-v1/
├── assets/
│   └── images/
│       └── brand.png       # Logo/favicon
├── bin/
│   └── yt-dlp.exe          # yt-dlp binary (downloaded)
├── converted/              # Temporary converted files
├── node_modules/           # Dependencies
├── index.html              # Main HTML page
├── style.css               # Styles
├── script.js               # Frontend JavaScript
├── server.js               # Express backend
├── download-ytdlp.js       # yt-dlp downloader script
├── package.json            # Project configuration
└── README.md               # This file
```

## 🔧 API Endpoints

| Method | Endpoint                                        | Description              |
| ------ | ----------------------------------------------- | ------------------------ |
| GET    | `/api/info?url=<youtube_url>`                   | Get video metadata       |
| POST   | `/api/convert`                                  | Convert video to MP3     |
| GET    | `/api/stream/:fileId?version=<trimmed\|full>`   | Stream audio for preview |
| GET    | `/api/download/:fileId?version=<trimmed\|full>` | Download MP3 file        |

### POST /api/convert Request Body

```json
{
  "url": "https://youtu.be/example",
  "trimStart": "0:15",
  "trimEnd": "3:45"
}
```

## 🧹 File Cleanup

- Converted files are automatically deleted after download
- Files older than 30 minutes are periodically cleaned up
- No server storage of user data

## ⚙️ Configuration

Modify `server.js` to change:

- Port number (default: 3000)
- Cleanup interval (default: 5 minutes)
- File expiration (default: 30 minutes)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is for educational purposes only. Please respect copyright laws and YouTube's Terms of Service.

## ⚠️ Disclaimer

This tool is intended for downloading content that you have the right to download. Users are responsible for ensuring they have permission to download and use the content.

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube download tool
- [ffmpeg](https://ffmpeg.org/) - Audio/video processing
- [SweetAlert2](https://sweetalert2.github.io/) - Beautiful alerts
- [Inter Font](https://rsms.me/inter/) - Typography

---

Made with ❤️ by SLT Developer
