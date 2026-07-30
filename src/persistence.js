/* ==============================================================
   LOCAL PERSISTENCE
   Until the real backend/import pipeline described in the SOP exists,
   the CRM's data lives in the browser. This keeps edits (and uploads)
   across refreshes instead of resetting to the seed data every time.
   ============================================================== */

const STORAGE_KEY = "lemo-crm:v1";

export function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.companies)) return null;
    return parsed;
  } catch {
    return null; // corrupted or blocked storage — fall back to seed data
  }
}

export function savePersisted(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable (e.g. private browsing) — edits still
    // work for the session, they just won't survive a refresh
  }
}

export function clearPersisted() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
