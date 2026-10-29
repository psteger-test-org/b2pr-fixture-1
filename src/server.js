// A tiny in-memory ideas service. Endpoints:
//   GET  /health        -> {"status":"ok"}
//   GET  /ideas         -> [{id, title, votes}]
//   POST /ideas {title} -> 201 {id, title, votes}; 400 if title is missing, blank or longer than 120 characters
//   POST /ideas/:id/vote -> 200 {id, title, votes} (increments votes); 404 if not found
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const MAX_BODY = 16 * 1024;

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body) + "\n");
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function createApp() {
  const ideas = [];
  let nextId = 1;
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (req.method === "GET" && pathname === "/health") return send(res, 200, { status: "ok" });
    if (req.method === "GET" && pathname === "/ideas") return send(res, 200, ideas);
    if (req.method === "POST" && pathname === "/ideas") {
      let body;
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: "invalid JSON body" });
      }
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 120) return send(res, 400, { error: "title must be 1-120 characters" });
      const idea = { id: nextId++, title, votes: 0 };
      ideas.push(idea);
      return send(res, 201, idea);
    }
    // POST /ideas/:id/vote
    const voteMatch = pathname.match(/^\/ideas\/(\d+)\/vote$/);
    if (req.method === "POST" && voteMatch) {
      const id = Number(voteMatch[1]);
      const idea = ideas.find((i) => i.id === id);
      if (!idea) return send(res, 404, { error: "not found" });
      idea.votes += 1;
      return send(res, 200, idea);
    }
    return send(res, 404, { error: "not found" });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, "127.0.0.1", () => console.log(`ideas service on http://127.0.0.1:${port}`));
}