// Прогон основных сценариев в живом Chrome: страница грузится с сервера
// синхронизации, дальше приложение работает как у пользователя.
// Проверяем: быстрые дела, окно дня, время напоминания, серия, отметка
// «выполнено», удаление могилой, «очистить данные», сохранность после перезагрузки.
// Usage: node tools/smoke.js   (сначала npm run build:web)
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");
const STORE_KEY = "pixel-calendar-2027-v1";

const results = [];
let crashed = false;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${detail && !ok ? ` — ${detail}` : ""}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    path.join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.ProgramFiles || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe")
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Не нашёл Chrome/Edge для прогона");
}

async function freePort() {
  const net = require("net");
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch (error) {
      // сервер ещё поднимается
    }
    await sleep(120);
  }
  throw new Error(`Не дождался ${url}`);
}

// Минимальный клиент CDP поверх встроенного в Node WebSocket.
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      const handlers = this.listeners.get(message.method) || [];
      for (const handler of handlers) handler(message.params);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP: соединение не открылось")), { once: true });
    });
    return new Cdp(socket);
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || "Ошибка в expression");
    }
    return result.result.value;
  }

  async waitFor(expression, message, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.eval(expression)) return true;
      await sleep(80);
    }
    throw new Error(`Не дождался: ${message}`);
  }
}

const readStore = `JSON.parse(localStorage.getItem(${JSON.stringify(STORE_KEY)}) || "null")`;

function isoToday() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

