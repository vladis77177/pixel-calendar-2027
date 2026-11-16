// Ранний бутстрап фазы неба: ставит data-daytime до первой отрисовки страницы.
// Без него первый кадр всегда дневной (#82d4fb), а затем CSS плавно (1.2 с)
// переходит в вечернюю или ночную тему — это и видно как «белая вспышка».
(function (root) {
  const SETTINGS_KEY = "pixel-calendar-2027-v1";

  function storedSky() {
    try {
      const raw = root.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return "auto";
      const parsed = JSON.parse(raw);
      const sky = parsed && parsed.settings && parsed.settings.sky;
      return typeof sky === "string" ? sky : "auto";
    } catch (error) {
      return "auto";
    }
  }

  function apply(doc, now) {
    const core = root.PixelCore;
    if (!doc || !core || typeof core.skyPhaseFor !== "function") return null;
    const hour = now.getHours() + now.getMinutes() / 60;
    const phase = core.skyPhaseFor(hour, storedSky());
    doc.documentElement.dataset.daytime = phase;
    return phase;
  }

  root.PixelBoot = { apply, storedSky };
  if (typeof document !== "undefined") apply(document, new Date());
  if (typeof module !== "undefined" && module.exports) module.exports = root.PixelBoot;
})(typeof window !== "undefined" ? window : globalThis);
