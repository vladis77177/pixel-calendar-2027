// Вставляет знак «Пиксельного календаря» из sign.js в статику: favicon.svg и
// разметку логотипа в index.html между маркерами SIGN_LOGO_START/END.
// Usage: node tools/build-sign.js [--check]
// Разметку и цифры держит sign.js, поэтому favicon, шапка и значок APK не разъезжаются.
const fs = require("fs");
const path = require("path");
const PixelSign = require(path.join(__dirname, "..", "sign.js"));

const ROOT = path.join(__dirname, "..");
const START = "<!-- SIGN_LOGO_START -->";
const END = "<!-- SIGN_LOGO_END -->";

// В статике стоит день 1: настоящее число подставляет app.js по календарю устройства,
// поэтому favicon и первый кадр всегда валидны, без пустого места.
function logoMarkup() {
  return `${START}\n          ${PixelSign.useMarkup(1)}\n          ${END}`;
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
