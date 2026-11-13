const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { isNewer, normalizeTag, parts, apkDownloadUrl, releaseApiUrl, shouldRecheck } = require("../update.js");

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
  assert.ok(app.includes("pixel-calendar-2027-release.apk"));
  assert.ok(app.includes("if (!isNativeApp() || !currentVersion()) return;"));
  assert.ok(html.includes('id="updateBar"'), "update banner markup is missing");
  assert.ok(html.includes("api.github.com"), "CSP must allow the release check");
});

test("APK download link always points at the latest release", () => {
  const url = apkDownloadUrl();
  assert.ok(url.includes("/releases/latest/download/"), "link must use the latest release");
  assert.ok(!/\/download\/v\d/.test(url), "link must not be pinned to one release tag");
  assert.ok(!/\/releases\/tag\//.test(url), "link must not be pinned to a tag page");
  assert.ok(url.endsWith("pixel-calendar-2027-release.apk"));
  assert.ok(releaseApiUrl().endsWith("/releases/latest"));
});

test("app never uses a release-pinned APK url", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.ok(!/browser_download_url/.test(app), "asset url must not be used: it pins the old release");
  assert.ok(app.includes("apkDownloadUrl()"), "app must take the link from update.js");
  assert.ok(app.includes("releases/latest/download/"), "latest download link must remain usable without update.js");
});

test("release check is skipped while the cache is fresh", () => {
  const now = 1_000_000_000_000;
  const interval = 30 * 60 * 1000;
  assert.equal(shouldRecheck(now - 60 * 1000, now, interval), false, "minute-old cache is fresh");
  assert.equal(shouldRecheck(now - interval + 1, now, interval), false);
  assert.equal(shouldRecheck(now - interval, now, interval), true, "boundary re-checks");
  assert.equal(shouldRecheck(now - 5 * 60 * 60 * 1000, now, interval), true);
});

test("broken or missing cache timestamps force a network check", () => {
  const now = 1_000_000_000_000;
  assert.equal(shouldRecheck(0, now, 1000), true);
  assert.equal(shouldRecheck(null, now, 1000), true);
  assert.equal(shouldRecheck("строка", now, 1000), true);
  assert.equal(shouldRecheck(now, now, 0), true, "zero interval always re-checks");
});

test("cached release url is ignored so old pins cannot survive the upgrade", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.ok(/readReleaseCache[\s\S]{0,400}?return \{\s*at:/.test(app), "cache reader must drop the stored url");
  assert.ok(!/cached\.url/.test(app), "stored url must never be used");
});
