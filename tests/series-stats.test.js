// Тесты статистики серий: серия отметок подряд и история по дням.
const test = require("node:test");
const assert = require("node:assert/strict");
const stats = require("../series-stats.js");

// Правило повтора подменяем простым: серия идёт каждый день от start до end.
function dailyActive(series, iso) {
  if (iso < series.start) return false;
  if (series.end && iso > series.end) return false;
  return true;
}

function seriesOf(exceptions, extra) {
  return Object.assign({ start: "2026-11-01", end: null, exceptions }, extra || {});
}

test("считает серию отметок подряд до сегодня", () => {
  const series = seriesOf({
    "2026-11-01": { done: true },
    "2026-11-02": { done: true },
    "2026-11-03": { done: true }
  });
  const result = stats.summarize(series, "2026-11-03", dailyActive);
  assert.equal(result.current, 3);
  assert.equal(result.best, 3);
  assert.equal(result.total, 3);
  assert.equal(result.done, 3);
});

test("незакрытый сегодняшний день не рвёт и не считает серию", () => {
  const series = seriesOf({ "2026-11-02": { done: true } }, { start: "2026-11-02" });
  const result = stats.summarize(series, "2026-11-03", dailyActive);
  assert.equal(result.current, 1, "вчера сделано, сегодня ещё нет");
  assert.equal(result.total, 1);
});

test("пропущенный день обрывает текущую серию, лучшая сохраняется", () => {
  const series = seriesOf({
    "2026-11-01": { done: true },
    "2026-11-02": { done: true },
    "2026-11-03": { done: true },
    "2026-11-04": { updatedAt: 1 },
    "2026-11-05": { done: true }
  });
  const result = stats.summarize(series, "2026-11-05", dailyActive);
  assert.equal(result.best, 3);
  assert.equal(result.current, 1);
  assert.equal(result.total, 5);
  assert.equal(result.done, 4);
});

test("удалённый день не считается ни пропуском, ни отметкой", () => {
  const series = seriesOf({
    "2026-11-01": { done: true },
    "2026-11-02": { deleted: true },
    "2026-11-03": { done: true }
  });
  const result = stats.summarize(series, "2026-11-03", dailyActive);
  assert.equal(result.current, 2);
  assert.equal(result.total, 2);
  assert.equal(result.done, 2);
});

test("серия без отметок даёт нули, но считает прошедшие дни", () => {
  const result = stats.summarize(seriesOf({}), "2026-11-10", dailyActive);
  // 1–9 ноября уже прошли и остались без отметок, сегодняшний не считается.
  assert.deepEqual(
    { current: result.current, best: result.best, total: result.total, done: result.done },
    { current: 0, best: 0, total: 9, done: 0 }
  );
});

test("история содержит нужное число клеток и верные состояния", () => {
  const series = seriesOf({
    "2026-11-09": { done: true },
    "2026-11-08": { deleted: true }
  });
  const cells = stats.history(series, "2026-11-10", dailyActive, 4);
  assert.deepEqual(cells.map((cell) => cell.iso), ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"]);
  assert.deepEqual(cells.map((cell) => cell.state), ["missed", "skipped", "done", "pending"]);
});

test("история учитывает выходные для будничной серии", () => {
  const weekdaysOnly = (series, iso) => {
    if (iso < series.start) return false;
    const day = new Date(iso.slice(0, 4), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).getDay();
    return day >= 1 && day <= 5;
  };
  const series = seriesOf({}, { start: "2026-11-01" });
  const cells = stats.history(series, "2026-11-08", weekdaysOnly, 7);
  // 2–6 ноября 2026 — будни и уже прошли, 7–8 — выходные.
  assert.deepEqual(cells.map((cell) => cell.state), [
    "missed", "missed", "missed", "missed", "missed", "none", "none"
  ]);
});

test("серия с окончанием в прошлом считается до конца", () => {
  const series = seriesOf(
    { "2026-11-01": { done: true }, "2026-11-02": { done: true } },
    { end: "2026-11-02" }
  );
  const result = stats.summarize(series, "2026-11-20", dailyActive);
  assert.equal(result.current, 2);
  assert.equal(result.total, 2);
  assert.equal(result.last, "2026-11-02");
});

test("очень длинная серия ограничена предохранителем", () => {
  const series = seriesOf({}, { start: "2000-01-01" });
  const result = stats.summarize(series, "2026-11-10", dailyActive);
  // Сегодняшний день не учитывается — он ещё не закончился.
  assert.equal(result.total, 1499);
  assert.equal(result.first, "2022-10-03");
});
