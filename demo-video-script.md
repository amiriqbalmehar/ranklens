# RankLens — demo video script (~90 seconds)

Record a screen share of the app running at http://localhost:5173 (or the
deployed URL) with voiceover. Keep it under 3 minutes — this script is
about 90 seconds. Show the real app doing real things; do not narrate over
static slides.

**Before recording:** complete `firebase-setup.md` (Firebase connected,
Chrome flag enabled, Gemini Nano downloaded so the on-device badge shows).
Have the sample page ready — the **Load sample page** button fills it in.

---

## 0:00–0:12 — The problem (show the app homepage)

**On screen:** RankLens homepage, empty input.

**Say:** "Small businesses pay hundreds for SEO audits — or paste their pages
into tools that upload everything to a server. RankLens audits any page
instantly, in your browser, and explains the findings with AI that runs
on your device when it can, and in the cloud when it can't."

## 0:12–0:35 — The audit (click Load sample page, then Run audit)

**On screen:** Click **Load sample page**. The form fills in (Apex Plumbing
page, keyword "emergency plumber Austin"). Click **Run audit**. The score
ring animates to **58/100 — Needs work**. Scroll through the checks.

**Say:** "Here's a real local business page. One click, and RankLens scores
it — 58 out of 100. Two H1 headings, no meta description, a title that's
109 characters, an image with no alt text. All of this runs locally —
nothing leaves the browser."

## 0:35–0:58 — On-device AI (click Explain with AI on the H1 issue)

**On screen:** Click **Explain with AI** next to the H1 error. The answer
appears with the green badge **"Ran on-device · Gemini Nano"** and a
latency figure (usually tens of milliseconds after the model is warm).

**Say:** "Now the AI explains it in plain English — and look, it ran
on-device, with Gemini Nano in Chrome. Free, private, and instant. No
server round-trip, no data leaving this laptop."

## 0:58–1:15 — Cloud fallback (switch mode, run Content brief)

**On screen:** Select **Cloud only** in the mode picker. Click **Content
brief**. The answer appears with the blue badge **"Ran in cloud · Gemini"**.

**Say:** "For longer work, like a full content brief, it hands off to cloud
Gemini — same SDK, same code path. And if I pick 'Prefer on-device', the
app chooses automatically: Nano when it's there, cloud when it's not.
One model call, two runtimes."

## 1:15–1:30 — Wrap up (show history + export)

**On screen:** Scroll to **Recent audits** (the audit is saved), then click
**Copy report (Markdown)**.

**Say:** "Audits are saved locally, exportable as Markdown or JSON, and the
whole project is open source. RankLens — hybrid AI that respects your
privacy and your hardware. Built with Firebase AI Logic."

---

## Recording notes

- **Resolution:** 1080p, browser window maximized, zoom at 100%.
- **If the on-device badge doesn't show:** the model may still be downloading — the progress bar is visible in the app. Wait for it, or pre-download with `await LanguageModel.create()` in the console before recording. If it still won't run on-device, record the cloud badge and say "falling back to cloud" — the fallback working is part of the demo.
- **Latency:** the first on-device answer can take a few seconds while the model warms up. Run one AI task off-camera first so the recorded answer is fast.
- **Captions:** add English subtitles if your narration isn't in English (Devpost requires English or English subtitles).
- **Upload:** YouTube, public or unlisted, and paste the link in the Devpost submission form.
