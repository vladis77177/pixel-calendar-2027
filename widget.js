(() => {
  "use strict";

  const STORAGE_KEY = "pixel-calendar-2027-v1";
  const WEEKDAYS_FULL = [
    "воскресенье", "понедельник", "вторник", "среда",
    "четверг", "пятница", "суббота"
  ];
  const MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
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
  const MAX_VISIBLE = 6;

  const els = {
    weekday: document.getElementById("widgetWeekday"),
    day: document.getElementById("widgetDay"),
    month: document.getElementById("widgetMonth"),
    year: document.getElementById("widgetYear"),
    holiday: document.getElementById("widgetHoliday"),
    clock: document.getElementById("widgetClock"),
    dateLabel: document.getElementById("widgetDateLabel"),
    progress: document.getElementById("widgetProgress"),
    bar: document.getElementById("widgetBar"),
    tasks: document.getElementById("widgetTasks"),
    form: document.getElementById("widgetForm"),
    input: document.getElementById("widgetInput"),
    toast: document.getElementById("widgetToast")
  };

  let data = normalizeStore(loadRaw());
  let knownToday = "";
  let toastTimer = 0;
  let widgetSyncTimer = 0;

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

  function makeId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadRaw() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function normalizeStore(parsed) {
    const result = {
      view: "month",
      tasks: {},
      series: [],
      settings: { showHolidays: true, sky: "auto" }
    };
    if (!parsed || typeof parsed !== "object") return result;

    if (["week", "month", "quarter", "year"].includes(parsed.view)) result.view = parsed.view;
    if (parsed.settings && parsed.settings.showHolidays === false) result.settings.showHolidays = false;
    if (parsed.settings && ["auto", "day", "dawn", "dusk", "night"].includes(parsed.settings.sky)) {
      result.settings.sky = parsed.settings.sky;
    }

    if (parsed.tasks && typeof parsed.tasks === "object" && !Array.isArray(parsed.tasks)) {
      Object.keys(parsed.tasks).forEach((iso) => {
        if (!isValidISO(iso) || !Array.isArray(parsed.tasks[iso])) return;
        const clean = parsed.tasks[iso]
          .filter((task) => task && typeof task.text === "string" && task.text.trim())
          .map((task) => ({
            ...task,
            id: typeof task.id === "string" && task.id ? task.id : makeId(),
            text: task.text.trim().slice(0, 140),
            done: Boolean(task.done),
            createdAt: Number(task.createdAt) || Date.now(),
            updatedAt: Number(task.updatedAt) || Number(task.createdAt) || Date.now()
          }));
        if (clean.length) result.tasks[iso] = clean;
      });
    }

    if (Array.isArray(parsed.series)) {
      parsed.series.forEach((raw) => {
        if (!raw || typeof raw.text !== "string" || !raw.text.trim()) return;
        if (!["daily", "weekdays", "weekly", "monthly", "yearly"].includes(raw.freq) || !isValidISO(raw.start)) return;
        let end = isValidISO(raw.end) ? raw.end : null;
        if (end && end < raw.start) end = null;
        const exceptions = {};
        if (raw.exceptions && typeof raw.exceptions === "object" && !Array.isArray(raw.exceptions)) {
          Object.keys(raw.exceptions).forEach((iso) => {
            if (!isValidISO(iso)) return;
            const ex = raw.exceptions[iso];
            if (!ex || typeof ex !== "object") return;
            const clean = { ...ex, updatedAt: Number(ex.updatedAt) || Date.now() };
            if (!ex.done) delete clean.done;
            if (!ex.deleted) delete clean.deleted;
            if (!Number(ex.snoozedUntil)) delete clean.snoozedUntil;
            if (clean.done || clean.deleted || clean.snoozedUntil) exceptions[iso] = clean;
          });
        }
        result.series.push({
          ...raw,
          id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
          text: raw.text.trim().slice(0, 140),
          freq: raw.freq,
          start: raw.start,
          end,
          updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || Date.now(),
          exceptions
        });
      });
    }

    return result;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        view: data.view,
        tasks: data.tasks,
        series: data.series,
        settings: data.settings
      }));
      syncNativeWidget();
      return true;
    } catch (error) {
      showToast("Не удалось сохранить изменения");
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
      holiday: holidayFor(iso) || "",
      phase: resolveDaytime(),
      sky: data.settings.sky || "auto",
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
        Promise.resolve(plugin.sync({ payload })).catch(() => {});
      } catch (error) {
        // The native widget is optional and must never break the web app.
      }
    }, 350);
  }

  function isSeriesActiveOn(series, iso) {
    if (!series || !isValidISO(iso)) return false;
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
    return false;
  }

  function getEntries(iso) {
    const tasks = (data.tasks[iso] || []).map((task) => ({
      key: task.id,
      taskId: task.id,
      seriesId: null,
      text: task.text,
      done: task.done,
      createdAt: task.createdAt || 0,
      isSeries: false
    }));
    const recurring = data.series
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
          isSeries: true
        };
      });
    return tasks.concat(recurring).sort((a, b) => a.createdAt - b.createdAt);
  }

  function getEntry(iso, key) {
    return getEntries(iso).find((entry) => entry.key === key) || null;
  }

  function holidayFor(iso) {
    if (!data.settings.showHolidays) return null;
    const date = fromISO(iso);
    return HOLIDAYS[`${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`] || null;
  }

  function seriesShort(series) {
    if (series.freq === "daily") return "каждый день";
    if (series.freq === "weekdays") return "по будням";
    if (series.freq === "weekly") return "каждую неделю";
    return "каждый месяц";
  }

  function formatLongDate(date) {
    return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
  }

  function renderDate() {
    const now = new Date();
    const iso = toISO(startOfDay(now));
    const date = fromISO(iso);
    const holiday = holidayFor(iso);
    knownToday = iso;

    els.weekday.textContent = WEEKDAYS_FULL[date.getDay()];
    els.day.textContent = String(date.getDate());
    els.month.textContent = MONTHS_GENITIVE[date.getMonth()];
    els.year.textContent = String(date.getFullYear());
    els.dateLabel.textContent = formatLongDate(date);
    els.clock.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    els.holiday.hidden = !holiday;
    els.holiday.textContent = holiday ? `★ ${holiday}` : "";
    document.title = `Сегодня, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} · Пиксельный календарь`;
  }

  function renderTasks() {
    const iso = toISO(startOfDay(new Date()));
    const entries = getEntries(iso);
    const done = entries.filter((entry) => entry.done).length;
    const percent = entries.length ? Math.round((done / entries.length) * 100) : 0;

    els.progress.textContent = `${done} / ${entries.length}`;
    els.bar.style.width = `${percent}%`;
    els.tasks.replaceChildren();

    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "widget-empty";
      const title = document.createElement("p");
      title.className = "widget-empty-title";
      title.textContent = "День свободен";
      const note = document.createElement("p");
      note.className = "widget-empty-note";
      note.textContent = "Добавь первое дело — и день сразу станет интереснее.";
      empty.append(title, note);
      els.tasks.appendChild(empty);
      return;
    }

    entries.slice(0, MAX_VISIBLE).forEach((entry) => {
      const item = document.createElement("li");
      item.className = `widget-task${entry.done ? " is-done" : ""}`;

      const label = document.createElement("label");
      label.className = "widget-check-wrap";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "widget-check";
      checkbox.checked = entry.done;
      checkbox.dataset.key = entry.key;
      checkbox.setAttribute("aria-label", `${entry.done ? "Снять отметку" : "Отметить выполненной"}: ${entry.text}`);
      const mark = document.createElement("span");
      mark.className = "widget-checkmark";
      mark.setAttribute("aria-hidden", "true");
      label.append(checkbox, mark);

      const body = document.createElement("span");
      body.className = "widget-task-body";
      const text = document.createElement("span");
      text.className = "widget-task-text";
      text.textContent = entry.text;
      body.appendChild(text);
      if (entry.isSeries) {
        const series = data.series.find((item) => item.id === entry.seriesId);
        const meta = document.createElement("span");
        meta.className = "widget-task-meta";
        const repeat = document.createElement("span");
        repeat.className = "widget-repeat";
        repeat.textContent = "↻";
        repeat.setAttribute("aria-hidden", "true");
        meta.append(repeat, document.createTextNode(series ? seriesShort(series) : "повторяется"));
        body.appendChild(meta);
      }

      item.append(label, body);
      els.tasks.appendChild(item);
    });

    if (entries.length > MAX_VISIBLE) {
      const more = document.createElement("li");
      more.className = "widget-more";
      more.textContent = `Ещё ${entries.length - MAX_VISIBLE} — открой календарь`;
      els.tasks.appendChild(more);
    }
  }

  function resolveDaytime() {
    const mode = data.settings.sky;
    if (mode && mode !== "auto") return mode;
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
    syncNativeWidget();
  }

  function renderAll() {
    applyDaytime();
    renderDate();
    renderTasks();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1900);
  }

  function toggleTask(key, checked) {
    const iso = toISO(startOfDay(new Date()));
    const entry = getEntry(iso, key);
    if (!entry) return;

    if (entry.isSeries) {
      const series = data.series.find((item) => item.id === entry.seriesId);
      if (!series) return;
      const exception = series.exceptions[iso] || {};
      if (checked) exception.done = true;
      else delete exception.done;
      if (exception.done || exception.deleted) series.exceptions[iso] = exception;
      else delete series.exceptions[iso];
    } else {
      const task = (data.tasks[iso] || []).find((item) => item.id === entry.taskId);
      if (!task) return;
      task.done = checked;
    }

    save();
    renderTasks();
    showToast(checked ? "Готово!" : "Снова в планах");
  }

  function addTask(text) {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) {
      showToast("Напиши, что нужно сделать");
      els.input.focus();
      return;
    }
    const iso = toISO(startOfDay(new Date()));
    if (!data.tasks[iso]) data.tasks[iso] = [];
    data.tasks[iso].push({
      id: makeId(),
      text: clean.slice(0, 140),
      done: false,
      createdAt: Date.now()
    });
    save();
    els.input.value = "";
    renderTasks();
    showToast("Добавлено на сегодня");
    els.input.focus();
  }

  function registerServiceWorker() {
    const capacitor = window.Capacitor;
    if (capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask(els.input.value);
  });

  els.tasks.addEventListener("change", (event) => {
    const checkbox = event.target.closest(".widget-check");
    if (!checkbox) return;
    toggleTask(checkbox.dataset.key, checkbox.checked);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    data = normalizeStore(loadRaw());
    renderAll();
  });

  window.setInterval(() => {
    applyDaytime();
    const current = toISO(startOfDay(new Date()));
    if (current !== knownToday) renderAll();
    else els.clock.textContent = `${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`;
  }, 15000);

  registerServiceWorker();
  renderAll();
  syncNativeWidget();
})();
