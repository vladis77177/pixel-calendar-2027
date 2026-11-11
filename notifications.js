// Напоминания о делах: Capacitor Local Notifications в APK.
// В браузере модуль молчит — уведомление вне вкладки браузер не гарантирует.
(function (root) {
  "use strict";

  // В Node.js (тесты) window нет, поэтому корнем может быть globalThis.
  const scope = root || (typeof globalThis !== "undefined" ? globalThis : null);
  const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  // Насколько вперёд планируем повторы: чаще приложение открывают, но и без
  // этого месяца напоминаний хватит. Android не любит сотни отложенных.
  const SERIES_HORIZON_DAYS = 60;
  const MAX_NOTIFICATIONS = 250;

  function plugin() {
    return scope && scope.Capacitor && scope.Capacitor.Plugins && scope.Capacitor.Plugins.LocalNotifications;
  }

  function isNative() {
    return Boolean(scope && scope.Capacitor && typeof scope.Capacitor.isNativePlatform === "function"
      && scope.Capacitor.isNativePlatform());
  }

  // Стабильный числовой id для Android: один и тот же ключ всегда даёт тот же id,
  // поэтому повторное планирование заменяет прошлое напоминание.
  function notificationId(key) {
    let hash = 0;
    const text = String(key || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return (hash % 2000000000) + 1;
  }

  function whenFor(iso, time) {
    if (!iso || !time || !TIME_PATTERN.test(time)) return null;
    const at = new Date(`${iso}T${time}:00`);
    return Number.isNaN(at.getTime()) ? null : at;
  }

  function isoOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(iso, days) {
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + days);
    return isoOf(date);
  }

  // Должно совпадать с isSeriesActiveOn в app.js: одна серия не должна
  // напоминать в день, который календарь не показывает.
  function seriesActiveOn(series, iso) {
    if (!series || series.deletedAt || !ISO_PATTERN.test(iso) || !ISO_PATTERN.test(series.start || "")) {
      return false;
    }
    if (iso < series.start) return false;
    if (series.end && iso > series.end) return false;
    const exception = series.exceptions && series.exceptions[iso];
    if (exception && exception.deleted) return false;
    const date = new Date(`${iso}T12:00:00`);
    const start = new Date(`${series.start}T12:00:00`);
    const diff = Math.round((date - start) / 86400000);
    if (diff < 0) return false;
    if (series.freq === "daily") return true;
    if (series.freq === "weekdays") return date.getDay() >= 1 && date.getDay() <= 5;
    if (series.freq === "weekly") return diff % 7 === 0 && date.getDay() === start.getDay();
    if (series.freq === "monthly") return date.getDate() === start.getDate();
    if (series.freq === "yearly") {
      return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
    }
    return false;
  }

  // Собирает все будущие напоминания из обычных задач и серий.
  // Возвращает Map<id, { at, text, taskId, seriesId, date }>.
  function collectReminders(tasks, series, now) {
    const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    const floor = current.getTime() + 1000;
    const wanted = new Map();

    Object.keys(tasks || {}).forEach((iso) => {
      (tasks[iso] || []).forEach((task) => {
        if (!task || task.deletedAt || task.done || !task.time) return;
        const at = whenFor(iso, task.time);
        if (!at || at.getTime() <= floor) return;
        wanted.set(notificationId(task.id), {
          at,
          text: task.text,
          taskId: task.id,
          seriesId: null,
          date: iso
        });
      });
    });

    const today = isoOf(current);
    (Array.isArray(series) ? series : []).forEach((item) => {
      if (!item || item.deletedAt || !item.time) return;
      if (item.end && item.end < today) return;
      for (let step = 0; step <= SERIES_HORIZON_DAYS; step += 1) {
        const iso = addDays(today, step);
        if (item.end && iso > item.end) break;
        if (!seriesActiveOn(item, iso)) continue;
        const exception = item.exceptions && item.exceptions[iso];
        if (exception && (exception.deleted || exception.done)) continue;
        const at = whenFor(iso, item.time);
        if (!at || at.getTime() <= floor) continue;
        wanted.set(notificationId(`${item.id}@${iso}`), {
          at,
          text: item.text,
          taskId: null,
          seriesId: item.id,
          date: iso
        });
      }
    });

    // Страховка от сотен дел: оставляем самые близкие по времени.
    if (wanted.size > MAX_NOTIFICATIONS) {
      const closest = [...wanted.entries()]
        .sort((a, b) => a[1].at - b[1].at)
        .slice(0, MAX_NOTIFICATIONS);
      return new Map(closest);
    }
    return wanted;
  }

  async function ensurePermission() {
    if (!isNative() || !plugin()) return false;
    try {
      let status = await plugin().checkPermissions();
      if (status.display !== "granted") status = await plugin().requestPermissions();
      return status.display === "granted";
    } catch (error) {
      return false;
    }
  }

  async function cancel(taskId) {
    if (!isNative() || !plugin() || !taskId) return;
    try {
      await plugin().cancel({ notifications: [{ id: notificationId(taskId) }] });
    } catch (error) {
      // отменять нечего
    }
  }

  // Пересобирает все будущие напоминания: убирает лишние, добавляет недостающие.
  // Вызывается после любого сохранения состояния, поэтому правки и синк
  // автоматически приводят уведомления в соответствие.
  async function resyncAll(tasks, series) {
    if (!isNative() || !plugin()) return;
    let pending = [];
    try {
      const result = await plugin().getPending();
      pending = (result && result.notifications) || [];
    } catch (error) {
      pending = [];
    }

    const wanted = collectReminders(tasks, series);
    const stale = pending.filter((item) => !wanted.has(item.id)).map((item) => ({ id: item.id }));
    if (stale.length) {
      try {
        await plugin().cancel({ notifications: stale });
      } catch (error) {
        // пропускаем: следующая синхронизация попробует снова
      }
    }
    if (!wanted.size || !(await ensurePermission())) return;

    try {
      await plugin().schedule({
        notifications: [...wanted.entries()].map(([id, item]) => ({
          id,
          title: "Пиксельный календарь",
          body: item.text,
          schedule: { at: item.at, allowWhileIdle: true },
          extra: item.seriesId
            ? { seriesId: item.seriesId, date: item.date }
            : { taskId: item.taskId, date: item.date }
        }))
      });
    } catch (error) {
      // разрешение могли отозвать между проверкой и планированием
    }
  }

  let debounceTimer = 0;
  let latest = { tasks: {}, series: [] };

  // Частые сохранения (правка, синк, отметки) не должны дёргать плагин каждый раз.
  // Второй аргумент может быть задержкой — так модуль вызывали до появления серий.
  function schedule(tasks, series, delay) {
    if (typeof series === "number") {
      delay = series;
      series = [];
    }
    latest = { tasks: tasks || {}, series: Array.isArray(series) ? series : [] };
    if (!isNative() || !plugin()) return;
    if (typeof setTimeout !== "function") return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      resyncAll(latest.tasks, latest.series);
    }, typeof delay === "number" ? delay : 800);
  }

  const api = {
    SERIES_HORIZON_DAYS,
    isNative,
    notificationId,
    whenFor,
    seriesActiveOn,
    collectReminders,
    ensurePermission,
    cancel,
    resyncAll,
    schedule
  };
  if (scope) scope.PixelNotify = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
