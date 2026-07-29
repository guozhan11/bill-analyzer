import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, publicReadiness } from "../src/config.ts";

test("uses safe local defaults", () => {
  const config = loadConfig({});
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 3000);
  assert.equal(publicReadiness(config).status, "needs_configuration");
});

test("reports readiness without exposing the API key", () => {
  const config = loadConfig({ CONGRESS_API_KEY: "secret-value" });
  const result = publicReadiness(config);
  assert.equal(result.status, "ready");
  assert.equal(JSON.stringify(result).includes("secret-value"), false);
});

test("rejects invalid ports", () => {
  assert.throws(() => loadConfig({ PORT: "70000" }), /PORT must be/);
});
