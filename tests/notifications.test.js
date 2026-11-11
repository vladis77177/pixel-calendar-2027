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
