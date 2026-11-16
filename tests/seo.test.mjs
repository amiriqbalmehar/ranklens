/**
 * tests/seo.test.mjs — unit tests for the deterministic audit engine.
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { auditPage, fleschReadingEase } from "../src/seo.js";
import { SAMPLE_PAGE, SAMPLE_KEYWORD } from "../src/samples.js";

const GOOD_PAGE = `<!DOCTYPE html><html><head>
<title>Emergency Plumber Austin | Apex Plumbing 24/7</title>
<meta name="description" content="Apex Plumbing fixes leaks, drains and water heaters across Austin. Licensed plumbers, fixed prices, 12-month guarantee. Call now for same-day service.">
</head><body>
<h1>Emergency Plumber in Austin</h1>
<p>${"When a pipe bursts, you need help fast. Our licensed plumbers answer day and night, explain the fix in plain words, and quote a fixed price before we start. ".repeat(12)}</p>
<h2>What we fix</h2>
<p>${"Leaks, drains, toilets, water heaters, and full repiping. We clean up when we finish and back every job with a guarantee. ".repeat(8)}</p>
<h3>Our guarantee</h3>
<p>${"Every job carries a twelve month workmanship guarantee with no hidden fees and no call out charge in the city. ".repeat(6)}</p>
<a href="/services">Services</a>
<a href="/about">About</a>
<a href="/contact">Contact</a>
<img src="/van.jpg" alt="Apex Plumbing van">
</body></html>`;

function severityOf(audit, id) {
  const found = audit.checks.find((c) => c.id === id);
  return found ? found.severity : "missing";
}

test("good page scores high with no errors", () => {
  const audit = auditPage(GOOD_PAGE, { targetKeyword: "emergency plumber" });
  assert.ok(audit.score >= 90, `expected score >= 90, got ${audit.score}`);
  assert.equal(audit.grade, "Excellent");
  assert.equal(audit.checks.filter((c) => c.severity === "error").length, 0);
  assert.equal(severityOf(audit, "title"), "pass");
  assert.equal(severityOf(audit, "h1"), "pass");
  assert.equal(severityOf(audit, "meta-description"), "pass");
});

test("sample page flags the intended issues", () => {
  const audit = auditPage(SAMPLE_PAGE, { targetKeyword: SAMPLE_KEYWORD });
  assert.ok(audit.isHtml);
  assert.equal(severityOf(audit, "title"), "warning"); // 109 chars
  assert.equal(severityOf(audit, "meta-description"), "warning"); // missing
  assert.equal(severityOf(audit, "h1"), "error"); // two H1s
  assert.equal(severityOf(audit, "headings"), "warning"); // H2 -> H4 skip
  assert.equal(severityOf(audit, "images"), "warning"); // one image without alt
  assert.equal(severityOf(audit, "internal-links"), "pass");
  assert.equal(severityOf(audit, "word-count"), "warning"); // thin content
  assert.ok(audit.score >= 50 && audit.score < 75, `expected 50-74, got ${audit.score}`);
  assert.equal(audit.grade, "Needs work");
});

test("plain text input skips HTML checks gracefully", () => {
  const audit = auditPage("Just some plain text about plumbing services in Austin. ".repeat(20));
  assert.equal(audit.isHtml, false);
  assert.equal(severityOf(audit, "html-only"), "info");
  assert.equal(severityOf(audit, "title"), "missing");
  assert.ok(audit.wordCount > 100);
});

test("empty input reports an error, not a crash", () => {
  const audit = auditPage("   ");
  assert.equal(severityOf(audit, "word-count"), "error");
  assert.ok(audit.score < 100);
});

test("target keyword: absent is an error, natural use passes", () => {
  const noKeyword = auditPage(GOOD_PAGE, { targetKeyword: "zebra juggling" });
  assert.equal(severityOf(noKeyword, "keyword"), "error");

  const natural = auditPage(GOOD_PAGE, { targetKeyword: "emergency plumber" });
  assert.equal(severityOf(natural, "keyword"), "pass");
});

test("keyword stuffing is flagged", () => {
  const stuffed = "plumber plumber plumber plumber plumber plumber plumber plumber ".repeat(10);
  const audit = auditPage(stuffed, { targetKeyword: "plumber" });
  assert.equal(severityOf(audit, "keyword"), "warning");
});

test("Flesch reading ease separates easy from hard text", () => {
  const easy = fleschReadingEase(
    "The cat sat on the mat. It was a hot day. The dog ran fast. We had fun in the sun."
  );
  const hard = fleschReadingEase(
    "The methodological implementation of comprehensive infrastructural reconfiguration necessitates substantial interdisciplinary coordination and rigorous analytical evaluation."
  );
  assert.ok(easy > 80, `expected easy text > 80, got ${easy}`);
  assert.ok(hard < 50, `expected hard text < 50, got ${hard}`);
});
