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

test("GET /ideas returns ideas with votes field initialized to 0", async () => {
  // First create an idea
  const createRes = await fetch(base + "/ideas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Test Idea" }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.title, "Test Idea");
  assert.equal(created.id, 1);

  // Now GET /ideas should include votes field
  const getRes = await fetch(base + "/ideas");
  assert.equal(getRes.status, 200);
  const ideas = await getRes.json();
  assert.equal(ideas.length, 1);
  assert.ok("votes" in ideas[0], "idea should have votes field");
  assert.equal(typeof ideas[0].votes, "number", "votes should be a number");
  assert.equal(ideas[0].votes, 0, "votes should initially be 0");
});

test("POST /ideas/:id/vote on existing idea returns 200 with incremented votes", async () => {
  // Create an idea first
  const createRes = await fetch(base + "/ideas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Votable Idea" }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  const ideaId = created.id;

  // Vote on the idea
  const voteRes = await fetch(base + `/ideas/${ideaId}/vote`, {
    method: "POST",
  });
  assert.equal(voteRes.status, 200);
  const voted = await voteRes.json();
  assert.equal(voted.id, ideaId);
  assert.equal(voted.title, "Votable Idea");
  assert.equal(voted.votes, 1, "votes should increment to 1");

  // Vote again - should increment further
  const voteRes2 = await fetch(base + `/ideas/${ideaId}/vote`, {
    method: "POST",
  });
  assert.equal(voteRes2.status, 200);
  const voted2 = await voteRes2.json();
  assert.equal(voted2.votes, 2, "votes should increment to 2");

  // Verify GET /ideas reflects the votes
  const getRes = await fetch(base + "/ideas");
  const ideas = await getRes.json();
  const idea = ideas.find((i) => i.id === ideaId);
  assert.equal(idea.votes, 2, "GET /ideas should reflect voted count");
});

test("POST /ideas/:id/vote on non-existent idea returns 404 with error", async () => {
  // First verify a real idea works
  const createRes = await fetch(base + "/ideas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Real Idea" }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  const realId = created.id;

  // Vote on real idea - should succeed
  const realVoteRes = await fetch(base + `/ideas/${realId}/vote`, {
    method: "POST",
  });
  assert.equal(realVoteRes.status, 200);

  // Now try to vote on non-existent idea
  const fakeId = 99999;
  const fakeVoteRes = await fetch(base + `/ideas/${fakeId}/vote`, {
    method: "POST",
  });
  assert.equal(fakeVoteRes.status, 404);
  const error = await fakeVoteRes.json();
  assert.equal(error.error, "not found");
});