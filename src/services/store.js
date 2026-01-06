// In-memory store for converted files
// In a production app, this might be a Redis or database
const convertedFiles = new Map();

module.exports = convertedFiles;
