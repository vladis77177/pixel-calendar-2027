// Знак «Пиксельного календаря» («грядка с календарём», вариант A) и пиксельные
// цифры 1–31. Один источник графики для всего: логотип в шапке, favicon, иконки
// PWA, значок APK и splash. Снято с SVG дизайнера скриптом, без ручного переноса,
// чтобы знак не разъезжался между платформами.
//
// Работает и в браузере (<script src="sign.js"></script> до app.js, без defer —
// значок рисуется до первой отрисовки), и в Node (require("./sign.js") в tools/*).
(function (root) {
  "use strict";

  const SIGN_ROWS = [".....rr.........",".....rr.........","..kkkrrkkkkk....","..kppprpppppk...","..kpppppppppk...","..kpppppppppk...","..kpppppppppk...","..kpppppppppke..",".ekpppppppppkf..",".fkpppppppppkff.",".fkpppppppppkgg.",".bkpppppppppkbb.",".bkkkkkkkkkkkbb.",".bbccbbbbdbbdbb.",".bdbbbcccbbbbbb.",".cccccccccccccc."];

  const SIGN_COLORS = {
  "a": "#956237",
  "d": "#9a6639",
  "b": "#80522e",
  "c": "#694021",
  "e": "#8ee06e",
  "f": "#6ec44c",
  "g": "#5fb947",
  "s": "#dfc99a",
  "r": "#bb4b3d",
  "p": "#fffdf7",
  "k": "#342416"
};

  // Поле числа на бумажной странице: 7 колонок × 5 строк, начало в (4, 5).
  const NUMBER_BOX = { x: 4, y: 5, width: 7, height: 5 };

  // Цифры 1–31: 5 строк по 7 символов, '.' — пусто, '#' — чернила.
  const DIGIT_ROWS = {"1":["...#...","..##...","...#...","...#...","..###.."],"2":["..###..","....#..","..###..","..#....","..###.."],"3":["..###..","....#..","..###..","....#..","..###.."],"4":["..#.#..","..#.#..","..###..","....#..","....#.."],"5":["..###..","..#....","..###..","....#..","..###.."],"6":["..###..","..#....","..###..","..#.#..","..###.."],"7":["..###..","....#..","....#..","....#..","....#.."],"8":["..###..","..#.#..","..###..","..#.#..","..###.."],"9":["..###..","..#.#..","..###..","....#..","..###.."],"10":[".#..###","##..#.#",".#..#.#",".#..#.#","###.###"],"11":[".#...#.","##..##.",".#...#.",".#...#.","###.###"],"12":[".#..###","##....#",".#..###",".#..#..","###.###"],"13":[".#..###","##....#",".#..###",".#....#","###.###"],"14":[".#..#.#","##..#.#",".#..###",".#....#","###...#"],"15":[".#..###","##..#..",".#..###",".#....#","###.###"],"16":[".#..###","##..#..",".#..###",".#..#.#","###.###"],"17":[".#..###","##....#",".#....#",".#....#","###...#"],"18":[".#..###","##..#.#",".#..###",".#..#.#","###.###"],"19":[".#..###","##..#.#",".#..###",".#....#","###.###"],"20":["###.###","..#.#.#","###.#.#","#...#.#","###.###"],"21":["###..#.","..#.##.","###..#.","#....#.","###.###"],"22":["###.###","..#...#","###.###","#...#..","###.###"],"23":["###.###","..#...#","###.###","#.....#","###.###"],"24":["###.#.#","..#.#.#","###.###","#.....#","###...#"],"25":["###.###","..#.#..","###.###","#.....#","###.###"],"26":["###.###","..#.#..","###.###","#...#.#","###.###"],"27":["###.###","..#...#","###...#","#.....#","###...#"],"28":["###.###","..#.#.#","###.###","#...#.#","###.###"],"29":["###.###","..#.#.#","###.###","#.....#","###.###"],"30":["###.###","..#.#.#","###.#.#","..#.#.#","###.###"],"31":["###..#.","..#.##.","###..#.","..#..#.","###.###"]};

  // Правило цифр проекта: значение выводится как есть, поэтому 31 — предел месяца,
  // а не всего календаря; число дня больше 31 на знак не попадает.
  const DAYS_IN_MONTH = 31;

  // Знак на конкретный день: сетка 16×16 из символов палитры.
  function signGrid(day) {
    const grid = SIGN_ROWS.map(function (row) { return row.split(""); });
    const rows = DIGIT_ROWS[Number(day)];
    if (!rows) return grid;
    rows.forEach(function (row, rowIndex) {
      for (let column = 0; column < NUMBER_BOX.width; column += 1) {
        if (row[column] !== "#") continue;
        const x = NUMBER_BOX.x + column;
        const y = NUMBER_BOX.y + rowIndex;
        if (grid[y] && grid[y][x] !== undefined) grid[y][x] = "k";
      }
    });
    return grid;
  }

  // Знак без числа: мелкие размеры (12–24 px, maskable, статус-бар), где цифра не читается.
  function staticGrid() {
    return SIGN_ROWS.map(function (row) { return row.split(""); });
  }

  // Горизонтальные отрезки одного цвета: SVG из сетки выходит компактным,
  // а не по прямоугольнику на пиксель.
  function rectsFor(grid, colors) {
    const palette = colors || SIGN_COLORS;
    const rects = [];
    for (let y = 0; y < grid.length; y += 1) {
      let x = 0;
      while (x < grid[y].length) {
        const symbol = grid[y][x];
        if (symbol === "." || !palette[symbol]) {
          x += 1;
          continue;
        }
        let width = 1;
        while (x + width < grid[y].length && grid[y][x + width] === symbol) width += 1;
        rects.push({ x: x, y: y, width: width, height: 1, color: palette[symbol] });
        x += width;
      }
    }
    return rects;
  }

  function rectsToSvg(rects) {
    const parts = [];
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      parts.push('<rect x="' + r.x + '" y="' + r.y + '" width="' + r.width + '" height="' + r.height + '" fill="' + r.color + '"/>');
    }
    return parts.join("");
  }

  // Готовый SVG знака: favicon и исходник для генерации PNG.
  function signSvg(day) {
    const rects = rectsFor(day ? signGrid(day) : staticGrid());
    const label = day ? "Пиксельный календарь, день " + day : "Пиксельный календарь";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="'
      + label + '">' + rectsToSvg(rects) + "</svg>";
  }

  // Разметка знака для HTML: основа плюс пустая группа числа, которую app.js
  // заполняет числом текущего дня (спрайт не нужен: 31 символ в разметке — лишний вес).
  function useMarkup(day) {
    const body = day ? numberMarkup(day) : "";
    return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">'
      + rectsToSvg(rectsFor(staticGrid()))
      + '<g id="brandDayNumber" fill="#342416">' + body + "</g></svg>";
  }

  // Число дня как прямоугольники внутри группы: 1 px на пиксель цифры.
  function numberMarkup(day) {
    const rows = DIGIT_ROWS[Number(day)];
    if (!rows) return "";
    const parts = [];
    rows.forEach(function (row, y) {
      for (let x = 0; x < NUMBER_BOX.width; x += 1) {
        if (row[x] !== "#") continue;
        parts.push('<rect x="' + (NUMBER_BOX.x + x) + '" y="' + (NUMBER_BOX.y + y) + '" width="1" height="1"/>');
      }
    });
    return parts.join("");
  }

  const PixelSign = {
    SIGN_ROWS: SIGN_ROWS,
    SIGN_COLORS: SIGN_COLORS,
    NUMBER_BOX: NUMBER_BOX,
    DIGIT_ROWS: DIGIT_ROWS,
    DAYS_IN_MONTH: DAYS_IN_MONTH,
    signGrid: signGrid,
    staticGrid: staticGrid,
    rectsFor: rectsFor,
    rectsToSvg: rectsToSvg,
    signSvg: signSvg,
    useMarkup: useMarkup,
    numberMarkup: numberMarkup
  };

  root.PixelSign = PixelSign;
  if (typeof module !== "undefined" && module.exports) module.exports = PixelSign;
})(typeof window !== "undefined" ? window : globalThis);
