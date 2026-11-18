const testStorage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem(key) {
      return testStorage.get(String(key)) ?? null;
    },
    setItem(key, value) {
      testStorage.set(String(key), String(value));
    },
    removeItem(key) {
      testStorage.delete(String(key));
    },
    clear() {
      testStorage.clear();
    },
  },
});
import assert from "node:assert/strict";
import { apiClient } from "../src/lib/apiClient.js";

global.window = { __accessToken: "test-token" };
let received;

global.fetch = async (path, options) => {
  received = { path, ...options };
  return new Response(JSON.stringify({ ok: true }));
};

assert.deepEqual(
  await apiClient("/api/v1/handoffs/scan", {
    method: "POST",
    body: { stationId: "station" },
  }),
  { ok: true }
);

assert.equal(received.headers.get("Authorization"), "Bearer test-token");
assert.equal(received.body, '{"stationId":"station"}');

window.__accessToken = "rotated-token";
await apiClient("/api/v1/handoffs/station/test");
assert.equal(received.headers.get("Authorization"), "Bearer rotated-token");

for (const status of [401, 403, 500]) {
  global.fetch = async () =>
    new Response(JSON.stringify({ detail: "Denied" }), { status });

  await assert.rejects(
    apiClient("/api/test"),
    (error) => error.status === status && error.message === "Denied"
  );
}

window.__accessToken = null;

global.fetch = async (_, options) => {
  assert.equal(options.headers.has("Authorization"), false);
  return new Response("[]");
};

assert.deepEqual(await apiClient("/api/test"), []);

console.log("PASS: token, JSON body, token rotation and HTTP errors");
