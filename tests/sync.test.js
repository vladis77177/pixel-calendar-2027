const test = require("node:test");
const assert = require("node:assert/strict");
const { migrateState, mergeStates } = require("../sync.js");

function task(overrides) {
  return {
    id: "t1",
    text: "Задача",
    done: false,
    createdAt: 100,
    updatedAt: 100,
    deletedAt: null,
    time: null,
    remindAt: null,
    ...overrides
  };
}

function state(tasks, series, settings) {
  return {
    version: 4,
    view: "month",
    tasks: tasks || {},
    series: series || [],
    settings: {
      showHolidays: true,
      profile: "auto",
      density: "comfortable",
      motion: "auto",
      dialogAnimation: "auto",
      decor: true,
      sky: "auto",
      holiday: "auto",
      weekStart: 1,
      morningDigest: false,
      updatedAt: 0,
      ...(settings || {})
    }
  };
}

test("миграция v2: метки времени, могилы и новые поля", () => {
  const migrated = migrateState({
    version: 2,
    view: "week",
    tasks: {
      "2026-11-10": [{ id: "a", text: "Полить цветы", done: true, createdAt: 111, snoozedUntil: 555 }],
      "not-a-date": [{ id: "bad", text: "Мусор", createdAt: 1 }]
    },
    series: [{
      id: "s",
      text: "Уборка",
      freq: "weekly",
      start: "2026-11-10",
      time: "10:15",
      createdAt: 222,
      exceptions: {
        "2026-11-17": { done: true },
        "2026-11-24": { deleted: true },
        "2026-11-25": { snoozedUntil: 777 }
      }
    }],
    settings: { showHolidays: false }
  });

  assert.equal(migrated.version, 4);
  assert.equal(migrated.view, "week");
  assert.deepEqual(Object.keys(migrated.tasks), ["2026-11-10"]);

  const item = migrated.tasks["2026-11-10"][0];
  assert.equal(item.updatedAt, 111);
  assert.equal(item.deletedAt, null);
  assert.equal(item.time, null);
  assert.equal(item.remindAt, null);
  assert.equal(item.snoozedUntil, 555);

  const series = migrated.series[0];
  assert.equal(series.updatedAt, 222);
  assert.equal(series.deletedAt, null);
  assert.equal(series.time, "10:15");
  assert.equal(series.exceptions["2026-11-17"].updatedAt, 222);
  assert.equal(series.exceptions["2026-11-17"].done, true);
  assert.equal(series.exceptions["2026-11-24"].deleted, true);
  assert.equal(series.exceptions["2026-11-25"].snoozedUntil, 777);
  assert.equal(migrated.settings.updatedAt, 0);
});

test("миграция сохраняет time/remindAt и отбрасывает некорректное время", () => {
  const migrated = migrateState({
    tasks: {
      "2026-11-10": [
        task({ id: "a", time: "09:30", remindAt: 5000 }),
        task({ id: "b", time: "25:00", remindAt: -3 })
      ]
    }
  });
  assert.equal(migrated.tasks["2026-11-10"][0].time, "09:30");
  assert.equal(migrated.tasks["2026-11-10"][0].remindAt, 5000);
  assert.equal(migrated.tasks["2026-11-10"][1].time, null);
  assert.equal(migrated.tasks["2026-11-10"][1].remindAt, null);
});

test("LWW: побеждает более поздняя правка задачи", () => {
  const local = state({ "2026-11-10": [task({ text: "Старое", updatedAt: 100 })] });
  const remote = state({ "2026-11-10": [task({ text: "Новое", updatedAt: 200 })] });
  const merged = mergeStates(local, remote);
  assert.equal(merged.tasks["2026-11-10"][0].text, "Новое");

  const reverse = mergeStates(remote, local);
  assert.equal(reverse.tasks["2026-11-10"][0].text, "Новое");
});

test("удаление против правки: могила новее — запись удалена", () => {
  const local = state({ "2026-11-10": [task({ deletedAt: 300, updatedAt: 300 })] });
  const remote = state({ "2026-11-10": [task({ text: "Правка", updatedAt: 200 })] });
  const merged = mergeStates(local, remote);
  assert.equal(merged.tasks["2026-11-10"][0].deletedAt, 300);
});

test("удаление против правки: правка новее — запись возвращается", () => {
  const local = state({ "2026-11-10": [task({ deletedAt: 300, updatedAt: 300 })] });
  const remote = state({ "2026-11-10": [task({ text: "Вернул", deletedAt: 200, updatedAt: 400 })] });
  const merged = mergeStates(local, remote);
  assert.equal(merged.tasks["2026-11-10"][0].deletedAt, null);
  assert.equal(merged.tasks["2026-11-10"][0].text, "Вернул");
});

test("перенос задачи: одна запись, дата выбирается по updatedAt", () => {
  const local = state({ "2026-11-10": [task({ updatedAt: 100 })] });
  const remote = state({ "2026-11-11": [task({ updatedAt: 200 })] });
  const merged = mergeStates(local, remote);
  assert.equal(Object.keys(merged.tasks).length, 1);
  assert.ok(merged.tasks["2026-11-11"]);
  assert.equal(merged.tasks["2026-11-11"][0].id, "t1");
});

