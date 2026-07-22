/**
 * Module-level dashboard cache.
 * Survives React route changes (unlike useState), cleared on page reload.
 * Invalidated explicitly when a scan is triggered/completes.
 */

const _cache = {
  recentScans:  null,
  asvsSummary:  null,
  notifications: null,
  dirty:        true,   // true = must re-fetch on next dashboard visit
};

export function getDashboardCache() {
  return _cache;
}

export function setDashboardCache(data) {
  Object.assign(_cache, data, { dirty: false });
  // Mirror to localStorage so a hard-reload still gets instant first paint
  try {
    if (data.recentScans)   localStorage.setItem("dc_recentScans",   JSON.stringify(data.recentScans));
    if (data.asvsSummary)   localStorage.setItem("dc_asvsSummary",   JSON.stringify(data.asvsSummary));
    if (data.notifications) localStorage.setItem("dc_notifications", JSON.stringify(data.notifications));
  } catch {}
}

export function markDashboardDirty() {
  _cache.dirty = true;
}

/** Load localStorage into the in-memory cache on first import (page reload). */
(function hydrateFromStorage() {
  try {
    const r  = localStorage.getItem("dc_recentScans");
    const s  = localStorage.getItem("dc_asvsSummary");
    const n  = localStorage.getItem("dc_notifications");
    if (r)  _cache.recentScans   = JSON.parse(r);
    if (s)  _cache.asvsSummary   = JSON.parse(s);
    if (n)  _cache.notifications = JSON.parse(n);
    // After reload, treat cache as dirty so fresh data is fetched in background
    _cache.dirty = true;
  } catch {}
})();

// Listen for invalidation events dispatched by ScanPage
window.addEventListener("vulcan:scan-started",   markDashboardDirty);
window.addEventListener("vulcan:scan-completed", markDashboardDirty);
