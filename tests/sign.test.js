// Знак CachePixel: один источник графики для шапки, favicon и иконок APK.
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const PixelSign = require(path.join(__dirname, "..", "sign.js"));

test("сетка знака 16×16 и состоит из известных символов палитры", () => {
  const grid = PixelSign.staticGrid();
  assert.equal(grid.length, 16);
  grid.forEach((row, index) => {
    assert.equal(row.length, 16, `строка ${index} не 16 клеток`);
    row.forEach((symbol) => {
      assert.ok(symbol === "." || PixelSign.SIGN_COLORS[symbol], `неизвестный символ ${symbol}`);
    });
  });
});

test("цифры 1–31 есть все и занимают поле числа", () => {
  for (let day = 1; day <= PixelSign.DAYS_IN_MONTH; day += 1) {
    const withNumber = PixelSign.signGrid(day);
    const plain = PixelSign.staticGrid();
    const changed = [];
    withNumber.forEach((row, y) => {
      row.forEach((symbol, x) => {
        if (symbol !== plain[y][x]) changed.push({ x, y, symbol });
      });
    });
    assert.ok(changed.length > 0, `день ${day} не нарисован`);
    changed.forEach(({ x, y, symbol }) => {
      assert.equal(symbol, "k", `день ${day}: цифра должна быть чернилами`);
      assert.ok(
        x >= PixelSign.NUMBER_BOX.x && x < PixelSign.NUMBER_BOX.x + PixelSign.NUMBER_BOX.width,
        `день ${day}: цифра вылезла за бумагу по X (${x})`
      );
      assert.ok(
        y >= PixelSign.NUMBER_BOX.y && y < PixelSign.NUMBER_BOX.y + PixelSign.NUMBER_BOX.height,
        `день ${day}: цифра вылезла за бумагу по Y (${y})`
      );
    });
  }
});

test("двузначные дни отличаются от однозначных: 20 — это 2 и 0, а не 2", () => {
  const twenty = PixelSign.signGrid(20);
  const two = PixelSign.signGrid(2);
  const count = (grid) => grid.flat().filter((symbol) => symbol === "k").length;
  assert.ok(count(twenty) > count(two), "у дня 20 пикселей больше, чем у дня 2");
  assert.deepEqual(PixelSign.signGrid(20), PixelSign.signGrid(20));
});

test("день без цифры не портит знак: 0 и 32 отдают статичную основу", () => {
  assert.deepEqual(PixelSign.signGrid(0), PixelSign.staticGrid());
  assert.deepEqual(PixelSign.signGrid(32), PixelSign.staticGrid());
});

test("разметка знака: группа числа заполнена ровно цифрой дня", () => {
  const markup = PixelSign.useMarkup(7);
  assert.ok(markup.includes('id="brandDayNumber"'), "нет группы числа");
  const numberRects = PixelSign.numberMarkup(7).match(/<rect/g) || [];
  assert.ok(numberRects.length > 0, "число дня пустое");
  const group = markup.slice(markup.indexOf('id="brandDayNumber"'));
  assert.ok(group.includes(PixelSign.numberMarkup(7)), "в разметке не то число");
});

test("favicon без числа: знак есть, цифры нет", () => {
  const svg = PixelSign.signSvg(null);
  assert.ok(svg.startsWith("<svg"), "это не SVG");
  assert.ok(svg.includes('viewBox="0 0 16 16"'), "не та система координат");
  assert.ok(!svg.includes('id="brandDayNumber"'), "в favicon попала цифра");
});

test("все цвета знака — из палитры проекта", () => {
  const allowed = new Set(Object.keys(PixelSign.SIGN_COLORS).map((key) => PixelSign.SIGN_COLORS[key]));
  const svg = PixelSign.signSvg(15);
  const colors = svg.match(/fill="(#[0-9a-f]{6})"/g) || [];
  assert.ok(colors.length > 10, "слишком мало прямоугольников");
  colors.forEach((value) => {
    const color = value.slice(6, -1);
    assert.ok(allowed.has(color), `чужой цвет ${color}`);
  });
});
