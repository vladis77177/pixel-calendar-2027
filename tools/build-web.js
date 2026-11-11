// Copies the static site into www/ so Capacitor can package it.
// Usage: node tools/build-web.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www");

const FILES = [
  "index.html",
  "styles.css",
  "app.mobile.css",
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

// Build info: commit hash and date are baked into www/index.html so the settings
// dialog can show exactly which build is installed on the phone.
const sha = (process.env.GITHUB_SHA || "").slice(0, 7);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const buildInfo = JSON.stringify({
  version: pkg.version,
  commit: sha || "dev",
  date: new Date().toISOString().slice(0, 10)
});

const builtIndex = path.join(OUT, "index.html");
const html = fs.readFileSync(builtIndex, "utf8").replace(
  "<!--BUILD_INFO-->",
  '<script src="build-info.js"></script>'
);
fs.writeFileSync(builtIndex, html);
// Отдельный файл вместо inline-скрипта: CSP разрешает только свои скрипты.
fs.writeFileSync(path.join(OUT, "build-info.js"), `window.__BUILD_INFO__ = ${buildInfo};\n`);

fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });

console.log(`Web build ready: ${OUT}`);
