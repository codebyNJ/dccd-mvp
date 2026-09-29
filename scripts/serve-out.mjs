// Serve the static export in out/ (used by the Playwright tests and for a quick local check).
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "out");
const port = Number(process.env.PORT ?? 3100);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

const file = (p) => {
  try {
    const s = statSync(p);
    if (s.isDirectory()) return file(join(p, "index.html"));
    return s.isFile() ? p : null;
  } catch {
    return null;
  }
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const found = file(join(root, path));
  if (!found) {
    res.writeHead(404, { "content-type": TYPES[".html"] });
    return createReadStream(join(root, "404.html")).pipe(res);
  }
  res.writeHead(200, { "content-type": TYPES[extname(found)] ?? "application/octet-stream" });
  createReadStream(found).pipe(res);
}).listen(port, () => console.log(`Serving out/ on http://localhost:${port}`));
