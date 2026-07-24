// Static OWASP ASVS 5.0.0 Level 1 catalog reference data — the same 70-control,
// 15-chapter catalog the backend loads into its asvs_controls collection
// (see the ControlGate backend's app/data/asvs_l1_controls.json). This module
// only holds catalog *text* (control IDs, descriptions, chapters); verdicts
// always come live from the backend (see asvsService in src/api/services.js).
import controls from "./asvsControls.json";

export function getManualAttestationControls() {
  return controls.filter((c) => c.detection_strategy === "manual_attestation");
}
