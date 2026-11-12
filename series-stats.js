// Статистика повторяющихся серий: серия отметок подряд и история по дням.
// Модуль не зависит от DOM: правило повтора передаётся снаружи (isActive),
// чтобы не дублировать логику из app.js. Тесты — node --test.
(function (root) {
  "use strict";

  const MAX_HISTORY_DAYS = 70;
  // Предохранитель: серия, начатая много лет назад, не должна крутить цикл бесконечно.
  const MAX_SCAN_DAYS = 1500;

  function shiftIso(iso, days) {
    const parts = String(iso).split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function exceptionOf(series, iso) {
    const all = series && series.exceptions;
    if (!all || typeof all !== "object") return null;
    const ex = all[iso];
    return ex && typeof ex === "object" ? ex : null;
  }

  // Как выглядел день серии: не было по расписанию, сделано, пропущено,
  // перенесено (удалённый день) или ещё не закончилось (сегодня).
  function dayState(series, iso, todayIso, isActive) {
    if (!isActive(series, iso)) return "none";
    const ex = exceptionOf(series, iso);
    if (ex && ex.deleted) return "skipped";
    if (ex && ex.done) return "done";
    if (iso >= todayIso) return "pending";
    return "missed";
  }

  // Серия отметок подряд: считаем подходящие дни, удалённые пропускаем,
  // сегодняшний не рвёт цепочку, первый пропуск её заканчивает.
  function summarize(series, todayIso, isActive) {
    const result = { current: 0, best: 0, total: 0, done: 0, first: null, last: null };
    if (!series || !series.start) return result;

    const from = series.start;
    const end = [series.end, todayIso].filter(Boolean).sort()[0];
    if (!end || end < from) return result;

    const fromDate = new Date(from.slice(0, 4), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
    const endDate = new Date(end.slice(0, 4), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)));
    const span = Math.round((endDate - fromDate) / 86400000) + 1;
    if (span > MAX_SCAN_DAYS) {
      result.first = shiftIso(end, -(MAX_SCAN_DAYS - 1));
    } else {
      result.first = from;
    }
    result.last = end;

    let run = 0;
    for (let cursor = result.first; cursor <= end; cursor = shiftIso(cursor, 1)) {
      const state = dayState(series, cursor, todayIso, isActive);
      if (state === "none" || state === "skipped") continue;
      if (state === "pending") continue;
      result.total += 1;
      if (state === "done") {
        result.done += 1;
        run += 1;
        if (run > result.best) result.best = run;
      } else {
        run = 0;
      }
    }
    result.current = run;
    return result;
  }

  // Клетки истории: последние days дней по возрастанию даты.
  function history(series, todayIso, isActive, days) {
    const size = Number.isFinite(days) && days > 0 ? Math.floor(days) : MAX_HISTORY_DAYS;
    const cells = [];
    for (let offset = size - 1; offset >= 0; offset -= 1) {
      const iso = shiftIso(todayIso, -offset);
      cells.push({ iso, state: dayState(series, iso, todayIso, isActive) });
    }
    return cells;
  }

  const api = { summarize, history, dayState, MAX_HISTORY_DAYS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.PixelSeriesStats = api;
})(typeof window !== "undefined" ? window : globalThis);
