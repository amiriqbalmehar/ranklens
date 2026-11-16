/**
 * tests/ai.test.mjs — unit tests for the hybrid AI router, using a fake
 * model (no Firebase project, no network). Verifies mode routing,
 * device-model initialization order, inference-source labelling and
 * error propagation.
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createAIRouter, TASKS, MODES } from "../src/ai.js";

class FakeModel {
  constructor({ source = "ON_DEVICE", failGenerate = null, failInit = null } = {}) {
    this.source = source;
    this.failGenerate = failGenerate;
    this.failInit = failInit;
    this.initCalls = 0;
    this.generateCalls = 0;
    this.lastPrompt = "";
  }

  async initializeDeviceModel(onProgress) {
    this.initCalls += 1;
    if (this.failInit) throw this.failInit;
    if (typeof onProgress === "function") {
      onProgress(0.5);
      onProgress(1);
    }
  }

  async generateContent(prompt) {
    this.generateCalls += 1;
    this.lastPrompt = prompt;
    if (this.failGenerate) throw this.failGenerate;
    return {
      response: {
        text: () => `fake answer for: ${String(prompt).slice(0, 40)}…`,
        inferenceSource: this.source,
      },
    };
  }
}

test("summarize returns text, source and latency", async () => {
  const model = new FakeModel({ source: "ON_DEVICE" });
  const router = createAIRouter({ modelFactory: () => model });
  const result = await router.run(TASKS.SUMMARIZE, { pageText: "Some page content here." });
  assert.match(result.text, /fake answer/);
  assert.equal(result.source, "ON_DEVICE");
  assert.equal(result.mode, MODES.PREFER_ON_DEVICE);
  assert.equal(result.task, TASKS.SUMMARIZE);
  assert.ok(typeof result.latencyMs === "number" && result.latencyMs >= 0);
  assert.equal(model.initCalls, 1, "device model initialized before first call");
  assert.equal(model.generateCalls, 1);
  assert.equal(router.getDeviceModelState(), "ready");
});

test("cloud source is labelled IN_CLOUD", async () => {
  const model = new FakeModel({ source: "IN_CLOUD" });
  const router = createAIRouter({ modelFactory: () => model });
  const result = await router.run(TASKS.CONTENT_BRIEF, {
    pageText: "x".repeat(500),
    targetKeyword: "plumber",
    wordCount: 120,
  });
  assert.equal(result.source, "IN_CLOUD");
  assert.match(model.lastPrompt, /content brief/i);
});

test("selected mode is passed to the model factory", async () => {
  const seenModes = [];
  const router = createAIRouter({
    modelFactory: (mode) => {
      seenModes.push(mode);
      return new FakeModel();
    },
  });
  await router.run(TASKS.SUMMARIZE, { pageText: "hi" }, MODES.ONLY_ON_DEVICE);
  assert.deepEqual(seenModes, [MODES.ONLY_ON_DEVICE]);
});

test("ONLY_IN_CLOUD skips device-model initialization", async () => {
  const model = new FakeModel({ source: "IN_CLOUD" });
  const router = createAIRouter({ modelFactory: () => model });
  await router.run(TASKS.SUMMARIZE, { pageText: "hi" }, MODES.ONLY_IN_CLOUD);
  assert.equal(model.initCalls, 0);
  assert.equal(model.generateCalls, 1);
});

test("device model is initialized only once across runs", async () => {
  const model = new FakeModel();
  const router = createAIRouter({ modelFactory: () => model });
  await router.run(TASKS.SUMMARIZE, { pageText: "a" });
  await router.run(TASKS.SUMMARIZE, { pageText: "b" });
  assert.equal(model.initCalls, 1);
  assert.equal(model.generateCalls, 2);
});

test("explain-issue prompt includes the finding", async () => {
  const model = new FakeModel();
  const router = createAIRouter({ modelFactory: () => model });
  await router.run(TASKS.EXPLAIN_ISSUE, {
    issue: { title: "Title tag", detail: "No title tag found.", recommendation: "Add one." },
  });
  assert.match(model.lastPrompt, /Title tag/);
  assert.match(model.lastPrompt, /No title tag found/);
});

test("unknown task and unknown mode throw", async () => {
  const router = createAIRouter({ modelFactory: () => new FakeModel() });
  await assert.rejects(() => router.run("not-a-task", {}), /Unknown AI task/);
  await assert.rejects(
    () => router.run(TASKS.SUMMARIZE, {}, "NOT_A_MODE"),
    /Unknown inference mode/
  );
});

test("model errors propagate to the caller", async () => {
  const model = new FakeModel({ failGenerate: new Error("on-device model unavailable") });
  const router = createAIRouter({ modelFactory: () => model });
  await assert.rejects(
    () => router.run(TASKS.SUMMARIZE, { pageText: "hi" }, MODES.ONLY_ON_DEVICE),
    /on-device model unavailable/
  );
});

test("download progress callback receives values", async () => {
  const progressValues = [];
  const router = createAIRouter({
    modelFactory: () => new FakeModel(),
    onDownloadProgress: (p) => progressValues.push(p),
  });
  await router.run(TASKS.SUMMARIZE, { pageText: "hi" });
  assert.deepEqual(progressValues, [0.5, 1]);
});
