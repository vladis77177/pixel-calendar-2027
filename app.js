(() => {
  "use strict";

  const STORAGE_KEY = "pixel-calendar-2027-v1";
  const VIEWS = ["week", "month", "quarter", "year"];
  const PROFILES = ["auto", "mobile", "full"];
  const DENSITIES = ["comfortable", "compact"];
  const MOTION_MODES = ["auto", "on", "off"];
  const DIALOG_ANIM_MODES = ["auto", "on", "off"];
  const SKY_MODES = ["auto", "day", "dawn", "dusk", "night"];
  const HOLIDAY_MODES = ["auto", "on", "off"];
  const THEME_COLORS = {
    day: "#8bd8ff",
    dawn: "#f2a5a0",
    dusk: "#e2886a",
    night: "#101a33"
  };
  const DEFAULT_SETTINGS = {
    showHolidays: true,
    profile: "auto",
    density: "comfortable",
    motion: "auto",
    dialogAnimation: "auto",
    decor: true,
    sky: "auto",
    holiday: "auto",
    weekStart: 1,
    morningDigest: false,
    templates: []
  };
  const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"];
  // Быстрые дела: сколько строк храним и какой длины.
  const MAX_TEMPLATES = 12;
  const TEMPLATE_MAX_LENGTH = 60;
  // Подписи клеток истории серии (подсказка при наведении).
  const HEAT_STATE_LABELS = {
    done: "сделано",
    missed: "пропущено",
    pending: "ещё не отмечено",
    skipped: "день перенесён",
    none: "по расписанию дня нет"
  };
  // За сколько напоминать: варианты селекта и допустимые значения схемы.
  const LEAD_OPTIONS = [10, 60, 1440];
  const MAX_SEARCH_RESULTS = 100;
  const MONTHS_NOMINATIVE = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  const MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const MONTHS_SHORT = [
    "янв.", "февр.", "мар.", "апр.", "мая", "июн.",
    "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."
  ];
  const MONTHS_SHORT_WEEK = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек"
  ];
  const WEEKDAYS_FULL = [
    "воскресенье", "понедельник", "вторник", "среда",
    "четверг", "пятница", "суббота"
  ];
  const WEEKDAYS_MONDAY_FIRST = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  const WEEKDAYS_LONG_MONDAY_FIRST = [
    "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"
  ];
  const ROMAN_QUARTERS = ["I", "II", "III", "IV"];
  const HOLIDAYS = {
    "01-01": "Новый год",
    "01-02": "Новогодние каникулы",
    "01-03": "Новогодние каникулы",
    "01-04": "Новогодние каникулы",
    "01-05": "Новогодние каникулы",
    "01-06": "Новогодние каникулы",
    "01-07": "Рождество Христово",
    "01-08": "Новогодние каникулы",
    "02-23": "День защитника Отечества",
    "03-08": "Международный женский день",
    "05-01": "Праздник Весны и Труда",
    "05-09": "День Победы",
    "06-12": "День России",
    "11-04": "День народного единства"
  };

  const els = {
    todayLabel: document.getElementById("todayLabel"),
    todayChip: document.getElementById("todayChip"),
    garland: document.querySelector(".garland"),
    viewTabs: Array.from(document.querySelectorAll(".view-tab")),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    todayBtn: document.getElementById("todayBtn"),
    yearJumpBtn: document.getElementById("yearJumpBtn"),
    periodKicker: document.getElementById("periodKicker"),
    periodTitle: document.getElementById("periodTitle"),
    progressCard: document.getElementById("progressCard"),
    progressValue: document.getElementById("progressValue"),
    progressBar: document.getElementById("progressBar"),
    progressNote: document.getElementById("progressNote"),
    calendarView: document.getElementById("calendarView"),
    quickAddForm: document.getElementById("quickAddForm"),
    quickAddInput: document.getElementById("quickAddInput"),
    quickAddDate: document.getElementById("quickAddDate"),
    searchBtn: document.getElementById("searchBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    dialog: document.getElementById("dayDialog"),
    dialogEyebrow: document.getElementById("dialogEyebrow"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogCloseBtn: document.getElementById("dialogCloseBtn"),
    daySummaryText: document.getElementById("daySummaryText"),
    dayProgressBar: document.getElementById("dayProgressBar"),
    taskList: document.getElementById("taskList"),
    taskForm: document.getElementById("taskForm"),
    taskInput: document.getElementById("taskInput"),
    taskRepeat: document.getElementById("taskRepeat"),
    taskRepeatEnd: document.getElementById("taskRepeatEnd"),
    taskTime: document.getElementById("taskTime"),
    taskTimeWrap: document.getElementById("taskTimeWrap"),
    taskLead: document.getElementById("taskLead"),
    taskLeadWrap: document.getElementById("taskLeadWrap"),
    repeatEndWrap: document.getElementById("repeatEndWrap"),
    repeatHint: document.getElementById("repeatHint"),
    quickTimes: document.getElementById("quickTimes"),
    templateChips: document.getElementById("templateChips"),
    formError: document.getElementById("formError"),
    searchDialog: document.getElementById("searchDialog"),
    searchCloseBtn: document.getElementById("searchCloseBtn"),
    searchInput: document.getElementById("searchInput"),
    searchStatus: document.getElementById("searchStatus"),
    searchStatusButtons: Array.from(document.querySelectorAll("#searchStatus [data-status]")),
    searchType: document.getElementById("searchType"),
    searchCount: document.getElementById("searchCount"),
    searchResults: document.getElementById("searchResults"),
    settingsDialog: document.getElementById("settingsDialog"),
    settingsCloseBtn: document.getElementById("settingsCloseBtn"),
    holidaysToggle: document.getElementById("holidaysToggle"),
    profileSelect: document.getElementById("profileSelect"),
    densitySelect: document.getElementById("densitySelect"),
    motionSelect: document.getElementById("motionSelect"),
    dialogAnimSelect: document.getElementById("dialogAnimSelect"),
    weekStartSelect: document.getElementById("weekStartSelect"),
    skySelect: document.getElementById("skySelect"),
    holidaySelect: document.getElementById("holidaySelect"),
    digestRow: document.getElementById("digestRow"),
    digestToggle: document.getElementById("digestToggle"),
    snow: document.querySelector(".snow"),
    decorToggle: document.getElementById("decorToggle"),
    settingsBuild: document.getElementById("settingsBuild"),
    perfBtn: document.getElementById("perfBtn"),
    perfCopyBtn: document.getElementById("perfCopyBtn"),
    perfReport: document.getElementById("perfReport"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    importJsonBtn: document.getElementById("importJsonBtn"),
    importFile: document.getElementById("importFile"),
    exportIcsBtn: document.getElementById("exportIcsBtn"),
    clearDataBtn: document.getElementById("clearDataBtn"),
    installBtn: document.getElementById("installBtn"),
    installNote: document.getElementById("installNote"),
    settingsMeta: document.getElementById("settingsMeta"),
    seriesStats: document.getElementById("seriesStats"),
    templatesInput: document.getElementById("templatesInput"),
    saveNoteText: document.getElementById("saveNoteText"),
    syncUrl: document.getElementById("syncUrl"),
    syncToken: document.getElementById("syncToken"),
    syncConnectBtn: document.getElementById("syncConnectBtn"),
    syncNowBtn: document.getElementById("syncNowBtn"),
    syncStatus: document.getElementById("syncStatus"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText"),
    updateBar: document.getElementById("updateBar"),
    updateTitle: document.getElementById("updateTitle"),
    updateText: document.getElementById("updateText"),
    updateAction: document.getElementById("updateAction"),
    updateDismiss: document.getElementById("updateDismiss")
  };

  const initialToday = startOfDay(new Date());
  const stored = loadStore();

  let settingsFingerprint = "";
  let applyingRemote = false;

  const state = {
    view: stored.view,
    cursor: new Date(initialToday),
    selectedDate: toISO(initialToday),
    tasks: stored.tasks,
    series: stored.series,
    settings: stored.settings,
    editingKey: null,
    deleteConfirmKey: null,
    dialogDate: null,
    searchQuery: "",
    searchStatus: "all",
    searchType: "all"
  };

  settingsFingerprint = fingerprintSettings(state.settings);

  let knownToday = toISO(initialToday);
  let lastDayISO = null;
  let enterTimer = 0;
  let toastTimer = 0;
  let storageWarned = false;
  let deferredInstallPrompt = null;
  let suppressClickUntil = 0;
  let widgetSyncTimer = 0;
  let lastWidgetPayload = "";
  let probing = false;

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function fromISO(iso) {
    const parts = String(iso).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isValidISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
    const date = fromISO(iso);
    return !Number.isNaN(date.getTime()) && toISO(date) === iso;
  }

  function normalizeTimeValue(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : null;
  }

  function normalizeLeadValue(value) {
    const number = Number(value);
    return LEAD_OPTIONS.includes(number) ? number : null;
  }

  // Абсолютная метка напоминания: дата задачи + время. Нужна для сортировки
  // и как запасной вариант, если time поменяют отдельно.
  function remindTimestamp(iso, time) {
    if (!isValidISO(iso) || !time) return null;
    const at = new Date(`${iso}T${time}:00`);
    return Number.isNaN(at.getTime()) ? null : at.getTime();
  }

  function addDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + amount);
    return result;
  }

  function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function weekStartDay() {
    return state.settings.weekStart === 0 ? 0 : 1;
  }

  function weekOffset(date) {
    return (date.getDay() - weekStartDay() + 7) % 7;
  }

  function rotateFromMonday(list) {
    return weekStartDay() === 1 ? list : [list[6]].concat(list.slice(0, 6));
  }

  function weekdayShortLabels() {
    return rotateFromMonday(WEEKDAYS_MONDAY_FIRST);
  }

  function weekdayLongLabels() {
    return rotateFromMonday(WEEKDAYS_LONG_MONDAY_FIRST);
  }

  function startOfWeek(date) {
    const result = startOfDay(date);
    result.setDate(result.getDate() - weekOffset(result));
    return result;
  }

  function endOfMonth(year, month) {
    return new Date(year, month + 1, 0);
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function plural(number, forms) {
    const abs = Math.abs(number) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function tasksWord(number) {
    return plural(number, ["задача", "задачи", "задач"]);
  }

  function seriesWord(number) {
    return plural(number, ["серия", "серии", "серий"]);
  }

  function getISOWeek(date) {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  }

  function formatLongDate(date) {
    return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function makeId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function holidayForISO(iso) {
    if (!state.settings.showHolidays || !isValidISO(iso)) return null;
    const date = fromISO(iso);
    return HOLIDAYS[`${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`] || null;
  }

  function formatDayAria(date, count) {
    const iso = toISO(date);
    const holiday = holidayForISO(iso);
    const base = `${WEEKDAYS_FULL[date.getDay()]}, ${formatLongDate(date)}`;
    const holidayPart = holiday ? ` Праздник: ${holiday}.` : "";
    if (!count) return `${base}.${holidayPart} Задач нет. Открыть список дел.`;
    return `${base}.${holidayPart} ${count} ${tasksWord(count)}. Открыть список дел.`;
  }

  function fingerprintSettings(settings) {
    return JSON.stringify({ ...settings, updatedAt: 0 });
  }

  function normalizeStore(parsed) {
    const fallback = { view: "month", tasks: {}, series: [], settings: { ...DEFAULT_SETTINGS, updatedAt: 0 } };
    if (!parsed || typeof parsed !== "object") return fallback;

    // Структурная миграция v2→v3: метки времени, могилы, time/remindAt.
    const migrated = window.PixelSync && typeof window.PixelSync.migrateState === "function"
      ? window.PixelSync.migrateState(parsed)
      : parsed;

    const view = VIEWS.includes(migrated.view) ? migrated.view : "month";
    const tasks = {};
    if (migrated.tasks && typeof migrated.tasks === "object" && !Array.isArray(migrated.tasks)) {
      Object.keys(migrated.tasks).forEach((iso) => {
        if (!isValidISO(iso)) return;
        const source = migrated.tasks[iso];
        if (!Array.isArray(source)) return;
        const clean = source
          .filter((task) => task && typeof task.text === "string" && task.text.trim())
          .map((task) => {
            const createdAt = Number(task.createdAt) || Date.now();
            return {
              id: typeof task.id === "string" && task.id ? task.id : makeId(),
              text: task.text.trim().slice(0, 140),
              done: Boolean(task.done),
              createdAt,
              updatedAt: Number(task.updatedAt) || createdAt,
              deletedAt: Number(task.deletedAt) || null,
              time: typeof task.time === "string" ? task.time : null,
              remindAt: Number(task.remindAt) || null,
              snoozedUntil: Number(task.snoozedUntil) || null,
              leadMinutes: normalizeLeadValue(task.leadMinutes)
            };
          });
        if (clean.length) tasks[iso] = clean;
      });
    }

    const series = [];
    if (Array.isArray(migrated.series)) {
      migrated.series.forEach((raw) => {
        if (!raw || typeof raw.text !== "string" || !raw.text.trim()) return;
        const freq = REPEATS.includes(raw.freq) && raw.freq !== "none" ? raw.freq : null;
        if (!freq || !isValidISO(raw.start)) return;
        const start = raw.start;
        let end = isValidISO(raw.end) ? raw.end : null;
        if (end && end < start) end = null;
        const createdAt = Number(raw.createdAt) || Date.now();
        const updatedAt = Number(raw.updatedAt) || createdAt;
        const exceptions = {};
        if (raw.exceptions && typeof raw.exceptions === "object" && !Array.isArray(raw.exceptions)) {
          Object.keys(raw.exceptions).forEach((iso) => {
            if (!isValidISO(iso)) return;
            const ex = raw.exceptions[iso];
            if (!ex || typeof ex !== "object") return;
            const clean = { updatedAt: Number(ex.updatedAt) || updatedAt };
            if (ex.done) clean.done = true;
            if (ex.deleted) clean.deleted = true;
            if (Number(ex.snoozedUntil)) clean.snoozedUntil = Number(ex.snoozedUntil);
            // Пустая отметка хранит время снятия галочки — нужна для слияния.
            exceptions[iso] = clean;
          });
        }
        series.push({
          id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
          text: raw.text.trim().slice(0, 140),
          freq,
          start,
          end,
          time: normalizeTimeValue(raw.time),
          leadMinutes: normalizeLeadValue(raw.leadMinutes),
          createdAt,
          updatedAt,
          deletedAt: Number(raw.deletedAt) || null,
          exceptions
        });
      });
    }

    const rawSettings = migrated.settings && typeof migrated.settings === "object" ? migrated.settings : {};

    return {
      view,
      tasks,
      series,
      settings: {
        showHolidays: rawSettings.showHolidays !== false,
        profile: PROFILES.includes(rawSettings.profile) ? rawSettings.profile : DEFAULT_SETTINGS.profile,
        density: DENSITIES.includes(rawSettings.density) ? rawSettings.density : DEFAULT_SETTINGS.density,
        motion: MOTION_MODES.includes(rawSettings.motion) ? rawSettings.motion : DEFAULT_SETTINGS.motion,
        dialogAnimation: DIALOG_ANIM_MODES.includes(rawSettings.dialogAnimation)
          ? rawSettings.dialogAnimation
          : DEFAULT_SETTINGS.dialogAnimation,
        decor: rawSettings.decor !== false,
        sky: SKY_MODES.includes(rawSettings.sky) ? rawSettings.sky : DEFAULT_SETTINGS.sky,
        holiday: HOLIDAY_MODES.includes(rawSettings.holiday) ? rawSettings.holiday : DEFAULT_SETTINGS.holiday,
        weekStart: rawSettings.weekStart === 0 ? 0 : 1,
        morningDigest: rawSettings.morningDigest === true,
        templates: normalizeTemplates(rawSettings.templates),
        updatedAt: Number(rawSettings.updatedAt) || 0
      }
    };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeStore(null);
      return normalizeStore(JSON.parse(raw));
    } catch (error) {
      return normalizeStore(null);
    }
  }

  function saveStore() {
    try {
      // Настройки синхронизируются блоком, поэтому метка времени обновляется
      // только когда их содержимое действительно изменилось.
      const fingerprint = fingerprintSettings(state.settings);
      if (fingerprint !== settingsFingerprint) {
        state.settings.updatedAt = Date.now();
        settingsFingerprint = fingerprint;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 4,
        view: state.view,
        tasks: state.tasks,
        series: state.series,
        settings: state.settings
      }));
      syncNativeWidget();
      if (window.PixelSync && !applyingRemote) {
        window.PixelSync.scheduleSync(2000);
      }
      if (window.PixelNotify) {
        window.PixelNotify.schedule(state.tasks, state.series, 900, state.settings);
      }
      return true;
    } catch (error) {
      if (!storageWarned) {
        storageWarned = true;
        showToast("Браузер не разрешил сохранить данные");
      }
      return false;
    }
  }

  function buildWidgetPayload() {
    const iso = toISO(startOfDay(new Date()));
    const date = fromISO(iso);
    const entries = getEntries(iso);
    return {
      date: iso,
      label: formatLongDate(date),
      weekday: WEEKDAYS_FULL[date.getDay()],
      holiday: holidayForISO(iso) || "",
      phase: resolveDaytime(),
      sky: state.settings.sky || "auto",
      done: entries.filter((entry) => entry.done).length,
      total: entries.length,
      tasks: entries.slice(0, 8).map((entry) => ({
        text: entry.text.slice(0, 80),
        done: entry.done,
        series: entry.isSeries
      }))
    };
  }

  function nativeWidgetPlugin() {
    const capacitor = window.Capacitor;
    if (!capacitor || typeof capacitor.isNativePlatform !== "function" || !capacitor.isNativePlatform()) {
      return null;
    }
    if (typeof capacitor.registerPlugin === "function") {
      return capacitor.registerPlugin("WidgetBridge");
    }
    return capacitor.Plugins && capacitor.Plugins.WidgetBridge ? capacitor.Plugins.WidgetBridge : null;
  }

  function syncNativeWidget() {
    const plugin = nativeWidgetPlugin();
    if (!plugin || typeof plugin.sync !== "function") return;
    window.clearTimeout(widgetSyncTimer);
    widgetSyncTimer = window.setTimeout(() => {
      try {
        const payload = JSON.stringify(buildWidgetPayload());
        // Виджет перерисовывается только когда данные действительно изменились.
        if (payload === lastWidgetPayload) return;
        lastWidgetPayload = payload;
        Promise.resolve(plugin.sync({ payload })).catch(() => {});
      } catch (error) {
        // The native widget is optional and must never break the web app.
      }
    }, 250);
  }

  function isSeriesActiveOn(series, iso) {
    if (!series || series.deletedAt || !isValidISO(iso)) return false;
    if (iso < series.start) return false;
    if (series.end && iso > series.end) return false;
    const exception = series.exceptions && series.exceptions[iso];
    if (exception && exception.deleted) return false;
    const date = fromISO(iso);
    const start = fromISO(series.start);
    const diff = Math.round((date - start) / 86400000);
    if (diff < 0) return false;
    if (series.freq === "daily") return true;
    if (series.freq === "weekdays") return date.getDay() >= 1 && date.getDay() <= 5;
    if (series.freq === "weekly") return diff % 7 === 0 && date.getDay() === start.getDay();
    if (series.freq === "monthly") return date.getDate() === start.getDate();
    if (series.freq === "yearly") {
      return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
    }
    return false;
  }

  function seriesStatsFor(series) {
    const helpers = window.PixelSeriesStats;
    if (!helpers || !series) return null;
    return helpers.summarize(series, toISO(new Date()), isSeriesActiveOn);
  }

  // Быстрые дела: строки из настроек, очищенные от пустых и повторов.
  function normalizeTemplates(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const list = [];
    raw.forEach((value) => {
      if (typeof value !== "string") return;
      const text = value.trim().replace(/\s+/g, " ").slice(0, TEMPLATE_MAX_LENGTH);
      if (!text || seen.has(text)) return;
      seen.add(text);
      list.push(text);
    });
    return list.slice(0, MAX_TEMPLATES);
  }

  function getEntries(iso) {
    const tasks = (state.tasks[iso] || [])
      .filter((task) => !task.deletedAt)
      .map((task) => ({
      key: task.id,
      taskId: task.id,
      seriesId: null,
      text: task.text,
      done: task.done,
      createdAt: task.createdAt || 0,
      time: task.time || null,
      isSeries: false,
      series: null
    }));

    const recurring = state.series
      .filter((series) => isSeriesActiveOn(series, iso))
      .map((series) => {
        const exception = series.exceptions[iso] || {};
        return {
          key: `${series.id}@${iso}`,
          taskId: null,
          seriesId: series.id,
          text: series.text,
          done: Boolean(exception.done),
          createdAt: series.createdAt || 0,
          time: series.time || null,
          isSeries: true,
          series
        };
      });

    return tasks.concat(recurring).sort((a, b) => a.createdAt - b.createdAt);
  }

  function getEntryByKey(iso, key) {
    return getEntries(iso).find((entry) => entry.key === key) || null;
  }

  function getSeriesById(id) {
    return state.series.find((series) => series.id === id) || null;
  }

  function nextSeriesOccurrence(series, fromIso) {
    let cursor = fromISO(series.start > fromIso ? series.start : fromIso);
    for (let index = 0; index < 800; index += 1) {
      const iso = toISO(cursor);
      if (isSeriesActiveOn(series, iso)) return iso;
      cursor = addDays(cursor, 1);
    }
    return null;
  }

  function seriesSchedule(series) {
    const start = fromISO(series.start);
    let label;
    if (series.freq === "daily") {
      label = "каждый день";
    } else if (series.freq === "weekdays") {
      label = "по будням";
    } else if (series.freq === "weekly") {
      const weekday = WEEKDAYS_LONG_MONDAY_FIRST[(start.getDay() + 6) % 7].toLowerCase();
      label = `каждый ${weekday}`;
    } else if (series.freq === "monthly") {
      label = `${start.getDate()}-го числа каждого месяца`;
    } else {
      label = `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} — каждый год`;
    }
    if (series.end) label += ` · до ${formatLongDate(fromISO(series.end))}`;
    return label;
  }

  function statsForRange(start, end) {
    let total = 0;
    let done = 0;
    let cursor = startOfDay(start);
    const last = startOfDay(end);
    while (cursor <= last) {
      const entries = getEntries(toISO(cursor));
      total += entries.length;
      done += entries.filter((entry) => entry.done).length;
      cursor = addDays(cursor, 1);
    }
    return { total, done, remaining: total - done };
  }

  function getVisiblePeriod() {
    const year = state.cursor.getFullYear();
    const month = state.cursor.getMonth();

    if (state.view === "week") {
      const start = startOfWeek(state.cursor);
      return { start, end: addDays(start, 6) };
    }
    if (state.view === "month") {
      return { start: new Date(year, month, 1), end: endOfMonth(year, month) };
    }
    if (state.view === "quarter") {
      const startMonth = Math.floor(month / 3) * 3;
      return { start: new Date(year, startMonth, 1), end: endOfMonth(year, startMonth + 2) };
    }
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  }

  function getQuarterStart(date) {
    return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  }

  function monthTitle(year, month) {
    return `${MONTHS_NOMINATIVE[month]} ${year}`;
  }

  function weekTitle(start) {
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} — ${end.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} ${start.getFullYear()}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} — ${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} ${start.getFullYear()} — ${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]} ${end.getFullYear()}`;
  }

  function periodCopy() {
    const year = state.cursor.getFullYear();
    const month = state.cursor.getMonth();

    if (state.view === "week") {
      const start = startOfWeek(state.cursor);
      return {
        kicker: `Недельный вид · ${getISOWeek(state.cursor)}-я неделя`,
        title: weekTitle(start)
      };
    }
    if (state.view === "month") {
      return {
        kicker: `Месячный вид · ${getISOWeek(state.cursor)}-я неделя года`,
        title: monthTitle(year, month)
      };
    }
    if (state.view === "quarter") {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        kicker: `Квартальный вид · ${MONTHS_NOMINATIVE[quarterStart].toLowerCase()} — ${MONTHS_NOMINATIVE[quarterStart + 2].toLowerCase()}`,
        title: `${ROMAN_QUARTERS[Math.floor(month / 3)]} квартал ${year}`
      };
    }
    return {
      kicker: "Годовой вид · 12 месяцев",
      title: `${year} год`
    };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function icon(id) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${id}`);
    svg.appendChild(use);
    return svg;
  }

  function updateTodayLabel() {
    const today = startOfDay(new Date());
    els.todayLabel.textContent = formatLongDate(today);
    els.todayChip.title = `${capitalize(WEEKDAYS_FULL[today.getDay()])}, ${formatLongDate(today)}`;
  }

  function renderTabs() {
    els.viewTabs.forEach((tab) => {
      const active = tab.dataset.view === state.view;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
  }

  function renderPeriod() {
    const copy = periodCopy();
    els.periodKicker.textContent = copy.kicker;
    els.periodTitle.textContent = copy.title;
    els.yearJumpBtn.classList.toggle("is-2027", state.cursor.getFullYear() === 2027);
  }

  function renderQuickAddDate() {
    if (!state.selectedDate) return;
    const date = fromISO(state.selectedDate);
    const today = isSameDay(date, new Date());
    const short = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
    els.quickAddDate.textContent = today ? `сегодня, ${short}` : `${short} ${date.getFullYear()}`;
    els.quickAddDate.title = `Быстрое добавление на ${formatLongDate(date)}`;
  }

  function renderProgress() {
    const period = getVisiblePeriod();
    const stats = statsForRange(period.start, period.end);
    const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

    els.progressValue.textContent = `${stats.done} / ${stats.total}`;
    els.progressBar.style.width = `${percent}%`;
    els.progressCard.setAttribute("aria-label", `Выполнено ${stats.done} из ${stats.total} задач`);

    if (stats.total === 0) {
      els.progressNote.textContent = "Пока нет задач";
    } else if (stats.remaining === 0) {
      els.progressNote.textContent = "Все дела готовы — красота!";
    } else {
      els.progressNote.textContent = `Осталось ${stats.remaining} ${plural(stats.remaining, ["дело", "дела", "дел"])}`;
    }
  }

  function makeDayBadges(taskCount, today, holiday) {
    const badges = el("span", "day-badges");
    if (holiday) {
      const star = el("span", "holiday-star", "★");
      star.setAttribute("aria-hidden", "true");
      star.title = holiday;
      badges.appendChild(star);
    }
    if (today) {
      const pin = el("span", "today-pin", "сегодня");
      pin.setAttribute("aria-hidden", "true");
      badges.appendChild(pin);
    }
    if (taskCount) {
      const count = el("span", "task-count", String(taskCount));
      count.setAttribute("aria-hidden", "true");
      badges.appendChild(count);
    }
    return badges;
  }

  function makeTaskPill(entry, iso) {
    const classes = `task-pill${entry.done ? " is-done" : ""}${entry.isSeries ? " is-series" : ""}`;
    const pill = el("span", classes, entry.text);
    pill.title = entry.isSeries ? `${entry.text} · ${seriesSchedule(entry.series)}` : entry.text;
    if (!entry.isSeries) {
      pill.draggable = true;
      pill.dataset.dragTask = entry.key;
      pill.dataset.dragFrom = iso;
    }
    return pill;
  }

  function makeDayDots(entries) {
    const dots = el("span", "day-dots");
    dots.setAttribute("aria-hidden", "true");
    entries.slice(0, 4).forEach((entry) => {
      dots.appendChild(el("span", `day-dot${entry.done ? " is-done" : ""}${entry.isSeries ? " is-series" : ""}`));
    });
    return dots;
  }

  function createMonthDay(date, options) {
    const opts = options || {};
    const iso = toISO(date);
    const entries = getEntries(iso);
    const today = isSameDay(date, new Date());
    const selected = state.selectedDate === iso;
    const outside = Boolean(opts.outside);
    const holiday = holidayForISO(iso);

    const button = el("button", "day-cell");
    button.type = "button";
    button.dataset.date = iso;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-label", formatDayAria(date, entries.length));
    if (holiday) button.classList.add("is-holiday");
    if (isWeekend(date)) button.classList.add("is-weekend");
    if (outside) button.classList.add("is-outside");
    if (today) {
      button.classList.add("is-today");
      button.setAttribute("aria-current", "date");
    }
    if (selected) button.classList.add("is-selected");

    const top = el("span", "day-top");
    top.appendChild(el("span", "day-number", String(date.getDate())));
    top.appendChild(makeDayBadges(entries.length, today, holiday));
    button.appendChild(top);

    if (holiday) {
      const label = el("span", "day-holiday", holiday);
      label.title = holiday;
      button.appendChild(label);
    }

    if (entries.length) {
      const preview = el("span", "day-tasks");
      entries.slice(0, 3).forEach((entry) => preview.appendChild(makeTaskPill(entry, iso)));
      if (entries.length > 3) {
        preview.appendChild(el("span", "task-more", `+${entries.length - 3}`));
      }
      button.appendChild(preview);
      button.appendChild(makeDayDots(entries));
    }

    const add = el("span", "day-add");
    add.setAttribute("aria-hidden", "true");
    add.appendChild(icon("plus"));
    button.appendChild(add);
    return button;
  }

  function renderMonthView() {
    const year = state.cursor.getFullYear();
    const month = state.cursor.getMonth();
    const first = new Date(year, month, 1);
    const offset = weekOffset(first);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const gridStart = addDays(first, -offset);

    const wrapper = el("div", "month-calendar");
    const weekdays = el("div", "weekday-row");
    weekdayShortLabels().forEach((name, index) => {
      const item = el("span", "weekday-name", name);
      const weekday = (weekStartDay() + index) % 7;
      if (weekday === 0 || weekday === 6) item.classList.add("is-weekend");
      weekdays.appendChild(item);
    });

    const grid = el("div", "month-grid");
    for (let index = 0; index < totalCells; index += 1) {
      const date = addDays(gridStart, index);
      grid.appendChild(createMonthDay(date, { outside: date.getMonth() !== month }));
    }

    wrapper.append(weekdays, grid);
    return wrapper;
  }

  function renderWeekView() {
    const start = startOfWeek(state.cursor);
    const wrapper = el("div", "week-grid");

    for (let index = 0; index < 7; index += 1) {
      const date = addDays(start, index);
      const iso = toISO(date);
      const entries = getEntries(iso);
      const today = isSameDay(date, new Date());
      const selected = state.selectedDate === iso;
      const holiday = holidayForISO(iso);

      const card = el("button", "week-day");
      card.type = "button";
      card.dataset.date = iso;
      card.setAttribute("aria-haspopup", "dialog");
      card.setAttribute("aria-label", formatDayAria(date, entries.length));
      if (holiday) card.classList.add("is-holiday");
      if (isWeekend(date)) card.classList.add("is-weekend");
      if (today) {
        card.classList.add("is-today");
        card.setAttribute("aria-current", "date");
      }
      if (selected) card.classList.add("is-selected");

      const top = el("span", "week-day-top");
      top.appendChild(el("span", "week-day-name", weekdayLongLabels()[index]));

      const dateLine = el("span", "week-date-line");
      const dateBox = el("span");
      dateBox.append(
        el("span", "week-date", String(date.getDate())),
        document.createTextNode(" "),
        el("span", "week-month", MONTHS_SHORT_WEEK[date.getMonth()])
      );
      dateLine.appendChild(dateBox);
      if (today) {
        const pin = el("span", "today-pin", "сегодня");
        pin.setAttribute("aria-hidden", "true");
        dateLine.appendChild(pin);
      }
      top.appendChild(dateLine);

      if (holiday) {
        const holidayLine = el("span", "week-holiday");
        const star = el("span", "holiday-star", "★");
        star.setAttribute("aria-hidden", "true");
        holidayLine.append(star, document.createTextNode(holiday));
        top.appendChild(holidayLine);
      }
      card.appendChild(top);

      const taskBox = el("span", "week-tasks");
      if (entries.length) {
        entries.forEach((entry) => {
          const row = el("span", `week-task${entry.done ? " is-done" : ""}${entry.isSeries ? " is-series" : ""}`);
          if (!entry.isSeries) {
            row.draggable = true;
            row.dataset.dragTask = entry.key;
            row.dataset.dragFrom = iso;
            row.title = `${entry.text} — перетащите на другой день`;
          } else {
            row.title = `${entry.text} · ${seriesSchedule(entry.series)}`;
          }
          const cube = el("span", "week-task-cube");
          cube.setAttribute("aria-hidden", "true");
          const text = el("span", "week-task-text", entry.text);
          row.append(cube, text);
          if (entry.isSeries) {
            const repeat = el("span", "week-task-repeat", "↻");
            repeat.setAttribute("aria-hidden", "true");
            row.appendChild(repeat);
          }
          taskBox.appendChild(row);
        });
      } else {
        taskBox.appendChild(el("span", "week-empty", "Свободный день. Самое время для маленького приключения."));
      }
      card.appendChild(taskBox);

      const add = el("span", "week-add");
      add.appendChild(icon("plus"));
      add.appendChild(document.createTextNode("добавить"));
      add.setAttribute("aria-hidden", "true");
      card.appendChild(add);

      wrapper.appendChild(card);
    }

    return wrapper;
  }

  function createMiniMonth(year, month) {
    const card = el("section", "mini-month");
    card.setAttribute("aria-label", monthTitle(year, month));

    const head = el("div", "mini-head");
    head.appendChild(el("h3", "mini-title", MONTHS_NOMINATIVE[month]));
    head.appendChild(el("span", "mini-year", String(year)));
    card.appendChild(head);

    const weekdays = el("div", "mini-weekdays");
    weekdayShortLabels().forEach((name) => weekdays.appendChild(el("span", "mini-weekday", name)));
    card.appendChild(weekdays);

    const grid = el("div", "mini-grid");
    const first = new Date(year, month, 1);
    const offset = weekOffset(first);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    for (let index = 0; index < totalCells; index += 1) {
      const dayNumber = index - offset + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        const empty = el("span", "mini-empty");
        empty.setAttribute("aria-hidden", "true");
        grid.appendChild(empty);
        continue;
      }

      const date = new Date(year, month, dayNumber);
      const iso = toISO(date);
      const entries = getEntries(iso);
      const today = isSameDay(date, new Date());
      const selected = state.selectedDate === iso;
      const holiday = holidayForISO(iso);
      const allDone = entries.length > 0 && entries.every((entry) => entry.done);

      const button = el("button", "mini-day", String(dayNumber));
      button.type = "button";
      button.dataset.date = iso;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-label", formatDayAria(date, entries.length));
      if (holiday) {
        button.classList.add("is-holiday");
        button.title = holiday;
      }
      if (today) {
        button.classList.add("is-today");
        button.setAttribute("aria-current", "date");
      }
      if (selected) button.classList.add("is-selected");
      if (entries.length) button.classList.add("has-tasks");
      if (allDone) button.classList.add("all-done");
      grid.appendChild(button);
    }

    card.appendChild(grid);
    return card;
  }

  function renderQuarterView() {
    const start = getQuarterStart(state.cursor);
    const wrapper = el("div", "months-grid");
    for (let index = 0; index < 3; index += 1) {
      const date = addMonths(start, index);
      wrapper.appendChild(createMiniMonth(date.getFullYear(), date.getMonth()));
    }
    return wrapper;
  }

  function renderYearView() {
    const year = state.cursor.getFullYear();
    const wrapper = el("div", "year-grid");
    for (let month = 0; month < 12; month += 1) {
      wrapper.appendChild(createMiniMonth(year, month));
    }
    return wrapper;
  }

  // Подгоняет высоту строк месяца под окно: на сайте и планшете весь месяц
  // должен быть виден без прокрутки. Узкие экраны не трогаем.
  function fitMonthView() {
    const root = document.documentElement;
    if (state.view !== "month" || !window.matchMedia("(min-width: 761px)").matches) {
      root.style.removeProperty("--month-row");
      delete root.dataset.monthFit;
      delete root.dataset.monthTight;
      return;
    }

    const grid = els.calendarView.querySelector(".month-grid");
    if (!grid) return;

    const rows = Math.max(1, Math.round(grid.children.length / 7));
    const shell = document.querySelector(".page-shell");
    // Координата от начала документа: прокрутка не должна влиять на высоту строк.
    const gridTop = grid.getBoundingClientRect().top + window.scrollY;

    // Сколько места занимает всё, что ниже сетки (подвалы и отступы).
    // Величина не зависит от высоты самой сетки, поэтому её можно мерить прямо.
    const reserveBelow = () => Math.round(
      shell.getBoundingClientRect().bottom - grid.getBoundingClientRect().bottom,
    );

    const rowsFor = (space) => {
      let gap = 6;
      let raw = Math.floor((space - gap * (rows - 1)) / rows);
      if (raw < 88) {
        gap = 4;
        raw = Math.floor((space - gap * (rows - 1)) / rows);
      }
      return raw;
    };

    const spaceFor = (reserve) => window.innerHeight - gridTop - reserve - 8;

    // Пара проходов: после смены высоты строк низ страницы смещается,
    // поэтому запас меряем заново и уточняем результат.
    const solve = () => {
      let rowHeight = 0;
      for (let pass = 0; pass < 3; pass += 1) {
        const next = Math.max(44, Math.min(130, rowsFor(spaceFor(reserveBelow()))));
        if (next === rowHeight) break;
        rowHeight = next;
        root.style.setProperty("--month-row", `${rowHeight}px`);
        void grid.offsetHeight;
      }
      return rowHeight;
    };

    // Сначала пробуем с подвалом страницы; если строки уже теряют подписи дел,
    // убираем декоративный подвал и считаем заново — он отдаёт сетке около 50px.
    delete root.dataset.monthTight;
    let rowHeight = solve();
    if (rowHeight < 62) {
      root.dataset.monthTight = "on";
      rowHeight = solve();
    }

    root.style.setProperty("--month-row", `${rowHeight}px`);
    root.dataset.monthFit = rowHeight < 62 ? "tight" : (rowHeight < 88 ? "compact" : "full");
  }

  let fitMonthTimer = 0;

  function scheduleFitMonth() {
    window.clearTimeout(fitMonthTimer);
    fitMonthTimer = window.setTimeout(fitMonthView, 80);
  }

  function renderCalendar(animate) {
    let viewNode;
    if (state.view === "week") viewNode = renderWeekView();
    else if (state.view === "quarter") viewNode = renderQuarterView();
    else if (state.view === "year") viewNode = renderYearView();
    else viewNode = renderMonthView();

    els.calendarView.replaceChildren(viewNode);
    fitMonthView();
    window.clearTimeout(fitMonthTimer);
    // Повторный расчёт после загрузки шрифтов и переносов в тулбаре.
    fitMonthTimer = window.setTimeout(fitMonthView, 150);
    window.clearTimeout(enterTimer);

    if (animate) {
      els.calendarView.classList.remove("is-entering");
      void els.calendarView.offsetWidth;
      els.calendarView.classList.add("is-entering");
      enterTimer = window.setTimeout(() => {
        els.calendarView.classList.remove("is-entering");
      }, 480);
    } else {
      els.calendarView.classList.remove("is-entering");
    }
  }

  function renderAll(animate) {
    renderTabs();
    renderPeriod();
    renderProgress();
    renderQuickAddDate();
    renderCalendar(Boolean(animate));
  }

  function changeView(view) {
    if (!VIEWS.includes(view) || view === state.view) return;
    state.view = view;
    saveStore();
    renderAll(true);
  }

  function shiftPeriod(direction) {
    if (state.view === "week") {
      state.cursor = addDays(state.cursor, direction * 7);
    } else if (state.view === "month") {
      state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + direction, 1);
    } else if (state.view === "quarter") {
      state.cursor = addMonths(getQuarterStart(state.cursor), direction * 3);
    } else {
      state.cursor = new Date(state.cursor.getFullYear() + direction, 0, 1);
    }
    renderAll(true);
  }

  function goToToday() {
    const today = startOfDay(new Date());
    state.cursor = new Date(today);
    state.selectedDate = toISO(today);
    renderAll(true);
    showToast("Вернулись к актуальной дате");
  }

  function goTo2027() {
    state.cursor = new Date(2027, 0, 1);
    state.selectedDate = "2027-01-01";
    renderAll(true);
    showToast("Открыт 2027 год");
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function hideDialog(dialog) {
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function markSelected(iso, selected) {
    if (!iso) return;
    els.calendarView.querySelectorAll(`[data-date="${iso}"]`).forEach((node) => {
      node.classList.toggle("is-selected", selected);
    });
  }

  // Обновляет только подсветку выбранного дня, не перестраивая весь вид.
  function selectDate(iso) {
    const previous = state.selectedDate;
    if (previous === iso) return;
    state.selectedDate = iso;
    markSelected(previous, false);
    markSelected(iso, true);
    renderQuickAddDate();
  }

  function openDay(iso) {
    const date = fromISO(iso);
    if (Number.isNaN(date.getTime())) return;
    selectDate(iso);
    state.dialogDate = iso;
    state.editingKey = null;
    state.deleteConfirmKey = null;
    lastDayISO = iso;
    populateDialog();
    els.formError.textContent = "";
    els.taskInput.value = "";
    els.taskRepeat.value = "none";
    els.taskRepeatEnd.value = "";
    els.taskTime.value = "";
    els.taskLead.value = "";
    updateRepeatFields();
    renderTemplateChips();
    showDialog(els.dialog);
  }

  function closeDayDialog() {
    hideDialog(els.dialog);
  }

  function summarizeTasks(entries) {
    const total = entries.length;
    const done = entries.filter((entry) => entry.done).length;
    if (total === 0) return { total, done, text: "Пока пусто" };
    if (done === total) {
      if (total === 1) return { total, done, text: "Задача выполнена!" };
      return { total, done, text: "Все задачи выполнены!" };
    }
    if (done === 0) {
      return { total, done, text: `${total} ${tasksWord(total)} в плане` };
    }
    return { total, done, text: `${done} из ${total} выполнено` };
  }

  function populateDialog() {
    if (!state.dialogDate) return;
    const date = fromISO(state.dialogDate);
    const entries = getEntries(state.dialogDate);
    const summary = summarizeTasks(entries);
    const percent = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
    const holiday = holidayForISO(state.dialogDate);

    els.dialogEyebrow.textContent = holiday
      ? `${WEEKDAYS_FULL[date.getDay()]} · ${holiday}`
      : WEEKDAYS_FULL[date.getDay()];
    els.dialogTitle.textContent = formatLongDate(date);
    els.daySummaryText.textContent = summary.text;
    els.dayProgressBar.style.width = `${percent}%`;
    els.taskList.setAttribute("aria-label", `Задачи на ${formatLongDate(date)}`);
    renderTaskList();
  }

  // Быстрые дела в окне дня: одно нажатие — дело уже в сундуке.
  function renderTemplateChips() {
    if (!els.templateChips) return;
    const templates = state.settings.templates;
    els.templateChips.replaceChildren();
    els.templateChips.hidden = !templates.length;
    templates.forEach((text) => {
      const button = el("button", "chip-btn template-chip", text);
      button.type = "button";
      button.dataset.template = text;
      els.templateChips.appendChild(button);
    });
  }

  function renderTaskList() {
    const iso = state.dialogDate;
    if (!iso) return;
    const entries = getEntries(iso);
    els.taskList.replaceChildren();

    if (!entries.length) {
      const empty = el("li", "empty-state");
      const tpl = document.getElementById("emptyChestTemplate");
      if (tpl) empty.appendChild(tpl.content.cloneNode(true));
      els.taskList.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const item = el("li", `task-item${entry.done ? " is-done" : ""}${entry.isSeries ? " is-series" : ""}`);
      item.dataset.taskKey = entry.key;

      const checkWrap = el("label", "task-check-wrap");
      const checkbox = el("input", "task-check");
      checkbox.type = "checkbox";
      checkbox.checked = entry.done;
      checkbox.dataset.action = "toggle";
      checkbox.dataset.taskKey = entry.key;
      checkbox.setAttribute("aria-label", `${entry.done ? "Снять отметку" : "Отметить выполненной"}: ${entry.text}`);
      const mark = el("span", "task-checkmark");
      mark.setAttribute("aria-hidden", "true");
      checkWrap.append(checkbox, mark);
      item.appendChild(checkWrap);

      if (state.editingKey === entry.key) {
        const form = el("form", "task-edit-form");
        form.dataset.editTaskKey = entry.key;
        const input = el("input", "task-edit-input");
        input.type = "text";
        input.maxLength = 140;
        input.required = true;
        input.value = entry.text;
        input.setAttribute("aria-label", "Новое название задачи");

        if (!entry.isSeries) {
          const dateInput = el("input", "task-edit-date");
          dateInput.type = "date";
          dateInput.value = iso;
          dateInput.setAttribute("aria-label", "Дата задачи");
          const timeInput = el("input", "task-edit-time");
          timeInput.type = "time";
          timeInput.value = entry.time || "";
          timeInput.setAttribute("aria-label", "Время напоминания");
          form.append(input, dateInput, timeInput);
        } else {
          const streak = seriesStatsFor(entry.series);
          const noteText = streak && streak.current > 0
            ? `Изменится вся серия · подряд ${streak.current}`
            : "Изменится вся серия";
          const note = el("span", "series-edit-note", noteText);
          note.title = seriesSchedule(entry.series);
          const timeInput = el("input", "task-edit-time");
          timeInput.type = "time";
          timeInput.value = entry.time || "";
          timeInput.setAttribute("aria-label", "Время напоминания для серии");
          form.append(input, timeInput, note);
        }

        const save = el("button", "task-edit-save");
        save.type = "submit";
        save.setAttribute("aria-label", "Сохранить задачу");
        save.appendChild(icon("check"));

        const cancel = el("button", "task-edit-cancel");
        cancel.type = "button";
        cancel.dataset.action = "cancel-edit";
        cancel.dataset.taskKey = entry.key;
        cancel.setAttribute("aria-label", "Отменить редактирование");
        cancel.appendChild(icon("close"));

        form.append(save, cancel);
        item.appendChild(form);
      } else {
        const textWrap = el("div", "task-text-wrap");
        textWrap.appendChild(el("span", "task-text", entry.text));
        textWrap.appendChild(el("span", "task-meta", entry.isSeries
          ? `↻ ${seriesSchedule(entry.series)}${entry.time ? ` · ${entry.time}` : ""}`
          : entry.time ? `${entry.time} · напоминание` : "Обычное дело"));
        item.appendChild(textWrap);

        const actions = el("div", "task-actions");
        const google = el("a", "task-action google");
        google.href = googleCalendarUrl(entry, iso);
        google.target = "_blank";
        google.rel = "noopener";
        google.title = "Добавить в Google Календарь";
        google.setAttribute("aria-label", `Добавить в Google Календарь: ${entry.text}`);
        google.appendChild(icon("calendar"));
        google.addEventListener("click", () => showToast("Открываю Google Календарь"));

        const edit = el("button", "task-action");
        edit.type = "button";
        edit.dataset.action = "edit";
        edit.dataset.taskKey = entry.key;
        edit.setAttribute("aria-label", `Редактировать: ${entry.text}`);
        edit.appendChild(icon("edit"));

        const remove = el("button", "task-action delete");
        remove.type = "button";
        remove.dataset.action = "delete";
        remove.dataset.taskKey = entry.key;
        remove.setAttribute("aria-label", `Удалить: ${entry.text}`);
        remove.appendChild(icon("trash"));

        actions.append(google, edit, remove);
        item.appendChild(actions);
      }

      if (state.deleteConfirmKey === entry.key && entry.isSeries) {
        const confirm = el("div", "delete-confirm");
        confirm.appendChild(el("span", "delete-confirm-text", "Удалить повторяющееся дело?"));
        const dayBtn = el("button", "delete-confirm-btn", "Только этот день");
        dayBtn.type = "button";
        dayBtn.dataset.action = "delete-occurrence";
        dayBtn.dataset.taskKey = entry.key;
        const seriesBtn = el("button", "delete-confirm-btn is-danger", "Всю серию");
        seriesBtn.type = "button";
        seriesBtn.dataset.action = "delete-series";
        seriesBtn.dataset.taskKey = entry.key;
        const cancelBtn = el("button", "delete-confirm-btn", "Отмена");
        cancelBtn.type = "button";
        cancelBtn.dataset.action = "cancel-delete";
        cancelBtn.dataset.taskKey = entry.key;
        confirm.append(dayBtn, seriesBtn, cancelBtn);
        item.appendChild(confirm);
      }

      els.taskList.appendChild(item);
    });
  }

  function refreshDialogSummary() {
    if (!state.dialogDate) return;
    const entries = getEntries(state.dialogDate);
    const summary = summarizeTasks(entries);
    const percent = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
    els.daySummaryText.textContent = summary.text;
    els.dayProgressBar.style.width = `${percent}%`;
  }

  function updateMainAfterTaskChange() {
    renderProgress();
    renderCalendar(false);
  }

  function updateRepeatFields() {
    const active = els.taskRepeat.value !== "none";
    const hasTime = Boolean(normalizeTimeValue(els.taskTime.value));
    els.repeatEndWrap.hidden = !active;
    els.taskLeadWrap.hidden = !hasTime;
    if (!hasTime) els.taskLead.value = "";
    if (active) {
      els.taskRepeatEnd.min = state.dialogDate || "";
      els.repeatHint.textContent = "Серия появится во всех подходящих днях, а время включит напоминание в каждый такой день. Отметки и удаления хранятся отдельно для каждого дня.";
    } else {
      els.taskRepeatEnd.value = "";
      els.repeatHint.textContent = "Время включает напоминание в приложении. Повторяющиеся дела видны во всех подходящих днях.";
    }
  }

  function addTask(text) {
    if (!state.dialogDate) return;
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) {
      els.formError.textContent = "Напиши, что нужно сделать.";
      els.taskInput.focus();
      return;
    }

    const repeat = REPEATS.includes(els.taskRepeat.value) ? els.taskRepeat.value : "none";
    const time = normalizeTimeValue(els.taskTime.value);
    const leadMinutes = time ? normalizeLeadValue(els.taskLead.value) : null;
    if (repeat !== "none") {
      const end = els.taskRepeatEnd.value;
      if (end && (!isValidISO(end) || end < state.dialogDate)) {
        els.formError.textContent = "Дата окончания не может быть раньше начала серии.";
        els.taskRepeatEnd.focus();
        return;
      }
      state.series.push({
        id: makeId(),
        text: clean.slice(0, 140),
        freq: repeat,
        start: state.dialogDate,
        end: end || null,
        time,
        leadMinutes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
        exceptions: {}
      });
      showToast(time ? `Серия создана · напоминание в ${time}` : "Повторяющаяся серия создана");
    } else {
      const task = {
        id: makeId(),
        text: clean.slice(0, 140),
        done: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
        time,
        leadMinutes,
        remindAt: remindTimestamp(state.dialogDate, time)
      };
      if (!state.tasks[state.dialogDate]) state.tasks[state.dialogDate] = [];
      state.tasks[state.dialogDate].push(task);
      showToast("Задача добавлена в сундук");
    }

    saveStore();
    els.taskInput.value = "";
    els.taskRepeat.value = "none";
    els.taskRepeatEnd.value = "";
    els.taskTime.value = "";
    els.taskLead.value = "";
    updateRepeatFields();
    els.formError.textContent = "";
    renderTaskList();
    refreshDialogSummary();
    updateMainAfterTaskChange();
    els.taskInput.focus();
  }

  function toggleTask(key, checked) {
    if (!state.dialogDate) return;
    const entry = getEntryByKey(state.dialogDate, key);
    if (!entry) return;

    if (entry.isSeries) {
      const series = getSeriesById(entry.seriesId);
      if (!series) return;
      const exception = series.exceptions[state.dialogDate] || {};
      if (checked) exception.done = true;
      else delete exception.done;
      if (checked) delete exception.snoozedUntil;
      exception.updatedAt = Date.now();
      // Отметка остаётся даже без done/deleted: время снятия галочки
      // должно побеждать старую отметку с другого устройства.
      series.exceptions[state.dialogDate] = exception;
      series.updatedAt = exception.updatedAt;
    } else {
      const task = (state.tasks[state.dialogDate] || []).find((item) => item.id === entry.taskId);
      if (!task) return;
      task.done = checked;
      if (checked) task.snoozedUntil = null;
      task.updatedAt = Date.now();
    }

    saveStore();
    renderTaskList();
    refreshDialogSummary();
    updateMainAfterTaskChange();
    showToast(checked ? "Готово! Ещё одно дело в кармане" : "Задача снова в планах");
  }

  function startEditingTask(key) {
    if (!state.dialogDate) return;
    const entry = getEntryByKey(state.dialogDate, key);
    if (!entry) return;
    state.editingKey = key;
    renderTaskList();
    const input = els.taskList.querySelector(".task-edit-input");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function saveEditedTask(key, form) {
    if (!state.dialogDate) return;
    const entry = getEntryByKey(state.dialogDate, key);
    if (!entry) return;
    const input = form.querySelector(".task-edit-input");
    if (!input) return;
    const clean = input.value.trim().replace(/\s+/g, " ");
    if (!clean) {
      showToast("Название задачи не может быть пустым");
      input.focus();
      return;
    }

    if (entry.isSeries) {
      const series = getSeriesById(entry.seriesId);
      if (!series) return;
      const timeInput = form.querySelector(".task-edit-time");
      series.text = clean.slice(0, 140);
      series.time = normalizeTimeValue(timeInput ? timeInput.value : series.time);
      series.updatedAt = Date.now();
      state.editingKey = null;
      saveStore();
      renderTaskList();
      refreshDialogSummary();
      updateMainAfterTaskChange();
      showToast(series.time ? `Серия обновлена · напоминание в ${series.time}` : "Серия обновлена");
      return;
    }

    const task = (state.tasks[state.dialogDate] || []).find((item) => item.id === entry.taskId);
    if (!task) return;
    const dateInput = form.querySelector(".task-edit-date");
    const timeInput = form.querySelector(".task-edit-time");
    const newISO = dateInput && dateInput.value ? dateInput.value : state.dialogDate;
    if (!isValidISO(newISO)) {
      showToast("Некорректная дата");
      return;
    }

    task.text = clean.slice(0, 140);
    task.time = normalizeTimeValue(timeInput ? timeInput.value : task.time);
    task.remindAt = remindTimestamp(newISO, task.time);
    task.updatedAt = Date.now();
    const moved = newISO !== state.dialogDate;
    if (moved) {
      const source = state.tasks[state.dialogDate] || [];
      const index = source.findIndex((item) => item.id === task.id);
      if (index >= 0) source.splice(index, 1);
      if (!source.length) delete state.tasks[state.dialogDate];
      if (!state.tasks[newISO]) state.tasks[newISO] = [];
      state.tasks[newISO].push(task);
      state.dialogDate = newISO;
      state.selectedDate = newISO;
    }

    state.editingKey = null;
    saveStore();
    if (moved) populateDialog();
    else {
      renderTaskList();
      refreshDialogSummary();
    }
    updateMainAfterTaskChange();
    showToast(moved ? `Задача перенесена на ${formatLongDate(fromISO(newISO))}` : "Название обновлено");
  }

  function deleteTask(key) {
    if (!state.dialogDate) return;
    const entry = getEntryByKey(state.dialogDate, key);
    if (!entry) return;

    if (entry.isSeries) {
      state.deleteConfirmKey = key;
      renderTaskList();
      window.requestAnimationFrame(() => {
        const button = els.taskList.querySelector('[data-action="delete-occurrence"]');
        if (button) button.focus();
      });
      return;
    }

    const tasks = state.tasks[state.dialogDate] || [];
    const index = tasks.findIndex((task) => task.id === entry.taskId);
    if (index < 0) return;
    const removed = tasks[index];
    // Не вырезаем запись: могила не даёт удалению «воскреснуть» при синхронизации.
    removed.deletedAt = Date.now();
    removed.updatedAt = removed.deletedAt;
    if (state.editingKey === key) state.editingKey = null;
    if (state.deleteConfirmKey === key) state.deleteConfirmKey = null;
    saveStore();
    renderTaskList();
    refreshDialogSummary();
    updateMainAfterTaskChange();
    showToast(removed.done ? "Выполненное дело убрано" : "Задача удалена");
  }

  function deleteSeriesOccurrence(key) {
    if (!state.dialogDate) return;
    const entry = getEntryByKey(state.dialogDate, key);
    if (!entry || !entry.isSeries) return;
    const series = getSeriesById(entry.seriesId);
    if (!series) return;
    const exception = series.exceptions[state.dialogDate] || {};
    exception.deleted = true;
    exception.updatedAt = Date.now();
    series.exceptions[state.dialogDate] = exception;
    series.updatedAt = exception.updatedAt;
    state.deleteConfirmKey = null;
    saveStore();
    populateDialog();
    updateMainAfterTaskChange();
    showToast("Этот день серии удалён");
  }

  function deleteSeries(key) {
    const entry = state.dialogDate ? getEntryByKey(state.dialogDate, key) : null;
    if (!entry || !entry.isSeries) return;
    const series = getSeriesById(entry.seriesId);
    if (!series) return;
    series.deletedAt = Date.now();
    series.updatedAt = series.deletedAt;
    state.deleteConfirmKey = null;
    saveStore();
    populateDialog();
    updateMainAfterTaskChange();
    showToast("Повторяющаяся серия удалена");
  }

  function addQuickTask(text) {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) {
      showToast("Напиши, что нужно сделать");
      els.quickAddInput.focus();
      return;
    }
    const iso = state.selectedDate || toISO(startOfDay(new Date()));
    if (!state.tasks[iso]) state.tasks[iso] = [];
    state.tasks[iso].push({
      id: makeId(),
      text: clean.slice(0, 140),
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      time: null,
      remindAt: null
    });
    saveStore();
    els.quickAddInput.value = "";
    renderProgress();
    renderCalendar(false);
    renderQuickAddDate();
    showToast(`Добавлено на ${formatLongDate(fromISO(iso))}`);
    els.quickAddInput.focus();
  }

  function moveTask(fromIso, key, toIso) {
    if (!isValidISO(fromIso) || !isValidISO(toIso) || fromIso === toIso) return;
    const source = state.tasks[fromIso] || [];
    const index = source.findIndex((task) => task.id === key);
    if (index < 0) return;
    const task = source[index];
    source.splice(index, 1);
    if (!source.length) delete state.tasks[fromIso];
    if (!state.tasks[toIso]) state.tasks[toIso] = [];
    state.tasks[toIso].push(task);
    task.updatedAt = Date.now();
    saveStore();
    if (state.dialogDate && els.dialog.open) populateDialog();
    renderAll(false);
    showToast(`Дело перенесено на ${formatLongDate(fromISO(toIso))}`);
  }

  function openSearch() {
    renderSearch();
    showDialog(els.searchDialog);
    if (!probing) window.setTimeout(() => els.searchInput.focus(), 30);
  }

  function collectSearchResults() {
    const query = state.searchQuery.trim().toLowerCase();
    const results = [];

    if (state.searchType !== "series") {
      Object.keys(state.tasks).forEach((iso) => {
        state.tasks[iso].forEach((task) => {
          if (task.deletedAt) return;
          if (query && !task.text.toLowerCase().includes(query)) return;
          if (state.searchStatus === "active" && task.done) return;
          if (state.searchStatus === "done" && !task.done) return;
          results.push({
            date: iso,
            text: task.text,
            done: task.done,
            kind: "task",
            key: task.id
          });
        });
      });
    }

    if (state.searchType !== "task") {
      const todayISO = toISO(startOfDay(new Date()));
      state.series.forEach((series) => {
        if (series.deletedAt) return;
        if (query && !series.text.toLowerCase().includes(query)) return;
        const date = nextSeriesOccurrence(series, todayISO) || series.start;
        const exception = series.exceptions[date] || {};
        const done = Boolean(exception.done);
        if (state.searchStatus === "active" && done) return;
        if (state.searchStatus === "done" && !done) return;
        results.push({
          date,
          text: series.text,
          done,
          kind: "series",
          seriesId: series.id
        });
      });
    }

    results.sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text, "ru"));
    return results;
  }

  function renderSearch() {
    const results = collectSearchResults();
    const shown = results.slice(0, MAX_SEARCH_RESULTS);
    els.searchResults.replaceChildren();

    els.searchCount.textContent = results.length
      ? `Найдено: ${results.length}${results.length > MAX_SEARCH_RESULTS ? ` · показаны первые ${MAX_SEARCH_RESULTS}` : ""}`
      : "Ничего не найдено";

    els.searchStatusButtons.forEach((button) => {
      const active = button.dataset.status === state.searchStatus;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (!shown.length) {
      const empty = el("li", "search-empty");
      empty.appendChild(el("p", "search-empty-title", "Сундук пуст"));
      empty.appendChild(el("p", "search-empty-note", "Попробуй другой запрос или сними фильтры."));
      els.searchResults.appendChild(empty);
      return;
    }

    shown.forEach((result) => {
      const date = fromISO(result.date);
      const li = el("li", "search-result-item");
      const button = el("button", "search-result");
      button.type = "button";
      button.dataset.date = result.date;
      if (result.kind === "task") button.dataset.taskKey = result.key;
      else button.dataset.seriesId = result.seriesId;
      button.setAttribute("aria-label", `${formatLongDate(date)}. ${result.text}. ${result.done ? "Выполнено" : "В планах"}.`);

      const dateBox = el("span", "search-date");
      dateBox.append(
        el("span", "search-day", String(date.getDate())),
        el("span", "search-month", MONTHS_SHORT[date.getMonth()]),
        el("span", "search-year", String(date.getFullYear()))
      );

      const body = el("span", "search-result-body");
      body.appendChild(el("span", "search-result-text", result.text));
      if (result.kind === "series") {
        const series = getSeriesById(result.seriesId);
        body.appendChild(el("span", "search-result-meta", series
          ? `↻ ${seriesSchedule(series)}`
          : "Повторяющееся дело"));
      } else {
        body.appendChild(el("span", "search-result-meta", "Обычное дело"));
      }

      const badge = el("span", `search-badge${result.done ? " is-done" : ""}`, result.done ? "Готово" : "В планах");
      button.append(dateBox, body, badge);
      li.appendChild(button);
      els.searchResults.appendChild(li);
    });
  }

  // История серии: последние 10 недель клетками. Читается как одна картинка.
  function renderSeriesStats() {
    if (!els.seriesStats) return;
    const helpers = window.PixelSeriesStats;
    const series = state.series.filter((item) => !item.deletedAt);
    els.seriesStats.replaceChildren();

    if (!helpers) return;
    if (!series.length) {
      els.seriesStats.appendChild(el("p", "settings-note", "Повторяющихся дел пока нет."));
      return;
    }

    const todayIso = toISO(new Date());
    series.forEach((item) => {
      const stats = seriesStatsFor(item);
      if (!stats) return;
      const card = el("article", "series-card");

      const head = el("p", "series-card-head");
      head.appendChild(el("strong", "series-card-title", item.text));
      head.appendChild(el("span", "series-card-freq", seriesSchedule(item)));
      card.appendChild(head);

      const nums = el("p", "series-card-nums");
      nums.append(
        "Подряд ",
        el("b", null, String(stats.current)),
        " · лучший ",
        el("b", null, String(stats.best)),
        " · всего ",
        el("b", null, String(stats.done)),
        ` из ${stats.total}`
      );
      card.appendChild(nums);

      const cells = helpers.history(item, todayIso, isSeriesActiveOn, helpers.MAX_HISTORY_DAYS);
      const heat = el("div", "heat");
      heat.setAttribute("role", "img");
      heat.setAttribute(
        "aria-label",
        `История серии «${item.text}»: отмечено ${stats.done} из ${stats.total}`
      );
      cells.forEach((cell) => {
        const dot = el("span", "heat-cell");
        dot.dataset.state = cell.state;
        dot.title = `${formatLongDate(fromISO(cell.iso))} — ${HEAT_STATE_LABELS[cell.state] || ""}`;
        heat.appendChild(dot);
      });
      card.appendChild(heat);
      els.seriesStats.appendChild(card);
    });
  }

  function syncSettingsControls() {
    els.holidaysToggle.checked = state.settings.showHolidays;
    els.profileSelect.value = state.settings.profile;
    els.densitySelect.value = state.settings.density;
    els.motionSelect.value = state.settings.motion;
    els.dialogAnimSelect.value = state.settings.dialogAnimation;
    els.decorToggle.checked = state.settings.decor;
    els.weekStartSelect.value = String(state.settings.weekStart);
    els.skySelect.value = state.settings.sky;
    els.holidaySelect.value = state.settings.holiday;
    els.digestToggle.checked = state.settings.morningDigest;
    // В браузере системных уведомлений нет — не обещаем сводку.
    els.digestRow.hidden = !isNativeApp();
    if (els.templatesInput) els.templatesInput.value = state.settings.templates.join("\n");
  }

  function openSettings() {
    syncSettingsControls();
    updateSettingsMeta();
    refreshSyncFields();
    renderSeriesStats();
    if (!/^https?:$/.test(window.location.protocol)) {
      els.installNote.textContent = "Установка PWA доступна при открытии сайта через http:// или https://. Сейчас страница открыта как файл.";
    } else if (els.installBtn.hidden) {
      els.installNote.textContent = "Если браузер поддерживает установку, кнопка появится автоматически.";
    }
    showDialog(els.settingsDialog);
  }

  function updateSettingsMeta() {
    const totalTasks = Object.values(state.tasks).reduce(
      (sum, list) => sum + list.filter((task) => !task.deletedAt).length,
      0
    );
    const totalSeries = state.series.filter((series) => !series.deletedAt).length;
    els.settingsMeta.textContent = `${totalTasks} ${tasksWord(totalTasks)} · ${totalSeries} ${seriesWord(totalSeries)}`;
    if (els.settingsBuild) els.settingsBuild.textContent = `Сборка: ${buildLabel()}`;
  }

  function buildLabel() {
    const info = window.__BUILD_INFO__;
    if (!info || !info.commit) return "локальная";
    const version = info.version ? `v${info.version} · ` : "";
    return info.date ? `${version}${info.commit} · ${info.date}` : `${version}${info.commit}`;
  }

  function nextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  // Снимает длительности кадров на протяжении duration мс.
  function measureFrames(duration) {
    return new Promise((resolve) => {
      const deltas = [];
      let previous = performance.now();
      const start = previous;
      function tick(now) {
        deltas.push(now - previous);
        previous = now;
        if (now - start < duration) window.requestAnimationFrame(tick);
        else resolve(deltas);
      }
      window.requestAnimationFrame(tick);
    });
  }

  function describeFrames(deltas) {
    if (!deltas.length) return { count: 0, avg: 0, max: 0, over33: 0, over50: 0 };
    const total = deltas.reduce((sum, value) => sum + value, 0);
    return {
      count: deltas.length,
      avg: total / deltas.length,
      max: Math.max(...deltas),
      over33: deltas.filter((value) => value > 33.4).length,
      over50: deltas.filter((value) => value > 50).length
    };
  }

  function hideOpenDialogs() {
    document.querySelectorAll("dialog[open]").forEach((dialog) => hideDialog(dialog));
  }

  async function measureDialogOpen(label, openFn) {
    await nextFrame();
    await nextFrame();
    const startedAt = performance.now();
    openFn();
    const openedAt = performance.now();
    const deltas = await measureFrames(650);
    hideOpenDialogs();
    await nextFrame();
    return { label, open: openedAt - startedAt, frames: describeFrames(deltas) };
  }

  function formatProbeReport(results) {
    const root = document.documentElement;
    const lines = [
      `Профиль: ${root.dataset.profile} · плотность: ${root.dataset.density}`,
      `Анимации: ${root.dataset.motion} · окна: ${root.dataset.dialogAnim}`,
      `Экран: ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
      `Сборка: ${buildLabel()}`,
      ""
    ];
    results.forEach((result) => {
      const frames = result.frames;
      lines.push(result.label);
      lines.push(`  открытие (JS + showModal): ${result.open.toFixed(1)} мс`);
      lines.push(`  кадры: ${frames.count} · средний ${frames.avg.toFixed(1)} мс · максимум ${frames.max.toFixed(1)} мс`);
      lines.push(`  дольше 33 мс: ${frames.over33} · дольше 50 мс: ${frames.over50}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  async function runPerfProbe() {
    if (!els.perfBtn || probing) return;
    probing = true;
    els.perfBtn.disabled = true;
    els.perfReport.hidden = false;
    els.perfReport.textContent = "Измеряю…";
    hideDialog(els.settingsDialog);
    await nextFrame();

    const results = [];
    try {
      results.push(await measureDialogOpen("Окно дня", () => openDay(state.selectedDate)));
      results.push(await measureDialogOpen("Поиск", () => openSearch()));
      results.push(await measureDialogOpen("Настройки", () => openSettings()));
    } catch (error) {
      results.push({ label: "Ошибка измерения", open: 0, frames: describeFrames([]) });
    }

    probing = false;
    els.perfBtn.disabled = false;
    els.perfReport.textContent = formatProbeReport(results);
    hideOpenDialogs();
    openSettings();
  }

  async function copyProbeReport() {
    const text = els.perfReport ? els.perfReport.textContent : "";
    if (!text || els.perfReport.hidden) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Отчёт скопирован");
    } catch (error) {
      showToast("Не удалось скопировать — сделайте скриншот");
    }
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const payload = {
      app: "pixel-calendar-2027",
      version: 3,
      exportedAt: new Date().toISOString(),
      view: state.view,
      tasks: state.tasks,
      series: state.series,
      settings: state.settings
    };
    downloadFile(
      `pixel-calendar-2027-backup-${toISO(new Date())}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    showToast("Резервная копия скачана");
  }

  function icsEscape(text) {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function icsDate(iso) {
    return iso.replace(/-/g, "");
  }

  function rruleForSeries(series) {
    const start = fromISO(series.start);
    let rule;
    if (series.freq === "daily") {
      rule = "FREQ=DAILY";
    } else if (series.freq === "weekdays") {
      rule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    } else if (series.freq === "weekly") {
      const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      rule = `FREQ=WEEKLY;BYDAY=${days[start.getDay()]}`;
    } else if (series.freq === "monthly") {
      rule = `FREQ=MONTHLY;BYMONTHDAY=${start.getDate()}`;
    } else {
      rule = `FREQ=YEARLY;BYMONTH=${start.getMonth() + 1};BYMONTHDAY=${start.getDate()}`;
    }
    if (series.end) rule += `;UNTIL=${icsDate(series.end)}T235959Z`;
    return `RRULE:${rule}`;
  }

  function foldICS(line) {
    const chunks = [];
    let current = "";
    let bytes = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (bytes + size > 73 && current) {
        chunks.push(current);
        current = " ";
        bytes = 1;
      }
      current += char;
      bytes += size;
    }
    chunks.push(current);
    return chunks.join("\r\n");
  }

  function buildICS() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pixel Calendar 2027//RU",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Пиксельный календарь 2027"
    ];

    Object.keys(state.tasks).sort().forEach((iso) => {
      state.tasks[iso].forEach((task) => {
        if (task.deletedAt) return;
        const end = toISO(addDays(fromISO(iso), 1));
        lines.push(
          "BEGIN:VEVENT",
          `UID:${task.id}@pixel-calendar-2027`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${icsDate(iso)}`,
          `DTEND;VALUE=DATE:${icsDate(end)}`,
          `SUMMARY:${icsEscape(task.done ? `[готово] ${task.text}` : task.text)}`,
          `DESCRIPTION:${icsEscape(task.done ? "Выполнено · Пиксельный календарь" : "Пиксельный календарь")}`,
          "STATUS:CONFIRMED",
          "END:VEVENT"
        );
      });
    });

    state.series.forEach((series) => {
      if (series.deletedAt) return;
      const end = toISO(addDays(fromISO(series.start), 1));
      lines.push(
        "BEGIN:VEVENT",
        `UID:${series.id}@pixel-calendar-2027`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(series.start)}`,
        `DTEND;VALUE=DATE:${icsDate(end)}`,
        `SUMMARY:${icsEscape(series.text)}`,
        `DESCRIPTION:${icsEscape(`Повтор: ${seriesSchedule(series)} · Пиксельный календарь`)}`,
        rruleForSeries(series),
        "STATUS:CONFIRMED"
      );
      const deleted = Object.keys(series.exceptions).filter((iso) => series.exceptions[iso].deleted);
      if (deleted.length) {
        lines.push(`EXDATE;VALUE=DATE:${deleted.map(icsDate).join(",")}`);
      }
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.map(foldICS).join("\r\n") + "\r\n";
  }

  function exportICS() {
    downloadFile(
      `pixel-calendar-2027-${toISO(new Date())}.ics`,
      buildICS(),
      "text/calendar;charset=utf-8"
    );
    showToast("Файл .ics готов для Google Календаря");
  }

  function googleCalendarUrl(entry, iso) {
    const start = icsDate(iso);
    const end = icsDate(toISO(addDays(fromISO(iso), 1)));
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: entry.text,
      dates: `${start}/${end}`,
      details: entry.isSeries
        ? `Повтор: ${seriesSchedule(entry.series)} · Добавлено из Пиксельного календаря`
        : "Добавлено из Пиксельного календаря"
    });
    if (entry.isSeries) params.set("recur", rruleForSeries(entry.series));
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || (!parsed.tasks && !parsed.series)) {
        showToast("В файле нет данных календаря");
        return;
      }
      if (!window.confirm("Импорт заменит текущие задачи и серии. Продолжить?")) return;
      const imported = normalizeStore(parsed);
      state.tasks = imported.tasks;
      state.series = imported.series;
      state.settings = imported.settings;
      state.view = imported.view;
      state.selectedDate = toISO(startOfDay(new Date()));
      state.cursor = startOfDay(new Date());
      saveStore();
      applyProfile();
      renderAll(false);
      if (state.dialogDate && els.dialog.open) populateDialog();
      updateSettingsMeta();
      showToast("Резервная копия загружена");
    } catch (error) {
      showToast("Не удалось прочитать JSON-файл");
    }
  }

  function clearAllData() {
    if (!window.confirm("Удалить все задачи и повторяющиеся серии? Это действие нельзя отменить.")) return;
    // Могилы вместо обнуления: иначе очистка на одном устройстве
    // вернёт данные с другого при следующей синхронизации.
    const now = Date.now();
    Object.keys(state.tasks).forEach((iso) => {
      state.tasks[iso].forEach((task) => {
        if (task.deletedAt) return;
        task.deletedAt = now;
        task.updatedAt = now;
      });
    });
    state.series.forEach((series) => {
      if (series.deletedAt) return;
      series.deletedAt = now;
      series.updatedAt = now;
    });
    state.editingKey = null;
    state.deleteConfirmKey = null;
    saveStore();
    renderAll(false);
    if (state.dialogDate && els.dialog.open) populateDialog();
    updateSettingsMeta();
    showToast("Все задачи удалены");
  }

  function showToast(message) {
    els.toastText.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 2300);
  }

  function refreshAtMidnight() {
    const current = toISO(startOfDay(new Date()));
    if (current === knownToday) return;
    const oldToday = fromISO(knownToday);
    const selectedWasToday = state.selectedDate === knownToday;
    const cursorWasToday = isSameDay(state.cursor, oldToday);
    knownToday = current;
    if (selectedWasToday) state.selectedDate = current;
    if (cursorWasToday) state.cursor = fromISO(current);
    updateTodayLabel();
    renderAll(false);
  }

  function bindDialogBackdrop(dialog, close) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
  }

  function syncTimeLabel(ms) {
    if (!ms) return "";
    try {
      return new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "";
    }
  }

  function renderSyncStatus(status) {
    if (!els.syncStatus || !window.PixelSync) return;
    const info = status || {};
    const config = info.config || window.PixelSync.getSyncConfig();
    let text = "Не подключено";
    if (info.state === "syncing") {
      text = "Синхронизация…";
    } else if (info.state === "ok") {
      text = `Синхронизировано в ${syncTimeLabel(info.at || config.lastOkAt)}`;
      if (info.skew && info.skew > window.PixelSync.SKEW_WARNING) {
        text += " · время на устройствах расходится";
      }
    } else if (info.state === "error" || config.lastError) {
      text = `Сервер недоступен: ${info.message || config.lastError}`;
    } else if (config.url && config.token) {
      text = "Готово к подключению";
    }
    els.syncStatus.textContent = text;
    els.syncStatus.dataset.state = info.state || (config.lastError ? "error" : "idle");
    const busy = info.state === "syncing";
    els.syncConnectBtn.disabled = busy;
    els.syncNowBtn.disabled = busy;
  }

  function refreshSyncFields() {
    if (!window.PixelSync || !els.syncUrl) return;
    const config = window.PixelSync.getSyncConfig();
    if (config.url) els.syncUrl.value = config.url;
    if (config.token) els.syncToken.value = config.token;
    renderSyncStatus(window.PixelSync.getSyncStatus());
  }

  async function syncFromForm(mode) {
    if (!window.PixelSync) return;
    const url = window.PixelSync.normalizeServerUrl(els.syncUrl.value);
    const token = els.syncToken.value.trim();
    if (!url) {
      showToast("Адрес вида http://192.168.1.5:8787");
      els.syncUrl.focus();
      return;
    }
    if (!token) {
      showToast("Введите код подключения");
      els.syncToken.focus();
      return;
    }
    els.syncUrl.value = url;
    window.PixelSync.saveSyncConfig({
      ...window.PixelSync.getSyncConfig(),
      url,
      token,
      lastError: null
    });
    const result = await window.PixelSync.syncNow();
    if (result.ok) {
      showToast(mode === "connect" ? "Подключено" : "Синхронизировано");
    } else {
      showToast(result.reason || "Сервер недоступен");
    }
  }

  function setupSync() {
    if (!window.PixelSync) return;
    window.PixelSync.configure({
      getState: () => ({
        version: 3,
        view: state.view,
        tasks: state.tasks,
        series: state.series,
        settings: state.settings
      }),
      applyState: (merged) => {
        applyingRemote = true;
        try {
          state.tasks = merged.tasks;
          state.series = merged.series;
          state.settings = merged.settings;
          settingsFingerprint = fingerprintSettings(state.settings);
          saveStore();
          applyProfile();
          applyDaytime();
          applyHoliday();
          renderAll(false);
          updateSettingsMeta();
        } finally {
          applyingRemote = false;
        }
      }
    });
    window.PixelSync.setStatusListener(renderSyncStatus);
    const config = window.PixelSync.getSyncConfig();
    const native = document.documentElement.dataset.platform === "android";
    const localOrigin = !native && /^https?:$/.test(window.location.protocol)
      ? window.location.origin
      : "";
    els.syncUrl.value = config.url || localOrigin;
    els.syncToken.value = config.token || "";
    renderSyncStatus(window.PixelSync.getSyncStatus());
  }

  function findTaskById(taskId) {
    if (!taskId) return null;
    const days = Object.keys(state.tasks);
    for (let index = 0; index < days.length; index += 1) {
      const iso = days[index];
      const task = (state.tasks[iso] || []).find((item) => item.id === taskId);
      if (task) return { iso, task };
    }
    return null;
  }

  function markNotificationDone(extra) {
    if (!extra) return false;
    const now = Date.now();
    if (extra.taskId) {
      const found = findTaskById(extra.taskId);
      if (!found || found.task.deletedAt || found.task.done) return false;
      found.task.done = true;
      found.task.snoozedUntil = null;
      found.task.updatedAt = now;
      return true;
    }
    if (extra.seriesId && isValidISO(extra.date)) {
      const series = getSeriesById(extra.seriesId);
      if (!series || series.deletedAt) return false;
      const exception = series.exceptions[extra.date] || {};
      if (exception.deleted || exception.done) return false;
      exception.done = true;
      delete exception.snoozedUntil;
      exception.updatedAt = now;
      series.exceptions[extra.date] = exception;
      series.updatedAt = now;
      return true;
    }
    return false;
  }

  function snoozeNotification(extra) {
    if (!extra) return false;
    const now = Date.now();
    const until = now + 60 * 60 * 1000;
    if (extra.taskId) {
      const found = findTaskById(extra.taskId);
      if (!found || found.task.deletedAt || found.task.done) return false;
      found.task.snoozedUntil = until;
      found.task.updatedAt = now;
      return true;
    }
    if (extra.seriesId && isValidISO(extra.date)) {
      const series = getSeriesById(extra.seriesId);
      if (!series || series.deletedAt) return false;
      const exception = series.exceptions[extra.date] || {};
      if (exception.deleted || exception.done) return false;
      exception.snoozedUntil = until;
      exception.updatedAt = now;
      series.exceptions[extra.date] = exception;
      series.updatedAt = now;
      return true;
    }
    return false;
  }

  // Кнопки «Готово» и «Отложить на час» в системном уведомлении.
  // Событие приходит и после холодного старта: Capacitor придерживает его до подписки.
  function handleNotificationAction(event) {
    if (!event) return;
    const extra = event.notification && event.notification.extra;
    if (event.actionId === "done") {
      if (!markNotificationDone(extra)) return;
      showToast("Отмечено выполненным");
    } else if (event.actionId === "snooze") {
      if (!snoozeNotification(extra)) return;
      showToast("Напомню через час");
    } else {
      return;
    }
    saveStore();
    updateMainAfterTaskChange();
    if (els.dialog.open && state.dialogDate === extra.date) {
      renderTaskList();
      refreshDialogSummary();
    }
  }

  function setupNotifications() {
    if (!window.PixelNotify) return;
    window.PixelNotify.addActionListener(handleNotificationAction);
    window.PixelNotify.schedule(state.tasks, state.series, 1500, state.settings);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) window.PixelNotify.schedule(state.tasks, state.series, 600, state.settings);
    });
  }

  function bindEvents() {
    els.viewTabs.forEach((tab) => {
      tab.addEventListener("click", () => changeView(tab.dataset.view));
    });

    els.prevBtn.addEventListener("click", () => shiftPeriod(-1));
    els.nextBtn.addEventListener("click", () => shiftPeriod(1));
    els.todayBtn.addEventListener("click", goToToday);
    els.yearJumpBtn.addEventListener("click", goTo2027);

    els.quickAddForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addQuickTask(els.quickAddInput.value);
    });

    els.quickAddInput.addEventListener("input", () => {
      if (!els.quickAddInput.value.trim()) return;
    });

    els.searchBtn.addEventListener("click", openSearch);
    els.settingsBtn.addEventListener("click", openSettings);

    let swipeStart = null;
    els.calendarView.addEventListener("pointerdown", (event) => {
      // Мышь не свайпает: на ПК есть стрелки, а перетаскивание задач не должно мешать.
      if (event.pointerType === "mouse") return;
      if (event.target.closest("[data-drag-task], input, select, textarea, a")) return;
      swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });

    els.calendarView.addEventListener("pointerup", (event) => {
      if (!swipeStart || swipeStart.id !== event.pointerId) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = null;
      // Горизонтальный жест должен быть явно горизонтальным, иначе это прокрутка.
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      suppressClickUntil = Date.now() + 350;
      shiftPeriod(dx < 0 ? 1 : -1);
    });

    els.calendarView.addEventListener("pointercancel", () => {
      swipeStart = null;
    });

    els.calendarView.addEventListener("click", (event) => {
      if (Date.now() < suppressClickUntil) return;
      const trigger = event.target.closest("[data-date]");
      if (!trigger) return;
      openDay(trigger.dataset.date);
    });

    let dragData = null;
    els.calendarView.addEventListener("dragstart", (event) => {
      const source = event.target.closest("[data-drag-task]");
      if (!source) return;
      dragData = { from: source.dataset.dragFrom, key: source.dataset.dragTask };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `${dragData.from}|${dragData.key}`);
      source.classList.add("is-dragging");
    });

    els.calendarView.addEventListener("dragend", () => {
      dragData = null;
      suppressClickUntil = Date.now() + 250;
      els.calendarView.querySelectorAll(".is-dragging").forEach((node) => node.classList.remove("is-dragging"));
      els.calendarView.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    });

    els.calendarView.addEventListener("dragover", (event) => {
      if (!dragData) return;
      const target = event.target.closest("[data-date]");
      if (!target) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      target.classList.add("is-drop-target");
    });

    els.calendarView.addEventListener("dragleave", (event) => {
      const target = event.target.closest("[data-date]");
      if (!target) return;
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      target.classList.remove("is-drop-target");
    });

    els.calendarView.addEventListener("drop", (event) => {
      if (!dragData) return;
      const target = event.target.closest("[data-date]");
      if (!target) return;
      event.preventDefault();
      const current = dragData;
      dragData = null;
      target.classList.remove("is-drop-target");
      suppressClickUntil = Date.now() + 250;
      moveTask(current.from, current.key, target.dataset.date);
    });

    els.dialogCloseBtn.addEventListener("click", closeDayDialog);
    bindDialogBackdrop(els.dialog, closeDayDialog);

    els.dialog.addEventListener("close", () => {
      state.dialogDate = null;
      state.editingKey = null;
      state.deleteConfirmKey = null;
      els.formError.textContent = "";
      renderCalendar(false);
      if (lastDayISO) {
        const focusTarget = els.calendarView.querySelector(`[data-date="${lastDayISO}"]`);
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      }
      lastDayISO = null;
    });

    els.taskForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addTask(els.taskInput.value);
    });

    els.taskInput.addEventListener("input", () => {
      if (els.formError.textContent) els.formError.textContent = "";
    });

    els.taskRepeat.addEventListener("change", updateRepeatFields);
    els.taskTime.addEventListener("input", updateRepeatFields);

    if (els.quickTimes) {
      els.quickTimes.addEventListener("click", (event) => {
        const button = event.target.closest("[data-quick-time]");
        if (!button) return;
        els.taskTime.value = button.dataset.quickTime;
        updateRepeatFields();
      });
    }

    if (els.templateChips) {
      els.templateChips.addEventListener("click", (event) => {
        const button = event.target.closest("[data-template]");
        if (!button || !state.dialogDate) return;
        els.taskInput.value = button.dataset.template;
        // Тот же путь, что и у кнопки «Добавить»: повтор и время берутся из формы.
        els.taskForm.requestSubmit();
      });
    }

    if (els.templatesInput) {
      const storeTemplates = () => {
        state.settings.templates = normalizeTemplates(els.templatesInput.value.split("\n"));
        saveStore();
        renderTemplateChips();
      };
      els.templatesInput.addEventListener("input", storeTemplates);
      // Приводим текст к тому, что реально сохранилось: лишние строки отброшены.
      els.templatesInput.addEventListener("blur", () => {
        storeTemplates();
        els.templatesInput.value = state.settings.templates.join("\n");
      });
    }
    els.taskRepeatEnd.addEventListener("input", () => {
      if (els.formError.textContent) els.formError.textContent = "";
    });

    els.taskList.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".task-check");
      if (!checkbox) return;
      toggleTask(checkbox.dataset.taskKey, checkbox.checked);
    });

    els.taskList.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action || action.tagName === "INPUT") return;
      const key = action.dataset.taskKey;
      if (action.dataset.action === "edit") startEditingTask(key);
      else if (action.dataset.action === "delete") deleteTask(key);
      else if (action.dataset.action === "cancel-edit") {
        state.editingKey = null;
        renderTaskList();
      } else if (action.dataset.action === "delete-occurrence") {
        deleteSeriesOccurrence(key);
      } else if (action.dataset.action === "delete-series") {
        deleteSeries(key);
      } else if (action.dataset.action === "cancel-delete") {
        state.deleteConfirmKey = null;
        renderTaskList();
      }
    });

    els.taskList.addEventListener("submit", (event) => {
      const form = event.target.closest(".task-edit-form");
      if (!form) return;
      event.preventDefault();
      saveEditedTask(form.dataset.editTaskKey, form);
    });

    els.searchCloseBtn.addEventListener("click", () => hideDialog(els.searchDialog));
    bindDialogBackdrop(els.searchDialog, () => hideDialog(els.searchDialog));

    els.searchInput.addEventListener("input", () => {
      state.searchQuery = els.searchInput.value;
      renderSearch();
    });

    els.searchStatusButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.searchStatus = button.dataset.status;
        renderSearch();
      });
    });

    els.searchType.addEventListener("change", () => {
      state.searchType = els.searchType.value;
      renderSearch();
    });

    els.searchResults.addEventListener("click", (event) => {
      const result = event.target.closest("[data-date]");
      if (!result) return;
      const iso = result.dataset.date;
      closeToolSearch();
      state.cursor = fromISO(iso);
      state.selectedDate = iso;
      openDay(iso);
    });

    els.settingsCloseBtn.addEventListener("click", () => hideDialog(els.settingsDialog));
    bindDialogBackdrop(els.settingsDialog, () => hideDialog(els.settingsDialog));

    els.holidaysToggle.addEventListener("change", () => {
      state.settings.showHolidays = els.holidaysToggle.checked;
      saveStore();
      renderAll(false);
      if (state.dialogDate && els.dialog.open) populateDialog();
    });

    els.profileSelect.addEventListener("change", () => {
      state.settings.profile = PROFILES.includes(els.profileSelect.value) ? els.profileSelect.value : "auto";
      saveStore();
      applyProfile();
    });

    els.densitySelect.addEventListener("change", () => {
      state.settings.density = DENSITIES.includes(els.densitySelect.value) ? els.densitySelect.value : "comfortable";
      saveStore();
      applyProfile();
      renderAll(false);
    });

    els.motionSelect.addEventListener("change", () => {
      state.settings.motion = MOTION_MODES.includes(els.motionSelect.value) ? els.motionSelect.value : "auto";
      saveStore();
      applyProfile();
    });

    els.dialogAnimSelect.addEventListener("change", () => {
      state.settings.dialogAnimation = DIALOG_ANIM_MODES.includes(els.dialogAnimSelect.value)
        ? els.dialogAnimSelect.value
        : "auto";
      saveStore();
      applyProfile();
    });

    els.decorToggle.addEventListener("change", () => {
      state.settings.decor = els.decorToggle.checked;
      saveStore();
      applyProfile();
    });

    els.weekStartSelect.addEventListener("change", () => {
      state.settings.weekStart = els.weekStartSelect.value === "0" ? 0 : 1;
      saveStore();
      renderAll(false);
    });

    els.skySelect.addEventListener("change", () => {
      state.settings.sky = SKY_MODES.includes(els.skySelect.value) ? els.skySelect.value : "auto";
      saveStore();
      applyDaytime();
    });

    els.holidaySelect.addEventListener("change", () => {
      state.settings.holiday = HOLIDAY_MODES.includes(els.holidaySelect.value)
        ? els.holidaySelect.value
        : "auto";
      saveStore();
      applyHoliday();
    });

    els.digestToggle.addEventListener("change", () => {
      state.settings.morningDigest = els.digestToggle.checked;
      saveStore();
    });

    els.exportJsonBtn.addEventListener("click", exportJson);
    els.exportIcsBtn.addEventListener("click", exportICS);
    if (els.syncConnectBtn) {
      els.syncConnectBtn.addEventListener("click", () => syncFromForm("connect"));
      els.syncNowBtn.addEventListener("click", () => syncFromForm("now"));
    }
    els.importJsonBtn.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", handleImportFile);
    els.clearDataBtn.addEventListener("click", clearAllData);
    if (els.perfBtn) els.perfBtn.addEventListener("click", runPerfProbe);
    if (els.perfCopyBtn) els.perfCopyBtn.addEventListener("click", copyProbeReport);

    els.installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      els.installBtn.hidden = true;
      els.installNote.textContent = choice.outcome === "accepted"
        ? "Приложение установлено. Ищи иконку на главном экране."
        : "Установку можно продолжить позже через меню браузера.";
    });

    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      const anyDialogOpen = Boolean(document.querySelector("dialog[open]"));
      if (typing) return;
      if (event.key === "Escape" && anyDialogOpen) return;
      if (event.key === "ArrowLeft" && !anyDialogOpen) {
        event.preventDefault();
        shiftPeriod(-1);
      } else if (event.key === "ArrowRight" && !anyDialogOpen) {
        event.preventDefault();
        shiftPeriod(1);
      } else if (event.key.toLowerCase() === "t" && !anyDialogOpen) {
        event.preventDefault();
        goToToday();
      } else if (event.key.toLowerCase() === "n" && !anyDialogOpen) {
        event.preventDefault();
        els.quickAddInput.focus();
      } else if (event.key === "/" && !anyDialogOpen) {
        event.preventDefault();
        openSearch();
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = normalizeStore(JSON.parse(event.newValue));
        state.tasks = parsed.tasks;
        state.series = parsed.series;
        state.settings = parsed.settings;
        state.view = parsed.view;
        applyProfile();
        renderAll(false);
        if (state.dialogDate && els.dialog.open) populateDialog();
        if (els.settingsDialog.open) {
          syncSettingsControls();
          updateSettingsMeta();
        }
      } catch (error) {
        // Ignore malformed data from another tab.
      }
    });

    window.setInterval(() => {
      refreshAtMidnight();
      applyDaytime();
      applyHoliday();
    }, 30000);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        applyDaytime();
        applyHoliday();
      }
    });

    window.addEventListener("resize", scheduleFitMonth);
  }

  function closeToolSearch() {
    hideDialog(els.searchDialog);
  }

  function setupInstall() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.installBtn.hidden = false;
      els.installNote.textContent = "Календарь можно установить как приложение — он откроется в отдельном окне.";
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      els.installBtn.hidden = true;
      els.installNote.textContent = "Приложение установлено. Ищи иконку на главном экране.";
      showToast("Календарь установлен");
    });
  }

  // ——— Обновления ———

  const RELEASE_API = "https://api.github.com/repos/vladis77177/pixel-calendar-2027/releases/latest";
  const RELEASE_APK = "https://github.com/vladis77177/pixel-calendar-2027/releases/latest/download/pixel-calendar-2027-debug.apk";
  const UPDATE_DISMISS_KEY = "pixel-calendar-update-dismissed";
  const RELEASE_CACHE_KEY = "pixel-calendar-release-check";
  const RELEASE_CHECK_INTERVAL = 12 * 60 * 60 * 1000;
  let updateKind = "";
  let updateVersion = "";
  let updateTarget = null;
  let reloadForUpdate = false;

  function currentVersion() {
    const info = window.__BUILD_INFO__;
    return info && info.version ? String(info.version) : "";
  }

  function isNewerVersion(remote, local) {
    const helper = window.PixelUpdate;
    if (helper && typeof helper.isNewer === "function") return helper.isNewer(remote, local);
    return false;
  }

  function normalizeReleaseVersion(tag) {
    const helper = window.PixelUpdate;
    if (helper && typeof helper.normalizeTag === "function") return helper.normalizeTag(tag);
    return String(tag || "").replace(/^v/i, "");
  }

  function hideUpdateBar() {
    if (!els.updateBar) return;
    els.updateBar.hidden = true;
    document.body.classList.remove("has-update-bar");
    updateKind = "";
    updateVersion = "";
    updateTarget = null;
  }

  function showUpdateBar(kind, title, text, label, action) {
    if (!els.updateBar || !els.updateTitle || !els.updateText || !els.updateAction) return;
    updateKind = kind;
    updateTarget = action;
    els.updateTitle.textContent = title;
    els.updateText.textContent = text;
    els.updateAction.textContent = label;
    els.updateBar.hidden = false;
    document.body.classList.add("has-update-bar");
  }

  function dismissedUpdate(kind, version) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(UPDATE_DISMISS_KEY) || "null");
      return Boolean(parsed && parsed.kind === kind && (version ? parsed.version === version : true));
    } catch (error) {
      return false;
    }
  }

  function rememberDismissed(kind, version) {
    try {
      sessionStorage.setItem(UPDATE_DISMISS_KEY, JSON.stringify({ kind, version: version || "" }));
    } catch (error) {
      // Приватный режим: плашка просто вернётся после перезагрузки.
    }
  }

  function offerWebUpdate(worker) {
    if (!worker || !navigator.serviceWorker.controller) return;
    if (dismissedUpdate("web")) return;
    showUpdateBar(
      "web",
      "Доступна новая версия",
      "Страница перезагрузится и покажет свежие правки.",
      "Обновить",
      () => {
        reloadForUpdate = true;
        if (els.updateAction) {
          els.updateAction.textContent = "Обновляем…";
          els.updateAction.disabled = true;
        }
        worker.postMessage({ type: "SKIP_WAITING" });
      }
    );
  }

  function offerAppRelease(version, url) {
    if (!version || !isNewerVersion(version, currentVersion())) return;
    if (dismissedUpdate("apk", version)) return;
    updateVersion = version;
    showUpdateBar(
      "apk",
      `Доступна версия ${version}`,
      "Скачайте APK и установите поверх — дела и настройки сохранятся.",
      "Скачать",
      () => {
        // В WebView APK ссылка уходит в системный браузер через ACTION_VIEW.
        const link = document.createElement("a");
        link.href = url || RELEASE_APK;
        link.target = "_blank";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    );
  }

  function readReleaseCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RELEASE_CACHE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      return {
        at: Number(parsed.at) || 0,
        version: typeof parsed.version === "string" ? parsed.version : "",
        url: typeof parsed.url === "string" ? parsed.url : RELEASE_APK
      };
    } catch (error) {
      return null;
    }
  }

  function writeReleaseCache(version, url) {
    try {
      localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ at: Date.now(), version, url }));
    } catch (error) {
      // Кэш проверки не критичен.
    }
  }

  function setupUpdateBar() {
    if (els.updateAction) {
      els.updateAction.addEventListener("click", () => {
        const action = updateTarget;
        if (typeof action === "function") action();
      });
    }
    if (els.updateDismiss) {
      els.updateDismiss.addEventListener("click", () => {
        rememberDismissed(updateKind, updateVersion);
        hideUpdateBar();
      });
    }
  }

  function setupAppUpdateCheck() {
    if (!isNativeApp() || !currentVersion()) return;
    const cached = readReleaseCache();
    if (cached && cached.version && Date.now() - cached.at < RELEASE_CHECK_INTERVAL) {
      offerAppRelease(cached.version, cached.url);
      return;
    }

    window.setTimeout(() => {
      fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } })
        .then((response) => (response.ok ? response.json() : null))
        .then((release) => {
          if (!release || !release.tag_name) return;
          const version = normalizeReleaseVersion(release.tag_name);
          if (!version) return;
          let url = RELEASE_APK;
          if (Array.isArray(release.assets)) {
            const asset = release.assets.find((item) => item && typeof item.name === "string" && /\.apk$/i.test(item.name));
            if (asset && asset.browser_download_url) url = asset.browser_download_url;
          }
          writeReleaseCache(version, url);
          offerAppRelease(version, url);
        })
        .catch(() => {
          // Нет сети или GitHub недоступен — молча ждём следующего запуска.
        });
    }, 4000);
  }

  function registerServiceWorker() {
    const capacitor = window.Capacitor;
    if (capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadForUpdate) window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").then((registration) => {
        offerWebUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") offerWebUpdate(worker);
          });
        });
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        });
      }).catch(() => {
        // Offline mode is a bonus; the calendar works without it.
      });
    });
  }

  function isNativeApp() {
    return Boolean(
      window.Capacitor
      && typeof window.Capacitor.isNativePlatform === "function"
      && window.Capacitor.isNativePlatform()
    );
  }

  // Фаза суток: 5–8 рассвет, 8–17 день, 17–21 закат, иначе ночь.
  function resolveDaytime() {
    const mode = state.settings.sky;
    if (mode !== "auto") return SKY_MODES.includes(mode) ? mode : "day";
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    if (hour >= 5 && hour < 8) return "dawn";
    if (hour >= 8 && hour < 17) return "day";
    if (hour >= 17 && hour < 21) return "dusk";
    return "night";
  }

  function applyDaytime() {
    const phase = resolveDaytime();
    const root = document.documentElement;
    if (root.dataset.daytime === phase) return;
    root.dataset.daytime = phase;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[phase] || THEME_COLORS.day);
  }

  // Новогодняя тема: auto = декабрь и январь.
  function resolveHoliday() {
    const mode = state.settings.holiday;
    if (mode === "on") return true;
    if (mode === "off") return false;
    const month = new Date().getMonth();
    return month === 11 || month === 0;
  }

  function applyHoliday() {
    document.documentElement.dataset.holiday = resolveHoliday() ? "on" : "off";
    renderSnow();
  }

  // Снеговик стоит вплотную слева от плашки с датой. Отступ считаем по реальным
  // координатам, потому что на телефоне топбар переносится и ширина плашки меняется.
  function updateSnowmanAnchor() {
    if (!els.garland || !els.todayChip) return;
    const garlandRect = els.garland.getBoundingClientRect();
    const chipRect = els.todayChip.getBoundingClientRect();
    if (!garlandRect.width || !chipRect.width) return;
    const offset = Math.max(8, Math.round(garlandRect.right - chipRect.left + 8));
    els.garland.style.setProperty("--snowman-right", `${offset}px`);
  }

  function setupSnowman() {
    updateSnowmanAnchor();
    window.addEventListener("resize", updateSnowmanAnchor);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateSnowmanAnchor);
    }
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(updateSnowmanAnchor);
      observer.observe(els.todayChip);
      observer.observe(els.garland);
    }
  }

  // Снежинки создаём только когда тема активна, декор включён и анимации не выключены.
  function renderSnow() {
    if (!els.snow) return;
    const root = document.documentElement;
    const active = root.dataset.holiday === "on"
      && root.dataset.decor === "on"
      && root.dataset.motion !== "off";
    if (!active) {
      if (els.snow.childElementCount) els.snow.replaceChildren();
      return;
    }
    const count = root.dataset.profile === "mobile" ? 28 : 56;
    if (els.snow.childElementCount === count) return;

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      const flake = document.createElement("span");
      flake.className = "snowflake";
      flake.style.setProperty("--x", `${(index * 37 + 5) % 100}%`);
      flake.style.setProperty("--size", `${2 + (index % 3)}px`);
      flake.style.setProperty("--duration", `${9 + (index % 7) * 2}s`);
      flake.style.setProperty("--delay", `-${((index * 1.7) % 18).toFixed(1)}s`);
      flake.style.setProperty("--drift", `${((index % 5) - 2) * 16}px`);
      fragment.appendChild(flake);
    }
    els.snow.replaceChildren(fragment);
  }

  // Анимация окон: auto = включена везде, кроме мобильного профиля.
  function resolveDialogAnimation(profile) {
    const mode = state.settings.dialogAnimation;
    if (mode === "off") return false;
    if (mode === "on") return true;
    return profile !== "mobile";
  }

  // Ставит на <html> атрибуты, по которым CSS выбирает профиль, плотность и анимации.
  function applyProfile() {
    const root = document.documentElement;
    const native = isNativeApp();
    const chosen = state.settings.profile;
    const profile = chosen === "auto" ? (native ? "mobile" : "full") : chosen;

    root.dataset.platform = native ? "android" : "web";
    root.dataset.profile = profile;
    root.dataset.density = state.settings.density === "compact" ? "compact" : "comfortable";
    root.dataset.motion = state.settings.motion === "off" ? "off" : "on";
    root.dataset.decor = state.settings.decor ? "on" : "off";
    root.dataset.dialogAnim = resolveDialogAnimation(profile) ? "on" : "off";
    if (els.saveNoteText) {
      els.saveNoteText.textContent = native
        ? "Всё сохраняется на устройстве"
        : "Всё сохраняется автоматически в этом браузере";
    }
    renderSnow();
  }

  function init() {
    applyProfile();
    applyDaytime();
    applyHoliday();
    updateTodayLabel();
    bindEvents();
    setupSync();
    setupNotifications();
    setupInstall();
    setupUpdateBar();
    registerServiceWorker();
    setupAppUpdateCheck();
    renderAll(true);
    setupSnowman();
    document.fonts.ready.then(scheduleFitMonth);
    syncNativeWidget();
  }

  init();
})();
