// Сравнение версий для проверки обновлений PWA и APK.
// Работает и в браузере (window.PixelUpdate), и в тестах (module.exports).
((root) => {
  "use strict";

  const REPO = "vladis77177/pixel-calendar-2027";
  const APK_NAME = "pixel-calendar-2027-release.apk";

  function parts(value) {
    const match = String(value || "")
      .trim()
      .replace(/^v/i, "")
      .match(/^\d+(?:\.\d+)*/);
    if (!match) return [];
    return match[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
  }

  function isNewer(remote, local) {
    const left = parts(remote);
    const right = parts(local);
    if (!left.length) return false;
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const a = left[index] || 0;
      const b = right[index] || 0;
      if (a !== b) return a > b;
    }
    return false;
  }

  function normalizeTag(tag) {
    const value = String(tag || "").trim().replace(/^v/i, "");
    return /^\d/.test(value) ? value : "";
  }

  // Ссылка на файл всегда ведёт на последний релиз. Ссылку конкретного релиза
  // подставлять нельзя: вместе с ней кэш проверки уводил на устаревший APK.
  function apkDownloadUrl() {
    return `https://github.com/${REPO}/releases/latest/download/${APK_NAME}`;
  }

  function releaseApiUrl() {
    return `https://api.github.com/repos/${REPO}/releases/latest`;
  }

  // Пора ли сходить в сеть за свежим релизом вместо кэша.
  function shouldRecheck(cachedAt, now, interval) {
    const at = Number(cachedAt) || 0;
    const current = Number(now) || 0;
    const limit = Number(interval) || 0;
    if (at <= 0) return true;
    if (limit <= 0) return true;
    return current - at >= limit;
  }

  const api = { parts, isNewer, normalizeTag, apkDownloadUrl, releaseApiUrl, shouldRecheck };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PixelUpdate = api;
})(typeof window !== "undefined" ? window : globalThis);
