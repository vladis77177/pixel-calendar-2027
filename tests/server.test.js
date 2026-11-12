const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TOKEN = "test-token-123";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Сервер не стартовал:\n${output}`)), 8000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("Код подключения")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Сервер завершился с кодом ${code}:\n${output}`));
    });
  });
}

function makeTask(overrides) {
  return {
    id: "t1",
    text: "Задача",
    done: false,
    createdAt: 100,
    updatedAt: 100,
    deletedAt: null,
    time: null,
    remindAt: null,
    ...overrides
  };
}

function body(tasks, series, settings) {
  return {
    version: 4,
    view: "month",
    tasks: tasks || {},
    series: series || [],
    settings: {
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
      updatedAt: 0,
      ...(settings || {})
    }
  };
}

test("сервер синхронизации", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixel-sync-"));
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, "sync-server", "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      SYNC_TOKEN: TOKEN,
      SYNC_DATA_DIR: dataDir
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  t.after(() => {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  await waitForServer(child);
  const base = `http://127.0.0.1:${port}`;

  const headers = { "Content-Type": "application/json", "X-Sync-Token": TOKEN };

  await t.test("без кода подключения — 401", async () => {
    const response = await fetch(`${base}/api/state`);
    assert.equal(response.status, 401);
  });

  await t.test("с кодом — пустое состояние v3", async () => {
    const response = await fetch(`${base}/api/state`, { headers });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.serverTime > 0);
    assert.deepEqual(data.tasks, {});
    assert.deepEqual(data.series, []);
  });

  await t.test("POST сохраняет и отдаёт слитое состояние", async () => {
    const incoming = body({ "2026-11-10": [makeTask({ text: "Полить цветы" })] });
    const response = await fetch(`${base}/api/state`, {
      method: "POST",
      headers,
      body: JSON.stringify(incoming)
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.tasks["2026-11-10"][0].text, "Полить цветы");
    assert.ok(fs.existsSync(path.join(dataDir, "state.json")));
  });

  await t.test("старое состояние не затирает новые данные", async () => {
    const stale = body({});
    const response = await fetch(`${base}/api/state`, {
      method: "POST",
      headers,
      body: JSON.stringify(stale)
    });
    const data = await response.json();
    assert.equal(data.tasks["2026-11-10"][0].text, "Полить цветы");
  });

  await t.test("могила удаляет задачу и сохраняется", async () => {
    const tombstone = body({
      "2026-11-10": [makeTask({ deletedAt: 500, updatedAt: 500 })]
    });
    const response = await fetch(`${base}/api/state`, {
      method: "POST",
      headers,
      body: JSON.stringify(tombstone)
    });
    const data = await response.json();
    assert.equal(data.tasks["2026-11-10"][0].deletedAt, 500);
  });

  await t.test("статика отдаётся, обход каталога закрыт", async () => {
    const response = await fetch(`${base}/`);
    if (fs.existsSync(path.join(ROOT, "www", "index.html"))) {
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes("Пиксельный календарь"));
    } else {
      assert.equal(response.status, 404);
    }
    const escape = await fetch(`${base}/..%2f..%2fpackage.json`);
    assert.equal(escape.status, 403);
  });

  await t.test("CORS только для локальных источников", async () => {
    const allowed = await fetch(`${base}/api/state`, {
      headers: { ...headers, Origin: "http://localhost:5173" }
    });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");

    const denied = await fetch(`${base}/api/state`, {
      headers: { ...headers, Origin: "https://evil.example" }
    });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
  });
});
