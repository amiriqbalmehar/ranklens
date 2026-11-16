/**
 * main.js — RankLens UI wiring.
 *
 * The deterministic audit (seo.js) runs with zero setup. The AI assistant
 * (ai.js + firebase.js) activates only when a Firebase config is present;
 * otherwise the AI buttons explain what is missing instead of failing
 * silently. See firebase-setup.md.
 */

import { auditPage } from "./seo.js";
import { createAIRouter, TASKS, MODES } from "./ai.js";
import { getFirebaseStatus, createHybridModel, saveAuditToCloud } from "./firebase.js";
import { SAMPLE_PAGE, SAMPLE_KEYWORD, SAMPLE_URL } from "./samples.js";
import { loadHistory, saveToHistory, clearHistory } from "./storage.js";

const $ = (id) => document.getElementById(id);

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

let currentAudit = null;
let currentPageText = "";
let aiRouter = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectedMode() {
  const checked = document.querySelector('input[name="inference-mode"]:checked');
  return checked ? checked.value : MODES.PREFER_ON_DEVICE;
}

function setStatusPills() {
  const fb = getFirebaseStatus();
  const fbPill = $("firebase-status");
  const banner = $("setup-banner");

  if (fb.configured) {
    fbPill.textContent = "Firebase: connected";
    fbPill.className = "pill pill-ok";
    banner.hidden = true;
  } else {
    fbPill.textContent = "Firebase: not configured (audit-only mode)";
    fbPill.className = "pill pill-warn";
    banner.hidden = false;
  }
}

function setDeviceStatus(text, ok = false) {
  const pill = $("device-status");
  pill.textContent = `On-device model: ${text}`;
  pill.className = ok ? "pill pill-ok" : "pill pill-muted";
}

function getAIRouter() {
  if (aiRouter) return aiRouter;
  aiRouter = createAIRouter({
    modelFactory: (mode) => createHybridModel(mode),
    onDownloadProgress: (progress) => {
      const wrap = $("download-wrap");
      wrap.hidden = false;
      $("download-bar").value = Math.round(progress * 100);
      $("download-pct").textContent = `${Math.round(progress * 100)}%`;
      setDeviceStatus("downloading…");
      if (progress >= 1) {
        wrap.hidden = true;
        setDeviceStatus("ready", true);
      }
    },
  });
  return aiRouter;
}

function renderHistory() {
  const history = loadHistory();
  const list = $("history-list");
  if (history.length === 0) {
    list.innerHTML = '<li class="muted">No audits yet — they appear here after you run one.</li>';
    return;
  }
  list.innerHTML = history
    .map((entry) => {
      const label = escapeHtml(entry.pageUrl || entry.targetKeyword || "Untitled page");
      const when = new Date(entry.savedAt).toLocaleString();
      return `<li><span>${label}<br><span class="muted">${escapeHtml(when)} · ${entry.wordCount} words</span></span><span class="history-score">${entry.score}/100</span></li>`;
    })
    .join("");
}

function renderAudit(audit) {
  $("results").hidden = false;

  const ring = $("score-ring-fill");
  ring.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - audit.score / 100));
  ring.style.stroke = audit.score >= 75 ? "#15803d" : audit.score >= 50 ? "#b45309" : "#b91c1c";
  $("score-value").textContent = audit.score;
  $("score-grade").textContent = audit.grade;
  $("score-summary").textContent = audit.summary;
  $("score-words").textContent = audit.isHtml
    ? `${audit.wordCount} words of readable text (HTML parsed).`
    : `${audit.wordCount} words of text (plain text — paste HTML for the full audit).`;

  const list = $("checks-list");
  list.innerHTML = audit.checks
    .map((c, i) => {
      const explainBtn =
        c.severity === "warning" || c.severity === "error"
          ? `<button class="btn btn-small" type="button" data-explain="${i}">Explain with AI</button>`
          : "";
      const rec = c.recommendation
        ? `<p class="check-rec"><strong>Fix:</strong> ${escapeHtml(c.recommendation)}</p>`
        : "";
      return `<li class="check">
        <div class="check-head">
          <span class="severity severity-${c.severity}">${c.severity}</span>
          <span class="check-title">${escapeHtml(c.title)}</span>
        </div>
        <p class="check-detail">${escapeHtml(c.detail)}</p>
        ${rec}
        ${explainBtn}
      </li>`;
    })
    .join("");

  list.querySelectorAll("[data-explain]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const issue = audit.checks[Number(btn.dataset.explain)];
      runAITask(TASKS.EXPLAIN_ISSUE, { issue });
    });
  });
}

function runAudit() {
  const input = $("page-input").value.trim();
  if (!input) {
    alert("Paste the page HTML or text first — or click “Load sample page”.");
    return;
  }
  const pageUrl = $("page-url").value.trim();
  const targetKeyword = $("target-keyword").value.trim();

  currentPageText = input;
  currentAudit = auditPage(input, { pageUrl, targetKeyword });
  renderAudit(currentAudit);

  const record = {
    pageUrl,
    targetKeyword,
    score: currentAudit.score,
    grade: currentAudit.grade,
    wordCount: currentAudit.wordCount,
    summary: currentAudit.summary,
  };
  saveToHistory(record);
  renderHistory();
  // Best-effort cloud backup; never blocks the UI.
  if (getFirebaseStatus().configured) void saveAuditToCloud(record);
}

