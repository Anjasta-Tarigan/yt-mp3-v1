/**
 * Parse time string to seconds
 * @param {string|number} timeStr
 * @returns {number|null}
 */
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;

  // Handle formats: "1:30", "01:30", "1:30:00", "90" (seconds)
  const parts = timeStr.toString().split(":").map(Number);

  if (parts.some(isNaN)) return null;

  if (parts.length === 1) {
    return parts[0]; // Just seconds
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  return null;
}

/**
 * Format seconds to time string (HH:MM:SS or MM:SS)
 * @param {number} seconds
 * @returns {string}
 */
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

module.exports = {
  parseTimeToSeconds,
  formatTime,
};
