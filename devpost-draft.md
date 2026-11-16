# RankLens — Devpost submission draft

**Platform:** Web (Chrome)
**Submission deadline:** 30 Nov 2026, 5:00 PM ET
**Repo:** (public GitHub URL — add after pushing)
**Demo video:** (YouTube URL — add after recording; see demo-video-script.md)
**Hosted app:** (Firebase Hosting URL — optional, see firebase-setup.md)

---

## Title

**RankLens — Hybrid AI SEO Audit Assistant**

## Tagline

Instant on-page SEO audits in your browser, explained by AI that runs on-device with Gemini Nano — and falls back to cloud Gemini when it can't.

## Description

### The problem

Small businesses and freelancers either pay hundreds of dollars for an SEO audit or paste their pages into online tools that upload everything to a server. Both are slow, and the second gives away your content. Meanwhile the phones and laptops people already own can run real AI models — but only on some devices, so an on-device-only app leaves half your users out.

### What RankLens does

RankLens audits any web page's on-page SEO instantly — **entirely in the browser, nothing uploaded** — and then explains the findings with hybrid AI:

1. **Instant audit (no AI, no network, no setup).** Paste a page's HTML or text and get a 0–100 score plus checks for title tag, meta description, H1 count, heading hierarchy, internal/external links, image alt text, word count, readability (Flesch), and target-keyword density.
2. **AI assistant.** Four tasks built on the audit: summarize the page, explain any finding in plain English with one concrete fix, rewrite a section, and generate a content brief (subtopics, reader questions, a suggested new section).
3. **Visible hybrid routing.** A mode selector (Prefer on-device / On-device only / Prefer cloud / Cloud only), a live download progress bar for the on-device model, and an `ON_DEVICE` / `IN_CLOUD` badge plus latency on every answer — the hybrid behaviour is shown, not hidden.
4. **History + export.** Audits are saved locally, with optional Firestore backup, and export as Markdown or JSON.

### How Firebase AI Logic is used

One `GenerativeModel` from Firebase AI Logic, created with `InferenceMode.PREFER_ON_DEVICE`, backed by the Gemini Developer API:

```js
const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  onDeviceParams: { createOptions: { /* SEO-assistant system prompt */ } },
});
await model.initializeDeviceModel(onProgress);
const result = await model.generateContent(prompt);
result.response.inferenceSource; // "ON_DEVICE" or "IN_CLOUD"
```

- **On-device:** Gemini Nano via Chrome's Prompt API (desktop Chrome 139+) handles short single-turn tasks — summaries and explanations — free, private, and offline-capable.
- **Cloud fallback:** the SDK's default cloud model (gemini-3.5-flash-lite) takes over automatically when Nano is unavailable, and for longer work like content briefs.
- **App Check** is enforced as required, with the debug provider for local development (debug tokens accepted in submissions).
- **Firestore + Anonymous Auth** provide an optional best-effort cloud backup of audit history; localStorage is the primary store, so the app never depends on the cloud.

### Why this is a good use of hybrid inference

The audit itself proves the point: the deterministic checks always run locally (fast, free, private), and the AI layer adds understanding only where a model earns its place. Short, frequent requests — exactly the ones users make most — are the ones Nano handles best, so most AI usage costs nothing and sends nothing anywhere. The cloud exists for the long tail. That is the hybrid pattern the hackathon is about: the right runtime for each request, chosen automatically, with the user able to see and control it.

### Value proposition

For a small business owner: a free, private SEO audit with explanations a non-expert can act on, in under a minute. For an SEO freelancer: a repeatable audit workflow with exportable reports and AI-drafted fixes. For anyone on a slow connection or an older machine: the same app, because the cloud fallback covers whatever the device can't.

### What's next

- URL fetching via a small proxy so users can audit by URL instead of pasting HTML.
- Competitor comparison: audit two pages side by side.
- Scheduled re-audits with score history charts.

### Built with

Firebase AI Logic (hybrid inference), Firebase App Check, Firestore, Firebase Auth (anonymous), Vite, vanilla JavaScript. Open source under the MIT license.

---

## Checklist before submitting

- [ ] Public GitHub repo with this code + LICENSE (MIT) + README
- [ ] Demo video on YouTube (≤ 3 min), link in the form
- [ ] Description above pasted into the Devpost form
- [ ] Platform selected: **Web (Chrome)**
- [ ] (Optional) Hosted URL from Firebase Hosting
