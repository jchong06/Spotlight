// ============================================================
//  Spotlight — standalone production server (no framework, no runtime deps).
//
//  Serves the built frontend (dist/) plus the external-API proxy:
//    /api/{tm,sg,bit,attr,venues} -> external APIs with key injection
//
//  Accounts + favorites are handled directly by Supabase from the browser
//  (see src/auth.js), so this server is now stateless.
//
//  Run after `npm run build`:  node server/index.js   (PORT via env)
// ============================================================
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tryProxy } from "./proxy.js";

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, "..", "dist");
const PORT = process.env.PORT || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://internal").pathname);
  let file = normalize(join(DIST, pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end("Forbidden"); }

  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(DIST, "index.html"); // SPA fallback for client routes
  }
  try {
    const data = await readFile(file);
    res.setHeader("Content-Type", MIME[extname(file)] || "application/octet-stream");
    // hashed assets are immutable; html should always revalidate
    if (file.includes(`${join(DIST, "assets")}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://internal").pathname;
  try {
    if (path.startsWith("/api/")) {
      if (tryProxy(req, res)) return;
      return send(res, 404, { error: "Not found" });
    }
    return serveStatic(req, res);
  } catch (e) {
    return send(res, 500, { error: e.message || "Server error" });
  }
});

server.listen(PORT, () => console.log(`Spotlight running on http://0.0.0.0:${PORT}`));
