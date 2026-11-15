const test = require("node:test");
const assert = require("node:assert/strict");
const notify = require("../notifications.js");

test("id уведомления стабилен и попадает в диапазон Android", () => {
  const first = notify.notificationId("task-123");
  assert.equal(first, notify.notificationId("task-123"));
  assert.notEqual(first, notify.notificationId("task-124"));
  assert.ok(first >= 1 && first <= notify.MAX_NOTIFICATION_ID);
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
  assert.ok(map.has(notify.notificationId(notify.taskKey("t1", "2027-01-04"))));
  assert.equal(map.has(notify.notificationId(notify.taskKey("t2", "2027-01-04"))), false);
  assert.equal(map.has(notify.notificationId(notify.taskKey("t3", "2027-01-04"))), false);

  const first = map.get(notify.notificationId(notify.seriesKey("s1", "2027-01-04")));
  assert.equal(first.seriesId, "s1");
  assert.equal(first.text, "Полить цветы");
  assert.equal(first.date, "2027-01-04");
  assert.equal(first.at.getHours(), 9);
  assert.equal(first.at.getMinutes(), 30);
  assert.equal(map.has(notify.notificationId(notify.seriesKey("s1", "2027-01-05"))), false);
  assert.equal(map.has(notify.notificationId(notify.seriesKey("s1", "2027-01-06"))), false);
  assert.equal(map.has(notify.notificationId(notify.seriesKey("s1", "2027-01-10"))), true);
  assert.equal(map.has(notify.notificationId(notify.seriesKey("s2", "2027-01-04"))), false);
});

test("планировщик отправляет серии в плагин и убирает лишние", async () => {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const scheduled = [];
  const cancelled = [];
  const registered = [];
  let actionHandler = null;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      LocalNotifications: {
        getPending: async () => ({ notifications: [{ id: 999 }] }),
        cancel: async (payload) => { cancelled.push(...payload.notifications); },
        checkPermissions: async () => ({ display: "granted" }),
        registerActionTypes: async (payload) => { registered.push(payload); },
        addListener: (name, handler) => { actionHandler = handler; return Promise.resolve({ remove() {} }); },
        schedule: async (payload) => { scheduled.push(...payload.notifications); }
      }
    }
  };

  try {
    notify.addActionListener((event) => { actionHandler = event; });
    assert.ok(actionHandler);
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
    assert.ok(scheduled.every((item) => item.actionTypeId === "calendar-task"));
    assert.ok(scheduled.every((item) => item.smallIcon === "ic_stat_calendar"));
    assert.ok(scheduled.every((item) => item.iconColor === "#5FB947"));
    assert.ok(scheduled.every((item) => item.schedule.allowWhileIdle === true));
    assert.equal(scheduled[0].body, "Полить цветы");
    assert.equal(registered.length, 1);
    assert.equal(registered[0].types[0].id, "calendar-task");
    assert.deepEqual(registered[0].types[0].actions.map((item) => item.id), ["done", "snooze"]);
    assert.ok(cancelled.some((item) => item.id === 999));
  } finally {
    delete globalThis.Capacitor;
  }
});

test("годовая серия получает напоминание за пределами 60 дней", () => {
  const now = new Date(2026, 10, 11, 12, 0, 0);
  const map = notify.collectReminders({}, [{
    id: "s1",
    text: "Продлить страховку",
    freq: "yearly",
    start: "2026-06-01",
    end: null,
    time: "10:00",
    deletedAt: null,
    exceptions: {}
  }], now);

  assert.equal(map.size, 1);
  const item = map.get(notify.notificationId(notify.seriesKey("s1", "2027-06-01")));
  assert.ok(item, "годовое напоминание должно планироваться заранее");
  assert.equal(item.at.getFullYear(), 2027);
  assert.equal(item.at.getMonth(), 5);
  assert.equal(item.at.getDate(), 1);
});

