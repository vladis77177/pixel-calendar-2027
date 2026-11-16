// Общий домен календаря: даты, склонения и правило повтора серий.
// Модуль не зависит от DOM и состояния приложения, поэтому один и тот же
// код работает в app.js, notifications.js, widget.js и в тестах node --test.
(function (root) {
  "use strict";

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function fromISO(iso) {
    const parts = String(iso).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isValidISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
    const date = fromISO(iso);
    return !Number.isNaN(date.getTime()) && toISO(date) === iso;
  }

  function addDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + amount);
    return result;
  }

  function addDaysIso(iso, days) {
    return toISO(addDays(fromISO(iso), days));
  }

  // Начало недели: weekStart === 0 — воскресенье, иначе понедельник.
  function startOfWeek(date, weekStart) {
    const startDay = weekStart === 0 ? 0 : 1;
    const result = startOfDay(date);
    result.setDate(result.getDate() - ((result.getDay() - startDay + 7) % 7));
    return result;
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  // Оба стиля вызова: plural(n, [one, few, many]) и plural(n, one, few, many).
  function plural(n, forms, few, many) {
    const list = Array.isArray(forms) ? forms : [forms, few, many];
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return list[2];
    if (last > 1 && last < 5) return list[1];
    if (last === 1) return list[0];
    return list[2];
  }

  function isSeriesActiveOn(series, iso) {
    if (!series || series.deletedAt || !isValidISO(iso)) return false;
    if (iso < series.start) return false;
    if (series.end && iso > series.end) return false;
    const exception = series.exceptions && series.exceptions[iso];
    if (exception && exception.deleted) return false;
    const date = fromISO(iso);
    const start = fromISO(series.start);
    const diff = Math.round((date - start) / 86400000);
    if (diff < 0) return false;
    if (series.freq === "daily") return true;
    if (series.freq === "weekdays") return date.getDay() >= 1 && date.getDay() <= 5;
    if (series.freq === "weekly") return diff % 7 === 0 && date.getDay() === start.getDay();
    // День серии = день старта, но не больше числа дней в месяце:
    // серия с 31-го срабатывает и в феврале, и в апрельском последнем дне.
    if (series.freq === "monthly") return date.getDate() === Math.min(start.getDate(), daysInMonth(date));
    if (series.freq === "yearly") {
      return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
    }
    return false;
  }

  // Фаза неба одна для приложения, виджета и раннего бутстрапа (boot.js):
  // 5–8 рассвет, 8–17 день, 17–21 закат, иначе ночь.
  const SKY_PHASES = ["dawn", "day", "dusk", "night"];

  function skyPhaseFor(hour, mode) {
    if (mode && mode !== "auto") return SKY_PHASES.includes(mode) ? mode : "day";
    if (!(hour >= 0)) return "day";
    if (hour >= 5 && hour < 8) return "dawn";
    if (hour >= 8 && hour < 17) return "day";
    if (hour >= 17 && hour < 21) return "dusk";
    return "night";
  }

  root.PixelCore = {
    toISO,
    fromISO,
    isValidISO,
    addDays,
    addDaysIso,
    startOfWeek,
    plural,
    isSeriesActiveOn,
    skyPhaseFor,
    SKY_PHASES
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.PixelCore;
})(typeof window !== "undefined" ? window : globalThis);