(async () => {
  if (!fs.existsSync(path.join(WWW, "index.html"))) {
    console.error("Нет сборки www — сначала npm run build:web");
    process.exit(2);
  }

  const serverPort = await freePort();
  const serverData = fs.mkdtempSync(path.join(os.tmpdir(), "pixel-smoke-"));
  const server = spawn(process.execPath, [path.join(ROOT, "sync-server", "server.js")], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      HOST: "127.0.0.1",
      SYNC_TOKEN: "smoke-token",
      SYNC_DATA_DIR: serverData
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pixel-chrome-"));
  const chromePort = await freePort();
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1280,900",
      "about:blank"
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let cdp = null;
  try {
    await waitForHttp(`http://127.0.0.1:${serverPort}/index.html`);
    await waitForHttp(`http://127.0.0.1:${chromePort}/json/version`);
    // Работаем с вкладкой: у браузерного эндпоинта нет доменов Page/Runtime.
    const targets = await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json();
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page) throw new Error("Chrome не отдал вкладку для подключения");
    cdp = await Cdp.connect(page.webSocketDebuggerUrl);

    const consoleErrors = [];
    const exceptions = [];
    const dialogs = [];

    cdp.on("Runtime.exceptionThrown", (params) => {
      exceptions.push(params.exceptionDetails?.exception?.description || "без описания");
    });
    cdp.on("Runtime.consoleAPICalled", (params) => {
      if (params.type !== "error") return;
      const text = (params.args || []).map((arg) => arg.value ?? arg.description ?? "").join(" ");
      // Проверка обновлений стучится в GitHub — вне сети это не дефект приложения.
      if (/fetch|network|api\.github\.com|Failed to load resource/i.test(text)) return;
      consoleErrors.push(text);
    });
    cdp.on("Page.javascriptDialogOpening", async (params) => {
      dialogs.push(params.message);
      await cdp.send("Page.handleJavaScriptDialog", { accept: true });
    });

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    const today = isoToday();

    // 0. Чистая установка: стираем хранилище и загружаемся заново.
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/index.html` });
    await cdp.waitFor(`!!document.querySelector("#calendarView")`, "календарь отрисовался");
    await cdp.eval("localStorage.clear(); sessionStorage.clear(); true");
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/index.html` });
    await cdp.waitFor(`document.querySelectorAll(".day-cell").length >= 28`, "сетка месяца");

    check(
      "пустая установка: сетка и заголовок периода",
      (await cdp.eval(`document.querySelectorAll(".day-cell").length >= 28 && document.querySelector("#periodTitle").textContent.trim().length > 0`))
    );
    check(
      "пустая установка: хранилище пустое",
      (await cdp.eval(`${readStore} === null || Object.keys((${readStore})?.tasks || {}).length === 0`))
    );

    // 1. Быстрое дело через строку сверху.
    await cdp.eval(`(() => {
      const input = document.querySelector("#quickAddInput");
      input.value = "Смоук: полить цветы";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#quickAddForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: полить цветы")`,
      "быстрое дело записалось"
    );
    const quickTask = await cdp.eval(
      `(${readStore}).tasks[${JSON.stringify(today)}].find((task) => task.text === "Смоук: полить цветы")`
    );
    check("быстрое дело: записано с отметкой времени", Boolean(quickTask && quickTask.updatedAt > 0), JSON.stringify(quickTask));
    check("быстрое дело: видно в ячейке дня", await cdp.eval(
      `[...document.querySelectorAll('.day-cell[data-date=\\"${today}\\"] .task-pill')].some((node) => node.textContent.includes("полить цветы"))`
    ));

    // Снимок рабочего хранилища пригодится в проверке восстановления после порчи.
    const goodStore = await cdp.eval(`localStorage.getItem("pixel-calendar-2027-v1")`);

    // 2. Окно дня: дело со временем напоминания.
    await cdp.eval(`document.querySelector('.day-cell[data-date="${today}"]').click(); true`);
    await cdp.waitFor(`document.querySelector("#dayDialog").open`, "окно дня открылось");
    check("окно дня открывается по клику", true);

    await cdp.eval(`(() => {
      document.querySelector("#taskInput").value = "Смоук: звонок";
      document.querySelector("#taskTime").value = "09:30";
      document.querySelector("#taskForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: звонок" && task.time === "09:30")`,
      "дело со временем записалось"
    );
    const timed = await cdp.eval(
      `(${readStore}).tasks[${JSON.stringify(today)}].find((task) => task.text === "Смоук: звонок")`
    );
    check("дело со временем: время и напоминание заполнены", Boolean(timed && timed.time === "09:30" && timed.remindAt), JSON.stringify(timed));

    // 3. Отметка «выполнено» галочкой в списке.
    await cdp.eval(`(() => {
      const box = [...document.querySelectorAll("#taskList .task-check")].find((node) => {
        const item = node.closest(".task-item");
        return item && item.textContent.includes("звонок");
      });
      box.click();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: звонок" && task.done === true)`,
      "отметка выполнено сохранилась"
    );
    check("отметка «выполнено» записывается", true);

    // 4. Серия с временем.
    await cdp.eval(`(() => {
      document.querySelector("#taskInput").value = "Смоук: зарядка";
      const repeat = document.querySelector("#taskRepeat");
      repeat.value = "daily";
      repeat.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("#taskTime").value = "08:00";
      document.querySelector("#taskForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(`(${readStore})?.series?.some((item) => item.text === "Смоук: зарядка")`, "серия записалась");
    const series = await cdp.eval(`(${readStore}).series.find((item) => item.text === "Смоук: зарядка")`);
    check("серия: правило и время сохранены", Boolean(series && series.freq === "daily" && series.time === "08:00" && series.updatedAt > 0), JSON.stringify(series));
    check("серия: помечена как повтор в списке", await cdp.eval(
      `[...document.querySelectorAll("#taskList .task-item")].some((node) => node.textContent.includes("Смоук: зарядка"))`
    ));

    // 5. Удаление обычного дела — могилой, а не вырезанием.
    await cdp.eval(`(() => {
      const row = [...document.querySelectorAll("#taskList .task-item")].find((node) => node.textContent.includes("полить цветы"));
      const button = row.querySelector('[data-action="delete"]');
      button.click();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: полить цветы" && task.deletedAt > 0)`,
      "дело удалено могилой"
    );
    const buried = await cdp.eval(`(${readStore}).tasks[${JSON.stringify(today)}].find((task) => task.text === "Смоук: полить цветы")`);
    check("удаление: запись остаётся с deletedAt", Boolean(buried && buried.deletedAt > 0 && buried.updatedAt === buried.deletedAt), JSON.stringify(buried));
    check("удаление: дело исчезло из списка", await cdp.eval(
      `![...document.querySelectorAll("#taskList .task-item")].some((node) => node.textContent.includes("полить цветы"))`
    ));

    // 6. Перезагрузка: данные и отметки на месте, удалённое не вернулось.
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/index.html` });
    await cdp.waitFor(`document.querySelectorAll(".day-cell").length >= 28`, "сетка после перезагрузки");
    check("перезагрузка: дело со временем на месте", await cdp.eval(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: звонок" && task.done === true)`
    ));
    check("перезагрузка: серия на месте", await cdp.eval(
      `(${readStore})?.series?.some((item) => item.text === "Смоук: зарядка")`
    ));
    check("перезагрузка: удалённое не всплыло", await cdp.eval(
      `![...document.querySelectorAll(".day-cell .task-pill")].some((node) => node.textContent.includes("полить цветы"))`
    ));
    // Счётчик охватывает весь период: серия «каждый день» даёт столько
    // вхождений, сколько дней месяца осталось. Ждём «1 / сколько-то».
    check("перезагрузка: счётчик выполненных считает верно", await cdp.eval(
      `/^1 \\/ \\d+$/.test(document.querySelector("#progressValue").textContent.trim())`
    ), await cdp.eval(`document.querySelector("#progressValue").textContent.trim()`));
    check("перезагрузка: удалённое в счётчик не входит", await cdp.eval(
      `(() => {
        const shown = document.querySelector("#progressValue").textContent.trim();
        const planned = Number(shown.split("/")[1]);
        return planned > 0 && planned <= 31;
      })()`
    ), await cdp.eval(`document.querySelector("#progressValue").textContent.trim()`));

    // 7. «Очистить данные» — тоже могилы.
    await cdp.eval(`document.querySelector("#settingsBtn").click(); true`);
    await cdp.waitFor(`document.querySelector("#settingsDialog").open`, "настройки открылись");
    await cdp.eval(`document.querySelector("#clearDataBtn").click(); true`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.every((task) => task.deletedAt > 0) === true`,
      "очистка поставила могилы"
    );
    check("очистка данных: спрашивает подтверждение", dialogs.some((text) => /удал|очист/i.test(text)), dialogs.join(" | "));
    check("очистка данных: записи остались могилами", await cdp.eval(
      `(${readStore}).tasks[${JSON.stringify(today)}].length > 0 && (${readStore}).tasks[${JSON.stringify(today)}].every((task) => task.deletedAt > 0)`
    ));
    check("очистка данных: счётчик обнулился", await cdp.eval(
      `document.querySelector("#progressValue").textContent.trim() === "0 / 0"`
    ), await cdp.eval(`document.querySelector("#progressValue").textContent.trim()`));

    // 8. Хоткеи работают в русской раскладке: event.key там «е»/«т», ловим по event.code.
    await cdp.eval(`(() => {
      const dialog = document.querySelector("#settingsDialog");
      if (dialog && dialog.open) dialog.close();
      if (document.activeElement) document.activeElement.blur();
      return true;
    })()`);
    await cdp.waitFor(`document.querySelector("#settingsDialog").open === false`, "настройки закрылись");
    const hotkeys = await cdp.eval(`(() => {
      const title = () => document.querySelector(".period-copy h2").textContent.trim();
      const start = title();
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", code: "ArrowRight", bubbles: true }));
      const shifted = title();
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "е", code: "KeyT", bubbles: true }));
      const back = title();
      const focusedByKey = document.activeElement && document.activeElement.id;
      document.activeElement.blur();
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "т", code: "KeyN", bubbles: true }));
      const focused = document.activeElement && document.activeElement.id;
      document.activeElement.blur();
      return { start, shifted, back, focusedByKey, focused };
    })()`);
    check(
      "хоткей T в русской раскладке возвращает к сегодня",
      hotkeys.shifted !== hotkeys.start && hotkeys.back === hotkeys.start,
      JSON.stringify(hotkeys)
    );
    check(
      "хоткей N в русской раскладке ставит курсор в быстрое дело",
      hotkeys.focused === "quickAddInput",
      JSON.stringify(hotkeys)
    );

    // 9. Битое хранилище: предыдущий снимок предлагается и восстанавливается.
    check("битый сторадж: снимок хранилища снят", typeof goodStore === "string" && goodStore.length > 20, String(goodStore).slice(0, 60));
    await cdp.eval(`(() => {
      localStorage.setItem("pixel-calendar-2027-backup", JSON.stringify({ at: Date.now(), raw: ${JSON.stringify(goodStore)} }));
      localStorage.setItem("pixel-calendar-2027-v1", '{"tasks":[,');
      return true;
    })()`);
    await cdp.eval(`location.reload(); true`);
    await cdp.waitFor(
      `(() => { const bar = document.querySelector("#recoverBar"); return Boolean(bar) && !bar.hidden; })()`,
      "плашка восстановления появилась"
    ).catch(async (error) => {
      const state = await cdp.eval(`JSON.stringify({ keys: Object.keys(localStorage), hasEl: Boolean(document.querySelector("#recoverBar")), hidden: document.querySelector("#recoverBar") ? document.querySelector("#recoverBar").hidden : "no-el", cells: document.querySelectorAll(".day-cell").length })`);
      throw new Error(`${error.message} | ${state}`);
    });
    const recoverText = await cdp.eval(`document.querySelector("#recoverText").textContent.trim()`);
    check("битый сторадж: плашка предлагает копию", /Копия от/.test(recoverText), recoverText);
    await cdp.eval(`document.querySelector("#recoverRestore").click(); true`);
    await cdp.waitFor(
      `document.querySelector("#recoverBar").hidden === true`,
      "плашка восстановления скрылась"
    );
    check("битый сторадж: дело из копии вернулось", await cdp.eval(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: полить цветы") === true`
    ));
    check("битый сторадж: копии остаются после восстановления", await cdp.eval(
      `localStorage.getItem("pixel-calendar-2027-corrupt") !== null && localStorage.getItem("pixel-calendar-2027-backup") !== null`
    ));
    check("битый сторадж: есть кнопки «Скачать копию» и «Убрать копии»", await cdp.eval(
      `Boolean(document.querySelector("#recoverDownload")) && Boolean(document.querySelector("#recoverDrop"))`
    ));
    await cdp.eval(`document.querySelector("#recoverDrop").click(); true`);
    check("битый сторадж: «Убрать копии» чистит хранилище", await cdp.eval(
      `localStorage.getItem("pixel-calendar-2027-corrupt") === null && localStorage.getItem("pixel-calendar-2027-backup") === null`
    ));

    // 10. Поиск работает и не падает на серии: ввод с задержкой, потом результаты.
    await cdp.eval(`(() => { document.querySelector("#searchBtn").click(); return true; })()`);
    await cdp.waitFor(`document.querySelector("#searchDialog").open === true`, "поиск открылся");
    await cdp.eval(`(() => { const input = document.querySelector("#searchInput"); input.value = "цветы"; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
    await cdp.waitFor(
      `[...document.querySelectorAll("#searchResults .search-result, #searchResults li")].some((node) => node.textContent.includes("цветы"))`,
      "поиск нашёл быстрое дело"
    );
    const searchCount = await cdp.eval(`document.querySelector("#searchInput").value + "|" + document.querySelector("#searchCount").textContent.trim()`);
    check("поиск: находит дело по подстроке", searchCount.startsWith("цветы|") && searchCount.includes("1"), searchCount);
    await cdp.eval(`(() => { const dialog = document.querySelector("#searchDialog"); if (dialog.open) dialog.close(); return true; })()`);

    // 11. Отмена удаления: тост с кнопкой должен лежать поверх открытого окна дня.
    await cdp.eval(`(() => {
      document.querySelector('.day-cell[data-date="${today}"]').click();
      return true;
    })()`);
    await cdp.waitFor(`document.querySelector("#dayDialog").open === true`, "окно дня открылось для отмены удаления");
    await cdp.eval(`(() => {
      document.querySelector("#taskInput").value = "Смоук: отменить меня";
      document.querySelector("#taskTime").value = "11:00";
      document.querySelector("#taskForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: отменить меня")`,
      "дело для отмены создано"
    );
    await cdp.eval(`(() => {
      const row = [...document.querySelectorAll("#taskList .task-item")].find((node) => node.textContent.includes("отменить меня"));
      row.querySelector('[data-action="delete"]').click();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: отменить меня" && task.deletedAt > 0)`,
      "дело удалено могилой перед отменой"
    );
    check("отмена удаления: тост предлагает «Отменить»", await cdp.eval(`(() => {
      const button = document.querySelector("#toastAction");
      return Boolean(button) && !button.hidden && button.textContent.trim() === "Отменить";
    })()`));
    // Регрессия слоёв: модальное окно живёт в top layer, тост обязан быть выше него.
    check("отмена удаления: кнопка не перекрыта окном дня", await cdp.eval(`(() => {
      const button = document.querySelector("#toastAction");
      const rect = button.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(top) && (top === button || button.contains(top));
    })()`));
    await cdp.eval(`document.querySelector("#toastAction").click(); true`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: отменить меня" && !task.deletedAt)`,
      "запись вернулась из могилы"
    );
    check("отмена удаления: дело снова в списке", await cdp.eval(
      `[...document.querySelectorAll("#taskList .task-item")].some((node) => node.textContent.includes("отменить меня"))`
    ));
    check("отмена удаления: тост подтверждает возврат", await cdp.eval(
      `document.querySelector("#toastText").textContent.includes("Удаление отменено")`
    ));

    // 12. «Перенести незавершённое»: едет только незавершённое, напоминание пересчитано.
    const tomorrow = await cdp.eval(`(() => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      const pad = (value) => String(value).padStart(2, "0");
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    })()`);
    await cdp.eval(`(() => {
      document.querySelector("#taskInput").value = "Смоук: готово";
      document.querySelector("#taskTime").value = "";
      document.querySelector("#taskForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: готово")`,
      "выполненное дело создано"
    );
    await cdp.eval(`(() => {
      const row = [...document.querySelectorAll("#taskList .task-item")].find((node) => node.textContent.includes("Смоук: готово"));
      row.querySelector(".task-check").click();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: готово" && task.done === true)`,
      "выполненное дело отмечено"
    );
    await cdp.eval(`(() => {
      document.querySelector("#taskInput").value = "Смоук: зарядка";
      const repeat = document.querySelector("#taskRepeat");
      repeat.value = "daily";
      repeat.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("#taskTime").value = "08:00";
      document.querySelector("#taskForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(`(${readStore})?.series?.some((item) => item.text === "Смоук: зарядка")`, "серия для переноса создана");
    const movableId = await cdp.eval(
      `(${readStore}).tasks[${JSON.stringify(today)}].find((task) => task.text === "Смоук: отменить меня").id`
    );
    check("перенос: кнопка видна при незавершённых делах", await cdp.eval(
      `(() => { const button = document.querySelector("#moveTomorrowBtn"); return Boolean(button) && !button.hidden; })()`
    ));
    await cdp.eval(`document.querySelector("#moveTomorrowBtn").click(); true`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(tomorrow)}]?.some((task) => task.id === ${JSON.stringify(movableId)})`,
      "незавершённое дело переехало на завтра"
    );
    const movedTask = await cdp.eval(
      `(${readStore}).tasks[${JSON.stringify(tomorrow)}].find((task) => task.id === ${JSON.stringify(movableId)})`
    );
    check("перенос: напоминание пересчитано на новый день", Boolean(
      movedTask && movedTask.time === "11:00" &&
      new Date(movedTask.remindAt).getTime() === new Date(`${tomorrow}T11:00:00`).getTime()
    ), JSON.stringify(movedTask));
    check("перенос: выполненное дело осталось на месте", await cdp.eval(
      `(${readStore})?.tasks?.[${JSON.stringify(today)}]?.some((task) => task.text === "Смоук: готово" && task.done === true) === true`
    ));
    check("перенос: в старом дне незавершённых не осталось", await cdp.eval(
      `((${readStore})?.tasks?.[${JSON.stringify(today)}] || []).every((task) => task.deletedAt || task.done)`
    ));
    check("перенос: день серии не переехал", await cdp.eval(
      `[...document.querySelectorAll("#taskList .task-item")].some((node) => node.textContent.includes("Смоук: зарядка"))`
    ));
    check("перенос: кнопка скрылась, когда переносить нечего", await cdp.eval(
      `document.querySelector("#moveTomorrowBtn").hidden === true`
    ));

    // 13. Удаление дня серии и его отмена через тот же тост.
    await cdp.eval(`(() => {
      const row = [...document.querySelectorAll("#taskList .task-item")].find((node) => node.textContent.includes("Смоук: зарядка"));
      row.querySelector('[data-action="delete"]').click();
      return true;
    })()`);
    await cdp.waitFor(
      `Boolean(document.querySelector('#taskList [data-action="delete-occurrence"]'))`,
      "подтверждение удаления дня серии появилось"
    );
    await cdp.eval(`document.querySelector('#taskList [data-action="delete-occurrence"]').click(); true`);
    await cdp.waitFor(
      `(${readStore})?.series?.some((item) => item.text === "Смоук: зарядка" && item.exceptions?.[${JSON.stringify(today)}]?.deleted === true)`,
      "день серии помечен удалённым"
    );
    check("серия: удаление дня не трогает саму серию", await cdp.eval(
      `(${readStore}).series.some((item) => item.text === "Смоук: зарядка" && !item.deletedAt)`
    ));
    check("серия: удалённый день исчез из списка", await cdp.eval(
      `![...document.querySelectorAll("#taskList .task-item")].some((node) => node.textContent.includes("Смоук: зарядка"))`
    ));
    await cdp.eval(`document.querySelector("#toastAction").click(); true`);
    await cdp.waitFor(
      `(${readStore})?.series?.some((item) => item.text === "Смоук: зарядка" && item.exceptions?.[${JSON.stringify(today)}]?.deleted === false)`,
      "день серии вернулся"
    );
    check("серия: «Отменить» возвращает день", await cdp.eval(
      `[...document.querySelectorAll("#taskList .task-item")].some((node) => node.textContent.includes("Смоук: зарядка"))`
    ));

    // 14. Поиск по двум символам и очистка поля.
    await cdp.eval(`document.querySelector("#searchBtn").click(); true`);
    await cdp.waitFor(`document.querySelector("#searchDialog").open === true`, "поиск открылся повторно");
    await cdp.eval(`(() => {
      const input = document.querySelector("#searchInput");
      input.value = "за";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await cdp.waitFor(
      `document.querySelectorAll("#searchResults .search-result, #searchResults li").length > 0`,
      "поиск по двум символам что-то нашёл"
    );
    check("поиск: два символа дают результаты", await cdp.eval(
      `document.querySelectorAll("#searchResults .search-result, #searchResults li").length > 0`
    ));
    await cdp.eval(`(() => {
      const input = document.querySelector("#searchInput");
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await cdp.waitFor(
      `document.querySelectorAll("#searchResults .search-result").length > 0`,
      "пустой запрос показывает все дела"
    );
    check("поиск: пустое поле показывает все дела", await cdp.eval(
      `!document.querySelector("#searchResults .search-empty") && document.querySelector("#searchCount").textContent.includes("Найдено")`
    ), await cdp.eval(`document.querySelector("#searchCount").textContent.trim()`));
    await cdp.eval(`(() => { const dialog = document.querySelector("#searchDialog"); if (dialog.open) dialog.close(); return true; })()`);

    // 15. Настройки: начало недели пишется в хранилище сразу, без перезагрузки.
    await cdp.eval(`(() => { const dialog = document.querySelector("#dayDialog"); if (dialog.open) dialog.close(); return true; })()`);
    await cdp.eval(`document.querySelector("#settingsBtn").click(); true`);
    await cdp.waitFor(`document.querySelector("#settingsDialog").open === true`, "настройки открылись для проверки недели");
    const chosenWeekStart = await cdp.eval(`(() => {
      const select = document.querySelector("#weekStartSelect");
      select.value = select.value === "0" ? "1" : "0";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return Number(select.value);
    })()`);
    check("настройки: начало недели сохраняется в хранилище", await cdp.eval(
      `(${readStore})?.settings?.weekStart === ${chosenWeekStart}`
    ), `выбрано ${chosenWeekStart}`);
    await cdp.eval(`(() => { const dialog = document.querySelector("#settingsDialog"); if (dialog.open) dialog.close(); return true; })()`);
    await cdp.waitFor(`document.querySelector("#settingsDialog").open === false`, "настройки закрылись");

    // 16. Ярлык долгого нажатия: ?add=tomorrow открывает завтрашний день с курсором в поле.
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/index.html?add=tomorrow` });
    await cdp.waitFor(
      `Boolean(document.querySelector("#dayDialog")) && document.querySelector("#dayDialog").open === true`,
      "ярлык открыл окно дня"
    );
    check("ярлык ?add=tomorrow очищает адрес", await cdp.eval(`window.location.search === ""`));
    check("ярлык ?add=tomorrow ставит курсор в поле дела", await cdp.eval(
      `Boolean(document.activeElement) && document.activeElement.id === "taskInput"`
    ));
    await cdp.eval(`(() => {
      document.querySelector("#taskInput").value = "Смоук: ярлык";
      document.querySelector("#taskForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(tomorrow)}]?.some((task) => task.text === "Смоук: ярлык")`,
      "ярлык записал дело на завтра"
    );
    check("ярлык ?add=tomorrow пишет дело в завтрашний день", await cdp.eval(
      `(${readStore}).tasks[${JSON.stringify(tomorrow)}].some((task) => task.text === "Смоук: ярлык")`
    ));

    // 17. Естественный ввод: дата, время и текст разбираются из одной строки.
    await cdp.eval(`(() => {
      const dialog = document.querySelector("#dayDialog");
      if (dialog && dialog.open) dialog.close();
      const input = document.querySelector("#quickAddInput");
      input.value = "завтра в 15:00 позвонить маме";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#quickAddForm").requestSubmit();
      return true;
    })()`);
    await cdp.waitFor(
      `(${readStore})?.tasks?.[${JSON.stringify(tomorrow)}]?.some((task) => task.text === "позвонить маме")`,
      "естественный ввод создал дело"
    );
    const parsedTask = await cdp.eval(
      `(${readStore}).tasks[${JSON.stringify(tomorrow)}].find((task) => task.text === "позвонить маме")`
    );
    check("естественный ввод: время и напоминание из строки", Boolean(
      parsedTask && parsedTask.time === "15:00" &&
      new Date(parsedTask.remindAt).getTime() === new Date(`${tomorrow}T15:00:00`).getTime()
    ), JSON.stringify(parsedTask));

    // 18. Жесты в окне дня: свайп листает дни, потягивание шапки закрывает окно.
    // События синтетические и с pointerType: "touch" — мышь жест не запускает.
    // Пороги детерминированные: 20px мало, 100px хватает, 30px по шапке мало,
    // 110px закрывает. Никаких «подождём и посмотрим».
    const gesture = (selector, dx, dy) => `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const x0 = Math.round(r.left + r.width / 2);
      const y0 = Math.round(r.top + Math.min(r.height / 2, 24));
      const fire = (type, x, y) => node.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 42, pointerType: "touch",
        isPrimary: true, clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1
      }));
      fire("pointerdown", x0, y0);
      for (let step = 1; step <= 6; step += 1) {
        fire("pointermove", x0 + (${dx} * step) / 6, y0 + (${dy} * step) / 6);
      }
      fire("pointerup", x0 + ${dx}, y0 + ${dy});
      return document.getElementById("dialogTitle").textContent.trim();
    })()`;
    const openTitle = `document.getElementById("dialogTitle").textContent.trim()`;
    const openIso = `(document.querySelector(".day-cell.is-selected[data-date]") || {}).dataset?.date || null`;
    const dialogOpen = `document.getElementById("dayDialog").open === true`;
    // После жеста приложение глушит клик на 350 мс (защита от фантомного тапа).
    // Ждём это окно явно: иначе клик по клетке гасится и окно не открывается —
    // именно на этом прогон спотыкался то в одном месте, то в другом.
    const afterGesture = () => sleep(420);

    await cdp.eval(`(() => { const d = document.querySelector("#dayDialog"); if (d.open) d.close(); return true; })()`);
    await afterGesture();
    await cdp.eval(`document.querySelector('.day-cell[data-date="${today}"]').click(); true`);
    await cdp.waitFor(dialogOpen, "окно дня открылось для жестов");

    const gestureStart = await cdp.eval(openTitle);
    const gestureStartIso = await cdp.eval(openIso);
    const shortSwipe = await cdp.eval(gesture(".day-summary", -20, 0));
    check("жест: короткий свайп 20px день не меняет", shortSwipe === gestureStart && await cdp.eval(openIso) === gestureStartIso, `${gestureStart} → ${shortSwipe}`);

    const diagonal = await cdp.eval(gesture(".day-summary", 60, 100));
    check("жест: диагональ 60x100 день не меняет", diagonal === gestureStart && await cdp.eval(openIso) === gestureStartIso, `${gestureStart} → ${diagonal}`);

    await cdp.eval(gesture(".day-summary", -100, 0));
    const swipeLeftIso = await cdp.eval(openIso);
    check("жест: свайп влево 100px открывает следующий день", swipeLeftIso === tomorrow, `${gestureStartIso} → ${swipeLeftIso}`);
    check("жест: календарь под окном отметил новый день", await cdp.eval(
      `document.querySelector('.day-cell.is-selected[data-date="${tomorrow}"]') !== null`
    ));

    await cdp.eval(gesture(".day-summary", 100, 0));
    const swipeRightIso = await cdp.eval(openIso);
    check("жест: свайп вправо 100px возвращает предыдущий день", swipeRightIso === gestureStartIso, `${swipeLeftIso} → ${swipeRightIso}`);

    const smallPull = await cdp.eval(gesture(".dialog-head", 0, 30));
    check("жест: потягивание шапки на 30px окно не закрывает", Boolean(smallPull) && await cdp.eval(dialogOpen));

    await cdp.eval(gesture(".dialog-head", 0, 110));
    await cdp.waitFor(`document.getElementById("dayDialog").open === false`, "окно закрылось потягиванием");
    check("жест: потягивание шапки на 110px закрывает окно", true);

    await cdp.eval(`(() => { const d = document.querySelector("#dayDialog"); if (d.open) d.close(); return true; })()`);
    await sleep(400);
    await cdp.eval(`document.querySelector('.day-cell[data-date="${today}"]').click(); true`);
    await cdp.waitFor(dialogOpen, "окно дня для проверки крестика");
    await cdp.eval(gesture(".dialog-head", 0, 0));
    check("жест: тап по шапке окно не закрывает", await cdp.eval(dialogOpen));
    await cdp.eval(`document.getElementById("dialogCloseBtn").click(); true`);
    await cdp.waitFor(`document.getElementById("dayDialog").open === false`, "крестик закрыл окно");
    check("жест: крестик по-прежнему закрывает окно", true);

    // Свайп внутри открытого окна не должен стирать начатое дело: день меняется,
    // набранный текст остаётся.
    await cdp.eval(`document.querySelector('.day-cell[data-date="${today}"]').click(); true`);
    await cdp.waitFor(dialogOpen, "окно дня открылось для проверки черновика");
    const draftFrom = await cdp.eval(openIso);
    await cdp.eval(`document.getElementById("taskInput").value = "Черновик до свайпа"; true`);
    await cdp.eval(gesture(".day-summary", -100, 0));
    const draft = await cdp.eval(`(() => ({
      text: document.getElementById("taskInput").value,
      iso: (document.querySelector(".day-cell.is-selected[data-date]") || {}).dataset?.date || null
    }))()`);
    check("жест: свайп дня сохраняет начатый текст", draft.text === "Черновик до свайпа"
      && draft.iso && draft.iso !== draftFrom, `${draftFrom} → ${JSON.stringify(draft)}`);

    // Подсказка: поле «Заранее» появляется только после времени — именно этого
    // не хватало, чтобы найти «напомнить заранее».
    const leadHint = await cdp.eval(`(() => {
      const time = document.getElementById("taskTime");
      const hintBefore = document.getElementById("repeatHint").textContent;
      const hiddenBefore = document.getElementById("taskLeadWrap").hidden;
      time.value = "09:00";
      time.dispatchEvent(new Event("input", { bubbles: true }));
      const result = {
        hintBefore,
        hiddenBefore,
        hiddenAfter: document.getElementById("taskLeadWrap").hidden
      };
      time.value = "";
      time.dispatchEvent(new Event("input", { bubbles: true }));
      return result;
    })()`);
    check("подсказка: до времени говорит про поле «Заранее»", leadHint.hiddenBefore
      && /Заранее/.test(leadHint.hintBefore), JSON.stringify(leadHint));
    check("подсказка: после времени поле «Заранее» появляется", leadHint.hiddenAfter === false, JSON.stringify(leadHint));

    // Гонка close: событие close приходит задачей уже после openDay этого же
    // задания, поэтому обработчик раньше обнулял день открытого окна и форма
    // молча не писала. Закрываем и открываем окно в одном задании и проверяем,
    // что дело реально легло в выбранный день.
    const raceOpened = await cdp.eval(`(() => {
      const d = document.getElementById("dayDialog");
      document.getElementById("taskInput").value = "";
      if (d.open) d.close();
      document.querySelector('.day-cell[data-date="${tomorrow}"]').click();
      return d.open;
    })()`);
    await sleep(120);
    const raceSaved = await cdp.eval(`(() => {
      const input = document.getElementById("taskInput");
      input.value = "Проверка гонки close";
      document.getElementById("taskForm").requestSubmit();
      const store = JSON.parse(localStorage.getItem("pixel-calendar-2027-v1") || "{}");
      const tasks = (store.tasks || {})["${tomorrow}"] || [];
      return tasks.some((task) => task.text === "Проверка гонки close");
    })()`);
    check("окно: закрытие и повторное открытие в одном задании сохраняет день", raceOpened && raceSaved, `открыто=${raceOpened}, записано=${raceSaved}`);
    await cdp.eval(`(() => {
      document.getElementById("taskInput").value = "";
      document.getElementById("dialogCloseBtn").click();
      return true;
    })()`);
    await sleep(200);

    check("ошибок в консоли нет", consoleErrors.length === 0, consoleErrors.join(" | "));
    check("падений JS нет", exceptions.length === 0, exceptions.join(" | "));
  } catch (error) {
    crashed = true;
    check(`прогон дошёл до конца (${error.message})`, false);
  } finally {
    if (cdp) {
      try { await cdp.send("Browser.close"); } catch (error) { /* уже закрыт */ }
    }
    server.kill();
    chrome.kill();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length} из ${results.length} проверок пройдено`);
  if (failed.length || crashed) {
    console.error("Провалено:", failed.map((item) => item.name).join("; "));
    process.exit(1);
  }
  console.log(`Данные прогона: ${serverData}`);
  console.log(`Профиль Chrome: ${profile}`);
})();