test("дневная серия планирует окно и одно вхождение после него", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const map = notify.collectReminders({}, [{
    id: "s1",
    text: "Зарядка",
    freq: "daily",
    start: "2026-11-11",
    end: null,
    time: "09:30",
    deletedAt: null,
    exceptions: {}
  }], now);

  assert.equal(map.size, notify.SERIES_HORIZON_DAYS + 2);
  assert.ok(map.has(notify.notificationId(notify.seriesKey("s1", "2026-11-11"))));
  assert.ok(map.has(notify.notificationId(notify.seriesKey("s1", "2027-01-10"))));
  assert.ok(map.has(notify.notificationId(notify.seriesKey("s1", "2027-01-11"))), "ближайшее вхождение за окном");
});

test("при переполнении у каждой серии остаётся напоминание", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const series = Array.from({ length: 6 }, (_, index) => ({
    id: `s${index}`,
    text: `Дело ${index}`,
    freq: "daily",
    start: "2026-11-11",
    end: null,
    time: "09:30",
    deletedAt: null,
    exceptions: {}
  }));
  const map = notify.collectReminders({}, series, now);
  assert.equal(map.size, notify.MAX_NOTIFICATIONS);
  for (let index = 0; index < series.length; index += 1) {
    assert.ok(
      [...map.values()].some((item) => item.seriesId === `s${index}`),
      `серия s${index} не должна исчезнуть`
    );
  }
});

test("отложенная задача сдвигает напоминание", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const until = new Date(2026, 10, 11, 10, 0, 0).getTime();
  const map = notify.collectReminders({
    "2026-11-11": [{ id: "t1", text: "Позвонить", time: "09:30", snoozedUntil: until }]
  }, [], now);
  const item = map.get(notify.notificationId(notify.taskKey("t1", "2026-11-11")));
  assert.ok(item);
  assert.equal(item.at.getTime(), until);
});

test("отложенный день серии сдвигает напоминание", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const until = new Date(2026, 10, 11, 10, 0, 0).getTime();
  const map = notify.collectReminders({}, [{
    id: "s1",
    text: "Полить цветы",
    freq: "daily",
    start: "2026-11-11",
    end: "2026-11-12",
    time: "09:30",
    deletedAt: null,
    exceptions: { "2026-11-11": { snoozedUntil: until, updatedAt: 1 } }
  }], now);
  const item = map.get(notify.notificationId(notify.seriesKey("s1", "2026-11-11")));
  assert.ok(item);
  assert.equal(item.at.getTime(), until);
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

test("заранее сдвигает напоминание и называет реальное время", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const map = notify.collectReminders({
    "2026-11-11": [{ id: "t1", text: "Позвонить", time: "10:00", leadMinutes: 10 }]
  }, [], now);

  const item = map.get(notify.notificationId(notify.taskKey("t1", "2026-11-11")));
  assert.ok(item);
  assert.equal(item.at.getHours(), 9);
  assert.equal(item.at.getMinutes(), 50);
  assert.equal(item.text, "За 10 мин · 10:00 Позвонить");
});

test("если заранее уже прошло, напоминаем в срок", () => {
  const now = new Date(2026, 10, 11, 9, 55, 0);
  const map = notify.collectReminders({
    "2026-11-11": [{ id: "t1", text: "Позвонить", time: "10:00", leadMinutes: 10 }]
  }, [], now);

  const item = map.get(notify.notificationId(notify.taskKey("t1", "2026-11-11")));
  assert.ok(item);
  assert.equal(item.at.getHours(), 10);
  assert.equal(item.at.getMinutes(), 0);
});

test("отложенное важнее заблаговременного напоминания", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const until = new Date(2026, 10, 11, 10, 0, 0).getTime();
  const map = notify.collectReminders({
    "2026-11-11": [{
      id: "t1",
      text: "Позвонить",
      time: "09:30",
      leadMinutes: 60,
      snoozedUntil: until
    }]
  }, [], now);

  const item = map.get(notify.notificationId(notify.taskKey("t1", "2026-11-11")));
  assert.ok(item);
  assert.equal(item.at.getTime(), until);
  assert.equal(item.text, "Отложено · 09:30 Позвонить");
});

