const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const MAX_VIDEO_IDS = 50;
const UPSTREAM_TIMEOUT_MS = 8000;

// 정적 파일로 제공할 확장자만 허용합니다 (server.js, .omc 등은 노출하지 않음)
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const sendJson = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};

// 클라이언트에는 필요한 필드만 전달합니다. API 키와 원본 응답은 노출하지 않습니다.
const toVideoSummary = (item) => ({
  id: item.id,
  title: item.snippet?.title ?? "",
  channelTitle: item.snippet?.channelTitle ?? "",
  thumbnail: item.snippet?.thumbnails?.medium?.url ?? "",
});

const handleVideos = async (url, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("[api/videos] YOUTUBE_API_KEY is not set");
    return sendJson(res, 503, { error: "영상 정보 서비스가 설정되지 않았습니다." });
  }

  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0 || ids.length > MAX_VIDEO_IDS || !ids.every((id) => VIDEO_ID_PATTERN.test(id))) {
    return sendJson(res, 400, { error: "잘못된 영상 ID 요청입니다." });
  }

  const params = new URLSearchParams({ part: "snippet", id: ids.join(","), key: apiKey });

  try {
    const upstream = await fetch(`${YOUTUBE_VIDEOS_URL}?${params}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      console.error(`[api/videos] YouTube API responded with ${upstream.status}`);
      return sendJson(res, 502, { error: "영상 정보를 가져오지 못했습니다." });
    }
    const data = await upstream.json();
    return sendJson(res, 200, { items: (data.items ?? []).map(toVideoSummary) });
  } catch (error) {
    console.error("[api/videos] request failed:", error);
    return sendJson(res, 502, { error: "영상 정보를 가져오지 못했습니다." });
  }
};

const serveStatic = async (url, req, res) => {
  const requested = decodeURIComponent(url.pathname);
  const relative = requested === "/" ? "/index.html" : requested;
  const filePath = path.join(ROOT, path.normalize(relative));
  const extension = path.extname(filePath).toLowerCase();

  const insideRoot = filePath.startsWith(ROOT + path.sep);
  const isHidden = relative.split("/").some((part) => part.startsWith("."));
  if (!insideRoot || isHidden || path.basename(filePath) === "server.js" || !MIME_TYPES[extension]) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not Found");
  }

  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === "/api/videos") {
      return await handleVideos(url, res);
    }
    return await serveStatic(url, req, res);
  } catch (error) {
    console.error("[server] unexpected error:", error);
    if (!res.headersSent) sendJson(res, 500, { error: "서버 오류가 발생했습니다." });
  }
});

server.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
});
