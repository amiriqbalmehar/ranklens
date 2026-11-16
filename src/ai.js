/**
 * ai.js — hybrid AI router for RankLens.
 *
 * This module owns everything about *how* an AI request runs, and nothing
 * about *where* the model comes from. The model is supplied by an injected
 * `modelFactory(mode)` function (see firebase.js for the real one). That
 * separation is what makes this module unit-testable without a Firebase
 * project: tests inject a fake model and verify routing, timing and
 * source-labelling logic.
 *
 * Inference modes (Firebase AI Logic `InferenceMode`):
 *   PREFER_ON_DEVICE — on-device Gemini Nano when available, else cloud.
 *   ONLY_ON_DEVICE   — on-device only; throws when unavailable.
 *   PREFER_IN_CLOUD  — cloud first, falls back to on-device when offline.
 *   ONLY_IN_CLOUD    — cloud only; throws when unavailable.
 *
 * Every response is labelled with its `inferenceSource` (ON_DEVICE or
 * IN_CLOUD) straight from the Firebase AI Logic response, plus the time
 * the request took — the UI shows both, so the hybrid behaviour is
 * visible instead of hidden.
 */

export const MODES = {
  PREFER_ON_DEVICE: "PREFER_ON_DEVICE",
  ONLY_ON_DEVICE: "ONLY_ON_DEVICE",
  PREFER_IN_CLOUD: "PREFER_IN_CLOUD",
  ONLY_IN_CLOUD: "ONLY_IN_CLOUD",
};

export const MODE_LABELS = {
  [MODES.PREFER_ON_DEVICE]: "Prefer on-device (fall back to cloud)",
  [MODES.ONLY_ON_DEVICE]: "On-device only",
  [MODES.PREFER_IN_CLOUD]: "Prefer cloud (fall back to on-device)",
  [MODES.ONLY_IN_CLOUD]: "Cloud only",
};

/** Short tasks that suit the small on-device model. */
export const TASKS = {
  SUMMARIZE: "summarize",
  EXPLAIN_ISSUE: "explain-issue",
  REWRITE: "rewrite",
  CONTENT_BRIEF: "content-brief",
};

export const TASK_LABELS = {
  [TASKS.SUMMARIZE]: "Summarize this page",
  [TASKS.EXPLAIN_ISSUE]: "Explain an issue",
  [TASKS.REWRITE]: "Rewrite a section",
  [TASKS.CONTENT_BRIEF]: "Content brief",
};

const MAX_INPUT_CHARS = 12000;

function truncate(text, max = MAX_INPUT_CHARS) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n\n[content trimmed to fit the model]";
}

function buildPrompt(task, context) {
  switch (task) {
    case TASKS.SUMMARIZE:
      return (
        "You are a concise SEO assistant. Summarize the following web page " +
        "content in 3 short bullet points: what the page is about, who it is for, " +
        "and the single most important thing it offers. Keep it under 90 words.\n\n" +
        truncate(context.pageText || "")
      );
    case TASKS.EXPLAIN_ISSUE: {
      const issue = context.issue || {};
      return (
        "You are a plain-speaking SEO consultant. Explain this on-page SEO " +
        "finding in 2–3 short sentences a small business owner can understand, " +
        "then give one concrete fix. No jargon.\n\n" +
        `Finding: ${issue.title || "unknown"}\n` +
        `Detail: ${issue.detail || ""}\n` +
        `Current recommendation: ${issue.recommendation || ""}`
      );
    }
    case TASKS.REWRITE:
      return (
        "You are an SEO copywriter. Rewrite the following section so it is " +
        "clearer, easier to scan, and better for search, without changing its " +
        "meaning. Keep roughly the same length. Return only the rewritten text.\n\n" +
        truncate(context.sectionText || "")
      );
    case TASKS.CONTENT_BRIEF:
      return (
        "You are an SEO strategist. Write a short content brief for improving " +
        "this page so it can rank better. Include: 1) the page's main topic in " +
        "one line, 2) three subtopics it should cover, 3) three questions readers " +
        "would ask, 4) one suggested new section heading. Keep it under 200 words.\n\n" +
        `Page topic / keyword: ${context.targetKeyword || "not specified"}\n` +
        `Current word count: ${context.wordCount || "unknown"}\n\n` +
        truncate(context.pageText || "", 6000)
      );
    default:
      throw new Error(`Unknown AI task: ${task}`);
  }
}

/**
 * Create a hybrid AI router.
 *
 * @param {object} options
 * @param {(mode: string) => object} options.modelFactory - returns a model
 *   with `initializeDeviceModel(onProgress)` and `generateContent(prompt)`.
 * @param {(progress: number) => void} [options.onDownloadProgress] - called
 *   with 0–1 while the on-device model downloads.
 * @returns {{ run, getDeviceModelState }}
 */
export function createAIRouter({ modelFactory, onDownloadProgress }) {
  if (typeof modelFactory !== "function") {
    throw new Error("createAIRouter requires a modelFactory function");
  }

  let deviceModelState = "not-started"; // not-started | downloading | ready | failed
  let deviceInitPromise = null;

  function ensureDeviceModel(model) {
    // initializeDeviceModel() must be called after a user interaction and
    // before the first generateContent() call. It is safe to call once and
    // reuse the promise; the SDK no-ops when the model is already ready.
    if (deviceInitPromise) return deviceInitPromise;
    deviceModelState = "downloading";
    deviceInitPromise = (async () => {
      try {
        await model.initializeDeviceModel((progress) => {
          if (typeof onDownloadProgress === "function") onDownloadProgress(progress);
        });
        deviceModelState = "ready";
      } catch (err) {
        deviceModelState = "failed";
        throw err;
      }
    })();
    return deviceInitPromise;
  }

  /**
   * Run one AI task.
   *
   * @param {string} task - one of TASKS
   * @param {object} context - task inputs (pageText, issue, sectionText, ...)
   * @param {string} [mode] - one of MODES (default PREFER_ON_DEVICE)
   * @returns {Promise<{ text, source, latencyMs, mode, task }>}
   */
  async function run(task, context, mode = MODES.PREFER_ON_DEVICE) {
    if (!Object.values(TASKS).includes(task)) {
      throw new Error(`Unknown AI task: ${task}`);
    }
    if (!Object.values(MODES).includes(mode)) {
      throw new Error(`Unknown inference mode: ${mode}`);
    }

    const prompt = buildPrompt(task, context);
    const model = modelFactory(mode);

    // On-device modes need the device model initialized first. For cloud-only
    // modes we skip it — there is nothing to download.
    if (mode !== MODES.ONLY_IN_CLOUD) {
      await ensureDeviceModel(model);
    }

    const started = Date.now();
    const result = await model.generateContent(prompt);
    const latencyMs = Date.now() - started;

    const response = result.response;
    const text = typeof response.text === "function" ? response.text() : String(response.text ?? "");
    // inferenceSource is provided by Firebase AI Logic (SDK v12.5.0+):
    // "ON_DEVICE" or "IN_CLOUD". Older responses may omit it.
    const source = response.inferenceSource || "unknown";

    return { text, source, latencyMs, mode, task };
  }

  return {
    run,
    getDeviceModelState: () => deviceModelState,
  };
}
