/**
 * seo.js — deterministic on-page SEO audit engine.
 *
 * Pure JavaScript, zero dependencies, no network calls. It parses pasted
 * HTML (or plain text) and scores the page against a fixed checklist of
 * on-page SEO fundamentals. This is the part of RankLens that always works,
 * even with no Firebase config and no internet connection.
 *
 * The AI assistant (ai.js) builds on these findings — it explains them and
 * suggests fixes — but the audit itself never needs a model.
 */

export const SEVERITY = {
  PASS: "pass",
  WARNING: "warning",
  ERROR: "error",
  INFO: "info",
};

const SCORE_PENALTY = {
  [SEVERITY.ERROR]: 12,
  [SEVERITY.WARNING]: 6,
  [SEVERITY.PASS]: 0,
  [SEVERITY.INFO]: 0,
};

function check(id, title, severity, detail, recommendation) {
  return { id, title, severity, detail, recommendation };
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch Reading Ease: 90-100 very easy, 60-70 standard, 0-30 very hard. */
export function fleschReadingEase(text) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  if (sentences.length === 0 || words.length === 0) return null;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score =
    206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

function looksLikeHtml(input) {
  return /<\s*(html|head|body|title|h1|h2|div|p|a|img|meta)\b/i.test(input);
}

function extractTagContent(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(stripTags(m[1]));
  return out;
}

function extractMetaContent(html, attrName, attrValue) {
  const re = new RegExp(
    `<meta\\b[^>]*${attrName}=["']${attrValue}["'][^>]*>`,
    "gi"
  );
  const m = re.exec(html);
  if (!m) return null;
  const content = /content=["']([^"']*)["']/i.exec(m[0]);
  return content ? content[1] : "";
}

function extractImages(html) {
  const re = /<img\b[^>]*>/gi;
  const imgs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const alt = /alt=["']([^"']*)["']/i.exec(m[0]);
    imgs.push({ hasAlt: !!alt && alt[1].trim().length > 0 });
  }
  return imgs;
}

function extractLinks(html) {
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const links = [];
  let m;
  while ((m = re.exec(html)) !== null) links.push(m[1]);
  return links;
}

function gradeFor(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs work";
  return "Poor";
}

/**
 * Run the full on-page audit.
 *
 * @param {string} input - pasted HTML or plain text of the page
 * @param {object} [options]
 * @param {string} [options.targetKeyword] - optional keyword to check density for
 * @param {string} [options.pageUrl] - optional page URL (display only, never fetched)
 * @returns {{ score, grade, isHtml, wordCount, checks, summary }}
 */
