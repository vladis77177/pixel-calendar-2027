const test = require("node:test");
const assert = require("node:assert/strict");
const notify = require("../notifications.js");

test("id уведомления стабилен и попадает в диапазон Android", () => {
  const first = notify.notificationId("task-123");
  assert.equal(first, notify.notificationId("task-123"));
  assert.notEqual(first, notify.notificationId("task-124"));
  assert.ok(first >= 1 && first <= 2000000000);
  assert.equal(notify.notificationId(""), 1);
});

test("время напоминания собирается из даты и HH:MM", () => {
  const at = notify.whenFor("2027-01-15", "09:30");
  assert.ok(at instanceof Date);
  assert.equal(at.getFullYear(), 2027);
  assert.equal(at.getMonth(), 0);
  assert.equal(at.getDate(), 15);
  assert.equal(at.getHours(), 9);
  assert.equal(at.getMinutes(), 30);
  assert.equal(notify.whenFor("2027-01-15", ""), null);
  assert.equal(notify.whenFor("", "09:30"), null);
  assert.equal(notify.whenFor("не дата", "09:30"), null);
});

test("в браузере и Node.js модуль молчит", async () => {
  assert.equal(notify.isNative(), false);
  assert.equal(await notify.ensurePermission(), false);
  await notify.cancel("task-1");
  await notify.resyncAll({ "2027-01-15": [{ id: "task-1", text: "Дело", time: "09:30" }] });
  assert.equal(notify.schedule({}), undefined);
});

test("обычные задачи и серии дают будущие напоминания", () => {
  const now = new Date(2027, 0, 4, 8, 0, 0);
  const tasks = {
    "2027-01-04": [
      { id: "t1", text: "Позвонить", time: "10:00", done: false },
      { id: "t2", text: "Выполнено", time: "10:00", done: true },
      { id: "t3", text: "Удалено", time: "10:00", deletedAt: 5 }
    ]
  };
  const series = [{
    id: "s1",
    text: "Полить цветы",
    freq: "daily",
    start: "2027-01-01",
    end: "2027-01-10",
    time: "09:30",
    deletedAt: null,
    exceptions: {
      "2027-01-05": { done: true, updatedAt: 1 },
      "2027-01-06": { deleted: true, updatedAt: 1 }
    }
  }, {
    id: "s2",
    text: "Без времени",
    freq: "daily",
    start: "2027-01-01",
    time: null,
    exceptions: {}
  }];

  const map = notify.collectReminders(tasks, series, now);
  assert.equal(map.size, 6);
  assert.ok(map.has(notify.notificationId("t1")));
  assert.equal(map.has(notify.notificationId("t2")), false);
  assert.equal(map.has(notify.notificationId("t3")), false);

  const first = map.get(notify.notificationId("s1@2027-01-04"));
  assert.equal(first.seriesId, "s1");
  assert.equal(first.text, "Полить цветы");
  assert.equal(first.date, "2027-01-04");
  assert.equal(first.at.getHours(), 9);
  assert.equal(first.at.getMinutes(), 30);
  assert.equal(map.has(notify.notificationId("s1@2027-01-05")), false);
  assert.equal(map.has(notify.notificationId("s1@2027-01-06")), false);
  assert.equal(map.has(notify.notificationId("s1@2027-01-10")), true);
  assert.equal(map.has(notify.notificationId("s2@2027-01-04")), false);
});

test("планировщик отправляет серии в плагин и убирает лишние", async () => {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const scheduled = [];
  const cancelled = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      LocalNotifications: {
        getPending: async () => ({ notifications: [{ id: 999 }] }),
        cancel: async (payload) => { cancelled.push(...payload.notifications); },
        checkPermissions: async () => ({ display: "granted" }),
        schedule: async (payload) => { scheduled.push(...payload.notifications); }
      }
    }
  };

  try {
    await notify.resyncAll({}, [{
      id: "s1",
      text: "Полить цветы",
      freq: "daily",
      start: iso,
      end: null,
      time: "00:01",
      deletedAt: null,
      exceptions: {}
    }]);
    assert.ok(scheduled.length > 0);
    assert.ok(scheduled.every((item) => item.extra.seriesId === "s1"));
    assert.ok(scheduled.every((item) => item.schedule.allowWhileIdle === true));
    assert.equal(scheduled[0].body, "Полить цветы");
    assert.ok(cancelled.some((item) => item.id === 999));
  } finally {
    delete globalThis.Capacitor;
  }
});

test("правила повторения в напоминаниях совпадают с календарём", () => {
  const base = { start: "2026-11-10", deletedAt: null, exceptions: {}, time: "09:00" };
  assert.equal(notify.seriesActiveOn({ ...base, freq: "weekdays" }, "2026-11-14"), false);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "weekdays" }, "2026-11-13"), true);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "weekly" }, "2026-11-17"), true);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "weekly" }, "2026-11-18"), false);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "monthly" }, "2026-12-10"), true);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "yearly" }, "2027-11-10"), true);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "daily", exceptions: { "2026-11-11": { deleted: true } } }, "2026-11-11"), false);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "daily", deletedAt: 1 }, "2026-11-11"), false);
  assert.equal(notify.seriesActiveOn({ ...base, freq: "daily", end: "2026-11-10" }, "2026-11-11"), false);
});
