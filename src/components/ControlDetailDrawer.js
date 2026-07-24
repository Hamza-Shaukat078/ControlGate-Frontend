// src/components/ControlDetailDrawer.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

const STRATEGY_LABEL = {
  static_code: "Static code analysis",
  config_inspection: "Configuration inspection",
  dependency_scan: "Dependency / SBOM scan",
  dynamic_probe: "Dynamic probe",
  manual_attestation: "Manual attestation",
};

const VERDICT_LABEL = {
  pass: "Pass",
  fail: "Fail",
  n_a: "Not applicable",
  manual_review: "Manual review",
  not_tested: "Not tested",
};

export default function ControlDetailDrawer({ control, result, onClose }) {
  const navigate = useNavigate();
  if (!control) return null;

  const isManual = control.detection_strategy === "manual_attestation";

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="chapter-accordion-id" style={{ marginBottom: "0.5rem", display: "inline-block" }}>
              {control.control_id}
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <span className={`badge badge-level-${control.level}`}>{control.level}</span>
              <span className={`badge badge-${result?.verdict || "not_tested"}`}>
                {VERDICT_LABEL[result?.verdict || "not_tested"]}
              </span>
              <span className="badge badge-strategy">{STRATEGY_LABEL[control.detection_strategy]}</span>
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div>
            <div className="drawer-section-label">{control.chapter}</div>
            <p className="control-detail-desc">{control.description}</p>
          </div>

          <div className="control-detail-meta-grid">
            <div className="control-meta-item">
              <span className="control-meta-label">Section</span>
              <span>{control.section_name}</span>
            </div>
            <div className="control-meta-item">
              <span className="control-meta-label">Confidence</span>
              <span>{result?.confidence != null ? `${Math.round(result.confidence * 100)}%` : "—"}</span>
            </div>
            {control.cwe && (
              <div className="control-meta-item">
                <span className="control-meta-label">CWE</span>
                <span>{control.cwe}</span>
              </div>
            )}
            {result?.reviewed_by && (
              <div className="control-meta-item">
                <span className="control-meta-label">Reviewed by</span>
                <span>{result.reviewed_by}</span>
              </div>
            )}
          </div>

          {isManual ? (
            <div>
              <div className="drawer-section-label">Verification path</div>
              <p className="explanation-box">
                This control is verified through the manual attestation workflow, not automated
                detection — it covers architecture, design, and business-logic requirements that
                can't be reduced to a code pattern.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: "0.75rem" }}
                onClick={() => navigate(`/attestation?control=${control.control_id}`)}
              >
                Go to attestation →
              </button>
            </div>
          ) : (
            <>
              <div>
                <div className="drawer-section-label">Evidence</div>
                {result?.evidence?.length > 0 ? (
                  result.evidence.map((ev, i) => (
                    <div className="evidence-item" key={i}>
                      {ev.file && (
                        <div>
                          <span className="evidence-file">{ev.file}{ev.line ? `:${ev.line}` : ""}</span>
                        </div>
                      )}
                      {ev.note && <div style={{ marginTop: ev.file ? "0.3rem" : 0 }}>{ev.note}</div>}
                    </div>
                  ))
                ) : (
                  <div className="explanation-box">No evidence recorded yet — this control hasn't been evaluated by a scan.</div>
                )}
              </div>

              {result?.llm_explanation && (
                <div>
                  <div className="drawer-section-label">Analysis</div>
                  <p className="explanation-box">{result.llm_explanation}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
