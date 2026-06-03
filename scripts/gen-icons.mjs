// Generates Spotlight app icons as PNGs with zero dependencies (pure Node).
// Draws a "spotlight beam + source" mark over the brand gradient. Run with:
//   node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(outDir, { recursive: true });

// ---- minimal PNG encoder (RGBA, 8-bit) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
// alpha=false writes an opaque RGB PNG (no alpha channel) — Apple recommends
// home-screen icons have no transparency.
function encodePNG(width, height, rgba, alpha = false) {
  const ch = alpha ? 4 : 3;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;                 // bit depth
  ihdr[9] = alpha ? 6 : 2;     // color type: 6=RGBA, 2=RGB
  const stride = width * ch;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    let o = y * (stride + 1);
    raw[o++] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[o++] = rgba[i]; raw[o++] = rgba[i + 1]; raw[o++] = rgba[i + 2];
      if (alpha) raw[o++] = rgba[i + 3];
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- drawing ----
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C0 = hex("#6d5cff"); // indigo
const C1 = hex("#ff4d8d"); // pink
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function draw(size) {
  const ss = 4;                  // supersample for smooth edges
  const S = size * ss;
  const buf = Buffer.alloc(S * S * 4);
  const cx = S / 2;
  const apexX = cx, apexY = S * 0.2;   // light source position
  const halfAngle = 0.42;              // beam spread (radians)
  const tan = Math.tan(halfAngle);
  const srcR = S * 0.075;              // bright source radius

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      // brand gradient background (diagonal)
      const t = (x + y) / (2 * S);
      let r = lerp(C0[0], C1[0], t), g = lerp(C0[1], C1[1], t), b = lerp(C0[2], C1[2], t);

      // spotlight beam (cone widening downward from the source)
      const dy = y - apexY;
      if (dy > 0) {
        const halfW = dy * tan;
        const edge = smooth(halfW, halfW - S * 0.02, Math.abs(x - apexX)); // 1 inside, 0 outside
        const fade = clamp(1 - dy / (S * 0.92), 0, 1);                      // dimmer toward bottom
        const a = 0.5 * edge * (0.35 + 0.65 * fade);
        r = lerp(r, 255, a); g = lerp(g, 255, a); b = lerp(b, 255, a);
      }

      // bright light source
      const ds = Math.hypot(x - apexX, y - apexY);
      const glow = smooth(srcR * 2.6, srcR, ds) * 0.6;
      const core = smooth(srcR * 1.1, srcR * 0.8, ds);
      const a = clamp(glow + core, 0, 1);
      r = lerp(r, 255, a); g = lerp(g, 255, a); b = lerp(b, 255, a);

      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }

  // downscale (box filter) to target size
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, bl = 0, a = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const j = ((y * ss + sy) * S + (x * ss + sx)) * 4;
          r += buf[j]; g += buf[j + 1]; bl += buf[j + 2]; a += buf[j + 3];
        }
      const n = ss * ss, k = (y * size + x) * 4;
      out[k] = r / n; out[k + 1] = g / n; out[k + 2] = bl / n; out[k + 3] = a / n;
    }
  }
  return encodePNG(size, size, out);
}

for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180], ["favicon.png", 64]]) {
  writeFileSync(join(outDir, name), draw(size));
  console.log("wrote public/" + name);
}
