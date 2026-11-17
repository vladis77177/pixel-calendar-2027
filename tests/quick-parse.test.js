// Естественный ввод: разбор строки быстрого добавления без AI и внешних API.
// Тесты фиксируют «сегодня» = 16 ноября 2026 (понедельник), чтобы не зависеть от дня запуска.
const test = require("node:test");
const assert = require("node:assert");
const core = require("../core.js");

const TODAY = new Date(2026, 10, 16);
const parse = (input) => core.parseQuickInput(input, TODAY);

test("дата и время вместе", () => {
  assert.deepStrictEqual(parse("завтра в 15:00 позвонить маме"), {
    date: "2026-11-17", time: "15:00", text: "позвонить маме"
  });
});

test("только время — дата не выдумывается", () => {
  const result = parse("в 15:00 позвонить маме");
  assert.strictEqual(result.date, null);
  assert.strictEqual(result.time, "15:00");
  assert.strictEqual(result.text, "позвонить маме");
});

test("только дата — время пустое", () => {
  assert.deepStrictEqual(parse("завтра купить хлеб"), {
    date: "2026-11-17", time: null, text: "купить хлеб"
  });
});

test("сегодня и послезавтра", () => {
  assert.strictEqual(parse("сегодня зал").date, "2026-11-16");
  assert.strictEqual(parse("послезавтра зал").date, "2026-11-18");
});

test("вчера уезжает назад", () => {
  assert.strictEqual(parse("вчера отчёт").date, "2026-11-15");
});

test("через N дней", () => {
  assert.strictEqual(parse("через 3 дня отчёт").date, "2026-11-19");
  assert.strictEqual(parse("через 1 день отчёт").date, "2026-11-17");
  assert.strictEqual(parse("через 10 дней отчёт").date, "2026-11-26");
});

test("через неделю", () => {
  assert.strictEqual(parse("через неделю отчёт").date, "2026-11-23");
});

test("дни недели — ближайший в будущем", () => {
  assert.strictEqual(parse("в пятницу зал").date, "2026-11-20");
  assert.strictEqual(parse("в субботу уборка").date, "2026-11-21");
  assert.strictEqual(parse("в воскресенье отдых").date, "2026-11-22");
});

test("сегодняшний день недели — через 7 дней", () => {
  assert.strictEqual(parse("в понедельник планёрка").date, "2026-11-23");
});

test("сокращения дней недели", () => {
  assert.strictEqual(parse("в пн планёрка").date, "2026-11-23");
  assert.strictEqual(parse("в ср созвон").date, "2026-11-18");
  assert.strictEqual(parse("в сб уборка").date, "2026-11-21");
});

test("день недели с временем", () => {
  assert.deepStrictEqual(parse("в пятницу 9 утра зал"), {
    date: "2026-11-20", time: "09:00", text: "зал"
  });
});

test("дата числами", () => {
  assert.strictEqual(parse("12.12 корпоратив").date, "2026-12-12");
  assert.strictEqual(parse("12/12 корпоратив").date, "2026-12-12");
});

test("дата числами с годом", () => {
  assert.strictEqual(parse("12.12.2027 корпоратив").date, "2027-12-12");
});

test("прошедшая дата без года уезжает на следующий год", () => {
  assert.strictEqual(parse("1 января отчёт").date, "2027-01-01");
});

test("12.12.12 датой не считается", () => {
  const result = parse("12.12.12 отчёт");
  assert.strictEqual(result.date, null);
  assert.ok(result.text.includes("12.12.12"));
});

test("дата словом", () => {
  assert.strictEqual(parse("12 декабря корпоратив").date, "2026-12-12");
  assert.strictEqual(parse("12 декабря 2027 корпоратив").date, "2027-12-12");
});

test("29 февраля — только в високосный год", () => {
  assert.strictEqual(parse("29 февраля 2028 отчёт").date, "2028-02-29");
  const notLeap = parse("29 февраля 2027 отчёт");
  assert.strictEqual(notLeap.date, null);
  assert.ok(notLeap.text.includes("29"));
});

test("время утра, дня, вечера, ночи", () => {
  assert.strictEqual(parse("в 9 утра зал").time, "09:00");
  assert.strictEqual(parse("3 дня зал").time, "15:00");
  assert.strictEqual(parse("8 вечера зал").time, "20:00");
  assert.strictEqual(parse("12 ночи зал").time, "00:00");
  assert.strictEqual(parse("12 дня зал").time, "12:00");
});

test("время с часами словами", () => {
  assert.strictEqual(parse("в 3 часа дня зал").time, "15:00");
});

test("полдень и полночь", () => {
  assert.strictEqual(parse("полдень обед").time, "12:00");
  assert.strictEqual(parse("полночь отбой").time, "00:00");
});

test("точка вместо двоеточия", () => {
  const result = parse("15.00 созвон");
  assert.strictEqual(result.time, "15:00");
  assert.strictEqual(result.date, null);
  assert.strictEqual(result.text, "созвон");
});

test("голый час — утренняя трактовка", () => {
  assert.strictEqual(parse("в 9 зал").time, "09:00");
});

test("числа в тексте не трогаем", () => {
  const result = parse("купить 2 яблока");
  assert.deepStrictEqual(result, { date: null, time: null, text: "купить 2 яблока" });
});

test("время вне диапазона не распознаётся", () => {
  const result = parse("25:99 отчёт");
  assert.strictEqual(result.time, null);
  assert.strictEqual(result.date, null);
});

test("пустой текст после вырезания даты", () => {
  assert.deepStrictEqual(parse("завтра"), { date: "2026-11-17", time: null, text: "" });
  assert.deepStrictEqual(parse("в 15:00"), { date: null, time: "15:00", text: "" });
});

test("пробелы и запятые чистятся", () => {
  const result = parse("  завтра,   в 15:00 ,  позвонить   маме  ");
  assert.deepStrictEqual(result, { date: "2026-11-17", time: "15:00", text: "позвонить маме" });
});

test("текст без даты и времени не меняется", () => {
  assert.deepStrictEqual(parse("позвонить маме"), {
    date: null, time: null, text: "позвонить маме"
  });
});

test("пустая строка", () => {
  assert.deepStrictEqual(core.parseQuickInput("", TODAY), { date: null, time: null, text: "" });
  assert.deepStrictEqual(core.parseQuickInput(null, TODAY), { date: null, time: null, text: "" });
});

test("регистр и ё не мешают", () => {
  assert.strictEqual(parse("ЗАВТРА В 9 УТРА зал").date, "2026-11-17");
  assert.strictEqual(parse("ЗАВТРА В 9 УТРА зал").time, "09:00");
});
