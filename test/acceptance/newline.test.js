import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, ["src/server.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("service did not start");
});

after(() => server.kill());

test("response bodies end with a newline character", async () => {
  // Test GET /health
  const healthRes = await fetch(base + "/health");
  assert.equal(healthRes.status, 200);
  const healthText = await healthRes.text();
  assert.ok(healthText.endsWith("\n"), "GET /health response should end with newline");

  // Test GET /ideas
  const ideasRes = await fetch(base + "/ideas");
  assert.equal(ideasRes.status, 200);
  const ideasText = await ideasRes.text();
  assert.ok(ideasText.endsWith("\n"), "GET /ideas response should end with newline");

  // Test POST /ideas
  const createRes = await fetch(base + "/ideas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Test Idea" }),
  });
  assert.equal(createRes.status, 201);
  const createText = await createRes.text();
  assert.ok(createText.endsWith("\n"), "POST /ideas response should end with newline");

  // Test POST /ideas/:id/vote
  const created = JSON.parse(createText);
  const voteRes = await fetch(base + `/ideas/${created.id}/vote`, {
    method: "POST",
  });
  assert.equal(voteRes.status, 200);
  const voteText = await voteRes.text();
  assert.ok(voteText.endsWith("\n"), "POST /ideas/:id/vote response should end with newline");

  // Test 404 response
  const notFoundRes = await fetch(base + "/ideas/99999/vote", {
    method: "POST",
  });
  assert.equal(notFoundRes.status, 404);
  const notFoundText = await notFoundRes.text();
  assert.ok(notFoundText.endsWith("\n"), "404 response should end with newline");
});