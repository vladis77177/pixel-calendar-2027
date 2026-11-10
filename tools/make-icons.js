// Generates the PWA icons as real PNG files without dependencies.
// Usage: node tools/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "assets", "icons");

const table = (() => {
  const result = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    result[n] = c >>> 0;
  }
  return result;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function writePng(file, width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
}

function hex(value) {
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), 255];
}

const BLOCK = [
  "................",
  "................",
  "................",
  ".LLLLLLLLLLLLLL.",
  ".LGGGGGGGGGGGGL.",
  ".LGGGGGGGGGGggL.",
  ".LGGGGGGGGGgggL.",
  ".LGGGGGGGGggggL.",
  ".LDDDDDDDDDDDDL.",
  ".LDDhDDDDDhDDDL.",
  ".LDDDDDDDDDDDDL.",
  ".LDDDDDhDDDDDDL.",
  ".LDDDDDDDDDDDhL.",
  ".LDDhDDDDDDDDDL.",
  ".LDDDDDDDDDDDDL.",
  ".LLLLLLLLLLLLLL."
];

const palette = {
  ".": "#00000000",
  L: "#3a2718",
  G: "#72ca55",
  g: "#5fb947",
  D: "#80522e",
  h: "#694021"
};

function drawBlock(size, scale, offset, background) {
  const pixels = Buffer.alloc(size * size * 4);
  if (background) {
    const bg = hex(background);
    for (let i = 0; i < size * size; i += 1) pixels.set(bg, i * 4);
  }
  const cell = Math.max(1, Math.floor((size * scale) / 16));
  const art = cell * 16;
  const start = Math.floor((size - art) / 2) + (offset || 0);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const color = palette[BLOCK[y][x]];
      if (!color || BLOCK[y][x] === ".") continue;
      const rgba = hex(color);
      for (let py = 0; py < cell; py += 1) {
        for (let px = 0; px < cell; px += 1) {
          const pxX = start + x * cell + px;
          const pxY = start + y * cell + py;
          if (pxX < 0 || pxY < 0 || pxX >= size || pxY >= size) continue;
          pixels.set(rgba, (pxY * size + pxX) * 4);
        }
      }
    }
  }
  return pixels;
}

function writeAppIcons() {
  fs.mkdirSync(OUT, { recursive: true });
  writePng(path.join(OUT, "icon-192.png"), 192, 192, drawBlock(192, 0.82));
  writePng(path.join(OUT, "icon-512.png"), 512, 512, drawBlock(512, 0.82));
  writePng(path.join(OUT, "apple-touch-icon.png"), 180, 180, drawBlock(180, 0.8, 0, "#8bd8ff"));
  writePng(path.join(OUT, "icon-maskable-512.png"), 512, 512, drawBlock(512, 0.62, 0, "#8bd8ff"));
  console.log("Icons written to", OUT);
}

if (require.main === module) writeAppIcons();

module.exports = { writePng, drawBlock, writeAppIcons };
