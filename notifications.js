// Напоминания о задачах: Capacitor Local Notifications в APK.
// В браузере модуль молчит — уведомление вне вкладки браузер не гарантирует.
(function (root) {
  "use strict";

  // В Node.js (тесты) window нет, поэтому корнем может быть globalThis.
  const scope = root || (typeof globalThis !== "undefined" ? globalThis : null);

  function plugin() {
    return scope && scope.Capacitor && scope.Capacitor.Plugins && scope.Capacitor.Plugins.LocalNotifications;
  }

  function isNative() {
    return Boolean(scope && scope.Capacitor && typeof scope.Capacitor.isNativePlatform === "function"
      && scope.Capacitor.isNativePlatform());
  }

  // Стабильный числовой id для Android: один и тот же task.id всегда даёт тот же id,
  // поэтому повторное планирование заменяет прошлое напоминание.
  function notificationId(taskId) {
    let hash = 0;
    const text = String(taskId || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return (hash % 2000000000) + 1;
  }

  function whenFor(iso, time) {
    if (!iso || !time) return null;
    const at = new Date(`${iso}T${time}:00`);
    return Number.isNaN(at.getTime()) ? null : at;
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
  async function resyncAll(tasks) {
    if (!isNative() || !plugin()) return;
    let pending = [];
    try {
      const result = await plugin().getPending();
      pending = (result && result.notifications) || [];
    } catch (error) {
      pending = [];
    }

    const wanted = new Map();
    Object.keys(tasks || {}).forEach((iso) => {
      (tasks[iso] || []).forEach((task) => {
        if (!task || task.deletedAt || task.done || !task.time) return;
        const at = whenFor(iso, task.time);
        if (!at || at.getTime() <= Date.now() + 1000) return;
        wanted.set(notificationId(task.id), { at, text: task.text, taskId: task.id });
      });
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

    try {
      await plugin().schedule({
        notifications: [...wanted.entries()].map(([id, item]) => ({
          id,
          title: "Пиксельный календарь",
          body: item.text,
          schedule: { at: item.at, allowWhileIdle: true },
          extra: { taskId: item.taskId }
        }))
      });
    } catch (error) {
      // разрешение могли отозвать между проверкой и планированием
    }
  }

  let debounceTimer = 0;
  let latestTasks = null;

  // Частые сохранения (правка, синк, отметки) не должны дёргать плагин каждый раз.
  function schedule(tasks, delay) {
    latestTasks = tasks || {};
    if (!isNative() || !plugin()) return;
    if (typeof setTimeout !== "function") return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      resyncAll(latestTasks);
    }, typeof delay === "number" ? delay : 800);
  }

  const api = { isNative, notificationId, whenFor, ensurePermission, cancel, resyncAll, schedule };
  if (scope) scope.PixelNotify = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