function aiNotConfiguredMessage() {
  return (
    "AI needs a Firebase project first — the audit above works without one.\n\n" +
    "Follow firebase-setup.md (5 steps): create a Firebase project, run the " +
    "AI Logic guided setup, copy the web app config into a .env file, register " +
    "the App Check debug token, and restart the dev server."
  );
}

async function runAITask(task, context) {
  const output = $("ai-output");

  if (!getFirebaseStatus().configured) {
    output.innerHTML = `<p class="ai-error">${escapeHtml(aiNotConfiguredMessage())}</p>`;
    return;
  }

  const buttons = document.querySelectorAll(".ai-tasks .btn, #ai-rewrite, [data-explain]");
  buttons.forEach((b) => (b.disabled = true));
  output.innerHTML = '<p class="muted">Thinking… (on-device first when Gemini Nano is available)</p>';

  try {
    const router = getAIRouter();
    const mode = selectedMode();
    const fullContext = {
      ...context,
      pageText: currentPageText,
      targetKeyword: currentAudit ? currentAudit.targetKeyword : $("target-keyword").value.trim(),
      wordCount: currentAudit ? currentAudit.wordCount : undefined,
    };
    const result = await router.run(task, fullContext, mode);

    const sourceClass =
      result.source === "ON_DEVICE"
        ? "source-on-device"
        : result.source === "IN_CLOUD"
          ? "source-in-cloud"
          : "source-unknown";
    const sourceLabel =
      result.source === "ON_DEVICE"
        ? "Ran on-device · Gemini Nano"
        : result.source === "IN_CLOUD"
          ? "Ran in cloud · Gemini"
          : "Source unknown";

    output.innerHTML =
      `<div class="ai-meta"><span class="source-badge ${sourceClass}">${sourceLabel}</span>` +
      `<span class="latency">${result.latencyMs} ms · mode ${escapeHtml(result.mode)}</span></div>` +
      `<div>${escapeHtml(result.text)}</div>`;

    const state = router.getDeviceModelState();
    if (state === "ready") setDeviceStatus("ready", true);
    else if (state === "failed") setDeviceStatus("unavailable — cloud fallback used");
  } catch (err) {
    const message =
      err && err.message
        ? err.message
        : "The AI request failed. Check the browser console for details.";
    output.innerHTML =
      `<p class="ai-error">AI request failed: ${escapeHtml(message)}</p>` +
      `<p class="muted">If you chose “On-device only”, Gemini Nano may not be downloaded yet — ` +
      `enable chrome://flags/#prompt-api-for-gemini-nano-multimodal-input, restart Chrome, ` +
      `and try “Prefer on-device” instead. If the error mentions App Check, register the ` +
      `debug token from the console in the Firebase console (see firebase-setup.md step 4).</p>`;
    console.error("[RankLens] AI task failed:", err);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

function auditToMarkdown(audit) {
  const lines = [
    `# RankLens audit report`,
    ``,
    audit.pageUrl ? `Page: ${audit.pageUrl}` : null,
    `Score: ${audit.score}/100 (${audit.grade})`,
    `Words: ${audit.wordCount}`,
    `Summary: ${audit.summary}`,
    ``,
    `## Findings`,
    ``,
  ].filter((l) => l !== null);
  for (const c of audit.checks) {
    lines.push(`### ${c.title} — ${c.severity}`);
    lines.push(c.detail);
    if (c.recommendation) lines.push(`Fix: ${c.recommendation}`);
    lines.push(``);
  }
  return lines.join("\n");
}

function wireUp() {
  setStatusPills();
  renderHistory();

  $("run-audit").addEventListener("click", runAudit);

  $("load-sample").addEventListener("click", () => {
    $("page-input").value = SAMPLE_PAGE;
    $("target-keyword").value = SAMPLE_KEYWORD;
    $("page-url").value = SAMPLE_URL;
    runAudit();
  });

  $("clear-input").addEventListener("click", () => {
    $("page-input").value = "";
    $("page-url").value = "";
    $("target-keyword").value = "";
    $("results").hidden = true;
    currentAudit = null;
    currentPageText = "";
  });

  $("file-input").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("page-input").value = String(reader.result || "");
      runAudit();
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  $("ai-summarize").addEventListener("click", () => {
    if (!currentPageText) {
      alert("Paste a page and run the audit first.");
      return;
    }
    runAITask(TASKS.SUMMARIZE, {});
  });

  $("ai-brief").addEventListener("click", () => {
    if (!currentPageText) {
      alert("Paste a page and run the audit first.");
      return;
    }
    runAITask(TASKS.CONTENT_BRIEF, {});
  });

  $("ai-rewrite").addEventListener("click", () => {
    const section = $("rewrite-input").value.trim();
    if (!section) {
      alert("Paste a section to rewrite first.");
      return;
    }
    runAITask(TASKS.REWRITE, { sectionText: section });
  });

  $("export-md").addEventListener("click", async () => {
    if (!currentAudit) return;
    const text = auditToMarkdown(currentAudit);
    try {
      await navigator.clipboard.writeText(text);
      $("export-md").textContent = "Copied ✓";
      setTimeout(() => ($("export-md").textContent = "Copy report (Markdown)"), 2000);
    } catch {
      // Clipboard blocked (non-secure context) — fall back to a download.
      const blob = new Blob([text], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ranklens-audit.md";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });

  $("export-json").addEventListener("click", () => {
    if (!currentAudit) return;
    const blob = new Blob([JSON.stringify(currentAudit, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ranklens-audit.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("clear-history").addEventListener("click", () => {
    clearHistory();
    renderHistory();
  });
}

wireUp();
