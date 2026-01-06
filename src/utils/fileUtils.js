const fs = require("fs");
const path = require("path");
const convertedFiles = require("../services/store");

/**
 * Cleanup files associated with a specific fileId
 * @param {string} fileId
 */
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

module.exports = {
  cleanupFiles,
};
