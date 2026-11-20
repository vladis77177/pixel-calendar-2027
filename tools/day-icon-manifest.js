#!/usr/bin/env node
// Живой значок ярлыка: у приложения 31 alias (Day1…Day31), включён ровно один.
// Переключает их Java-код по системной рассылке DATE_CHANGED — тем же способом,
// каким виджет узнаёт о новом дне. Скрипт печатает фрагмент AndroidManifest.xml,
// который patch-android.js вставляет в <application>. Отдельный файл, чтобы
// разметку можно было просмотреть и проверить без прогона всего генератора.
// Usage: node tools/day-icon-manifest.js [--check]

const PACKAGE = "ru.pixel.calendar2027";
const ACTIVITY = ".MainActivity";

function aliasXml(day) {
  return `        <activity-alias
            android:name=".Day${day}"
            android:enabled="${day === 1 ? "true" : "false"}"
            android:exported="true"
            android:icon="@mipmap/ic_launcher_day_${day}"
            android:roundIcon="@mipmap/ic_launcher_day_${day}"
            android:targetActivity="${PACKAGE}${ACTIVITY}">
            <!-- Ярлыки долгого нажатия объявлены на том компоненте, который несёт
                 MAIN/LAUNCHER: у alias, а не у самой Activity, иначе они пропадут. -->
            <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`;
}

function aliasBlock() {
  const aliases = [];
  for (let day = 1; day <= 31; day += 1) aliases.push(aliasXml(day));
  return aliases.join("\n");
}

function main() {
  const check = process.argv.includes("--check");
  if (check) {
    const block = aliasBlock();
    const problems = [];
    for (let day = 1; day <= 31; day += 1) {
      if (!block.includes(`.Day${day}"`)) problems.push(`alias .Day${day} отсутствует`);
      if (!block.includes(`android:icon="@mipmap/ic_launcher_day_${day}"`)) problems.push(`иконка дня ${day} не подключена`);
    }
    const enabled = (block.match(/android:enabled="true"/g) || []).length;
    if (enabled !== 1) problems.push(`включённых alias должно быть ровно один, найдено ${enabled}`);
    if (!block.includes(`android:targetActivity="${PACKAGE}${ACTIVITY}"`)) problems.push("targetActivity не совпадает с пакетом");
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exit(1);
    }
    console.log("Разметка ярлыков в порядке: 31 alias, включён один (Day1), targetActivity совпадает с пакетом.");
    return;
  }
  process.stdout.write(aliasBlock() + "\n");
}

if (require.main === module) main();

module.exports = { aliasBlock, aliasXml };
