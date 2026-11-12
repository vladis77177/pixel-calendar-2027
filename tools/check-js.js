// Проверка синтаксиса всех JS-файлов проекта.
// Дополняет тесты: ловит опечатки в файлах, которые тесты не покрывают
// (widget.js, sw.js, tools/*), и не даёт уехать в сборку нечитаемому файлу.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SKIP = new Set(["node_modules", "www", "android", "dist", "preview", ".git", ".signing", "backups", "apk"]);

function collect(dir, list) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      if (entry.isDirectory()) continue;
    }
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, list);
    else if (entry.name.endsWith(".js")) list.push(full);
  }
  return list;
}

const files = collect(ROOT, []);
const broken = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  try {
    new vm.Script(source, { filename: file });
  } catch (error) {
    broken.push(`${path.relative(ROOT, file)}: ${error.message}`);
  }
}

if (broken.length) {
  console.error(`Синтаксис не прошёл проверку (${broken.length}):`);
  for (const line of broken) console.error(`  ${line}`);
  process.exit(1);
}

console.log(`Синтаксис в порядке: ${files.length} файлов.`);
