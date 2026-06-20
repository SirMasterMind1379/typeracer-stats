const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, "..", "node_modules", "html2canvas", "dist", "html2canvas.js");
let code = fs.readFileSync(bundlePath, "utf8");

// Check if already patched
if (code.includes("/* patched: fallback transparent */")) {
  console.log("OK: Already patched");
  process.exit(0);
}

// Find the throw with unsupported color function
// The exact text: throw new Error("Attempting to parse an unsupported color function \"" + value.name + "\"");
const idx = code.indexOf('throw new Error("Attempting to parse an unsupported color function');
if (idx === -1) {
  console.error("FATAL: Could not find the unsupported color function error");
  process.exit(1);
}

// Replace just the throw line
const lineEnd = code.indexOf("\n", idx);
const before = code.substring(0, idx);
const after = code.substring(lineEnd);
code = before + "return 0x00000000; /* patched: fallback transparent */" + after;

// Find the throw with unsupported image function
const imgIdx = code.indexOf('throw new Error("Attempting to parse an unsupported image function');
if (imgIdx !== -1) {
  const imgLineEnd = code.indexOf("\n", imgIdx);
  const imgBefore = code.substring(0, imgIdx);
  const imgAfter = code.substring(imgLineEnd);
  code = imgBefore + "return null; /* patched: fallback for unknown image functions */" + imgAfter;
}

fs.writeFileSync(bundlePath, code);
console.log("OK: Patched html2canvas");
