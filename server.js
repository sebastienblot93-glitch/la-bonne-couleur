// Petit serveur statique sans dépendance : sert le dossier public/
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const ROOT = path.join(__dirname, "public");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Requête invalide");
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  // Empêche de sortir du dossier public/
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end("Interdit");
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Page introuvable");
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

server.listen(PORT, () => console.log(`La bonne couleur : http://localhost:${PORT}`));
