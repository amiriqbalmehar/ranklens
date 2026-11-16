/**
 * storage.js — local audit history (localStorage).
 *
 * The primary store for past audits. Cloud sync (Firestore) is optional
 * and best-effort — see firebase.js saveAuditToCloud(). Nothing here
 * needs a network connection.
 */

const STORAGE_KEY = "ranklens.auditHistory.v1";
const MAX_ENTRIES = 20;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToHistory(record) {
  const history = loadHistory();
  history.unshift({ ...record, savedAt: new Date().toISOString() });
  const trimmed = history.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable (private mode) — history is a
    // nice-to-have, never a blocker.
  }
  return trimmed;
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