test("исключения серии сливаются по каждому дню", () => {
  const local = state({}, [{
    id: "s", text: "Зарядка", freq: "daily", start: "2026-11-10",
    createdAt: 10, updatedAt: 10, deletedAt: null,
    exceptions: {
      "2026-11-11": { done: true, updatedAt: 100 },
      "2026-11-12": { done: true, updatedAt: 100 }
    }
  }]);
  const remote = state({}, [{
    id: "s", text: "Зарядка", freq: "daily", start: "2026-11-10",
    createdAt: 10, updatedAt: 20, deletedAt: null,
    exceptions: {
      "2026-11-11": { deleted: true, updatedAt: 200 },
      "2026-11-12": { updatedAt: 300 }
    }
  }]);
  const merged = mergeStates(local, remote);
  const series = merged.series[0];
  assert.equal(series.exceptions["2026-11-11"].deleted, true);
  assert.equal(series.exceptions["2026-11-12"].done, undefined);
  assert.equal(series.exceptions["2026-11-12"].updatedAt, 300);
});

test("настройки сливаются блоком по settings.updatedAt", () => {
  const local = state({}, [], { showHolidays: true, updatedAt: 100 });
  const remote = state({}, [], { showHolidays: false, updatedAt: 200 });
  assert.equal(mergeStates(local, remote).settings.showHolidays, false);
  assert.equal(mergeStates(remote, local).settings.showHolidays, false);

  const newerLocal = state({}, [], { showHolidays: true, updatedAt: 300 });
  assert.equal(mergeStates(newerLocal, remote).settings.showHolidays, true);
});

test("слияние идемпотентно и не зависит от порядка одинаковых данных", () => {
  const a = state({
    "2026-11-10": [task({ text: "A", updatedAt: 100 })]
  }, [{
    id: "s", text: "Серия", freq: "weekly", start: "2026-11-10",
    createdAt: 10, updatedAt: 10, deletedAt: null, exceptions: {}
  }], { updatedAt: 50 });
  const b = state({
    "2026-11-10": [task({ text: "B", updatedAt: 200 })]
  }, [], { updatedAt: 40 });

  const once = mergeStates(a, b);
  assert.deepEqual(mergeStates(once, b), once);
  assert.deepEqual(mergeStates(once, once), once);
  assert.deepEqual(mergeStates(a, a), { ...a });
});

test("пустые настройки сервера не обнуляют интерфейс", () => {
  const local = state({}, [], { updatedAt: 0 });
  const remote = { version: 4, view: "month", tasks: {}, series: [], settings: { updatedAt: 0 } };
  const merged = mergeStates(local, remote);
  assert.equal(merged.settings.profile, "auto");
  assert.equal(merged.settings.weekStart, 1);
  assert.equal(merged.settings.showHolidays, true);
  assert.equal(merged.settings.updatedAt, 0);

  const migrated = migrateState({ tasks: {} });
  assert.equal(migrated.settings.density, "comfortable");
});

test("пустые состояния не ломают слияние", () => {
  const empty = mergeStates(null, null);
  assert.deepEqual(empty.tasks, {});
  assert.deepEqual(empty.series, []);
  assert.equal(empty.version, 4);
});

test("миграция v3→v4 сохраняет «заранее» и чистит лишние значения", () => {
  const migrated = migrateState({
    version: 3,
    tasks: {
      "2026-11-10": [
        task({ id: "t1", leadMinutes: 60 }),
        task({ id: "t2", leadMinutes: 30 }),
        task({ id: "t3" })
      ]
    },
    series: [{
      id: "s1",
      text: "Серия",
      freq: "daily",
      start: "2026-11-10",
      time: "09:00",
      leadMinutes: 1440,
      createdAt: 1,
      updatedAt: 1,
      exceptions: {}
    }],
    settings: { morningDigest: true }
  });

  const tasks = migrated.tasks["2026-11-10"];
  assert.equal(tasks[0].leadMinutes, 60);
  assert.equal(tasks[1].leadMinutes, null);
  assert.equal(tasks[2].leadMinutes, null);
  assert.equal(migrated.series[0].leadMinutes, 1440);
  assert.equal(migrated.settings.morningDigest, true);
  assert.equal(migrateState({ tasks: {} }).settings.morningDigest, false);
});

test("слияние переносит «заранее» вместе с более новой задачей", () => {
  const local = state({
    "2026-11-10": [task({ id: "t1", updatedAt: 100, leadMinutes: 10 })]
  }, [], { updatedAt: 10 });
  const remote = state({
    "2026-11-10": [task({ id: "t1", updatedAt: 200, leadMinutes: 60 })]
  }, [], { updatedAt: 10 });

  const merged = mergeStates(local, remote);
  assert.equal(merged.tasks["2026-11-10"][0].leadMinutes, 60);
});
