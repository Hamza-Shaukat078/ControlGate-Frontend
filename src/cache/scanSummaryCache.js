/**
 * Safe, capped localStorage cache for scan summaries.
 *
 * ScanPage writes `scan_<scanId>` on completion so a page reload gets
 * instant data instead of a network round-trip. Nothing ever evicted those
 * keys, so localStorage usage grew by one full scan summary (vulnerabilities
 * + code snippets + LLM explanations) forever, eventually blowing the
 * browser's per-origin quota and crashing the app with an uncaught
 * QuotaExceededError from inside the WebSocket handler.
 *
 * setScanSummaryCache() keeps only the MAX_ENTRIES most recently written
 * scans, evicting the oldest first, and never throws — if storage is still
 * full after evicting everything this cache tracks, the write is skipped
 * rather than crashing the page. The scan data itself always lives in
 * MongoDB regardless; this is a best-effort read-through cache only.
 */
const INDEX_KEY = "scan_cache_index";
const MAX_ENTRIES = 5;
const KEY_PREFIX = "scan_";

function readIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(index) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* best-effort */
  }
}

function evictOldest(count) {
  const index = readIndex();
  for (let i = 0; i < count && index.length > 0; i++) {
    const oldestId = index.shift();
    try {
      localStorage.removeItem(`${KEY_PREFIX}${oldestId}`);
    } catch {
      /* best-effort */
    }
  }
  writeIndex(index);
}

/**
 * Last-resort eviction for `scan_*` keys written before this cache existed
 * (so they were never added to the index). Sweeps every localStorage key
 * directly rather than relying on the index at all.
 */
function evictAllUntrackedScanKeys(keepScanId) {
  try {
    const keepKey = `${KEY_PREFIX}${keepScanId}`;
    const staleKeys = Object.keys(localStorage).filter(
      (k) => k.startsWith(KEY_PREFIX) && k !== keepKey && k !== INDEX_KEY
    );
    for (const k of staleKeys) {
      localStorage.removeItem(k);
    }
  } catch {
    /* best-effort */
  }
}

export function setScanSummaryCache(scanId, summary) {
  if (!scanId) return;
  const key = `${KEY_PREFIX}${scanId}`;
  const serialized = JSON.stringify(summary);

  let index = readIndex().filter((id) => id !== scanId);
  index.push(scanId);
  while (index.length > MAX_ENTRIES) {
    const oldestId = index.shift();
    try {
      localStorage.removeItem(`${KEY_PREFIX}${oldestId}`);
    } catch {
      /* best-effort */
    }
  }

  try {
    localStorage.setItem(key, serialized);
    writeIndex(index);
    return;
  } catch (err) {
    // Quota already hit even after our own eviction above (e.g. another
    // large item is sharing the origin's quota, or pre-existing scan_* keys
    // from before this cache module existed) -- evict progressively harder
    // and retry before giving up silently.
    for (const evictCount of [MAX_ENTRIES, MAX_ENTRIES * 2]) {
      evictOldest(evictCount);
      try {
        localStorage.setItem(key, serialized);
        writeIndex(readIndex().filter((id) => id !== scanId).concat(scanId));
        return;
      } catch {
        // keep trying with a harder eviction, or fall through below
      }
    }
    evictAllUntrackedScanKeys(scanId);
    try {
      localStorage.setItem(key, serialized);
      writeIndex([scanId]);
      return;
    } catch (finalErr) {
      console.warn(`Could not cache scan ${scanId} locally (storage quota); continuing without cache.`, finalErr);
    }
  }
}

export function getScanSummaryCache(scanId) {
  if (!scanId) return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${scanId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
