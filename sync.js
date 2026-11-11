// Схема данных v3 и слияние состояний для будущей синхронизации.
// Модуль не зависит от DOM: его же использует localStorage-клиент и тесты (node --test).
(function (root) {
  "use strict";

  const SCHEMA_VERSION = 3;
  const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  // Дублируем значения из app.js: sync.js должен работать без DOM.
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
    updatedAt: 0
  };

  // Настройки синхронизируются блоком: недостающие поля заполняем
  // значениями по умолчанию, иначе пустой сервер обнулит интерфейс.
  function normalizeSettings(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return {
      ...DEFAULT_SETTINGS,
      ...source,
      updatedAt: timeMs(source.updatedAt)
    };
  }

  function timeMs(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function normalizeTime(value) {
    return typeof value === "string" && TIME_PATTERN.test(value) ? value : null;
  }

  function normalizeRemindAt(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function makeId() {
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // Приводит задачу/серию к виду v3. Старые записи получают updatedAt = createdAt,
  // а deletedAt остаётся пустым: миграция ничего не удаляет.
  function normalizeTask(raw, fallbackNow) {
    const createdAt = timeMs(raw.createdAt) || fallbackNow;
    const updatedAt = Math.max(createdAt, timeMs(raw.updatedAt) || createdAt);
    const deletedAt = timeMs(raw.deletedAt) || null;
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
      text: typeof raw.text === "string" ? raw.text : "",
      done: Boolean(raw.done),
      createdAt,
      updatedAt,
      deletedAt,
      time: normalizeTime(raw.time),
      remindAt: normalizeRemindAt(raw.remindAt),
      snoozedUntil: normalizeRemindAt(raw.snoozedUntil)
    };
  }

  function normalizeException(raw, fallbackAt) {
    const exception = {};
    if (raw && raw.done) exception.done = true;
    if (raw && raw.deleted) exception.deleted = true;
    const snoozed = normalizeRemindAt(raw && raw.snoozedUntil);
    if (snoozed) exception.snoozedUntil = snoozed;
    exception.updatedAt = Math.max(timeMs(raw && raw.updatedAt), timeMs(fallbackAt));
    return exception;
  }

  function normalizeSeries(raw, fallbackNow) {
    const createdAt = timeMs(raw.createdAt) || fallbackNow;
    const updatedAt = Math.max(createdAt, timeMs(raw.updatedAt) || createdAt);
    const exceptions = {};
    const source = raw.exceptions && typeof raw.exceptions === "object" && !Array.isArray(raw.exceptions)
      ? raw.exceptions
      : {};
    Object.keys(source).sort().forEach((iso) => {
      if (!ISO_PATTERN.test(iso)) return;
      const exception = normalizeException(source[iso], updatedAt);
      // Пустые исключения с меткой времени нужны: иначе снятая галочка
      // «воскресает» с другого устройства, где она ещё отмечена.
      if (exception.done || exception.deleted || exception.updatedAt) exceptions[iso] = exception;
    });
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
      text: typeof raw.text === "string" ? raw.text : "",
      freq: typeof raw.freq === "string" ? raw.freq : "none",
      start: typeof raw.start === "string" ? raw.start : "",
      end: typeof raw.end === "string" ? raw.end : null,
      time: normalizeTime(raw.time),
      createdAt,
      updatedAt,
      deletedAt: timeMs(raw.deletedAt) || null,
      exceptions
    };
  }

  // Миграция v2→v3. Возвращает структурно корректное состояние; проверку
  // пользовательских значений (виды, настройки) по-прежнему делает app.js.
  function migrateState(parsed) {
    const now = Date.now();
    const source = parsed && typeof parsed === "object" ? parsed : {};
    const tasks = {};
    if (source.tasks && typeof source.tasks === "object" && !Array.isArray(source.tasks)) {
      Object.keys(source.tasks).forEach((iso) => {
        if (!ISO_PATTERN.test(iso)) return;
        const list = source.tasks[iso];
        if (!Array.isArray(list)) return;
        const clean = list
          .filter((task) => task && typeof task === "object")
          .map((task) => normalizeTask(task, now));
        if (clean.length) tasks[iso] = clean;
      });
    }

    const series = Array.isArray(source.series)
      ? source.series
        .filter((item) => item && typeof item === "object")
        .map((item) => normalizeSeries(item, now))
      : [];

    const settings = normalizeSettings(source.settings);

    return { version: SCHEMA_VERSION, view: source.view, tasks, series, settings };
  }

  // LWW по сущности: побеждает больший updatedAt, при равенстве — локальная запись.
  // Так повторное слияние тех же данных ничего не меняет (идемпотентность).
  function newer(local, remote) {
    if (!local) return remote;
    if (!remote) return local;
    return timeMs(remote.updatedAt) > timeMs(local.updatedAt) ? remote : local;
  }

  function indexTasks(state) {
    const map = new Map();
    Object.keys(state.tasks || {}).forEach((iso) => {
      (state.tasks[iso] || []).forEach((task) => {
        if (!task || !task.id) return;
        const current = map.get(task.id);
        if (!current || timeMs(task.updatedAt) > timeMs(current.task.updatedAt)) {
          map.set(task.id, { iso, task });
        }
      });
    });
    return map;
  }

  function mergeExceptions(local, remote) {
    const merged = {};
    const source = local && typeof local === "object" ? local : {};
    const incoming = remote && typeof remote === "object" ? remote : {};
    const keys = new Set([...Object.keys(source), ...Object.keys(incoming)]);
    [...keys].sort().forEach((iso) => {
      const picked = newer(source[iso], incoming[iso]);
      if (!picked) return;
      merged[iso] = {
        ...picked,
        updatedAt: timeMs(picked.updatedAt)
      };
    });
    return merged;
  }

  function mergeSeries(local, remote) {
    const merged = newer(local, remote);
    const alive = !merged.deletedAt || timeMs(merged.updatedAt) > timeMs(merged.deletedAt);
    return {
      ...merged,
      updatedAt: timeMs(merged.updatedAt),
      deletedAt: alive ? null : merged.deletedAt,
      exceptions: mergeExceptions(local && local.exceptions, remote && remote.exceptions)
    };
  }

  function sortTasks(tasks) {
    Object.keys(tasks).sort().forEach((iso) => {
      tasks[iso].sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
    });
    return tasks;
  }

  function mergeStates(localState, remoteState) {
    const local = localState || { tasks: {}, series: [], settings: {} };
    const remote = remoteState || { tasks: {}, series: [], settings: {} };

    const byId = indexTasks(local);
    indexTasks(remote).forEach((entry, id) => {
      const current = byId.get(id);
      if (!current || timeMs(entry.task.updatedAt) > timeMs(current.task.updatedAt)) {
        byId.set(id, entry);
      }
    });

    const tasks = {};
    [...byId.keys()].sort().forEach((id) => {
      const entry = byId.get(id);
      const { iso, task } = entry;
      // Если правка случилась позже удаления, запись считается живой:
      // могила не должна пережить более новое изменение.
      const alive = !task.deletedAt || timeMs(task.updatedAt) > timeMs(task.deletedAt);
      const clean = alive ? { ...task, deletedAt: null } : task;
      if (!tasks[iso]) tasks[iso] = [];
      tasks[iso].push(clean);
    });
    sortTasks(tasks);

    const seriesById = new Map();
    (local.series || []).forEach((series) => {
      if (series && series.id) seriesById.set(series.id, series);
    });
    (remote.series || []).forEach((series) => {
      if (!series || !series.id) return;
      seriesById.set(series.id, mergeSeries(seriesById.get(series.id), series));
    });
    const series = [...seriesById.values()].sort(
      (a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id))
    );

    const settings = normalizeSettings(
      timeMs(remote.settings && remote.settings.updatedAt) > timeMs(local.settings && local.settings.updatedAt)
        ? remote.settings
        : local.settings
    );

    return { version: SCHEMA_VERSION, view: local.view, tasks, series, settings };
  }

  // ── Синхронизация по локальной сети ─────────────────────────────────────
  const SYNC_KEY = "pixel-calendar-2027-sync";
  const SYNC_DEFAULTS = { url: "", token: "", lastSyncAt: 0, lastOkAt: 0, lastError: null };
  const SYNC_TIMEOUT = 8000;
  const SKEW_WARNING = 2 * 60 * 1000;

  let syncProvider = null;
  let syncPromise = null;
  let syncTimer = 0;
  let autoStarted = false;
  let statusListener = null;
  let lastStatus = { state: "idle" };

  function readSyncConfig() {
    if (typeof localStorage === "undefined") return { ...SYNC_DEFAULTS };
    try {
      const saved = JSON.parse(localStorage.getItem(SYNC_KEY) || "{}");
      return { ...SYNC_DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
    } catch (error) {
      return { ...SYNC_DEFAULTS };
    }
  }

  function writeSyncConfig(config) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify({ ...SYNC_DEFAULTS, ...config }));
    } catch (error) {
      // Переполнение хранилища не должно ломать календарь.
    }
  }

  function normalizeServerUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`;
    try {
      const parsed = new URL(withScheme);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    } catch (error) {
      return "";
    }
  }

  function emitStatus(status) {
    lastStatus = status;
    if (typeof statusListener === "function") {
      try {
        statusListener(status);
      } catch (error) {
        // Слушатель интерфейса не должен ломать синхронизацию.
      }
    }
  }

  function getSyncStatus() {
    return { ...lastStatus, config: readSyncConfig() };
  }

  function configure(provider) {
    syncProvider = provider || null;
    startAutoSync();
  }

  function setStatusListener(listener) {
    statusListener = typeof listener === "function" ? listener : null;
  }

  function scheduleSync(delay) {
    if (!readSyncConfig().url) return;
    if (typeof setTimeout === "undefined") return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncNow();
    }, typeof delay === "number" ? delay : 2000);
  }

  // Один цикл: отправляем своё состояние, получаем слитое сервером.
  // Полный обмен вместо инкрементов: для личного объёма это дешевле и надёжнее.
  function syncNow() {
    if (syncPromise) return syncPromise;
    const config = readSyncConfig();
    if (!config.url || !config.token) {
      emitStatus({ state: "off" });
      return Promise.resolve({ ok: false, reason: "Не указан адрес или код подключения" });
    }
    if (!syncProvider || typeof fetch === "undefined") {
      emitStatus({ state: "error", message: "Синхронизация недоступна" });
      return Promise.resolve({ ok: false, reason: "Синхронизация недоступна" });
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), SYNC_TIMEOUT) : 0;
    emitStatus({ state: "syncing" });

    syncPromise = Promise.resolve()
      .then(() => fetch(`${config.url}/api/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sync-Token": config.token },
        body: JSON.stringify(syncProvider.getState()),
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      }))
      .then((response) => {
        if (response.status === 401) throw new Error("Неверный код подключения");
        if (!response.ok) throw new Error(`Сервер ответил ${response.status}`);
        return response.json();
      })
      .then((remote) => {
        if (!remote || typeof remote.serverTime !== "number") {
          throw new Error("Сервер вернул неожиданный ответ");
        }
        const merged = mergeStates(syncProvider.getState(), remote);
        syncProvider.applyState(merged);
        const skew = Math.abs(remote.serverTime - Date.now());
        const next = {
          ...readSyncConfig(),
          lastSyncAt: remote.serverTime,
          lastOkAt: Date.now(),
          lastError: null
        };
        writeSyncConfig(next);
        emitStatus({ state: "ok", at: next.lastOkAt, skew });
        return { ok: true };
      })
      .catch((error) => {
        const message = error && error.name === "AbortError"
          ? "Сервер не ответил за 8 секунд"
          : (error && error.message) || "Ошибка сети";
        writeSyncConfig({ ...readSyncConfig(), lastError: message });
        emitStatus({ state: "error", message });
        return { ok: false, reason: message };
      })
      .finally(() => {
        if (timeout) clearTimeout(timeout);
        syncPromise = null;
      });

    return syncPromise;
  }

  function startAutoSync() {
    if (autoStarted || typeof document === "undefined") return;
    autoStarted = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scheduleSync(800);
    });
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => scheduleSync(1200));
    }
  }

  const api = {
    SCHEMA_VERSION,
    migrateState,
    mergeStates,
    normalizeTime,
    configure,
    syncNow,
    scheduleSync,
    getSyncStatus,
    setStatusListener,
    getSyncConfig: readSyncConfig,
    saveSyncConfig: writeSyncConfig,
    normalizeServerUrl,
    SKEW_WARNING
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PixelSync = api;
})(typeof window !== "undefined" ? window : globalThis);