export function auditPage(input, options = {}) {
  const { targetKeyword = "", pageUrl = "" } = options;
  const raw = (input || "").trim();
  const isHtml = looksLikeHtml(raw);
  const text = isHtml ? stripTags(raw) : raw;
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const checks = [];

  // --- Title tag (HTML only) ---
  if (isHtml) {
    const titles = extractTagContent(raw, "title");
    if (titles.length === 0) {
      checks.push(
        check(
          "title",
          "Title tag",
          SEVERITY.ERROR,
          "No <title> tag found.",
          "Add a unique title tag of 30–60 characters that states what the page is about."
        )
      );
    } else {
      const len = titles[0].length;
      if (len < 30) {
        checks.push(
          check(
            "title",
            "Title tag",
            SEVERITY.WARNING,
            `Title is ${len} characters — shorter than the 30–60 character sweet spot.`,
            "Expand the title so it describes the page clearly; keep it under 60 characters so it is not cut off in search results."
          )
        );
      } else if (len > 60) {
        checks.push(
          check(
            "title",
            "Title tag",
            SEVERITY.WARNING,
            `Title is ${len} characters — longer than 60, so search engines will truncate it.`,
            "Trim the title to under 60 characters while keeping the most important words at the front."
          )
        );
      } else {
        checks.push(
          check(
            "title",
            "Title tag",
            SEVERITY.PASS,
            `Title is ${len} characters — inside the 30–60 character range.`,
            ""
          )
        );
      }
      if (titles.length > 1) {
        checks.push(
          check(
            "title-duplicate",
            "Duplicate title tags",
            SEVERITY.ERROR,
            `${titles.length} <title> tags found — a page must have exactly one.`,
            "Remove the extra title tags so only one remains."
          )
        );
      }
    }

    // --- Meta description (HTML only) ---
    const meta = extractMetaContent(raw, "name", "description");
    if (meta === null) {
      checks.push(
        check(
          "meta-description",
          "Meta description",
          SEVERITY.WARNING,
          "No meta description found.",
          "Add a meta description of 120–160 characters that sells the click."
        )
      );
    } else if (meta.length < 120) {
      checks.push(
        check(
          "meta-description",
          "Meta description",
          SEVERITY.WARNING,
          `Meta description is ${meta.length} characters — shorter than the 120–160 character range.`,
          "Expand the meta description to 120–160 characters with a clear benefit and a call to action."
        )
      );
    } else if (meta.length > 160) {
      checks.push(
        check(
          "meta-description",
          "Meta description",
          SEVERITY.WARNING,
          `Meta description is ${meta.length} characters — longer than 160, so it will be truncated.`,
          "Trim the meta description to 160 characters or fewer."
        )
      );
    } else {
      checks.push(
        check(
          "meta-description",
          "Meta description",
          SEVERITY.PASS,
          `Meta description is ${meta.length} characters — inside the 120–160 range.`,
          ""
        )
      );
    }

    // --- H1 (HTML only) ---
    const h1s = extractTagContent(raw, "h1");
    if (h1s.length === 0) {
      checks.push(
        check(
          "h1",
          "H1 heading",
          SEVERITY.ERROR,
          "No H1 heading found.",
          "Add exactly one H1 that states the page topic in plain words."
        )
      );
    } else if (h1s.length > 1) {
      checks.push(
        check(
          "h1",
          "H1 heading",
          SEVERITY.ERROR,
          `${h1s.length} H1 headings found — a page should have exactly one.`,
          "Keep the main H1 and change the others to H2."
        )
      );
    } else {
      checks.push(
        check(
          "h1",
          "H1 heading",
          SEVERITY.PASS,
          `One H1 found: “${h1s[0].slice(0, 80)}${h1s[0].length > 80 ? "…" : ""}”.`,
          ""
        )
      );
    }

    // --- Heading hierarchy (HTML only) ---
    const levels = [];
    const headingRe = /<(h[1-6])\b[^>]*>/gi;
    let hm;
    while ((hm = headingRe.exec(raw)) !== null) levels.push(Number(hm[1][1]));
    let skipped = false;
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        skipped = true;
        break;
      }
    }
    if (levels.length === 0) {
      checks.push(
        check(
          "headings",
          "Heading structure",
          SEVERITY.WARNING,
          "No headings found at all.",
          "Break the content into sections with H2/H3 headings so readers and search engines can scan it."
        )
      );
    } else if (skipped) {
      checks.push(
        check(
          "headings",
          "Heading structure",
          SEVERITY.WARNING,
          "Heading levels are skipped (for example H2 straight to H4).",
          "Nest headings in order — H2, then H3 under it — instead of jumping levels."
        )
      );
    } else {
      checks.push(
        check(
          "headings",
          "Heading structure",
          SEVERITY.PASS,
          `${levels.length} headings, nested in order.`,
          ""
        )
      );
    }

    // --- Links (HTML only) ---
    const links = extractLinks(raw);
    const internal = links.filter(
      (href) =>
        href.startsWith("/") ||
        href.startsWith("#") ||
        (!/^https?:\/\//i.test(href) && !href.startsWith("mailto:") && !href.startsWith("tel:"))
    );
    const external = links.filter((href) => /^https?:\/\//i.test(href));
    if (internal.length === 0) {
      checks.push(
        check(
          "internal-links",
          "Internal links",
          SEVERITY.WARNING,
          "No internal links found.",
          "Link to 2–3 relevant pages on the same site so visitors and crawlers can move around."
        )
      );
    } else {
      checks.push(
        check(
          "internal-links",
          "Internal links",
          SEVERITY.PASS,
          `${internal.length} internal link${internal.length === 1 ? "" : "s"} found.`,
          ""
        )
      );
    }
    checks.push(
      check(
        "external-links",
        "External links",
        SEVERITY.INFO,
        `${external.length} external link${external.length === 1 ? "" : "s"} found.`,
        ""
      )
    );

    // --- Images (HTML only) ---
    const images = extractImages(raw);
    const missingAlt = images.filter((img) => !img.hasAlt).length;
    if (images.length === 0) {
      checks.push(
        check(
          "images",
          "Images",
          SEVERITY.INFO,
          "No images found on the page.",
          ""
        )
      );
    } else if (missingAlt > 0) {
      checks.push(
        check(
          "images",
          "Image alt text",
          SEVERITY.WARNING,
          `${missingAlt} of ${images.length} image${images.length === 1 ? "" : "s"} ${missingAlt === 1 ? "has" : "have"} no alt text.`,
          "Add short descriptive alt text to every image — it helps accessibility and image search."
        )
      );
    } else {
      checks.push(
        check(
          "images",
          "Image alt text",
          SEVERITY.PASS,
          `All ${images.length} image${images.length === 1 ? " has" : "s have"} alt text.`,
          ""
        )
      );
    }
  } else {
    checks.push(
      check(
        "html-only",
        "HTML checks skipped",
        SEVERITY.INFO,
        "Plain text was pasted, so title, headings, links and image checks need the page HTML.",
        "Paste the page's HTML (View Source > copy) to run the full audit."
      )
    );
  }

  // --- Word count (always) ---
  if (wordCount === 0) {
    checks.push(
      check(
        "word-count",
        "Word count",
        SEVERITY.ERROR,
        "No readable text found.",
        "Paste the page content or HTML to audit it."
      )
    );
  } else if (wordCount < 300) {
    checks.push(
      check(
        "word-count",
        "Word count",
        SEVERITY.WARNING,
        `${wordCount} words — thin content for a page that should rank.`,
        "Aim for at least 300 words of genuinely useful content; 600+ is better for competitive topics."
      )
    );
  } else if (wordCount < 600) {
    checks.push(
      check(
        "word-count",
        "Word count",
        SEVERITY.PASS,
        `${wordCount} words — a reasonable length.`,
        ""
      )
    );
  } else {
    checks.push(
      check(
        "word-count",
        "Word count",
        SEVERITY.PASS,
        `${wordCount} words — substantial content.`,
        ""
      )
    );
  }

  // --- Readability (always, needs enough text) ---
  const flesch = fleschReadingEase(text);
  if (flesch === null || wordCount < 30) {
    checks.push(
      check(
        "readability",
        "Readability",
        SEVERITY.INFO,
        "Not enough text to measure readability.",
        ""
      )
    );
  } else if (flesch < 30) {
    checks.push(
      check(
        "readability",
        "Readability",
        SEVERITY.WARNING,
        `Flesch Reading Ease ${flesch} — very hard to read.`,
        "Shorten sentences and swap long words for plain ones; aim for a Flesch score of 50 or higher."
      )
    );
  } else if (flesch < 50) {
    checks.push(
      check(
        "readability",
        "Readability",
        SEVERITY.WARNING,
        `Flesch Reading Ease ${flesch} — fairly difficult.`,
        "Break up long sentences and paragraphs to make the page easier to scan."
      )
    );
  } else {
    checks.push(
      check(
        "readability",
        "Readability",
        SEVERITY.PASS,
        `Flesch Reading Ease ${flesch} — easy to read.`,
        ""
      )
    );
  }

  // --- Target keyword (optional) ---
  const keyword = targetKeyword.trim().toLowerCase();
  if (keyword) {
    const lower = text.toLowerCase();
    let count = 0;
    let idx = lower.indexOf(keyword);
    while (idx !== -1) {
      count++;
      idx = lower.indexOf(keyword, idx + keyword.length);
    }
    const density = wordCount > 0 ? (count / wordCount) * 100 : 0;
    if (count === 0) {
      checks.push(
        check(
          "keyword",
          `Target keyword “${targetKeyword.trim()}”`,
          SEVERITY.ERROR,
          "The target keyword does not appear in the content at all.",
          "Use the keyword naturally in the H1, the first paragraph and once or twice more in the body."
        )
      );
    } else if (density > 3) {
      checks.push(
        check(
          "keyword",
          `Target keyword “${targetKeyword.trim()}”`,
          SEVERITY.WARNING,
          `Keyword appears ${count} times (${density.toFixed(1)}% density) — overuse reads as stuffing.`,
          "Cut some repetitions and use related words and synonyms instead."
        )
      );
    } else {
      checks.push(
        check(
          "keyword",
          `Target keyword “${targetKeyword.trim()}”`,
          SEVERITY.PASS,
          `Keyword appears ${count} time${count === 1 ? "" : "s"} (${density.toFixed(1)}% density) — natural usage.`,
          ""
        )
      );
    }
  }

  // --- Score ---
  let score = 100;
  for (const c of checks) score -= SCORE_PENALTY[c.severity];
  score = Math.max(0, score);

  const errors = checks.filter((c) => c.severity === SEVERITY.ERROR).length;
  const warnings = checks.filter((c) => c.severity === SEVERITY.WARNING).length;
  const summary = `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"} across ${checks.length} checks.`;

  return {
    score,
    grade: gradeFor(score),
    isHtml,
    wordCount,
    pageUrl,
    targetKeyword: targetKeyword.trim(),
    checks,
    summary,
  };
}