test("серия напоминает заранее в каждый подходящий день", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const map = notify.collectReminders({}, [{
    id: "s1",
    text: "Полить цветы",
    freq: "daily",
    start: "2026-11-11",
    end: "2026-11-11",
    time: "09:30",
    leadMinutes: 60,
    deletedAt: null,
    exceptions: {}
  }], now);

  const item = map.get(notify.notificationId(notify.seriesKey("s1", "2026-11-11")));
  assert.ok(item);
  assert.equal(item.at.getHours(), 8);
  assert.equal(item.at.getMinutes(), 30);
  assert.equal(item.text, "За час · 09:30 Полить цветы");
});

test("утренняя сводка молчит, пока её не включили", () => {
  const now = new Date(2026, 10, 11, 7, 0, 0);
  const tasks = { "2026-11-11": [{ id: "t1", text: "Позвонить" }] };
  assert.equal(notify.collectDigest(tasks, [], now, { morningDigest: false }).size, 0);
  assert.equal(notify.collectDigest(tasks, [], now, null).size, 0);
});

test("утренняя сводка собирает дела и пропускает пустые дни", () => {
  const now = new Date(2026, 10, 11, 7, 0, 0);
  const tasks = {
    "2026-11-11": [
      { id: "t1", text: "Позвонить" },
      { id: "t2", text: "Сделано", done: true }
    ],
    "2026-11-12": [{ id: "t3", text: "Купить хлеб" }]
  };
  const map = notify.collectDigest(tasks, [], now, { morningDigest: true });

  assert.equal(map.size, 2);
  const first = map.get(notify.notificationId("digest@2026-11-11"));
  assert.ok(first);
  assert.equal(first.title, "Утренняя сводка");
  assert.equal(first.at.getHours(), 8);
  assert.equal(first.text, "Дел: 1 дело · Позвонить");
  assert.equal(map.has(notify.notificationId("digest@2026-11-13")), false);
});

test("время сводки берётся из настроек, мусор — к 08:00", () => {
  const now = new Date(2026, 10, 11, 7, 0, 0);
  const tasks = { "2026-11-11": [{ id: "t1", text: "Позвонить" }] };

  const early = notify.collectDigest(tasks, [], now, { morningDigest: true, digestTime: "07:30" });
  const item = early.get(notify.notificationId("digest@2026-11-11"));
  assert.ok(item);
  assert.equal(item.at.getHours(), 7);
  assert.equal(item.at.getMinutes(), 30);

  assert.equal(notify.digestTime({ digestTime: "06:05" }), "06:05");
  assert.equal(notify.digestTime({ digestTime: "25:00" }), "08:00");
  assert.equal(notify.digestTime({ digestTime: 730 }), "08:00");
  assert.equal(notify.digestTime({}), "08:00");
  assert.equal(notify.digestTime(null), "08:00");
});

test("200 разных ключей дают 200 разных id в диапазоне Android", () => {
  const keys = Array.from({ length: 200 }, (_, index) => notify.taskKey(`task-${index}`, "2027-01-05"));
  const ids = notify.assignNotificationIds(keys);
  assert.equal(ids.size, 200);
  const values = [...ids.values()];
  assert.equal(new Set(values).size, 200);
  values.forEach((id) => {
    assert.ok(Number.isInteger(id) && id >= 1 && id <= notify.MAX_NOTIFICATION_ID);
  });
});

test("id стабильны между прогонами и не зависят от порядка ключей", () => {
  const keys = Array.from({ length: 120 }, (_, index) => `task:task-${index}@2027-02-0${index % 9}`);
  const first = notify.assignNotificationIds(keys);
  const again = notify.assignNotificationIds(keys);
  const reversed = notify.assignNotificationIds([...keys].reverse());
  keys.forEach((key) => {
    assert.equal(again.get(key), first.get(key));
    assert.equal(reversed.get(key), first.get(key));
  });
});

