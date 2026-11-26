(() => {
  "use strict";

  const STORAGE_KEY = "cachepixel-v1";
  // Аварийные копии: BACKUP — последний рабочий снимок, CORRUPT — сырая строка, которую
  // не удалось разобрать (для ручного спасения). Большие хранилища не копируем: квота.
  const BACKUP_KEY = "cachepixel-backup";
  const BACKUP_STAMP_KEY = "cachepixel-backup-at";
  const CORRUPT_KEY = "cachepixel-corrupt";
  const BACKUP_LIMIT = 512 * 1024;
  const CORRUPT_LIMIT = 1024 * 1024;
  const BACKUP_REFRESH_MS = 10 * 60 * 1000;

  // Ключи прежнего бренда: данные переезжают копированием, старые остаются на диске.
  const LEGACY_KEYS = {
    "cachepixel-v1": "pixel-calendar-2027-v1",
    "cachepixel-backup": "pixel-calendar-2027-backup",
    "cachepixel-backup-at": "pixel-calendar-2027-backup-at",
    "cachepixel-corrupt": "pixel-calendar-2027-corrupt",
    "cachepixel-update-dismissed": "pixel-calendar-2027-update-dismissed",
    "cachepixel-release-check": "pixel-calendar-2027-release-check"
  };

  function adoptLegacyStorage() {
    try {
      Object.keys(LEGACY_KEYS).forEach((key) => {
        if (localStorage.getItem(key) !== null) return;
        const legacy = localStorage.getItem(LEGACY_KEYS[key]);
        if (legacy !== null) localStorage.setItem(key, legacy);
      });
    } catch (error) {
      // Хранилище недоступно — работаем как при пустой установке.
    }
  }

  let storeWasCorrupt = false;
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
  const DIGEST_TIME_DEFAULT = "08:00";
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
    digestTime: DIGEST_TIME_DEFAULT,
    updateCheck: true,
    templates: []
  };
  const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly", "yearly", "custom-days", "custom-weekdays"];
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
    yearJumpLabel: document.querySelector("#yearJumpBtn .year-jump-label"),
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
    dialogCard: document.querySelector("#dayDialog .dialog-card"),
    dialogEyebrow: document.getElementById("dialogEyebrow"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogCloseBtn: document.getElementById("dialogCloseBtn"),
    daySummaryText: document.getElementById("daySummaryText"),
    dayProgressBar: document.getElementById("dayProgressBar"),
    taskList: document.getElementById("taskList"),
    moveTomorrowBtn: document.getElementById("moveTomorrowBtn"),
    taskForm: document.getElementById("taskForm"),
    taskInput: document.getElementById("taskInput"),
    taskRepeat: document.getElementById("taskRepeat"),
    taskRepeatEnd: document.getElementById("taskRepeatEnd"),
    taskInterval: document.getElementById("taskInterval"),
    taskIntervalWrap: document.getElementById("taskIntervalWrap"),
    taskWeekdays: document.getElementById("taskWeekdays"),
    weekdayParams: Array.from(document.querySelectorAll("#taskWeekdays [data-weekday]")),
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
    digestTime: document.getElementById("digestTime"),
    updateCheckRow: document.getElementById("updateCheckRow"),
    updateCheckToggle: document.getElementById("updateCheckToggle"),
    updateCheckNote: document.getElementById("updateCheckNote"),
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
    wipeDataBtn: document.getElementById("wipeDataBtn"),
    installBtn: document.getElementById("installBtn"),
    installNote: document.getElementById("installNote"),
    settingsMeta: document.getElementById("settingsMeta"),
    seriesStats: document.getElementById("seriesStats"),
    templatesInput: document.getElementById("templatesInput"),
    saveNoteText: document.getElementById("saveNoteText"),
    footerPhrase: document.getElementById("footerPhrase"),
    syncUrl: document.getElementById("syncUrl"),
    syncToken: document.getElementById("syncToken"),
    syncConnectBtn: document.getElementById("syncConnectBtn"),
    syncNowBtn: document.getElementById("syncNowBtn"),
    syncStatus: document.getElementById("syncStatus"),
    syncSize: document.getElementById("syncSize"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText"),
    toastAction: document.getElementById("toastAction"),
    updateBar: document.getElementById("updateBar"),
    updateTitle: document.getElementById("updateTitle"),
    updateText: document.getElementById("updateText"),
    updateAction: document.getElementById("updateAction"),
    updateDismiss: document.getElementById("updateDismiss"),
    recoverBar: document.getElementById("recoverBar"),
    recoverText: document.getElementById("recoverText"),
    recoverRestore: document.getElementById("recoverRestore"),
    recoverDownload: document.getElementById("recoverDownload"),
    recoverDrop: document.getElementById("recoverDrop"),
    recoverDismiss: document.getElementById("recoverDismiss")
  };

  const initialToday = startOfDay(new Date());
  adoptLegacyStorage();
  const stored = loadStore();

  let settingsFingerprint = "";
  let applyingRemote = false;
  // Собранные дела дня: пересобираем только после изменения состояния.
  const entriesCache = new Map();

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
let toastAction = null;
let toastHome = null;
const TOAST_ACTION_MS = 6000;
  let storageWarned = false;
  let deferredInstallPrompt = null;
  let suppressClickUntil = 0;
  // Жест в окне дня: свайп по дню или потягивание шапки вниз.
  let dayGesture = null;
  let dayGestureTimer = 0;
  // Подавление клика внутри окна дня — отдельно от календаря: иначе жест в окне
  // глушил и клик по клетке календаря уже после закрытия окна (гонка на 350 мс).
  let suppressDialogClickUntil = 0;
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
    return window.PixelCore.toISO(date);
  }

  function fromISO(iso) {
    return window.PixelCore.fromISO(iso);
  }

  function isValidISO(iso) {
    return window.PixelCore.isValidISO(iso);
  }

  function normalizeTimeValue(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : null;
  }

  // Время сводки: любое корректное HH:MM, иначе 08:00 по умолчанию.
  function normalizeDigestTimeValue(value) {
    return normalizeTimeValue(value) || DIGEST_TIME_DEFAULT;
  }

  function normalizeLeadValue(value) {
    const number = Number(value);
    return LEAD_OPTIONS.includes(number) ? number : null;
  }

  // Аддитивные поля новых частот: «каждые N дней» (interval) и набор дней (days).
  // Те же границы, что в sync.js: сервер и приложение не должны расходиться.
  function normalizeIntervalValue(value) {
    const number = Math.floor(Number(value));
    return number >= 1 && number <= 99 ? number : null;
  }

  function normalizeWeekdaysValue(list) {
    if (!Array.isArray(list)) return [];
    const days = [];
    list.forEach((item) => {
      const day = Math.floor(Number(item));
      if (!Number.isFinite(day) || day < 0 || day > 6) return;
      if (days.indexOf(day) === -1) days.push(day);
    });
    return days.sort((a, b) => a - b);
  }

  function weekdayCodes(days) {
    const codes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    return normalizeWeekdaysValue(days).map((day) => codes[day]);
  }

  // Абсолютная метка напоминания: дата задачи + время. Нужна для сортировки
  // и как запасной вариант, если time поменяют отдельно.
  function remindTimestamp(iso, time) {
    if (!isValidISO(iso) || !time) return null;
    const at = new Date(`${iso}T${time}:00`);
    return Number.isNaN(at.getTime()) ? null : at.getTime();
  }

  function addDays(date, amount) {
    return window.PixelCore.addDays(date, amount);
  }

  function addDaysIso(iso, amount) {
    return window.PixelCore.addDaysIso(iso, amount);
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
    return window.PixelCore.startOfWeek(date, weekStartDay());
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
    return window.PixelCore.plural(number, forms);
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
          interval: normalizeIntervalValue(raw.interval),
          days: normalizeWeekdaysValue(raw.days),
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
        digestTime: normalizeDigestTimeValue(rawSettings.digestTime),
        updateCheck: rawSettings.updateCheck !== false,
        templates: normalizeTemplates(rawSettings.templates),
        updatedAt: Number(rawSettings.updatedAt) || 0
      }
    };
  }

  // Аварийные копии: следующее сохранение не должно затирать единственный экземпляр данных.
  function readWrappedStore(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.raw !== "string") return null;
      return { at: Number(parsed.at) || 0, raw: parsed.raw };
    } catch (error) {
      return null;
    }
  }

  function writeWrappedStore(key, raw, extra) {
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), raw, ...extra }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearWrappedStore(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      /* хранилище недоступно — чистить нечего */
    }
  }

  function stashPreviousStore(raw) {
    if (!raw || raw.length > BACKUP_LIMIT) return;
    try {
      // Копию обновляем не на каждом сохранении: разбор и запись до 512 КБ на каждый
      // тап по галочке заметны. Достаточно «последнего рабочего снимка» раз в 10 минут.
      const stamp = Number(localStorage.getItem(BACKUP_STAMP_KEY)) || 0;
      if (stamp && Date.now() - stamp < BACKUP_REFRESH_MS) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      writeWrappedStore(BACKUP_KEY, raw);
      localStorage.setItem(BACKUP_STAMP_KEY, String(Date.now()));
    } catch (error) {
      /* предыдущее значение уже битое: его сохранит loadStore в CORRUPT */
    }
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeStore(null);
      return normalizeStore(JSON.parse(raw));
    } catch (error) {
      storeWasCorrupt = true;
      const raw = localStorage.getItem(STORAGE_KEY);
      // Сырую строку держим только в пределах лимита: без него квота уходит на копию
      // повреждённого хранилища, и сохранять становится негде.
      if (raw && raw.length <= CORRUPT_LIMIT) {
        writeWrappedStore(CORRUPT_KEY, raw, { error: String((error && error.message) || error) });
      }
      return normalizeStore(null);
    }
  }

  // Версия схемы — из sync.js; если модуль не загрузился, пишем последнюю известную,
  // иначе сохранение падало бы целиком и человек терял данные.
  function schemaVersion() {
    return (window.PixelSync && window.PixelSync.SCHEMA_VERSION) || 4;
  }

  // Могилы старше месяца нужны только пока устройства не обменялись: обрезаем их
  // лишь после недавнего успешного обмена, иначе удаление с другого устройства
  // вернёт запись.
  function pruneOldTombstones() {
    const sync = window.PixelSync;
    if (!sync || typeof sync.pruneTombstones !== "function") return;
    const config = sync.getSyncConfig();
    if (!config.url || !config.token) return;
    if (!config.lastOkAt || Date.now() - config.lastOkAt > sync.TOMBSTONE_SYNC_GRACE_MS) return;
    sync.pruneTombstones(state, Date.now());
  }

  function saveStore() {
    entriesCache.clear();
    pruneOldTombstones();
    try {
      // Настройки синхронизируются блоком, поэтому метка времени обновляется
      // только когда их содержимое действительно изменилось.
      const fingerprint = fingerprintSettings(state.settings);
      if (fingerprint !== settingsFingerprint) {
        state.settings.updatedAt = Date.now();
        settingsFingerprint = fingerprint;
      }
      const payload = JSON.stringify({
        version: schemaVersion(),
        view: state.view,
        tasks: state.tasks,
        series: state.series,
        settings: state.settings
      });
      stashPreviousStore(localStorage.getItem(STORAGE_KEY));
      localStorage.setItem(STORAGE_KEY, payload);
      updateSyncSize(payload.length);
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
      iso,
      label: formatLongDate(date),
      weekday: WEEKDAYS_FULL[date.getDay()],
      holiday: holidayForISO(iso) || "",
      phase: resolveDaytime(),
      sky: state.settings.sky || "auto",
      done: entries.filter((entry) => entry.done).length,
      total: entries.length,
      tasks: entries.slice(0, 8).map((entry) => ({
        key: entry.isSeries ? `series:${entry.seriesId}@${iso}` : `task:${entry.taskId}`,
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

  // Тапы по строкам виджета приходят из native PendingIntent: применяем их к живым задачам.
  function consumeWidgetToggles() {
    const plugin = window.Capacitor?.Plugins?.WidgetBridge;
    if (!plugin || typeof plugin.consumeToggles !== "function") return;
    Promise.resolve(plugin.consumeToggles()).then((result) => {
      const items = result && Array.isArray(result.items) ? result.items : [];
      if (!items.length) return;
      let changed = false;
      items.forEach((item) => {
        const raw = item && typeof item.key === "string" ? item.key : "";
        if (!raw.startsWith("task:")) return;
        const id = raw.slice("task:".length);
        Object.keys(state.tasks).forEach((iso) => {
          state.tasks[iso].forEach((task) => {
            if (task.id !== id || task.deletedAt || task.done) return;
            task.done = true;
            task.snoozedUntil = null;
            task.updatedAt = Date.now();
            changed = true;
          });
        });
      });
      if (!changed) return;
      saveStore();
      renderAll(false);
    }).catch((error) => {
      console.warn("WidgetBridge.consumeToggles failed", error);
    });
  }

  function isSeriesActiveOn(series, iso) {
    return window.PixelCore.isSeriesActiveOn(series, iso);
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
    const cached = entriesCache.get(iso);
    if (cached) return cached;
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

    // Сначала дела со временем — по часам; без времени — ниже, в порядке добавления.
    const entries = tasks.concat(recurring).sort((a, b) => {
      if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return a.createdAt - b.createdAt;
    });
    entriesCache.set(iso, entries);
    return entries;
  }

  function getEntryByKey(iso, key) {
    return getEntries(iso).find((entry) => entry.key === key) || null;
  }

  function getSeriesById(id) {
    return state.series.find((series) => series.id === id) || null;
  }

  function nextSeriesOccurrence(series, fromIso) {
    let cursor = fromISO(series.start > fromIso ? series.start : fromIso);
    // Горизонт поиска вхождения тот же, что у напоминаний: меньше — серия «теряется» в поиске.
    const horizon = window.PixelNotify && window.PixelNotify.MAX_LOOKAHEAD_DAYS
      ? window.PixelNotify.MAX_LOOKAHEAD_DAYS
      : 1500;
    for (let index = 0; index < horizon; index += 1) {
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
    } else if (series.freq === "custom-days") {
      const step = Math.max(1, Math.floor(Number(series.interval) || 1));
      label = step === 1 ? "каждый день" : `каждые ${step} ${plural(step, ["день", "дня", "дней"])}`;
    } else if (series.freq === "custom-weekdays") {
      const names = normalizeWeekdaysValue(series.days)
        .map((day) => WEEKDAYS_MONDAY_FIRST[(day + 6) % 7]);
      label = names.length ? `по ${names.join(", ")}` : "по выбранным дням";
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

  // Цифры внутри подписи набираем Nunito: Tiny5 слипается на мелком кегле и в «2026»
  // читается «2086». Текст остаётся пиксельным, меняются только числовые группы.
  function numberize(node, text) {
    node.replaceChildren();
    String(text === undefined || text === null ? "" : text)
      .split(/(\d+)/)
      .forEach((part) => {
        if (!part) return;
        if (/^\d+$/.test(part)) {
          node.appendChild(el("span", "num", part));
        } else {
          node.appendChild(document.createTextNode(part));
        }
      });
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
    numberize(els.todayLabel, formatLongDate(today));
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
    numberize(els.periodKicker, copy.kicker);
    numberize(els.periodTitle, copy.title);
    const year = new Date().getFullYear();
    els.yearJumpBtn.classList.toggle("is-current", state.cursor.getFullYear() === year);
    // Подпись и обе подсказки — из календаря, а не из константы: год меняется,
    // кнопка не должна врать ни 1 января, ни после него.
    if (els.yearJumpLabel && els.yearJumpLabel.textContent !== String(year)) {
      els.yearJumpLabel.textContent = String(year);
      els.yearJumpBtn.setAttribute("aria-label", `Перейти к ${year} году`);
    }
  }

  function renderQuickAddDate() {
    if (!state.selectedDate) return;
    const date = fromISO(state.selectedDate);
    const today = isSameDay(date, new Date());
    const short = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
    numberize(els.quickAddDate, today ? `сегодня, ${short}` : `${short} ${date.getFullYear()}`);
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

  // Порог compact: в ячейке должно хватать места на номер дня и одну строку
  // дела целиком — рамка 4 + отступы 10 + строка дня 22 + зазор 2 + плашка 19.
  const COMPACT_MIN = 60;
  // Выше этого порога в список влезает и вторая строка (см. styles.css).
  const FULL_MIN = 88;

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
    if (rowHeight < COMPACT_MIN) {
      root.dataset.monthTight = "on";
      rowHeight = solve();
    }

    root.style.setProperty("--month-row", `${rowHeight}px`);
    root.dataset.monthFit =
      rowHeight < COMPACT_MIN ? "tight" : (rowHeight < FULL_MIN ? "compact" : "full");
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

  // Кнопка года не привязана к 2027: 1 января 2028 она должна вести в новый год,
  // а не в прошлое. Подпись и aria-label строятся из текущего года в renderPeriod.
  // Знак в шапке: основа из sign.js стоит в разметке, здесь только число текущего дня.
  // Временно в шапке может стоять прежний блок травы — тогда группы числа нет и мы ничего не делаем.
  function renderBrandSign() {
    const group = document.getElementById("brandDayNumber");
    if (!group || !window.PixelSign) return;
    group.innerHTML = window.PixelSign.numberMarkup(new Date().getDate());
  }

  // Подпись внизу — фраза дня: считается от той же даты, что и число на значке,
  // и меняется в полночь вместе с ней.
  function updateFooterPhrase() {
    if (!els.footerPhrase || !window.PixelCore) return;
    const text = window.PixelCore.phraseForDay(toISO(startOfDay(new Date())));
    if (els.footerPhrase.textContent !== text) els.footerPhrase.textContent = text;
  }

  function goToCurrentYear() {
    const year = new Date().getFullYear();
    state.cursor = new Date(year, 0, 1);
    state.selectedDate = `${year}-01-01`;
    renderAll(true);
    showToast(`Открыт ${year} год`);
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

  // keepDraft — для свайпа внутри открытого окна: день меняется, а начатый текст
  // и время остаются. Иначе листание стирало уже набранное дело.
  function openDay(iso, { keepDraft = false } = {}) {
    const date = fromISO(iso);
    if (Number.isNaN(date.getTime())) return;
    selectDate(iso);
    state.dialogDate = iso;
    state.editingKey = null;
    state.deleteConfirmKey = null;
    lastDayISO = iso;
    populateDialog();
    els.formError.textContent = "";
    if (!keepDraft) {
      els.taskInput.value = "";
      resetRepeatFields();
      els.taskTime.value = "";
      els.taskLead.value = "";
    }
    updateRepeatFields();
    renderTemplateChips();
    showDialog(els.dialog);
  }

  function closeDayDialog() {
    hideDialog(els.dialog);
  }

  // Свайп по окну дня листает дни тем же openDay, что и клик по клетке: второго
  // пути правки состояния нет. Через границу месяца двигаем ещё и курсор — иначе
  // календарь под окном остался бы на старом месяце.
  function shiftDialogDay(direction) {
    if (!state.dialogDate) return false;
    const iso = addDaysIso(state.dialogDate, direction);
    if (!isValidISO(iso)) return false;
    const before = getVisiblePeriod();
    state.cursor = fromISO(iso);
    const after = getVisiblePeriod();
    // Сменился видимый период — обновляем всё под окном (заголовок, прогресс,
    // подсветку). Внутри периода сетка та же, лишний пересбор не нужен.
    if (before.start.getTime() !== after.start.getTime() || before.end.getTime() !== after.end.getTime()) {
      renderAll(false);
    }
    openDay(iso, { keepDraft: els.dialog.open });
    return true;
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
    numberize(els.dialogTitle, formatLongDate(date));
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
    // Перенос касается только обычных дел: отметку дня серии переносить некуда.
    const movable = entries.filter((entry) => !entry.isSeries && !entry.done).length;
    const target = addDaysIso(state.dialogDate, 1);
    els.moveTomorrowBtn.hidden = movable === 0;
    els.moveTomorrowBtn.textContent = target === toISO(addDays(new Date(), 1))
      ? "Перенести незавершённое на завтра"
      : `Перенести незавершённое на ${formatLongDate(fromISO(target))}`;
  }

  // Незавершённые дела переезжают на следующий день. Могилы не нужны: запись
  // физически переносится в другую корзину с тем же id, поэтому синхронизация
  // не увидит удаления.
  function moveUnfinishedToTomorrow() {
    if (!state.dialogDate) return;
    const from = state.dialogDate;
    const to = addDaysIso(from, 1);
    const tasks = state.tasks[from] || [];
    const moving = tasks.filter((task) => !task.deletedAt && !task.done);
    if (!moving.length) return;

    const now = Date.now();
    moving.forEach((task) => {
      task.updatedAt = now;
      if (task.time) task.remindAt = remindTimestamp(to, task.time);
    });
    const rest = tasks.filter((task) => !moving.includes(task));
    if (rest.length) state.tasks[from] = rest;
    else delete state.tasks[from];
    if (!state.tasks[to]) state.tasks[to] = [];
    state.tasks[to].push(...moving);
    if (state.editingKey && moving.some((task) => `task:${task.id}` === state.editingKey)) {
      state.editingKey = null;
    }

    saveStore();
    renderTaskList();
    refreshDialogSummary();
    updateMainAfterTaskChange();
    showToast(moving.length === 1
      ? `Дело перенесено на ${formatLongDate(fromISO(to))}`
      : `${moving.length} ${plural(moving.length, ["дело", "дела", "дел"])} перенесено на ${formatLongDate(fromISO(to))}`);
  }

  function updateMainAfterTaskChange() {
    renderProgress();
    renderCalendar(false);
  }

  // Пример владельца: «пн-ср-пт». Стартовый набор, дальше человек отмечает сам.
  const DEFAULT_WEEKDAYS = [1, 3, 5];

  function readWeekdaySelection() {
    return normalizeWeekdaysValue(
      els.weekdayParams
        .filter((button) => button.getAttribute("aria-pressed") === "true")
        .map((button) => Number(button.dataset.weekday))
    );
  }

  function setWeekdaySelection(list) {
    const days = normalizeWeekdaysValue(list);
    els.weekdayParams.forEach((button) => {
      const on = days.indexOf(Number(button.dataset.weekday)) !== -1;
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.classList.toggle("is-on", on);
    });
  }

  function resetRepeatFields() {
    els.taskRepeat.value = "none";
    els.taskRepeatEnd.value = "";
    els.taskInterval.value = "2";
    setWeekdaySelection(DEFAULT_WEEKDAYS);
  }

  function updateRepeatFields() {
    const repeat = REPEATS.includes(els.taskRepeat.value) ? els.taskRepeat.value : "none";
    const active = repeat !== "none";
    const hasTime = Boolean(normalizeTimeValue(els.taskTime.value));
    els.repeatEndWrap.hidden = !active;
    els.taskLeadWrap.hidden = !hasTime;
    els.taskIntervalWrap.hidden = repeat !== "custom-days";
    els.taskWeekdays.hidden = repeat !== "custom-weekdays";
    if (!hasTime) els.taskLead.value = "";
    if (active) {
      els.taskRepeatEnd.min = state.dialogDate || "";
      els.repeatHint.textContent = "Повтор делает дело серией: оно видно во всех подходящих днях, а время включит напоминание в каждый такой день. Отметки и удаления хранятся отдельно для каждого дня.";
    } else {
      els.taskRepeatEnd.value = "";
      els.repeatHint.textContent = "Время включает напоминание в приложении, повтор — превращает дело в серию.";
    }
    if (repeat === "custom-days") {
      const step = normalizeIntervalValue(els.taskInterval.value) || 2;
      els.repeatHint.textContent = `Серия повторится через ${step} ${plural(step, ["день", "дня", "дней"])}, считая от дня начала.`;
    } else if (repeat === "custom-weekdays") {
      const days = readWeekdaySelection();
      els.repeatHint.textContent = days.length
        ? `Серия появится по ${days.map((day) => WEEKDAYS_MONDAY_FIRST[(day + 6) % 7]).join(", ")}.`
        : "Отметь хотя бы один день недели — иначе серии не будет.";
    }
    // Поле «Заранее» скрыто, пока нет времени, и это главная причина, по которой
    // «напомнить заранее» не находили. Подсказка говорит, что поле появится.
    if (!hasTime && repeat !== "custom-days" && repeat !== "custom-weekdays") {
      els.repeatHint.textContent = "Выберите время — включится напоминание и появится поле «Заранее» (за 10 минут, за час, за день).";
    } else if (!hasTime) {
      els.repeatHint.textContent += " Время включит напоминание и поле «Заранее».";
    }
    // Поле «Заранее» скрыто, пока нет времени, и это главная причина, по которой
    // «напомнить заранее» не находили. Подсказка говорит, что поле появится.
    if (!hasTime) {
      els.repeatHint.textContent = "Выберите время — включится напоминание и появится поле «Заранее» (за 10 минут, за час, за день).";
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
    // Аддитивные частоты схемы v4: «каждые N дней» и свой набор дней недели.
    const interval = repeat === "custom-days" ? normalizeIntervalValue(els.taskInterval.value) : null;
    const days = repeat === "custom-weekdays" ? readWeekdaySelection() : [];
    if (repeat === "custom-days" && !interval) {
      els.formError.textContent = "Напиши, через сколько дней повторять: от 2 до 99.";
      els.taskInterval.focus();
      return;
    }
    if (repeat === "custom-weekdays" && !days.length) {
      els.formError.textContent = "Отметь хотя бы один день недели.";
      els.taskWeekdays.focus();
      return;
    }
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
        interval,
        days,
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
    resetRepeatFields();
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
    const tombstone = removed.deletedAt;
    if (state.editingKey === key) state.editingKey = null;
    if (state.deleteConfirmKey === key) state.deleteConfirmKey = null;
    saveStore();
    renderTaskList();
    refreshDialogSummary();
    updateMainAfterTaskChange();
    showToast(removed.done ? "Выполненное дело убрано" : "Задача удалена", {
      label: "Отменить",
      run() {
        // Если за это время запись удалили заново, старую могилу не трогаем.
        if (removed.deletedAt !== tombstone) return;
        removed.deletedAt = null;
        removed.updatedAt = Date.now();
        saveStore();
        renderTaskList();
        refreshDialogSummary();
        updateMainAfterTaskChange();
        showToast("Удаление отменено");
      }
    });
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
    const iso = state.dialogDate;
    state.deleteConfirmKey = null;
    saveStore();
    populateDialog();
    updateMainAfterTaskChange();
    showToast("Этот день серии удалён", {
      label: "Отменить",
      run() {
        const current = series.exceptions[iso];
        if (!current || !current.deleted) return;
        current.deleted = false;
        current.updatedAt = Date.now();
        series.updatedAt = current.updatedAt;
        saveStore();
        populateDialog();
        updateMainAfterTaskChange();
        showToast("День серии возвращён");
      }
    });
  }

  function deleteSeries(key) {
    const entry = state.dialogDate ? getEntryByKey(state.dialogDate, key) : null;
    if (!entry || !entry.isSeries) return;
    const series = getSeriesById(entry.seriesId);
    if (!series) return;
    series.deletedAt = Date.now();
    series.updatedAt = series.deletedAt;
    const tombstone = series.deletedAt;
    state.deleteConfirmKey = null;
    saveStore();
    populateDialog();
    updateMainAfterTaskChange();
    showToast("Повторяющаяся серия удалена", {
      label: "Отменить",
      run() {
        if (series.deletedAt !== tombstone) return;
        series.deletedAt = null;
        series.updatedAt = Date.now();
        saveStore();
        populateDialog();
        updateMainAfterTaskChange();
        showToast("Серия восстановлена");
      }
    });
  }

  function addQuickTask(text) {
    // Дата и время разбираются офлайн-парсером: «завтра в 15:00 позвонить маме».
    const parsed = window.PixelCore.parseQuickInput(text, new Date());
    const clean = parsed.text.trim().replace(/\s+/g, " ");
    if (!clean) {
      showToast("Напиши, что нужно сделать");
      els.quickAddInput.focus();
      return;
    }
    const iso = parsed.date || state.selectedDate || toISO(startOfDay(new Date()));
    const time = parsed.time;
    if (!state.tasks[iso]) state.tasks[iso] = [];
    state.tasks[iso].push({
      id: makeId(),
      text: clean.slice(0, 140),
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      time,
      remindAt: remindTimestamp(iso, time)
    });
    saveStore();
    els.quickAddInput.value = "";
    renderProgress();
    renderCalendar(false);
    renderQuickAddDate();
    showToast(`${time ? `${time} · ` : ""}Добавлено на ${formatLongDate(fromISO(iso))}`);
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
    if (els.updateCheckToggle) els.updateCheckToggle.checked = updateCheckEnabled();
    if (els.digestTime) {
      els.digestTime.value = state.settings.digestTime;
      els.digestTime.disabled = !state.settings.morningDigest;
    }
    // В браузере системных уведомлений нет — не обещаем сводку.
    els.digestRow.hidden = !isNativeApp();
    // Проверка обновлений — только в APK, в вебе сеть не используется вовсе.
    if (els.updateCheckRow) els.updateCheckRow.hidden = !isNativeApp();
    if (els.updateCheckNote) els.updateCheckNote.hidden = !isNativeApp();
    if (els.templatesInput) els.templatesInput.value = state.settings.templates.join("\n");
  }

  function openSettings() {
    syncSettingsControls();
    updateSettingsMeta();
    updateSyncSize();
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

  // Экспорт файла на телефон. В WebView атрибут download у blob-ссылки не работает
  // (Capacitor не ставит обработчик загрузок), поэтому на Android файл пишет
  // нативный метод saveBackup — в общую папку «Загрузки», и он же сообщает путь.
  function saveFileOnDevice(filename, content, type) {
    const plugin = nativeWidgetPlugin();
    if (!plugin || typeof plugin.saveBackup !== "function") {
      downloadFile(filename, content, type);
      return Promise.resolve({ ok: true, path: null });
    }
    return Promise.resolve(plugin.saveBackup({ filename, content }))
      .then((result) => ({ ok: true, path: (result && result.path) || `Download/${filename}` }))
      .catch((error) => ({ ok: false, message: (error && error.message) || "" }));
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
      app: "cachepixel",
      version: schemaVersion(),
      exportedAt: new Date().toISOString(),
      view: state.view,
      tasks: state.tasks,
      series: state.series,
      settings: state.settings
    };
    const name = `cachepixel-backup-${toISO(new Date())}.json`;
    const text = JSON.stringify(payload, null, 2);
    // На телефоне сохранение делает нативный метод — в общую папку «Загрузки».
    // Тост показывает путь, иначе «копия скачана» звучит как обещание, которого не видно.
    saveFileOnDevice(name, text, "application/json").then((result) => {
      if (!result.ok) {
        showToast("Не удалось сохранить копию. Попробуйте ещё раз.");
        return;
      }
      showToast(result.path ? `Копия сохранена: ${result.path}` : "Резервная копия скачана");
    });
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
    } else if (series.freq === "custom-days") {
      const step = Math.max(1, Math.floor(Number(series.interval) || 1));
      rule = step === 1 ? "FREQ=DAILY" : `FREQ=DAILY;INTERVAL=${step}`;
    } else if (series.freq === "custom-weekdays") {
      const codes = weekdayCodes(series.days);
      rule = codes.length ? `FREQ=WEEKLY;BYDAY=${codes.join(",")}` : "FREQ=WEEKLY";
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
      "PRODID:-//CachePixel//RU",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:CachePixel"
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
          `DESCRIPTION:${icsEscape(task.done ? "Выполнено · CachePixel" : "CachePixel")}`,
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
        `DESCRIPTION:${icsEscape(`Повтор: ${seriesSchedule(series)} · CachePixel`)}`,
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
    const name = `cachepixel-${toISO(new Date())}.ics`;
    saveFileOnDevice(name, buildICS(), "text/calendar;charset=utf-8").then((result) => {
      if (!result.ok) {
        showToast("Не удалось сохранить файл. Попробуйте ещё раз.");
        return;
      }
      showToast(result.path ? `Календарь сохранён: ${result.path}` : "Файл .ics готов для Google Календаря");
    });
  }

  function googleCalendarUrl(entry, iso) {
    const start = icsDate(iso);
    const end = icsDate(toISO(addDays(fromISO(iso), 1)));
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: entry.text,
      dates: `${start}/${end}`,
      details: entry.isSeries
        ? `Повтор: ${seriesSchedule(entry.series)} · Добавлено из CachePixel`
        : "Добавлено из CachePixel"
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

  // Полное стирание: без могил, с чисткой копий и, если настроено, серверной копии.
  async function eraseAllData() {
    if (!window.confirm(
      "Стереть все задачи и серии безвозвратно? Копии в этом браузере тоже удалятся. "
      + "Если настроена синхронизация, будет очищена и серверная копия. Отменить это нельзя."
    )) return;
    const answer = window.prompt("Чтобы подтвердить стирание, введите слово «стереть».", "");
    if (answer === null) return;
    if (answer.trim().toLowerCase() !== "стереть") {
      showToast("Слово не совпало — данные не тронуты");
      return;
    }

    let remoteError = "";
    const sync = window.PixelSync;
    if (sync && typeof sync.wipeRemote === "function") {
      const config = sync.getSyncConfig();
      if (config.url && config.token) {
        try {
          await sync.wipeRemote();
        } catch (error) {
          remoteError = (error && error.message) || "ошибка сети";
        }
      }
    }

    const today = startOfDay(new Date());
    state.tasks = {};
    state.series = [];
    state.settings = { ...DEFAULT_SETTINGS, templates: [], updatedAt: 0 };
    state.view = "month";
    state.editingKey = null;
    state.deleteConfirmKey = null;
    state.dialogDate = null;
    state.selectedDate = toISO(today);
    state.cursor = new Date(today);
    entriesCache.clear();
    lastWidgetPayload = "";
    // saveStore снимет все запланированные уведомления: список дел пуст.
    saveStore();
    // Копии удаляем после сохранения: иначе saveStore сделает снимок стёртого.
    clearWrappedStore(BACKUP_KEY);
    clearWrappedStore(CORRUPT_KEY);
    try {
      localStorage.removeItem(BACKUP_STAMP_KEY);
    } catch (error) {
      /* хранилище недоступно — чистить нечего */
    }
    applyProfile();
    applyDaytime();
    applyHoliday();
    renderAll(false);
    if (els.settingsDialog.open) {
      syncSettingsControls();
      refreshSyncFields();
      renderSeriesStats();
    }
    updateSettingsMeta();
    if (remoteError) {
      window.alert(
        `Локальные данные стёрты. Серверная копия осталась: ${remoteError}. `
        + "При следующей синхронизации записи вернутся с сервера."
      );
    } else {
      showToast("Данные стёрты безвозвратно");
    }
  }

  // Окно дня — модальный <dialog> в top layer, а тост живёт в body и рисуется под ним.
  // На время показа переносим тост внутрь открытого окна (его поддерево уже в top layer),
  // после закрытия окна возвращаем назад, чтобы тост оставался видимым.
  function revealToast() {
    const host = document.querySelector("dialog[open]");
    if (!host) {
      if (toastHome && toastHome.isConnected && els.toast.parentElement !== toastHome) {
        toastHome.appendChild(els.toast);
      }
      return;
    }
    if (els.toast.parentElement === host) return;
    if (!toastHome) toastHome = els.toast.parentElement;
    host.appendChild(els.toast);
  }

  function concealToast() {
    els.toast.classList.remove("is-visible");
    if (toastHome && toastHome.isConnected && els.toast.parentElement !== toastHome) {
      toastHome.appendChild(els.toast);
    }
    toastHome = null;
  }

  // Окно закрылось, пока тост висел внутри него: возвращаем тост в body, не гася.
  function detachToastFromDialogs(event) {
    const dialog = event.currentTarget;
    if (els.toast.parentElement !== dialog) return;
    const home = toastHome && toastHome.isConnected ? toastHome : document.body;
    home.appendChild(els.toast);
    toastHome = null;
  }

  // Тост умеет держать одно действие («Отменить»): удаление без диалога подтверждения
  // ошибочно не выбранную запись возвращает одним нажатием.
  function showToast(message, action) {
    els.toastText.textContent = message;
    toastAction = typeof action?.run === "function" ? action : null;
    els.toastAction.hidden = !toastAction;
    if (toastAction) els.toastAction.textContent = toastAction.label || "Отменить";
    revealToast();
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastAction = null;
      els.toastAction.hidden = true;
      concealToast();
    }, toastAction ? TOAST_ACTION_MS : 2300);
  }

  function runToastAction() {
    const action = toastAction;
    if (!action) return;
    toastAction = null;
    els.toastAction.hidden = true;
    window.clearTimeout(toastTimer);
    concealToast();
    action.run();
  }

  function refreshAtMidnight() {
    const current = toISO(startOfDay(new Date()));
    if (current === knownToday) return;
    const oldToday = fromISO(knownToday);
    const selectedWasToday = state.selectedDate === knownToday;
    const cursorWasToday = isSameDay(state.cursor, oldToday);
    knownToday = current;
    updateFooterPhrase();
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

  function syncStateSize() {
    try {
      return JSON.stringify({
        version: schemaVersion(),
        view: state.view,
        tasks: state.tasks,
        series: state.series,
        settings: state.settings
      }).length;
    } catch (error) {
      return 0;
    }
  }

  function updateSyncSize(bytes) {
    if (!els.syncSize) return;
    const kb = Math.max(1, Math.round((typeof bytes === "number" ? bytes : syncStateSize()) / 1024));
    els.syncSize.textContent = `≈ ${kb} КБ`;
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
        version: schemaVersion(),
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
    els.yearJumpBtn.addEventListener("click", goToCurrentYear);

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

    // Жесты в окне дня: свайп вбок листает дни, потягивание шапки вниз закрывает окно.
    // Модель та же, что у свайпа по календарю: только палец, жест должен быть явно
    // своим (порог по модулю и против второй оси), а клик сразу после жеста гасится
    // (suppressDialogClickUntil), иначе тап «нажимал» дело вместо листания.
    const DAY_SWIPE_MIN = 48;
    // Шапка 73–74px: порог закрытия 64px — почти вся её высота, то есть осознанное
    // движение, а не случайное касание или микросдвиг при клике.
    const HEAD_PULL_CLOSE = 64;
    const HEAD_PULL_MAX = 140;
    const AXIS_LOCK_MIN = 8;
    const GESTURE_BLOCK = "button, input, select, textarea, a, label, [data-action]";

    const setDayGesture = (translate, opacity) => {
      els.dialogCard.style.translate = translate;
      els.dialogCard.style.opacity = opacity;
    };

    const resetDayGesture = (animate) => {
      dayGesture = null;
      els.dialogCard.classList.remove("is-gesture");
      if (animate) {
        els.dialogCard.classList.add("is-settling");
        window.clearTimeout(dayGestureTimer);
        dayGestureTimer = window.setTimeout(() => {
          els.dialogCard.classList.remove("is-settling");
        }, 240);
      } else {
        els.dialogCard.classList.remove("is-settling");
        window.clearTimeout(dayGestureTimer);
      }
      setDayGesture("", "");
    };

    els.dialogCard.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      if (event.target.closest(GESTURE_BLOCK)) return;
      const inHead = Boolean(event.target.closest(".dialog-head"));
      // В списке дел вертикальная прокрутка важнее: свайп там не начинаем.
      if (!inHead && event.target.closest("#taskList")) return;
      dayGesture = {
        id: event.pointerId,
        mode: inHead ? "pull" : "swipe",
        x: event.clientX,
        y: event.clientY,
        axis: null
      };
      // Захватываем указатель: без этого палец (перо) может уйти за карточку и
      // отпуститься вне неё — pointerup придёт другому элементу, dayGesture не
      // обнулится, и карточка застрянет сдвинутой и без анимации возврата.
      // У касания захват неявный, но перо и стилус его не получают.
      try {
        els.dialogCard.setPointerCapture(event.pointerId);
      } catch (error) {
        // Старый WebView без захвата: сработает страховка lostpointercapture/window ниже.
      }
      els.dialogCard.classList.remove("is-settling");
      els.dialogCard.classList.add("is-gesture");
    });

    // Страховка: если захват потерян (или его не было), жест не должен зависнуть.
    // Срабатывает только пока жест реально не завершён — после своего pointerup
    // dayGesture уже пуст, и повторный сброс не перезапускает анимацию возврата.
    els.dialogCard.addEventListener("lostpointercapture", (event) => {
      if (dayGesture && dayGesture.id === event.pointerId) resetDayGesture(true);
    });
    window.addEventListener("pointerup", (event) => {
      if (dayGesture && dayGesture.id === event.pointerId) resetDayGesture(true);
    });
    window.addEventListener("pointercancel", (event) => {
      if (dayGesture && dayGesture.id === event.pointerId) resetDayGesture(true);
    });

    els.dialogCard.addEventListener("pointermove", (event) => {
      if (!dayGesture || dayGesture.id !== event.pointerId) return;
      const dx = event.clientX - dayGesture.x;
      const dy = event.clientY - dayGesture.y;
      if (!dayGesture.axis) {
        if (Math.abs(dx) < AXIS_LOCK_MIN && Math.abs(dy) < AXIS_LOCK_MIN) return;
        const horizontal = Math.abs(dx) >= Math.abs(dy);
        if (dayGesture.mode === "pull" ? horizontal : !horizontal) {
          if (dayGesture.mode === "pull" && horizontal) {
            // Начали за шапку, а ведём вбок: это листание дней, а не потягивание.
            dayGesture.mode = "swipe";
          } else {
            // Ось не наша: отдаём жест браузеру (прокрутку не отбираем).
            resetDayGesture(false);
            return;
          }
        }
        dayGesture.axis = horizontal ? "x" : "y";
      }
      if (dayGesture.mode === "pull") {
        // Вверх шапку не тянем: карточка идёт только за пальцем вниз.
        const shift = Math.max(0, Math.min(dy, HEAD_PULL_MAX));
        setDayGesture(`0 ${shift}px`, String(Math.max(0.6, 1 - shift / 360)));
      } else {
        setDayGesture(`${Math.max(-HEAD_PULL_MAX, Math.min(dx, HEAD_PULL_MAX))}px 0`, "");
      }
    });

    els.dialogCard.addEventListener("pointerup", (event) => {
      if (!dayGesture || dayGesture.id !== event.pointerId) return;
      const dx = event.clientX - dayGesture.x;
      const dy = event.clientY - dayGesture.y;
      const mode = dayGesture.mode;
      const horizontal = dayGesture.axis === "x";
      const vertical = dayGesture.axis === "y";

      if (mode === "pull" && vertical
        && dy >= HEAD_PULL_CLOSE && Math.abs(dy) >= Math.abs(dx) * 1.5) {
        // Закрываем только при явном движении вниз: почти вся высота шапки (73–74px)
        // и заметный перевес над горизонталью, чтобы диагональ окно не гасила.
        dayGesture = null;
        suppressDialogClickUntil = Date.now() + 350;
        els.dialogCard.classList.add("is-settling");
        setDayGesture(`0 ${Math.min(dy, HEAD_PULL_MAX)}px`, "0.35");
        window.clearTimeout(dayGestureTimer);
        // Карточка доезжает за пальцем ещё кадр-другой и только потом закрывается:
        // без этого она «щёлкала» на место перед закрытием.
        dayGestureTimer = window.setTimeout(closeDayDialog, 160);
        return;
      }

      resetDayGesture(true);
      if (mode === "pull" || !horizontal) return;
      if (Math.abs(dx) < DAY_SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      suppressDialogClickUntil = Date.now() + 350;
      shiftDialogDay(dx < 0 ? 1 : -1);
    });

    els.dialogCard.addEventListener("pointercancel", () => resetDayGesture(true));
    els.dialog.addEventListener("close", () => resetDayGesture(false));
    // Пока подавляем клик, он не должен уходить ни в крестик, ни в список дел.
    els.dialog.addEventListener("click", (event) => {
      if (Date.now() >= suppressDialogClickUntil) return;
      event.stopPropagation();
      event.preventDefault();
    }, true);

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
    els.toastAction.addEventListener("click", runToastAction);
    els.moveTomorrowBtn.addEventListener("click", moveUnfinishedToTomorrow);
    [els.dialog, els.searchDialog, els.settingsDialog].forEach((dialog) => {
      if (dialog) dialog.addEventListener("close", detachToastFromDialogs);
    });
    bindDialogBackdrop(els.dialog, closeDayDialog);

    els.dialog.addEventListener("close", () => {
      // Событие close приходит задачей уже после close(), а не сразу. Если окно
      // успели открыть заново в том же задании (свайп на соседний день, повторный
      // клик по клетке), обработчик сработает поверх нового openDay и обнулит
      // день открытого окна — форма добавления потом молча не пишет.
      if (els.dialog.open) return;
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
    els.taskInterval.addEventListener("input", updateRepeatFields);
    if (els.taskWeekdays) {
      els.taskWeekdays.addEventListener("click", (event) => {
        const button = event.target.closest("[data-weekday]");
        if (!button) return;
        const on = button.getAttribute("aria-pressed") === "true";
        button.setAttribute("aria-pressed", on ? "false" : "true");
        button.classList.toggle("is-on", !on);
        updateRepeatFields();
      });
    }

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

    // Поиск пересобирается с задержкой: на каждый символ раньше прогонялись все серии.
    let searchTimer = 0;
    const runSearch = () => {
      window.clearTimeout(searchTimer);
      searchTimer = 0;
      state.searchQuery = els.searchInput.value;
      renderSearch();
    };
    els.searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(runSearch, 150);
    });
    els.searchInput.addEventListener("change", runSearch);
    els.searchInput.addEventListener("blur", runSearch);

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
      if (els.digestTime) els.digestTime.disabled = !state.settings.morningDigest;
      saveStore();
    });

    if (els.updateCheckToggle) {
      els.updateCheckToggle.addEventListener("change", () => {
        state.settings.updateCheck = els.updateCheckToggle.checked;
        saveStore();
        applyUpdateCheckSetting();
      });
    }

    if (els.digestTime) {
      els.digestTime.addEventListener("change", () => {
        state.settings.digestTime = normalizeDigestTimeValue(els.digestTime.value);
        els.digestTime.value = state.settings.digestTime;
        saveStore();
      });
    }

    els.exportJsonBtn.addEventListener("click", exportJson);
    els.exportIcsBtn.addEventListener("click", exportICS);
    if (els.syncConnectBtn) {
      els.syncConnectBtn.addEventListener("click", () => syncFromForm("connect"));
      els.syncNowBtn.addEventListener("click", () => syncFromForm("now"));
    }
    els.importJsonBtn.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", handleImportFile);
    els.clearDataBtn.addEventListener("click", clearAllData);
    if (els.wipeDataBtn) els.wipeDataBtn.addEventListener("click", eraseAllData);
    if (els.perfBtn) els.perfBtn.addEventListener("click", runPerfProbe);
    if (els.perfCopyBtn) els.perfCopyBtn.addEventListener("click", copyProbeReport);

    // ——— Помощь и поддержка ———
    // «Поддержать проект» — обычная ссылка в index.html (Boosty), JS ей не нужен.
    setupSupport();

    function setupSupport() {
      const mailBtn = document.getElementById("mailAuthorBtn");
      if (mailBtn) {
        const version = (window.__BUILD_INFO__ && window.__BUILD_INFO__.version) || "";
        const subject = `CachePixel${version ? ` ${version}` : ""}: `;
        const body = [
          "Что случилось или что хочется добавить:",
          "",
          "",
          "— — —",
          `Версия: ${version || "неизвестна"}`,
          `Устройство: ${navigator.userAgent}`,
        ].join("\n");
        mailBtn.href = `mailto:vlad-02_2014@mail.ru?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
    }

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
      // Раскладка не важна: в русской раскладке T/N дают «е»/«т» в event.key,
      // поэтому буквы ловим по физической клавише (event.code), слэш — по обоим признакам.
      const code = event.code || "";
      const key = (event.key || "").toLowerCase();
      const isLetter = (letter) => code === `Key${letter.toUpperCase()}` || key === letter;
      if (event.key === "Escape" && anyDialogOpen) return;
      if (event.key === "ArrowLeft" && !anyDialogOpen) {
        event.preventDefault();
        shiftPeriod(-1);
      } else if (event.key === "ArrowRight" && !anyDialogOpen) {
        event.preventDefault();
        shiftPeriod(1);
      } else if (isLetter("t") && !anyDialogOpen) {
        event.preventDefault();
        goToToday();
      } else if (isLetter("n") && !anyDialogOpen) {
        event.preventDefault();
        els.quickAddInput.focus();
      } else if ((code === "Slash" || event.key === "/") && !anyDialogOpen) {
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
        entriesCache.clear();
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
      els.installNote.textContent = "CachePixel можно установить как приложение — он откроется в отдельном окне.";
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      els.installBtn.hidden = true;
      els.installNote.textContent = "Приложение установлено. Ищи иконку на главном экране.";
      showToast("CachePixel установлен");
    });
  }

  // ——— Обновления ———

  const RELEASE_API = window.PixelUpdate
    ? window.PixelUpdate.releaseApiUrl()
    : "https://api.github.com/repos/vladis77177/cachepixel-calendar/releases/latest";
  const RELEASE_APK = window.PixelUpdate
    ? window.PixelUpdate.apkDownloadUrl()
    : "https://github.com/vladis77177/cachepixel-calendar/releases/latest/download/cachepixel-calendar-release.apk";
  const UPDATE_DISMISS_KEY = "cachepixel-update-dismissed";
  const RELEASE_CACHE_KEY = "cachepixel-release-check";
  // Кэш показывается сразу и живёт офлайн сколько угодно, но в сеть ходим
  // не реже раза в полчаса: иначе свежий релиз замечается только через сутки.
  const RELEASE_RECHECK_INTERVAL = 30 * 60 * 1000;
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
      // Ссылка из кэша не используется: в старых версиях туда попадала ссылка
      // конкретного релиза, и она уводила на устаревший APK.
      return {
        at: Number(parsed.at) || 0,
        version: typeof parsed.version === "string" ? parsed.version : ""
      };
    } catch (error) {
      return null;
    }
  }

  function writeReleaseCache(version) {
    try {
      localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ at: Date.now(), version }));
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

  // Битое хранилище: показываем шанс вернуть предыдущее сохранение вместо тихой потери.
  function countBackupTasks(raw) {
    try {
      const parsed = JSON.parse(raw);
      const tasks = parsed && parsed.tasks;
      if (!tasks || typeof tasks !== "object") return 0;
      let count = 0;
      Object.keys(tasks).forEach((iso) => {
        if (!Array.isArray(tasks[iso])) return;
        tasks[iso].forEach((task) => {
          if (task && !task.deletedAt && task.text) count += 1;
        });
      });
      return count;
    } catch (error) {
      return 0;
    }
  }

  function backupStamp(at) {
    if (!at) return "неизвестное время";
    try {
      return new Date(at).toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return new Date(at).toISOString();
    }
  }

  function hideRecoverBar() {
    if (els.recoverBar) els.recoverBar.hidden = true;
    document.body.classList.remove("has-recover-bar");
  }

  function restoreBackup() {
    // Копию и повреждённую строку не удаляем: если восстановление окажется неудачным,
    // спасать будет нечего. Чистятся они только явными кнопками.
    const backup = readWrappedStore(BACKUP_KEY);
    let restored = null;
    if (backup) {
      try {
        restored = normalizeStore(JSON.parse(backup.raw));
      } catch (error) {
        restored = null;
      }
    }
    if (!restored) {
      showToast("Копия тоже не читается");
      return;
    }
    state.view = restored.view;
    state.tasks = restored.tasks;
    state.series = restored.series;
    state.settings = restored.settings;
    settingsFingerprint = fingerprintSettings(state.settings);
    saveStore();
    renderAll(false);
    updateSettingsMeta();
    hideRecoverBar();
    showToast("Данные восстановлены");
  }

  function downloadRawStore() {
    const raw = localStorage.getItem(CORRUPT_KEY);
    const backup = readWrappedStore(BACKUP_KEY);
    const source = raw || (backup && backup.raw);
    if (!source) {
      showToast("Сохранять нечего");
      return;
    }
    const name = `cachepixel-raw-${new Date().toISOString().slice(0, 10)}.json`;
    saveFileOnDevice(name, source, "application/json").then((result) => {
      if (!result.ok) {
        showToast("Не удалось сохранить копию. Попробуйте ещё раз.");
        return;
      }
      showToast(result.path ? `Сырая строка сохранена: ${result.path}` : "Сырая строка сохранена");
    });
  }

  function dropRecoveryCopies() {
    clearWrappedStore(BACKUP_KEY);
    clearWrappedStore(CORRUPT_KEY);
    try {
      localStorage.removeItem(BACKUP_STAMP_KEY);
    } catch (error) {
      /* хранилище недоступно — чистить нечего */
    }
    hideRecoverBar();
    showToast("Копии удалены");
  }

  function setupRecovery() {
    if (!els.recoverBar) return;
    if (!storeWasCorrupt) return;
    const backup = readWrappedStore(BACKUP_KEY);
    if (!backup && !localStorage.getItem(CORRUPT_KEY)) {
      showToast("Данные не прочитались, повреждённая копия сохранена");
      return;
    }
    const count = backup ? countBackupTasks(backup.raw) : 0;
    const countText = count ? `${count} ${plural(count, ["дело", "дела", "дел"])}` : "без дел, только настройки";
    els.recoverText.textContent = backup
      ? `Данные не прочитались. Копия от ${backupStamp(backup.at)}: ${countText}.`
      : "Данные не прочитались. Повреждённую строку можно скачать и спасти вручную.";
    els.recoverRestore.hidden = !backup;
    els.recoverBar.hidden = false;
    document.body.classList.add("has-recover-bar");
    els.recoverRestore.addEventListener("click", restoreBackup);
    if (els.recoverDownload) els.recoverDownload.addEventListener("click", downloadRawStore);
    if (els.recoverDrop) els.recoverDrop.addEventListener("click", dropRecoveryCopies);
    els.recoverDismiss.addEventListener("click", () => {
      // Крестик только скрывает плашку: копии остаются, пока их не уберут явно.
      hideRecoverBar();
      showToast("Копии остались в хранилище");
    });
  }

  function shouldRecheckRelease(cached) {
    const helper = window.PixelUpdate;
    if (helper && typeof helper.shouldRecheck === "function") {
      return helper.shouldRecheck(cached ? cached.at : 0, Date.now(), RELEASE_RECHECK_INTERVAL);
    }
    if (!cached || !cached.at) return true;
    return Date.now() - cached.at >= RELEASE_RECHECK_INTERVAL;
  }

  let releaseCheckInFlight = false;

  function refreshRelease() {
    if (releaseCheckInFlight) return;
    releaseCheckInFlight = true;
    fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((release) => {
        if (!release || !release.tag_name) return;
        const version = normalizeReleaseVersion(release.tag_name);
        if (!version) return;
        writeReleaseCache(version);
        if (!isNewerVersion(version, currentVersion())) {
          // Свежий ответ — истина: если последний релиз не новее установленного
          // (например, релиз откатили), плашку снимаем.
          hideUpdateBar();
          return;
        }
        offerAppRelease(version, RELEASE_APK);
      })
      .catch(() => {
        // Нет сети или GitHub недоступен — показываем кэш и ждём следующей попытки.
      })
      .then(() => {
        releaseCheckInFlight = false;
      });
  }

  function updateCheckEnabled() {
    return state.settings.updateCheck !== false;
  }

  function setupAppUpdateCheck() {
    if (!isNativeApp() || !currentVersion()) return;
    // Выключатель только в APK: веб-версия в GitHub не ходит вовсе.
    if (els.updateCheckRow) els.updateCheckRow.hidden = false;
    if (els.updateCheckNote) els.updateCheckNote.hidden = false;
    if (els.updateCheckToggle) els.updateCheckToggle.checked = updateCheckEnabled();
    const cached = readReleaseCache();
    if (!updateCheckEnabled()) return;
    if (cached && cached.version) offerAppRelease(cached.version, RELEASE_APK);
    if (shouldRecheckRelease(cached)) window.setTimeout(refreshRelease, cached ? 1500 : 4000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!updateCheckEnabled()) return;
      if (shouldRecheckRelease(readReleaseCache())) refreshRelease();
    });
  }

  // Переключение выключателя: выключили — снимаем плашку и молчим до включения;
  // включили — не ждём полчаса, а проверяем сразу (кэш всё равно уважается).
  function applyUpdateCheckSetting() {
    if (!isNativeApp() || !currentVersion()) return;
    if (!updateCheckEnabled()) {
      hideUpdateBar();
      return;
    }
    const cached = readReleaseCache();
    if (cached && cached.version) offerAppRelease(cached.version, RELEASE_APK);
    if (shouldRecheckRelease(cached)) refreshRelease();
  }

  function setupWidgetToggles() {
    consumeWidgetToggles();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      consumeWidgetToggles();
    });
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
    const now = new Date();
    return window.PixelCore.skyPhaseFor(now.getHours() + now.getMinutes() / 60, state.settings.sky);
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

  // Долгое нажатие на иконку (Android) и ярлыки PWA передают режим быстрого добавления:
  // сразу открывается окно нужного дня, для «сейчас» — с ближайшим получасом.
  function nextHalfHourTime(date) {
    const next = new Date(date.getTime());
    next.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0);
    const hours = String(next.getHours()).padStart(2, "0");
    const minutes = String(next.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function openQuickAdd(mode) {
    const today = new Date();
    openDay(mode === "tomorrow" ? toISO(addDays(today, 1)) : toISO(today));
    if (mode === "now") els.taskTime.value = nextHalfHourTime(today);
    els.taskInput.focus();
  }

  function handleQuickAddRequest(mode) {
    if (mode !== "now" && mode !== "today" && mode !== "tomorrow") return;
    openQuickAdd(mode);
  }

  function setupQuickAdd() {
    const fromUrl = new URLSearchParams(window.location.search).get("add");
    if (fromUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete("add");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      handleQuickAddRequest(fromUrl);
    }
    const plugin = window.Capacitor?.Plugins?.WidgetBridge;
    if (!plugin || typeof plugin.consumeLaunch !== "function") return;
    const readLaunch = () => {
      Promise.resolve(plugin.consumeLaunch())
        .then((result) => handleQuickAddRequest(result && result.mode))
        .catch(() => {});
    };
    readLaunch();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") readLaunch();
    });
  }

  // Системная кнопка «назад» в APK: по одному слою за нажатие. Сначала верхний
  // открытый слой (окно дня, поиск, настройки), затем возврат к сегодняшнему дню,
  // если пользователь ушёл в другой период, и только потом — выход из приложения
  // по второму нажатию. Подписка на событие `backButton` обязательна: без неё
  // плагин @capacitor/app сам вызывает webView.goBack() / закрывает Activity —
  // именно это и «сворачивало» приложение вместо возврата на главный экран.
  function setupAndroidBack() {
    const capacitor = window.Capacitor;
    const plugin = capacitor && capacitor.Plugins ? capacitor.Plugins.App : null;
    if (!isNativeApp() || !plugin || typeof plugin.addListener !== "function") return;
    let lastBackAt = 0;
    plugin.addListener("backButton", () => {
      if (els.dialog.open) {
        closeDayDialog();
        return;
      }
      if (els.searchDialog.open) {
        hideDialog(els.searchDialog);
        return;
      }
      if (els.settingsDialog.open) {
        hideDialog(els.settingsDialog);
        return;
      }
      const today = startOfDay(new Date());
      if (!isSameDay(state.cursor, today) || state.selectedDate !== toISO(today)) {
        goToToday();
        return;
      }
      const now = Date.now();
      if (now - lastBackAt < 2000) {
        if (typeof plugin.exitApp === "function") plugin.exitApp();
        return;
      }
      // Первое нажатие на главном — предупреждаем, второе (в пределах двух секунд) выходит.
      lastBackAt = now;
      showToast("Нажмите «назад» ещё раз, чтобы выйти");
    });
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
    setupRecovery();
    registerServiceWorker();
    setupAppUpdateCheck();
    setupWidgetToggles();
    setupAndroidBack();
    renderBrandSign();
    updateFooterPhrase();
    // День меняется и при открытом приложении: возвращаемся к экрану — знак догоняет дату.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        renderBrandSign();
        updateFooterPhrase();
      }
    });
    renderAll(true);
    setupSnowman();
    document.fonts.ready.then(scheduleFitMonth);
    syncNativeWidget();
    setupQuickAdd();
  }

  init();
})();
