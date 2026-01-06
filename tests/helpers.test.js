const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseTimeToSeconds, formatTime } = require("../src/utils/helpers");

describe("Helper Functions", () => {
  describe("parseTimeToSeconds", () => {
    it("should parse seconds correctly", () => {
      assert.strictEqual(parseTimeToSeconds("90"), 90);
    });

    it("should parse MM:SS correctly", () => {
      assert.strictEqual(parseTimeToSeconds("1:30"), 90);
      assert.strictEqual(parseTimeToSeconds("01:30"), 90);
    });

    it("should parse HH:MM:SS correctly", () => {
      assert.strictEqual(parseTimeToSeconds("1:01:30"), 3690);
    });

    it("should return null for invalid input", () => {
      assert.strictEqual(parseTimeToSeconds("abc"), null);
      assert.strictEqual(parseTimeToSeconds(""), null);
      assert.strictEqual(parseTimeToSeconds(null), null);
    });
  });

  describe("formatTime", () => {
    it("should format seconds to MM:SS", () => {
      assert.strictEqual(formatTime(90), "1:30");
      assert.strictEqual(formatTime(65), "1:05");
    });

    it("should format seconds to HH:MM:SS when needed", () => {
      assert.strictEqual(formatTime(3690), "1:01:30");
    });

    it("should pad zero correctly", () => {
      assert.strictEqual(formatTime(9), "0:09");
    });
  });
});
