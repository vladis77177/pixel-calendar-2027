// Copies the static site into www/ so Capacitor can package it.
// Usage: node tools/build-web.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www");

const FILES = [
  "index.html",
  "styles.css",
  "app.js",
  "widget.html",
  "widget.css",
  "widget.js",
  "sw.js",
  "manifest.webmanifest",
  "favicon.svg"
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const file of FILES) {
  fs.copyFileSync(path.join(ROOT, file), path.join(OUT, file));
}

fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });

console.log(`Web build ready: ${OUT}`);
