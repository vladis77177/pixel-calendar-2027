// Вставляет в статику логотип шапки и знак CachePixel из sign.js: favicon.svg и
// разметку логотипа в index.html между маркерами SIGN_LOGO_START/END.
// Usage: node tools/build-sign.js [--check]
// В шапке — постоянный знак бренда (без даты). Дата живёт в знаке-иконке:
// favicon и значок APK рисует sign.js, поэтому они не разъезжаются.
const fs = require("fs");
const path = require("path");
const PixelSign = require(path.join(__dirname, "..", "sign.js"));

const ROOT = path.join(__dirname, "..");
const START = "<!-- SIGN_LOGO_START -->";
const END = "<!-- SIGN_LOGO_END -->";

// Знак шапки, вариант B: страница календаря с травяной полосой сверху и закладкой.
// Он статичный — число дня в шапке не показываем.
const HEADER_RECTS = [
  '<rect x="5" y="0" width="1" height="1" fill="#6ec44c"/>',
  '<rect x="6" y="0" width="1" height="1" fill="#8ee06e"/>',
  '<rect x="9" y="0" width="1" height="1" fill="#6ec44c"/>',
  '<rect x="11" y="0" width="1" height="1" fill="#5fb947"/>',
  '<rect x="3" y="1" width="10" height="2" fill="#5fb947"/>',
  '<rect x="4" y="1" width="7" height="1" fill="#8ee06e"/>',
  '<rect x="3" y="2" width="10" height="1" fill="#342416"/>',
  '<rect x="3" y="3" width="1" height="11" fill="#342416"/>',
  '<rect x="12" y="3" width="1" height="11" fill="#342416"/>',
  '<rect x="3" y="14" width="8" height="1" fill="#342416"/>',
  '<rect x="4" y="3" width="8" height="11" fill="#fffdf7"/>',
  '<rect x="11" y="14" width="1" height="1" fill="#dfc99a"/>',
  '<rect x="4" y="5" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="7" y="5" width="2" height="2" fill="#6ec44c"/>',
  '<rect x="10" y="5" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="4" y="8" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="7" y="8" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="10" y="8" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="4" y="11" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="7" y="11" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="10" y="11" width="2" height="2" fill="#dfc99a"/>',
  '<rect x="8" y="13" width="2" height="3" fill="#bb4b3d"/>'
];

function logoMarkup() {
  const svg = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">' + HEADER_RECTS.join("") + "</svg>";
  return `${START}\n          ${svg}\n          ${END}`;
}

function writeFavicon(check) {
  const file = path.join(ROOT, "favicon.svg");
  // Знак без числа: favicon живёт в 16 px, где цифра не читается.
  const svg = PixelSign.signSvg(null);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (current === svg) return false;
  if (!check) fs.writeFileSync(file, svg, "utf8");
  return true;
}

function writeIndexMarkup(check) {
  const file = path.join(ROOT, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("В index.html нет маркеров SIGN_LOGO_START/SIGN_LOGO_END");
  }
  const next = html.slice(0, start) + logoMarkup() + html.slice(end + END.length);
  if (next === html) return false;
  if (!check) fs.writeFileSync(file, next, "utf8");
  return true;
}

function main() {
  const check = process.argv.includes("--check");
  const faviconChanged = writeFavicon(check);
  const indexChanged = writeIndexMarkup(check);
  if (check) {
    if (faviconChanged || indexChanged) {
      console.error("Знак в статике отстал от sign.js — запустите node tools/build-sign.js");
      process.exit(1);
    }
    console.log("Знак в статике совпадает с sign.js (favicon и логотип).");
    return;
  }
  console.log(
    `Знак обновлён: favicon ${faviconChanged ? "переписан" : "уже актуален"}, логотип ${indexChanged ? "переписан" : "уже актуален"}`
  );
}

if (require.main === module) main();

module.exports = { logoMarkup, START, END };
