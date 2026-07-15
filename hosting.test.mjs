import assert from "node:assert/strict";

const { default: worker } = await import("./dist/server/index.js");

const root = await worker.fetch(new Request("https://mpd360.example/"));
assert.equal(root.status, 200);
assert.match(root.headers.get("content-type"), /^text\/html/);
assert.match(await root.text(), /MPD 360 Pill Calculator/);

const script = await worker.fetch(new Request("https://mpd360.example/app.js"));
assert.equal(script.status, 200);
assert.match(await script.text(), /function makeScheduleRows/);

const image = await worker.fetch(new Request("https://mpd360.example/og.png"));
assert.equal(image.status, 200);
assert.equal(image.headers.get("content-type"), "image/png");
assert.ok((await image.arrayBuffer()).byteLength > 10000);

const missing = await worker.fetch(new Request("https://mpd360.example/missing"));
assert.equal(missing.status, 404);

console.log("Hosted worker routes verified.");
