#!/usr/bin/env node
// Домашний сервер синхронизации: статика www/ + API обмена состоянием.
// Без зависимостей. Запуск: npm run sync
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { mergeStates, migrateState } = require("../sync.js");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");
const DATA_DIR = process.env.SYNC_DATA_DIR
  ? path.resolve(process.env.SYNC_DATA_DIR)
  : path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const BACKUP_FILE = path.join(DATA_DIR, "state.bak.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BACKUP_KEEP = Number(process.env.SYNC_BACKUPS) > 0 ? Number(process.env.SYNC_BACKUPS) : 14;
const TOKEN_FILE = path.join(DATA_DIR, "token.txt");
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY = 2 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8"
};

function loadToken() {
  if (process.env.SYNC_TOKEN) return process.env.SYNC_TOKEN;
  try {
    const saved = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (saved) return saved;
  } catch (error) {
    // файла ещё нет — создадим ниже
  }
  const token = crypto.randomBytes(4).toString("hex");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
  return token;
}

function loadState() {
  for (const file of stateCandidates()) {
    try {
      return migrateState(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch (error) {
      // пробуем следующий файл
    }
  }
  return migrateState({});
}

// Основной файл, затем последняя копия, затем датированные копии от новых к старым.
function stateCandidates() {
  const list = [STATE_FILE, BACKUP_FILE];
  try {
    const dated = fs.readdirSync(BACKUP_DIR)
      .filter((name) => /^state-\d{8}-\d{6}-\d{3}\.json$/.test(name))
      .sort()
      .reverse()
      .slice(0, 5);
    for (const name of dated) list.push(path.join(BACKUP_DIR, name));
  } catch (error) {
    // каталога копий ещё нет
  }
  return list;
}

const token = loadToken();
let serverState = loadState();

// Копия перед каждой записью: state.bak.json (последнее состояние) плюс
// датированные копии в backups/, чтобы неудачное слияние не затёрло единственный файл.
function rotateBackup() {
  if (!fs.existsSync(STATE_FILE)) return;
  fs.copyFileSync(STATE_FILE, BACKUP_FILE);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 23).replace(/[-:]/g, "").replace("T", "-").replace(".", "-");
  fs.copyFileSync(STATE_FILE, path.join(BACKUP_DIR, `state-${stamp}.json`));
  const saved = fs.readdirSync(BACKUP_DIR)
    .filter((name) => /^state-\d{8}-\d{6}-\d{3}\.json$/.test(name))
    .sort();
  for (const name of saved.slice(0, Math.max(0, saved.length - BACKUP_KEEP))) {
    fs.rmSync(path.join(BACKUP_DIR, name), { force: true });
  }
}

function persist(next) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    rotateBackup();
  } catch (error) {
    console.warn("Не удалось сделать резервную копию:", error.message);
  }
  const temp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(next));
  fs.renameSync(temp, STATE_FILE);
  serverState = next;
}

function publicState() {
  return {
    serverTime: Date.now(),
    tasks: serverState.tasks,
    series: serverState.series,
    settings: serverState.settings
  };
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  let allowed = origin === "null" || origin === "https://localhost";
  try {
    const parsed = new URL(origin);
    allowed = allowed || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch (error) {
    allowed = false;
  }
  if (!allowed) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Sync-Token");
  res.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, callback) {
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      callback(new Error("Слишком большое тело запроса"));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => callback(null, Buffer.concat(chunks).toString("utf8")));
  req.on("error", (error) => callback(error));
}

function handleApi(req, res) {
  if (req.headers["x-sync-token"] !== token) {
    sendJson(res, 401, { error: "Неверный код подключения" });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, publicState());
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Метод не поддерживается" });
    return;
  }

  readBody(req, (error, body) => {
    if (error) {
      sendJson(res, 413, { error: error.message });
      return;
    }
    let incoming;
    try {
      incoming = migrateState(JSON.parse(body));
    } catch (parseError) {
      sendJson(res, 400, { error: "Некорректный JSON" });
      return;
    }
    const merged = mergeStates(serverState, incoming);
    try {
      persist(merged);
    } catch (writeError) {
      console.error("Не удалось сохранить состояние:", writeError.message);
      sendJson(res, 500, { error: "Не удалось сохранить состояние" });
      return;
    }
    sendJson(res, 200, publicState());
  });
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (error) {
    res.writeHead(400).end("Bad request");
    return;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = path.normalize(path.join(WWW, pathname));
  if (file !== WWW && !file.startsWith(WWW + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Не найдено");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  const pathname = (req.url || "").split("?")[0];
  if (pathname === "/api/state") {
    handleApi(req, res);
    return;
  }
  if (pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "Неизвестный метод API" });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end("Method not allowed");
    return;
  }
  serveStatic(req, res);
});

function lanAddresses() {
  const result = [];
  Object.values(os.networkInterfaces()).forEach((list) => {
    (list || []).forEach((item) => {
      if (item.family === "IPv4" && !item.internal) result.push(item.address);
    });
  });
  return result;
}

if (!fs.existsSync(path.join(WWW, "index.html"))) {
  console.warn("Внимание: www/index.html не найден. Сначала выполните npm run build:web.");
}

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  Пиксельный календарь · сервер синхронизации");
  console.log(`  Локально:  http://localhost:${PORT}`);
  lanAddresses().forEach((address) => {
    console.log(`  В сети:    http://${address}:${PORT}`);
  });
  console.log(`  Код подключения: ${token}`);
  console.log(`  Данные: ${STATE_FILE}`);
  console.log(`  Копии:  ${BACKUP_DIR} (до ${BACKUP_KEEP} шт.)`);
  console.log("");
  console.log("  Оставьте окно открытым. Остановить — Ctrl+C.");
  console.log("");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Порт ${PORT} занят. Закройте другой сервер или задайте PORT.`);
  } else {
    console.error("Ошибка сервера:", error.message);
  }
  process.exit(1);
});
