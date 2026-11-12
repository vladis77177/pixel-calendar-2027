const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { isNewer, normalizeTag, parts } = require("../update.js");

test("version parts ignore prefix and suffixes", () => {
  assert.deepEqual(parts("v0.10.0"), [0, 10, 0]);
  assert.deepEqual(parts("1.2.3-beta.1"), [1, 2, 3]);
  assert.deepEqual(parts(""), []);
});

test("newer minor version wins over patch numbering", () => {
  assert.equal(isNewer("0.10.0", "0.9.1"), true);
  assert.equal(isNewer("0.9.1", "0.10.0"), false);
});

test("equal versions are not an update", () => {
  assert.equal(isNewer("0.9.1", "0.9.1"), false);
  assert.equal(isNewer("v0.9.1", "0.9.1"), false);
});

test("patch digits compare numerically", () => {
  assert.equal(isNewer("0.9.10", "0.9.9"), true);
  assert.equal(isNewer("1.0", "1.0.1"), false);
});

test("empty or broken remote tags are ignored", () => {
  assert.equal(isNewer("", "0.9.1"), false);
  assert.equal(normalizeTag("release-candidate"), "");
  assert.equal(normalizeTag(" v0.10.0 "), "0.10.0");
});

test("service worker waits for the user before reloading", () => {
  const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  assert.ok(sw.includes('data.type === "SKIP_WAITING"'), "SW must answer the skip-waiting message");
  assert.ok(!/then\(\(\) => self\.skipWaiting\(\)\)/.test(sw), "SW must not reload pages on its own");
  assert.ok(sw.includes("./update.js"), "update.js must be precached");
  assert.ok(sw.includes("./widget-night.css"), "widget-night.css must be precached");
});

test("app checks GitHub releases only for installed APK", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(app.includes("api.github.com/repos/vladis77177/pixel-calendar-2027/releases/latest"));
  assert.ok(app.includes("pixel-calendar-2027-debug.apk"));
  assert.ok(app.includes("if (!isNativeApp() || !currentVersion()) return;"));
  assert.ok(html.includes('id="updateBar"'), "update banner markup is missing");
  assert.ok(html.includes("api.github.com"), "CSP must allow the release check");
});
