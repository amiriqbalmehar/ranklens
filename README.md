# RankLens — Hybrid AI SEO Audit Assistant

**Built for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/)** · Web (Chrome) · Firebase AI Logic hybrid inference

RankLens audits a web page's on-page SEO instantly, then explains the findings with hybrid AI: **Gemini Nano runs on-device in Chrome when available, and the app falls back to cloud Gemini when it isn't** — all through one Firebase AI Logic SDK call. Every AI answer is labelled with where it ran (`ON_DEVICE` or `IN_CLOUD`) and how long it took, so the hybrid behaviour is visible instead of hidden.

## The problem

Small businesses and freelancers pay for SEO audits or paste their pages into tools that upload everything to a server. RankLens does the audit **entirely in the browser** — nothing is uploaded — and uses AI only to explain findings and suggest fixes. Short explanations run free and private on-device; longer work (content briefs) goes to the cloud. That makes it fast on good hardware, usable on weak hardware, and private by default.

## What it does

1. **Instant on-page audit (no AI, no network, no setup)** — paste a page's HTML or text (or upload a file) and get a 0–100 score plus checks for:
   - Title tag (present, 30–60 characters) · Meta description (120–160)
   - Exactly one H1 · Heading hierarchy (no skipped levels)
   - Internal/external links · Image alt text
   - Word count · Flesch Reading Ease · Target-keyword density
2. **AI assistant (Firebase AI Logic hybrid inference)** — four tasks:
   - *Summarize this page* — 3 bullets: topic, audience, key offer
   - *Explain an issue* — plain-English explanation + one concrete fix, per finding
   - *Rewrite a section* — clearer, more scannable copy, same meaning
   - *Content brief* — subtopics, reader questions, a suggested new section
3. **Visible hybrid routing** — a mode selector (Prefer on-device / On-device only / Prefer cloud / Cloud only), a live on-device model download progress bar, and an `ON_DEVICE` / `IN_CLOUD` badge + latency on every answer.
4. **Audit history** — saved locally (localStorage), with optional best-effort backup to Firestore. Export any audit as Markdown (copy) or JSON (download).

## How the hybrid inference works

```js
// src/firebase.js — one model, one SDK, two runtimes
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";

const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,   // Nano on-device, cloud fallback
  onDeviceParams: { createOptions: { /* SEO-assistant system prompt */ } },
});

// Must be called after a user click, before the first generateContent().
await model.initializeDeviceModel((progress) => showProgress(progress));

const result = await model.generateContent(prompt);
result.response.text();              // the answer
result.response.inferenceSource;     // "ON_DEVICE" or "IN_CLOUD"
```

- **On-device:** Gemini Nano via Chrome's Prompt API (desktop Chrome 139+). Single-turn text generation only — which is exactly what short summaries and explanations need.
- **Cloud fallback:** the SDK default cloud model (gemini-3.5-flash-lite from SDK v13), via the Gemini Developer API backend (free tier). Override it with `inCloudParams` in `src/firebase.js` if you want a stronger cloud model.
- **App Check** is enforced (required by AI Logic). Local development uses the debug provider; see `firebase-setup.md`.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

The audit works immediately with no setup. For the AI assistant, add your Firebase config (5 steps, ~10 minutes) — see **[firebase-setup.md](firebase-setup.md)**.

```bash
npm test           # 16 unit tests (audit engine + AI router with a fake model)
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

## Requirements

- Node.js 18+ (developed on Node 24)
- For on-device inference: desktop **Chrome 139+** with the flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` enabled, and the Gemini Nano model downloaded (the app triggers the download on first AI use and shows progress). On any other browser, or without the model, the app falls back to cloud inference automatically.
- For AI features: a Firebase project with AI Logic enabled (free tier). See `firebase-setup.md`.

## Project structure

```
index.html            Page shell (input + audit + AI panel)
src/
  main.js             UI wiring
  styles.css          Styles (no framework)
  seo.js              Deterministic audit engine (pure JS, zero deps)
  ai.js               Hybrid AI router (mode selection, timing, source labels)
  firebase.js         Firebase init, App Check, AI Logic model factory, Firestore save
  samples.js          Sample page for the demo
  storage.js          localStorage audit history
tests/
  seo.test.mjs        Audit engine tests (good/bad/plain-text/keyword cases)
  ai.test.mjs         Router tests with a fake model (no Firebase needed)
firebase-setup.md     Exact steps to create the Firebase project + config
demo-video-script.md  90-second demo video script
devpost-draft.md      Submission title + description for Devpost
```

## What was verified without a live Firebase key

- `npm test` — 16/16 tests pass (audit engine + AI router logic with a fake model).
- `npm run build` — production build succeeds; the bundle contains the Firebase AI Logic calls (`getGenerativeModel`, `initializeDeviceModel`, `inferenceSource`).
- The sample page audits to **58/100 ("Needs work")** with 1 error + 5 warnings across 10 checks — the exact mix the demo needs.
- The built app serves over HTTP and renders the full UI (audit-only mode).

What still needs a live key: real on-device and cloud AI responses, the model download flow, and the Firestore backup. These are exercised in the demo video after the Firebase project is created (see `firebase-setup.md`).

## License

MIT — see [LICENSE](LICENSE).
