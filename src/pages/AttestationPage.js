// src/pages/AttestationPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import "../App.css";
import { attestationService } from "../api/services";
import { getManualAttestationControls } from "../data/asvsCatalog";
import { getCurrentUser } from "../api/client";

export default function AttestationPage() {
  const [attestations, setAttestations] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [chapterFilter, setChapterFilter] = useState("all");

  const controls = useMemo(() => getManualAttestationControls(), []);
  const chapters = useMemo(
    () => [...new Set(controls.map((c) => c.chapter_id))],
    [controls]
  );

  useEffect(() => {
    let mounted = true;
    attestationService.list().then((data) => {
      if (mounted) { setAttestations(data || {}); setLoading(false); }
    });
    return () => { mounted = false; };
  }, []);

  const visibleControls = chapterFilter === "all"
    ? controls
    : controls.filter((c) => c.chapter_id === chapterFilter);

  const handleAnswer = async (control, answer) => {
    setSavingId(control.control_id);
    const user = getCurrentUser();
    const existing = attestations[control.control_id];
    const record = await attestationService.submit(control.control_id, {
      answer,
      evidence_url: existing?.evidence_url || null,
      attested_by: user?.full_name || user?.email || "current user",
    });
    setAttestations((prev) => ({ ...prev, [control.control_id]: record }));
    setSavingId(null);
  };

  const handleEvidence = async (control, file) => {
    if (!file) return;
    const { evidence_url } = await attestationService.uploadEvidence(control.control_id, file);
    const existing = attestations[control.control_id];
    const user = getCurrentUser();
    const record = await attestationService.submit(control.control_id, {
      answer: existing?.answer || "n_a",
      evidence_url,
      attested_by: user?.full_name || user?.email || "current user",
    });
    setAttestations((prev) => ({ ...prev, [control.control_id]: record }));
  };

  const attestedCount = Object.keys(attestations).filter((id) => controls.some((c) => c.control_id === id)).length;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Manual Attestation</h1>
        <p className="page-subtitle">
          {controls.length} controls require manual attestation (Architecture &amp; Business Logic —
          no automated detection path exists for these). {attestedCount} / {controls.length} reviewed.
        </p>
      </div>

      <div className="controls-toolbar">
        <select className="input filter-select" value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}>
          <option value="all">All chapters</option>
          {chapters.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty-state">Loading attestation checklist…</div>
      ) : (
        <div className="attestation-list">
          {visibleControls.map((control) => {
            const a = attestations[control.control_id];
            const answer = a?.answer;
            return (
              <div className="card attestation-card" key={control.control_id}>
                <div className="attestation-top">
                  <div>
                    <div className="attestation-id-row">
                      <span className="chapter-accordion-id">{control.control_id}</span>
                      <span className={`badge badge-level-${control.level}`}>{control.level}</span>
                    </div>
                    <p className="attestation-desc">{control.description}</p>
                  </div>
                  <div className="attestation-controls">
                    <div className="tri-toggle">
                      <button
                        type="button"
                        className={answer === "pass" ? "active-pass" : ""}
                        disabled={savingId === control.control_id}
                        onClick={() => handleAnswer(control, "pass")}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        className={answer === "fail" ? "active-fail" : ""}
                        disabled={savingId === control.control_id}
                        onClick={() => handleAnswer(control, "fail")}
                      >
                        Fail
                      </button>
                      <button
                        type="button"
                        className={answer === "n_a" ? "active-n_a" : ""}
                        disabled={savingId === control.control_id}
                        onClick={() => handleAnswer(control, "n_a")}
                      >
                        N/A
                      </button>
                    </div>
                    {a?.attested_by && (
                      <div className="attestation-meta">
                        by {a.attested_by} · {new Date(a.timestamp).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="attestation-evidence-row">
                  <Paperclip size={14} color="var(--t-text-dim)" />
                  <label className="attestation-file-label">
                    {a?.evidence_url ? `Evidence: ${a.evidence_url}` : "Attach evidence"}
                    <input
                      type="file"
                      style={{ display: "none" }}
                      onChange={(e) => handleEvidence(control, e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
