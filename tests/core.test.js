// Тесты общего домена: даты, склонения и правило повтора серий.
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../core.js");

function seriesOf(start, freq, extra) {
  return Object.assign({ start, end: null, freq, exceptions: {} }, extra || {});
}

test("daily идёт от даты старта", () => {
  const series = seriesOf("2027-01-10", "daily");
  assert.equal(core.isSeriesActiveOn(series, "2027-01-09"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-01-10"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-01-11"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-02-09"), true);
});

test("weekdays не срабатывает в субботу и воскресенье", () => {
  const series = seriesOf("2027-03-01", "weekdays");
  for (let i = 0; i < 14; i += 1) {
    const iso = core.addDaysIso("2027-03-01", i);
    const day = core.fromISO(iso).getDay();
    assert.equal(core.isSeriesActiveOn(series, iso), day >= 1 && day <= 5, iso);
  }
});

test("weekly срабатывает в тот же день недели", () => {
  const series = seriesOf("2027-03-01", "weekly");
  assert.equal(core.isSeriesActiveOn(series, "2027-03-08"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-03-15"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-03-04"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-03-09"), false);
});

test("monthly 15-го срабатывает в середине месяца", () => {
  const series = seriesOf("2027-01-15", "monthly");
  assert.equal(core.isSeriesActiveOn(series, "2027-02-15"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-03-15"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-02-14"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-02-16"), false);
});

test("monthly с 31-го не пропускает короткие месяцы", () => {
  const series = seriesOf("2027-01-31", "monthly");
  assert.equal(core.isSeriesActiveOn(series, "2027-02-28"), true, "февраль 2027 без 29-го");
  assert.equal(core.isSeriesActiveOn(series, "2027-02-27"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-03-31"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-03-30"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-04-30"), true, "апрель короче 31 дня");
});

test("monthly с 31-го попадает в 29 февраля високосного года", () => {
  const series = seriesOf("2027-01-31", "monthly");
  assert.equal(core.isSeriesActiveOn(series, "2028-02-29"), true);
  assert.equal(core.isSeriesActiveOn(series, "2028-02-28"), false);
});

test("yearly строго в день старта", () => {
  const series = seriesOf("2026-09-01", "yearly");
  assert.equal(core.isSeriesActiveOn(series, "2027-09-01"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-09-02"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-08-31"), false);
  assert.equal(core.isSeriesActiveOn(series, "2026-09-01"), true);
});

// Аддитивные частоты v4: «каждые N дней» и свой набор дней недели.
test("custom-days: каждые 3 дня от старта", () => {
  const series = seriesOf("2026-11-16", "custom-days", { interval: 3 });
  assert.equal(core.isSeriesActiveOn(series, "2026-11-16"), true);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-17"), false);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-18"), false);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-19"), true);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-22"), true);
  assert.equal(core.isSeriesActiveOn(series, "2026-12-16"), true, "шаг считается через границу месяца");
  assert.equal(core.isSeriesActiveOn(series, "2026-11-15"), false, "до старта серии нет");
});

test("custom-days без interval не теряется: шаг 1", () => {
  const series = seriesOf("2026-11-16", "custom-days");
  assert.equal(core.isSeriesActiveOn(series, "2026-11-16"), true);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-17"), true);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-30"), true);
});

test("custom-days: мусорный interval приводится к 1", () => {
  const series = seriesOf("2026-11-16", "custom-days", { interval: -5 });
  assert.equal(core.isSeriesActiveOn(series, "2026-11-17"), true);
});

test("custom-weekdays: пн-ср-пт", () => {
  const series = seriesOf("2026-11-16", "custom-weekdays", { days: [1, 3, 5] });
  const expected = {
    "2026-11-16": true,  // пн
    "2026-11-17": false, // вт
    "2026-11-18": true,  // ср
    "2026-11-19": false, // чт
    "2026-11-20": true,  // пт
    "2026-11-21": false, // сб
    "2026-11-22": false, // вс
    "2026-11-23": true   // следующая пн
  };
  Object.keys(expected).forEach((iso) => {
    assert.equal(core.isSeriesActiveOn(series, iso), expected[iso], iso);
  });
});

test("custom-weekdays: пустой набор дней не срабатывает", () => {
  const series = seriesOf("2026-11-16", "custom-weekdays", { days: [] });
  assert.equal(core.isSeriesActiveOn(series, "2026-11-16"), false);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-23"), false);
});

test("custom-weekdays: воскресенье — день 0", () => {
  const series = seriesOf("2026-11-16", "custom-weekdays", { days: [0] });
  assert.equal(core.isSeriesActiveOn(series, "2026-11-22"), true);
  assert.equal(core.isSeriesActiveOn(series, "2026-11-16"), false);
});

test("границы start и end включительно", () => {
  const series = seriesOf("2027-05-10", "daily", { end: "2027-05-12" });
  assert.equal(core.isSeriesActiveOn(series, "2027-05-09"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-05-10"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-05-12"), true);
  assert.equal(core.isSeriesActiveOn(series, "2027-05-13"), false);
});

test("удалённая серия не активна", () => {
  const series = seriesOf("2027-05-10", "daily", { deletedAt: 1750000000000 });
  assert.equal(core.isSeriesActiveOn(series, "2027-05-10"), false);
});

test("исключение deleted снимает день", () => {
  const series = seriesOf("2027-05-10", "daily", {
    exceptions: { "2027-05-11": { deleted: true } }
  });
  assert.equal(core.isSeriesActiveOn(series, "2027-05-11"), false);
  assert.equal(core.isSeriesActiveOn(series, "2027-05-12"), true);
});

test("plural: формы 1, 2-4, 5+ и 11-14", () => {
  const forms = ["дело", "дела", "дел"];
  assert.equal(core.plural(1, forms), "дело");
  assert.equal(core.plural(2, forms), "дела");
  assert.equal(core.plural(5, forms), "дел");
  assert.equal(core.plural(11, forms), "дел");
  assert.equal(core.plural(21, forms), "дело");
});

test("plural: оба стиля вызова дают одно и то же", () => {
  for (const n of [0, 1, 2, 4, 5, 11, 14, 21, 22, 25, 101, 111]) {
    assert.equal(
      core.plural(n, "дело", "дела", "дел"),
      core.plural(n, ["дело", "дела", "дел"]),
      String(n)
    );
  }
});

test("toISO и fromISO взаимно обратны", () => {
  for (const iso of ["2027-01-01", "2027-02-28", "2027-12-31", "2028-02-29"]) {
    assert.equal(core.toISO(core.fromISO(iso)), iso);
  }
});

test("isValidISO отбрасывает мусор", () => {
  assert.equal(core.isValidISO("2027-13-01"), false);
  assert.equal(core.isValidISO("abc"), false);
  assert.equal(core.isValidISO(null), false);
  assert.equal(core.isValidISO("2027-02-30"), false);
  assert.equal(core.isValidISO("2027-02-28"), true);
});

test("addDays переходит через границу месяца", () => {
  assert.equal(core.toISO(core.addDays(core.fromISO("2027-01-31"), 1)), "2027-02-01");
  assert.equal(core.addDaysIso("2027-01-31", 1), "2027-02-01");
  assert.equal(core.addDaysIso("2027-12-31", 1), "2028-01-01");
  assert.equal(core.addDaysIso("2027-03-01", -1), "2027-02-28");
});

test("startOfWeek от воскресенья", () => {
  assert.equal(core.fromISO("2027-02-07").getDay(), 0);
  assert.equal(core.toISO(core.startOfWeek(core.fromISO("2027-02-07"))), "2027-02-01");
  assert.equal(core.toISO(core.startOfWeek(core.fromISO("2027-02-07"), 0)), "2027-02-07");
  assert.equal(core.toISO(core.startOfWeek(core.fromISO("2027-02-03"))), "2027-02-01");
});

test("правило повтора совпадает с notifications.js", () => {
  const notify = require("../notifications.js");
  assert.equal(typeof notify.seriesActiveOn, "function");
  const series = [
    seriesOf("2027-01-31", "monthly"),
    seriesOf("2027-03-01", "weekdays"),
    seriesOf("2026-09-01", "yearly"),
    seriesOf("2027-05-10", "daily", { end: "2027-05-12" })
  ];
  for (const item of series) {
    for (let i = 0; i < 75; i += 1) {
      const iso = core.addDaysIso(item.start, i);
      assert.equal(
        notify.seriesActiveOn(item, iso),
        core.isSeriesActiveOn(item, iso),
        `${item.freq} ${iso}`
      );
    }
  }
});

test("skyPhaseFor: расписание суток", () => {
  assert.equal(core.skyPhaseFor(4.99, "auto"), "night");
  assert.equal(core.skyPhaseFor(5, "auto"), "dawn");
  assert.equal(core.skyPhaseFor(7.99, "auto"), "dawn");
  assert.equal(core.skyPhaseFor(8, "auto"), "day");
  assert.equal(core.skyPhaseFor(16.99, "auto"), "day");
  assert.equal(core.skyPhaseFor(17, "auto"), "dusk");
  assert.equal(core.skyPhaseFor(20.99, "auto"), "dusk");
  assert.equal(core.skyPhaseFor(21, "auto"), "night");
  assert.equal(core.skyPhaseFor(0, "auto"), "night");
});

test("skyPhaseFor: фиксированная тема сильнее времени", () => {
  assert.equal(core.skyPhaseFor(12, "night"), "night");
  assert.equal(core.skyPhaseFor(23, "day"), "day");
  assert.equal(core.skyPhaseFor(12, "dusk"), "dusk");
  assert.equal(core.skyPhaseFor(12, "мусор"), "day");
  assert.equal(core.skyPhaseFor(NaN, "auto"), "day");
});

test("phraseForDay: фраза постоянна в течение дня и меняется в полночь", () => {
  const phrases = core.FOOTER_PHRASES;
  assert.ok(phrases.length >= 2);
  assert.equal(core.phraseForDay("2027-05-04"), core.phraseForDay("2027-05-04"));
  assert.ok(phrases.includes(core.phraseForDay("2027-05-04")));
  assert.notEqual(core.phraseForDay("2027-05-04"), core.phraseForDay("2027-05-05"));
  // Мусор не должен оставлять подпись пустой.
  assert.equal(core.phraseForDay(""), phrases[0]);
  assert.equal(core.phraseForDay(null), phrases[0]);
});
