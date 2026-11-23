// Sanity checks for the patched Capacitor Android project.
// Usage: node tools/verify-android.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "capacitor.config.json"), "utf8"));
const PACKAGE = CONFIG.appId;
const APP = path.join(ROOT, "android", "app", "src", "main");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function read(file) {
  const full = path.join(APP, file);
  check(fs.existsSync(full), `Missing ${file}`);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

const manifest = read("AndroidManifest.xml");
check(manifest.includes("CalendarWidgetProvider"), "Widget receiver is not registered in AndroidManifest.xml");
check(manifest.includes("RECEIVE_BOOT_COMPLETED"), "Boot permission is missing");
check(manifest.includes("POST_NOTIFICATIONS"), "Notification permission is missing");
check(manifest.includes("SCHEDULE_EXACT_ALARM"), "Exact alarm permission is missing");
check(
  /<uses-permission android:name="android\.permission\.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" \/>/.test(manifest),
  "WRITE_EXTERNAL_STORAGE with maxSdkVersion=\"28\" is missing: Android 7–9 needs it to write the JSON backup into the public Downloads folder"
);
check(
  !/<uses-permission android:name="android\.permission\.WRITE_EXTERNAL_STORAGE"[^>]*\/>/.test(
    manifest.replace(/<uses-permission android:name="android\.permission\.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" \/>/g, "")
  ),
  "WRITE_EXTERNAL_STORAGE is requested without maxSdkVersion=\"28\": Android 10+ writes through MediaStore and must not ask for it"
);
check(manifest.includes("calendar_widget_info"), "Widget metadata is missing");
check(
  /android:allowBackup="false"/.test(manifest),
  "System backup must be off: the sync token lives in WebView localStorage"
);
check(!/android:allowBackup="true"/.test(manifest), "allowBackup=\"true\" leaks the sync token into cloud backups");

const mainActivity = read(`java/${PACKAGE.split(".").join("/")}/MainActivity.java`);
check(mainActivity.includes("registerPlugin(WidgetBridgePlugin.class)"), "WidgetBridge plugin is not registered");
check(
  mainActivity.indexOf("registerPlugin(WidgetBridgePlugin.class)") < mainActivity.indexOf("super.onCreate"),
  "Plugin must be registered before super.onCreate"
);
check(
  mainActivity.includes("setBackgroundColor"),
  "WebView background must be painted, otherwise the launch and widget return flash white"
);

const networkConfig = read("res/xml/network_security_config.xml");
check(
  manifest.includes('android:networkSecurityConfig="@xml/network_security_config"'),
  "Manifest must point at the network security config"
);
check(
  networkConfig.includes('cleartextTrafficPermitted="true"'),
  "Release build must allow cleartext HTTP: LAN sync needs it and IP ranges cannot be listed"
);
check(
  read("java/" + PACKAGE.split(".").join("/") + "/MainActivity.java").includes("setBackgroundColor"),
  "WebView background must be painted, otherwise launch flashes white"
);
read("res/drawable-night/splash.png");
read("res/drawable-land-night-hdpi/splash.png");
check(
  !fs.existsSync(path.join(APP, "res", "drawable-night-land-hdpi")),
  "Квалификаторы Android идут в порядке «ориентация, uiMode, плотность»: drawable-night-land-* недопустим"
);

// Подложка стартового окна: без неё Android рисует под WebView своё полотно и при
// холодном старте или возврате из виджета видно вспышку чужого цвета.
const styles = read("res/values/styles.xml");
const stylesNight = fs.existsSync(path.join(APP, "res", "values-night", "styles.xml"))
  ? read("res/values-night/styles.xml")
  : "";
check(
  /AppTheme\.NoActionBar[^>]*>[\s\S]*android:windowBackground/.test(styles),
  "AppTheme.NoActionBar must set android:windowBackground"
);
check(
  /AppTheme\.NoActionBarLaunch[^>]*>[\s\S]*android:windowBackground/.test(styles)
    || /AppTheme\.NoActionBarLaunch[^>]*>[\s\S]*android:windowBackground/.test(stylesNight),
  "Launch theme must set android:windowBackground instead of @null"
);
const dayColors = read("res/values/colors.xml");
if (dayColors) {
  check(
    /name="splash_background">#82D4FB</.test(dayColors),
    "Day splash background must be the sky top colour #82D4FB"
  );
}

read(`java/${PACKAGE.split(".").join("/")}/WidgetBridgePlugin.java`);
read(`java/${PACKAGE.split(".").join("/")}/CalendarWidgetProvider.java`);
read("res/layout/calendar_widget.xml");
read("res/layout/calendar_widget_night.xml");
read("res/layout/widget_task_row.xml");
read("res/layout/widget_task_row_night.xml");
read("res/drawable/widget_bg.xml");
read("res/drawable/widget_bg_night.xml");
read("res/drawable/widget_header_bg.xml");
read("res/drawable/widget_header_bg_night.xml");
read("res/drawable/widget_task_bg.xml");
read("res/drawable/widget_task_bg_night.xml");
read("res/drawable/widget_progress.xml");
read("res/drawable/widget_progress_night.xml");
read("res/xml/calendar_widget_info.xml");

const receiver = read(`java/${PACKAGE.split(".").join("/")}/WidgetToggleReceiver.java`);
check(
  /android:name="\.WidgetToggleReceiver"[^>]*android:exported="false"/s.test(manifest)
    || /android:exported="false"[^>]*android:name="\.WidgetToggleReceiver"/s.test(manifest),
  "WidgetToggleReceiver must be declared with exported=\"false\""
);
const expectedToggleAction = `${PACKAGE}.WIDGET_TOGGLE`;
const manifestToggleActions = manifest.match(/<action android:name="[^"]*\.WIDGET_TOGGLE"/g) || [];
check(
  manifestToggleActions.length === 1 && manifestToggleActions[0] === `<action android:name="${expectedToggleAction}"`,
  `WidgetToggleReceiver intent-filter action must be ${expectedToggleAction} (appId from capacitor.config.json), found ${manifestToggleActions.join(", ") || "nothing"}`
);
check(
  /getPackageName\(\)\s*\+\s*"\.WIDGET_TOGGLE"/.test(receiver),
  `WidgetToggleReceiver must build its action as getPackageName() + ".WIDGET_TOGGLE" so it equals ${expectedToggleAction}`
);
check(
  !/"[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+\.WIDGET_TOGGLE"/.test(receiver),
  `WidgetToggleReceiver must not hardcode the action: it has to stay ${expectedToggleAction} when appId changes`
);
check(
  !receiver.includes("MainActivity") && !receiver.includes("startActivity"),
  "WidgetToggleReceiver must not open MainActivity"
);
const bridge = read(`java/${PACKAGE.split(".").join("/")}/WidgetBridgePlugin.java`);
check(bridge.includes("consumeToggles"), "WidgetBridgePlugin must expose consumeToggles");
check(bridge.includes("saveBackup"), "WidgetBridgePlugin must expose saveBackup to write the JSON backup into Downloads");
check(
  bridge.includes("MediaStore.Downloads") && bridge.includes("DIRECTORY_DOWNLOADS"),
  "saveBackup must write via MediaStore.Downloads into Environment.DIRECTORY_DOWNLOADS on Android 10+"
);

// Кнопка «назад» перехватывается в JS (событие backButton плагина @capacitor/app),
// иначе плагин вызывает webView.goBack() и закрывает Activity — приложение сворачивается.
const androidRoot = path.join(ROOT, "android");
const capAppSettings = (() => {
  const file = path.join(androidRoot, "capacitor.settings.gradle");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
})();
check(
  capAppSettings.includes("capacitor-app"),
  "Android project must include the @capacitor/app plugin (needed for the back button)"
);
const capAppBuildGradle = (() => {
  const file = path.join(androidRoot, "app", "capacitor.build.gradle");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
})();
check(
  capAppBuildGradle.includes("':capacitor-app'"),
  "app/capacitor.build.gradle must depend on ':capacitor-app'"
);
const appSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
check(
  /addListener\(\s*"backButton"/.test(appSource),
  "app.js must subscribe to the backButton event, otherwise Android closes the Activity on back"
);
check(
  appSource.includes("exitApp"),
  "app.js must exit the app on the second back press at the home screen"
);
check(
  Boolean(CONFIG.android && CONFIG.android.backgroundColor),
  "capacitor.config.json must set android.backgroundColor — otherwise the WebView is white until the page paints (launch flash)"
);
// WebView грузит приложение с https://localhost (server.androidScheme), а синхронизация
// ходит на http://192.168.x.x:8787. Без allowMixedContent Chromium блокирует такой запрос,
// и в приложении видно «Сервер недоступен: Failed to fetch».
check(
  Boolean(CONFIG.android && CONFIG.android.allowMixedContent === true),
  "capacitor.config.json must set android.allowMixedContent = true — otherwise LAN sync over plain HTTP is blocked as mixed content (Failed to fetch)"
);
check(
  mainActivity.includes("postVisualStateCallback"),
  "MainActivity must reveal the WebView at its first frame, not before"
);
const launchStyles = read("res/values/styles.xml");
check(
  launchStyles.includes("windowSplashScreenBackground"),
  "Launch theme must set windowSplashScreenBackground — the platform otherwise paints its own background"
);
check(
  launchStyles.includes("name=\"android:colorBackground\""),
  "Both app themes must set android:colorBackground to the sky colour, not white"
);
check(
  launchStyles.includes("postSplashScreenTheme"),
  "Launch theme must declare postSplashScreenTheme = AppTheme.NoActionBar"
);

// Ярлыки долгого нажатия на иконку: файл, ссылка в манифесте и обработка в JS.
const shortcuts = read("res/xml/shortcuts.xml");
check(
  manifest.includes("android.app.shortcuts"),
  "MainActivity must reference android.app.shortcuts, otherwise long-press shortcuts never appear"
);
check(
  shortcuts.includes('android:name="quick_add"'),
  "shortcuts.xml must pass the quick_add extra"
);
for (const mode of ["now", "today", "tomorrow"]) {
  check(shortcuts.includes(`android:value="${mode}"`), `Shortcut ${mode} is missing in shortcuts.xml`);
}
check(
  /onNewIntent[\s\S]*captureQuickAdd/.test(mainActivity),
  "MainActivity must capture the shortcut extra in onNewIntent (BridgeActivity does not call setIntent)"
);
check(bridge.includes("consumeLaunch"), "WidgetBridgePlugin must expose consumeLaunch for icon shortcuts");
check(
  fs.readFileSync(path.join(ROOT, "app.js"), "utf8").includes("setupQuickAdd"),
  "app.js must open the quick-add dialog for icon shortcuts"
);

const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const payloadStart = appJs.indexOf("function buildWidgetPayload");
const payloadEnd = appJs.indexOf("function nativeWidgetPlugin");
const payloadBody = payloadStart >= 0 && payloadEnd > payloadStart ? appJs.slice(payloadStart, payloadEnd) : "";
check(payloadBody.includes("key:"), "syncNativeWidget payload must include key");
check(payloadBody.includes("iso,") || payloadBody.includes("iso:"), "syncNativeWidget payload must include iso");

const widgetFont = path.join(APP, "res", "font", "tiny5.ttf");
check(fs.existsSync(widgetFont), "Missing widget font res/font/tiny5.ttf");
if (fs.existsSync(widgetFont)) check(fs.statSync(widgetFont).size > 1000, "Empty widget font res/font/tiny5.ttf");

// Дата виджета набирается Nunito ExtraBold: Tiny5 на 19sp теряет просветы в 2/8/0.
const dateFont = path.join(APP, "res", "font", "nunito_date.ttf");
check(fs.existsSync(dateFont), "Missing widget date font res/font/nunito_date.ttf");
if (fs.existsSync(dateFont)) check(fs.statSync(dateFont).size > 4000, "Empty widget date font res/font/nunito_date.ttf");
for (const layout of ["calendar_widget.xml", "calendar_widget_night.xml"]) {
  const body = read(`res/layout/${layout}`);
  check(body.includes('@font/nunito_date'), `${layout}: widget_date must use @font/nunito_date`);
}

const strings = read("res/values/strings.xml");
check(strings.includes("widget_label"), "widget_label string is missing");
check(strings.includes("widget_description"), "widget_description string is missing");

for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  for (const icon of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    const file = path.join(APP, "res", `mipmap-${density}`, icon);
    check(fs.existsSync(file), `Missing mipmap-${density}/${icon}`);
    if (fs.existsSync(file)) check(fs.statSync(file).size > 100, `Empty mipmap-${density}/${icon}`);
  }
  const statIcon = path.join(APP, "res", `drawable-${density}`, "ic_stat_calendar.png");
  check(fs.existsSync(statIcon), `Missing drawable-${density}/ic_stat_calendar.png`);
  if (fs.existsSync(statIcon)) check(fs.statSync(statIcon).size > 100, `Empty drawable-${density}/ic_stat_calendar.png`);
}

// Живой значок ярлыка: 31 alias, включён ровно один, у каждого иконка дня ведёт
// на адаптивную разметку, а её foreground — на layer-list «основа + число».
const aliasMatches = manifest.match(/<activity-alias[\s\S]*?<\/activity-alias>/g) || [];
check(aliasMatches.length === 31, `activity-alias должно быть 31, найдено ${aliasMatches.length}`);
for (let day = 1; day <= 31; day += 1) {
  check(manifest.includes(`android:name=".Day${day}"`), `В манифесте нет alias .Day${day} — ярлык дня ${day} не соберётся`);
  check(
    manifest.includes(`android:icon="@mipmap/ic_launcher_day_${day}"`),
    `alias .Day${day}: android:icon не ведёт на @mipmap/ic_launcher_day_${day}`
  );
  check(
    manifest.includes(`android:roundIcon="@mipmap/ic_launcher_day_${day}"`),
    `alias .Day${day}: android:roundIcon не ведёт на @mipmap/ic_launcher_day_${day}`
  );
}
for (const block of aliasMatches) {
  const nameMatch = block.match(/android:name="\.Day(\d+)"/);
  const enabled = /android:enabled="true"/.test(block);
  if (!enabled) continue;
  check(
    nameMatch && nameMatch[1] === "1",
    "Включённым на старте должен быть ровно один alias — .Day1"
  );
}
const enabledAliases = aliasMatches.filter((block) => /android:enabled="true"/.test(block));
check(enabledAliases.length === 1, `включённых activity-alias должно быть ровно один, найдено ${enabledAliases.length}`);

const dayIconReceiver = read(`java/${PACKAGE.split(".").join("/")}/DayIconReceiver.java`);
const dayIconSwitcher = read(`java/${PACKAGE.split(".").join("/")}/DayIconSwitcher.java`);
check(
  manifest.includes(".DayIconReceiver"),
  "DayIconReceiver не зарегистрирован в AndroidManifest.xml — значок не догонит смену дня"
);
for (const action of ["DATE_CHANGED", "TIME_CHANGED", "TIMEZONE_CHANGED", "BOOT_COMPLETED"]) {
  check(
    dayIconReceiver.includes(`Intent.ACTION_${action}`),
    `DayIconReceiver не слушает ACTION_${action}`
  );
}
check(
  manifest.includes('android:name=".DayIconReceiver"'),
  "В манифесте нет receiver .DayIconReceiver с именем .DayIconReceiver"
);
check(
  dayIconSwitcher.includes("setComponentEnabledSetting"),
  "DayIconSwitcher должен переключать alias через setComponentEnabledSetting"
);
check(
  mainActivity.includes("DayIconSwitcher.apply"),
  "MainActivity.onCreate должен вызывать DayIconSwitcher.apply(this), иначе значок не догонит дату при запуске"
);

// Ярлык запуска должен принадлежать ровно одному компоненту: у самой MainActivity
// его быть не должно, иначе в лончере два значка — живой и статичный.
const mainActivityBlock = (manifest.match(/<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?<\/activity>/) || [""])[0];
check(
  !mainActivityBlock.includes("android.intent.category.LAUNCHER"),
  "У MainActivity остался intent-filter LAUNCHER — в лончере будет два ярлыка вместо одного живого"
);
// Ярлыки долгого нажатия объявляет тот компонент, который несёт MAIN/LAUNCHER.
const launcherAliasBlock = (manifest.match(/<activity-alias[\s\S]*?android:enabled="true"[\s\S]*?<\/activity-alias>/) || [""])[0];
check(
  launcherAliasBlock.includes("android.app.shortcuts"),
  "Включённый alias не объявляет android.app.shortcuts — ярлыки долгого нажатия пропадут"
);

for (let day = 1; day <= 31; day += 1) {
  const adaptive = path.join(APP, "res", "mipmap-anydpi-v26", `ic_launcher_day_${day}.xml`);
  check(fs.existsSync(adaptive), `Нет mipmap-anydpi-v26/ic_launcher_day_${day}.xml: alias .Day${day} указывает на несуществующий ресурс`);
  if (!fs.existsSync(adaptive)) continue;
  const adaptiveBody = fs.readFileSync(adaptive, "utf8");
  check(
    adaptiveBody.includes("@color/ic_launcher_background"),
    `ic_launcher_day_${day}.xml: background должен быть @color/ic_launcher_background`
  );
  check(
    adaptiveBody.includes(`@drawable/ic_launcher_day_${day}_foreground`),
    `ic_launcher_day_${day}.xml: foreground должен вести на @drawable/ic_launcher_day_${day}_foreground`
  );
  const layerList = path.join(APP, "res", "drawable-xxhdpi", `ic_launcher_day_${day}_foreground.xml`);
  check(fs.existsSync(layerList), `Нет drawable-xxhdpi/ic_launcher_day_${day}_foreground.xml`);
  if (fs.existsSync(layerList)) {
    const layerBody = fs.readFileSync(layerList, "utf8");
    check(
      layerBody.includes("@mipmap/ic_launcher_foreground"),
      `ic_launcher_day_${day}_foreground.xml: layer-list должен накладывать основу @mipmap/ic_launcher_foreground`
    );
    check(
      layerBody.includes(`@drawable/ic_day_number_${day}`),
      `ic_launcher_day_${day}_foreground.xml: layer-list должен накладывать @drawable/ic_day_number_${day}`
    );
  }
  const numberPng = path.join(APP, "res", "drawable-xxhdpi", `ic_day_number_${day}.png`);
  check(fs.existsSync(numberPng), `Нет drawable-xxhdpi/ic_day_number_${day}.png — число дня ${day} не отрисуется`);
  if (fs.existsSync(numberPng)) check(fs.statSync(numberPng).size > 100, `Пустой drawable-xxhdpi/ic_day_number_${day}.png`);
  const legacy = path.join(APP, "res", "mipmap-xxxhdpi", `ic_launcher_day_${day}.png`);
  check(fs.existsSync(legacy), `Нет mipmap-xxxhdpi/ic_launcher_day_${day}.png`);
}

const buildGradle = fs.readFileSync(path.join(ROOT, "android", "app", "build.gradle"), "utf8");
check(buildGradle.includes(`namespace = "${PACKAGE}"`), "Gradle namespace does not match appId");
check(buildGradle.includes(`applicationId "${PACKAGE}"`), "Gradle applicationId does not match appId");

const webIndex = path.join(ROOT, "android", "app", "src", "main", "assets", "public", "index.html");
check(fs.existsSync(webIndex), "Web assets were not copied into the Android project");
const webNotify = path.join(ROOT, "android", "app", "src", "main", "assets", "public", "notifications.js");
check(fs.existsSync(webNotify), "notifications.js was not copied into the Android project");

if (errors.length) {
  console.error("Android verification failed:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}

console.log("Android project verified: widget, plugin, icons, splash and web assets are in place.");
