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

const widgetFont = path.join(APP, "res", "font", "tiny5.ttf");
check(fs.existsSync(widgetFont), "Missing widget font res/font/tiny5.ttf");
if (fs.existsSync(widgetFont)) check(fs.statSync(widgetFont).size > 1000, "Empty widget font res/font/tiny5.ttf");

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
