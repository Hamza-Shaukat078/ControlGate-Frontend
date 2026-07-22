// ASVS 5.0.0 Level 1 catalog loader.
//
// Source of truth for `controls`/`chapters` is the same 70-control ASVS
// 5.0.0 Level 1 catalog the backend loads into its asvs_controls collection
// (vulcan-backend/app/data/asvs_l1_controls.json), transformed into
// asvsControls.json / asvsChapters.json for the local fallback path only —
// this file is used when the live backend is unreachable. `asvsResults.json`
// holds a small set of illustrative sample verdicts; every control without a
// sample defaults to "not_tested" until a real backend scan or manual
// attestation supplies a verdict.
import controls from "./asvsControls.json";
import chapters from "./asvsChapters.json";
import seedResults from "./asvsResults.json";

export const ASVS_LEVELS = ["L1", "L2", "L3"];

export const VERDICTS = ["pass", "fail", "n_a", "manual_review", "not_tested"];

export function getControls() {
  return controls;
}

export function getChapters() {
  return chapters;
}

export function getControlsByChapter(chapterId) {
  return controls.filter((c) => c.chapter_id === chapterId);
}

// Attestation answers persisted in localStorage (see attestationService) take
// precedence over the seed verdict for any control they cover.
function getAttestationOverrides() {
  try {
    const raw = localStorage.getItem("vulcan_attestations");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getResult(controlId) {
  const overrides = getAttestationOverrides();
  if (overrides[controlId]) {
    const a = overrides[controlId];
    return {
      control_id: controlId,
      verdict: a.answer,
      confidence: null,
      evidence: a.evidence_url ? [{ note: a.evidence_url }] : [],
      llm_explanation: null,
      reviewed_by: a.attested_by,
      reviewed_at: a.timestamp,
    };
  }
  return seedResults[controlId] || {
    control_id: controlId,
    verdict: "not_tested",
    confidence: null,
    evidence: [],
    llm_explanation: null,
    reviewed_by: null,
    reviewed_at: null,
  };
}

export function getAllResults() {
  const overrides = getAttestationOverrides();
  const map = {};
  for (const c of controls) {
    map[c.control_id] = overrides[c.control_id]
      ? getResult(c.control_id)
      : seedResults[c.control_id] || getResult(c.control_id);
  }
  return map;
}

/** Per-chapter verdict counts + control count, for the dashboard/chapter list. */
export function getChapterSummaries() {
  const results = getAllResults();
  return chapters.map((chapter) => {
    const chapterControls = getControlsByChapter(chapter.chapter_id);
    const counts = { pass: 0, fail: 0, n_a: 0, manual_review: 0, not_tested: 0 };
    for (const c of chapterControls) {
      const v = results[c.control_id]?.verdict || "not_tested";
      counts[v] = (counts[v] || 0) + 1;
    }
    return { ...chapter, control_count: chapterControls.length, counts };
  });
}

/** Overall completion % per ASVS level: share of that level's controls with a pass verdict. */
export function getLevelCompletion() {
  const results = getAllResults();
  const out = {};
  for (const level of ASVS_LEVELS) {
    const applicable = controls.filter((c) => levelIncludes(c.level, level));
    const passed = applicable.filter((c) => results[c.control_id]?.verdict === "pass");
    out[level] = {
      total: applicable.length,
      passed: passed.length,
      pct: applicable.length ? Math.round((passed.length / applicable.length) * 100) : 0,
    };
  }
  return out;
}

// A control tagged L1 is required at L2/L3 too; L2 is required at L3.
function levelIncludes(controlLevel, targetLevel) {
  const order = { L1: 1, L2: 2, L3: 3 };
  return order[controlLevel] <= order[targetLevel];
}

export function getManualAttestationControls() {
  return controls.filter((c) => c.detection_strategy === "manual_attestation");
}