test("совпавший хеш разводится до свободного id", () => {
  const first = "t2h3px9un9";
  const second = "tn3fxhni";
  assert.equal(notify.notificationId(first), notify.notificationId(second));
  const ids = notify.assignNotificationIds([second, first]);
  assert.equal(ids.get(first), notify.notificationId(first));
  assert.equal(ids.get(second), notify.notificationId(first) + 1);
});

test("повтор id задачи на разных датах даёт разные уведомления", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const map = notify.collectReminders({
    "2026-11-11": [{ id: "t1", text: "Позвонить", time: "10:00" }],
    "2026-11-12": [{ id: "t1", text: "Позвонить", time: "10:00" }]
  }, [], now);

  assert.equal(map.size, 2);
  const firstId = notify.notificationId(notify.taskKey("t1", "2026-11-11"));
  const secondId = notify.notificationId(notify.taskKey("t1", "2026-11-12"));
  assert.notEqual(firstId, secondId);
  assert.equal(map.get(firstId).date, "2026-11-11");
  assert.equal(map.get(secondId).date, "2026-11-12");
});

test("серия и задача с одним id в один день не затирают друг друга", () => {
  const now = new Date(2026, 10, 11, 8, 0, 0);
  const map = notify.collectAll({
    "2026-11-11": [{ id: "s1", text: "Позвонить", time: "09:30" }]
  }, [{
    id: "s1",
    text: "Зарядка",
    freq: "daily",
    start: "2026-11-11",
    end: "2026-11-11",
    time: "09:30",
    deletedAt: null,
    exceptions: {}
  }], now, null);

  const idOf = (key) => [...map.entries()].find(([, item]) => item.key === key)[0];
  const taskId = idOf(notify.taskKey("s1", "2026-11-11"));
  const occurrenceId = idOf(notify.seriesKey("s1", "2026-11-11"));
  assert.notEqual(taskId, occurrenceId);
  assert.equal(map.get(taskId).text, "Позвонить");
  assert.equal(map.get(occurrenceId).text, "Зарядка");
});

test("сводка и задача в 08:00 получают разные id", () => {
  const now = new Date(2026, 10, 11, 7, 0, 0);
  const map = notify.collectAll(
    { "2026-11-11": [{ id: "t1", text: "Позвонить", time: "08:00" }] },
    [],
    now,
    { morningDigest: true }
  );

  const idOf = (key) => [...map.entries()].find(([, item]) => item.key === key)[0];
  const taskId = idOf(notify.taskKey("t1", "2026-11-11"));
  const digestId = idOf(notify.digestKey("2026-11-11"));
  assert.notEqual(taskId, digestId);
  assert.equal(map.get(taskId).at.getHours(), 8);
  assert.equal(map.get(digestId).at.getHours(), 8);
  assert.equal(map.get(digestId).digest, true);
});

test("cancel снимает id, который запланировал планировщик", async () => {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const scheduled = [];
  const cancelled = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      LocalNotifications: {
        getPending: async () => ({ notifications: [] }),
        cancel: async (payload) => { cancelled.push(...payload.notifications); },
        checkPermissions: async () => ({ display: "granted" }),
        registerActionTypes: async () => {},
        schedule: async (payload) => { scheduled.push(...payload.notifications); }
      }
    }
  };

  try {
    await notify.resyncAll({ [iso]: [{ id: "t1", text: "Позвонить", time: "00:01" }] }, []);
    const planned = scheduled.filter((item) => item.extra.taskId === "t1");
    assert.equal(planned.length, 1);
    assert.equal(planned[0].id, notify.notificationId(notify.taskKey("t1", iso)));

    await notify.cancel("t1");
    assert.ok(cancelled.some((item) => item.id === planned[0].id));
  } finally {
    delete globalThis.Capacitor;
  }
});
