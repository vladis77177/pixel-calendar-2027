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
  // Дальше окна ищем только ближайшее вхождение серии: годовой повтор
  // может быть и через несколько лет (29 февраля), но терять его нельзя.
  const MAX_LOOKAHEAD_DAYS = 1500;
  const MAX_NOTIFICATIONS = 250;
  const ACTION_TYPE_ID = "calendar-task";
  const ACTION_DONE = "done";
  const ACTION_SNOOZE = "snooze";
  const DIGEST_TIME = "08:00";
  const DIGEST_HORIZON_DAYS = 7;

  function plugin() {
    return scope && scope.Capacitor && scope.Capacitor.Plugins && scope.Capacitor.Plugins.LocalNotifications;
  }

  function isNative() {
    return Boolean(scope && scope.Capacitor && typeof scope.Capacitor.isNativePlatform === "function"
      && scope.Capacitor.isNativePlatform());
  }

  // Кнопки появляются в каждом напоминании. Регистрируем один раз.
  let actionsRegistered = null;
  function registerActions() {
    if (!isNative() || !plugin()) return Promise.resolve(false);
    if (!actionsRegistered) {
      try {
        actionsRegistered = Promise.resolve(plugin().registerActionTypes({
          types: [{
            id: ACTION_TYPE_ID,
            actions: [
              { id: ACTION_DONE, title: "Готово" },
              { id: ACTION_SNOOZE, title: "Отложить на час" }
            ]
          }]
        })).then(() => true).catch(() => false);
      } catch (error) {
        actionsRegistered = Promise.resolve(false);
      }
    }
    return actionsRegistered;
  }

  function addActionListener(handler) {
    if (!isNative() || !plugin() || typeof handler !== "function") return;
    try {
      const listener = plugin().addListener("localNotificationActionPerformed", (event) => {
        try {
          handler(event);
        } catch (error) {
          // действие не должно ронять приложение
        }
      });
      if (listener && typeof listener.catch === "function") listener.catch(() => {});
    } catch (error) {
      // на старых сборках плагина слушателя может не быть
    }
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

  function leadLabel(minutes) {
    if (minutes >= 1440) return "За день";
    if (minutes >= 60) return "За час";
    return `За ${minutes} мин`;
  }

  // Сдвиг на «заранее». Если момент уже прошёл, напоминаем в срок.
  function shiftByLead(at, lead, floor) {
    const minutes = Number(lead);
    if (!at || !Number.isFinite(minutes) || minutes <= 0) return at;
    const shifted = new Date(at.getTime() - minutes * 60000);
    return shifted.getTime() > floor ? shifted : at;
  }

  function reminderBody(text, time, lead, snoozed) {
    if (snoozed) return `Отложено · ${time} ${text}`;
    if (Number(lead) > 0) return `${leadLabel(Number(lead))} · ${time} ${text}`;
    return text;
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

  // Разворачивает серию: все вхождения на 60 дней вперёд плюс ближайшее
  // вхождение за пределами окна. Пустые и выполненные дни пропускаются.
  function seriesCandidates(item, current, floor) {
    const result = [];
    if (!item || item.deletedAt || !item.time) return result;
    const today = isoOf(current);
    if (item.end && item.end < today) return result;

    const add = (iso) => {
      if (!seriesActiveOn(item, iso)) return false;
      const exception = item.exceptions && item.exceptions[iso];
      if (exception && (exception.deleted || exception.done)) return false;
      let at = whenFor(iso, item.time);
      const snoozed = Number(exception && exception.snoozedUntil);
      const isSnoozed = Number.isFinite(snoozed) && snoozed > floor;
      if (isSnoozed) {
        at = new Date(snoozed);
      } else {
        const shifted = shiftByLead(at, item.leadMinutes, floor);
        at = shifted;
      }
      if (!at || at.getTime() <= floor) return false;
      result.push({
        iso,
        at,
        shifted: !isSnoozed && at.getTime() < whenFor(iso, item.time).getTime(),
        snoozed: isSnoozed
      });
      return true;
    };

    for (let step = 0; step <= SERIES_HORIZON_DAYS; step += 1) {
      const iso = addDays(today, step);
      if (item.end && iso > item.end) return result;
      add(iso);
    }

    for (let step = SERIES_HORIZON_DAYS + 1; step <= SERIES_HORIZON_DAYS + MAX_LOOKAHEAD_DAYS; step += 1) {
      const iso = addDays(today, step);
      if (item.end && iso > item.end) break;
      // Если ближайшее вхождение исключено, ищем следующее.
      if (add(iso)) break;
    }
    return result;
  }

  // Держит общий лимит Android, но не даёт потерять серию целиком:
  // у каждой серии остаётся хотя бы одно ближайшее напоминание.
  function limitReminders(wanted) {
    if (wanted.size <= MAX_NOTIFICATIONS) return wanted;
    const entries = [...wanted.entries()].sort(
      (a, b) => a[1].at - b[1].at || String(a[0]).localeCompare(String(b[0]))
    );
    const protectedIds = new Set();
    const seen = new Set();
    entries.forEach(([id, item]) => {
      if (!item.seriesId || seen.has(item.seriesId)) return;
      seen.add(item.seriesId);
      protectedIds.add(id);
    });
    if (protectedIds.size >= MAX_NOTIFICATIONS) {
      return new Map(entries.slice(0, MAX_NOTIFICATIONS));
    }
    const result = new Map();
    entries.forEach(([id, item]) => {
      if (protectedIds.has(id)) result.set(id, item);
    });
    for (const [id, item] of entries) {
      if (result.size >= MAX_NOTIFICATIONS) break;
      if (!result.has(id)) result.set(id, item);
    }
    return result;
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
        let at = whenFor(iso, task.time);
        const snoozed = Number(task.snoozedUntil);
        const isSnoozed = Number.isFinite(snoozed) && snoozed > floor;
        if (isSnoozed) {
          at = new Date(snoozed);
        } else {
          at = shiftByLead(at, task.leadMinutes, floor);
        }
        if (!at || at.getTime() <= floor) return;
        wanted.set(notificationId(task.id), {
          at,
          text: isSnoozed ? reminderBody(task.text, task.time, 0, true) : reminderBody(task.text, task.time, task.leadMinutes, false),
          taskId: task.id,
          seriesId: null,
          date: iso
        });
      });
    });

    (Array.isArray(series) ? series : []).forEach((item) => {
      seriesCandidates(item, current, floor).forEach(({ iso, at, snoozed }) => {
        wanted.set(notificationId(`${item.id}@${iso}`), {
          at,
          text: reminderBody(item.text, item.time, snoozed ? 0 : item.leadMinutes, snoozed),
          taskId: null,
          seriesId: item.id,
          date: iso
        });
      });
    });

    return limitReminders(wanted);
  }

  function plural(n, one, few, many) {
    const tail = n % 100;
    if (tail >= 11 && tail <= 14) return many;
    const last = n % 10;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
  }

  // Состав сводки на конкретный день: активные задачи и вхождения серий.
  function digestBody(tasks, series, iso) {
    const names = [];
    (tasks[iso] || []).forEach((task) => {
      if (task && !task.deletedAt && !task.done && task.text) names.push(task.text);
    });
    (Array.isArray(series) ? series : []).forEach((item) => {
      if (!seriesActiveOn(item, iso)) return;
      const exception = item.exceptions && item.exceptions[iso];
      if (exception && (exception.done || exception.deleted)) return;
      if (item.text) names.push(item.text);
    });
    if (!names.length) return "";
    const count = names.length;
    const head = `Дел: ${count} ${plural(count, "дело", "дела", "дел")}`;
    const short = names.slice(0, 3).join(", ");
    const tail = count > 3 ? ` и ещё ${count - 3}` : "";
    return `${head} · ${short}${tail}`;
  }

  // Утренняя сводка: одно уведомление на день, только если она включена.
  function collectDigest(tasks, series, now, settings) {
    const result = new Map();
    if (!settings || settings.morningDigest !== true) return result;
    const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    const floor = current.getTime() + 1000;
    const today = isoOf(current);
    for (let step = 0; step < DIGEST_HORIZON_DAYS; step += 1) {
      const iso = addDays(today, step);
      const at = whenFor(iso, DIGEST_TIME);
      if (!at || at.getTime() <= floor) continue;
      const text = digestBody(tasks, series, iso);
      if (!text) continue;
      result.set(notificationId(`digest@${iso}`), {
        at,
        text,
        title: "Утренняя сводка",
        digest: true,
        taskId: null,
        seriesId: null,
        date: iso
      });
    }
    return result;
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
  async function resyncAll(tasks, series, settings) {
    if (!isNative() || !plugin()) return;
    let pending = [];
    try {
      const result = await plugin().getPending();
      pending = (result && result.notifications) || [];
    } catch (error) {
      pending = [];
    }

    const wanted = collectReminders(tasks, series);
    collectDigest(tasks, series, new Date(), settings).forEach((item, id) => {
      wanted.set(id, item);
    });
    const stale = pending.filter((item) => !wanted.has(item.id)).map((item) => ({ id: item.id }));
    if (stale.length) {
      try {
        await plugin().cancel({ notifications: stale });
      } catch (error) {
        // пропускаем: следующая синхронизация попробует снова
      }
    }
    if (!wanted.size || !(await ensurePermission())) return;

    await registerActions();
    try {
      await plugin().schedule({
        notifications: [...wanted.entries()].map(([id, item]) => {
          const base = {
            id,
            title: item.title || "Пиксельный календарь",
            body: item.text,
            smallIcon: "ic_stat_calendar",
            iconColor: "#5FB947",
            schedule: { at: item.at, allowWhileIdle: true },
            extra: item.seriesId
              ? { seriesId: item.seriesId, date: item.date }
              : { taskId: item.taskId, date: item.date }
          };
          // У сводки нет одной задачи, поэтому кнопки действий не нужны.
          if (!item.digest) base.actionTypeId = ACTION_TYPE_ID;
          return base;
        })
      });
    } catch (error) {
      // разрешение могли отозвать между проверкой и планированием
    }
  }

  let debounceTimer = 0;
  let latest = { tasks: {}, series: [], settings: null };

  // Частые сохранения (правка, синк, отметки) не должны дёргать плагин каждый раз.
  // Третий аргумент может быть задержкой — так модуль вызывали до появления серий.
  function schedule(tasks, series, delay, settings) {
    if (typeof series === "number") {
      settings = delay;
      delay = series;
      series = [];
    }
    latest = {
      tasks: tasks || {},
      series: Array.isArray(series) ? series : [],
      settings: settings || null
    };
    if (!isNative() || !plugin()) return;
    if (typeof setTimeout !== "function") return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      resyncAll(latest.tasks, latest.series, latest.settings);
    }, typeof delay === "number" ? delay : 800);
  }

  const api = {
    SERIES_HORIZON_DAYS,
    MAX_NOTIFICATIONS,
    isNative,
    notificationId,
    whenFor,
    seriesActiveOn,
    seriesCandidates,
    registerActions,
    addActionListener,
    collectReminders,
    collectDigest,
    ensurePermission,
    cancel,
    resyncAll,
    schedule
  };
  if (scope) scope.PixelNotify = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
