// Сравнение версий для проверки обновлений PWA и APK.
// Работает и в браузере (window.PixelUpdate), и в тестах (module.exports).
((root) => {
  "use strict";

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

  const api = { parts, isNewer, normalizeTag };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PixelUpdate = api;
})(typeof window !== "undefined" ? window : globalThis);
