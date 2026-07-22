// src/pages/ReportsPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { asvsService } from "../api/services";

const VERDICT_ORDER = ["pass", "fail", "n_a", "manual_review", "not_tested"];
const VERDICT_LABEL = {
  pass: "Pass", fail: "Fail", n_a: "N/A", manual_review: "Manual review", not_tested: "Not tested",
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportMessage, setExportMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const scanId = localStorage.getItem("lastScanId") || "latest";
    asvsService.getComplianceSummary(scanId).then((data) => {
      if (mounted) { setSummary(data); setLoading(false); }
    });
    return () => { mounted = false; };
  }, []);

  const handleExportPDF = async () => {
    setExporting(true);
    setExportMessage("");
    try {
      const scanId = localStorage.getItem("lastScanId") || "latest";
      const res = await asvsService.exportCompliancePDF(scanId);
      const blob = res.data || res;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `controlgate-asvs-compliance-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportMessage("PDF export requires the /export/asvs-report backend endpoint — not yet available in this environment.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="page"><div className="empty-state">Compiling compliance report…</div></div>;
  }

  const chapters = summary?.chapters || [];
  const levels = summary?.levels || {};
  const totals = chapters.reduce(
    (acc, ch) => {
      const c = ch.counts || {};
      VERDICT_ORDER.forEach((v) => { acc[v] = (acc[v] || 0) + (c[v] || 0); });
      acc.total += ch.control_count || 0;
      return acc;
    },
    { total: 0 }
  );

  return (
    <div className="page">
      <div className="page-header row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Compliance Report</h1>
          <p className="page-subtitle">ASVS 5.0.0 Level 1 verification status, evidence, and level completion.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleExportPDF} disabled={exporting}>
          {exporting ? "Generating…" : "Export PDF"}
        </button>
      </div>

      {exportMessage && (
        <div className="lp-alert lp-alert-error" style={{ marginBottom: "1rem" }}>{exportMessage}</div>
      )}

      <div className="report-summary-grid">
        <div className="card report-stat-card">
          <div className="report-stat-label">Total controls</div>
          <div className="report-stat-value">{totals.total}</div>
        </div>
        <div className="card report-stat-card">
          <div className="report-stat-label" style={{ color: "var(--v-pass)" }}>Pass</div>
          <div className="report-stat-value" style={{ color: "var(--v-pass)" }}>{totals.pass || 0}</div>
        </div>
        <div className="card report-stat-card">
          <div className="report-stat-label" style={{ color: "var(--v-fail)" }}>Fail</div>
          <div className="report-stat-value" style={{ color: "var(--v-fail)" }}>{totals.fail || 0}</div>
        </div>
        <div className="card report-stat-card">
          <div className="report-stat-label" style={{ color: "var(--v-untested)" }}>Not tested</div>
          <div className="report-stat-value" style={{ color: "var(--v-untested)" }}>{totals.not_tested || 0}</div>
        </div>
      </div>

      <div className="v-row" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: "1.5rem" }}>
        {["L1", "L2", "L3"].map((level) => (
          <div className="card" key={level} style={{ padding: "1.1rem 1.25rem" }}>
            <div className="report-stat-label">{level} completion</div>
            <div className="report-stat-value">{levels[level]?.pct ?? 0}%</div>
            <div className="pbar" style={{ marginTop: "0.6rem" }}>
              <div className="pbar-fill" style={{ width: `${levels[level]?.pct ?? 0}%` }} />
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--t-text-dim)", marginTop: "0.4rem" }}>
              {levels[level]?.passed ?? 0} / {levels[level]?.total ?? 0} passing
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
        <header className="v-card-header" style={{ padding: 0, border: "none", marginBottom: "0.75rem" }}>
          <h2>Per-chapter breakdown</h2>
        </header>
        {chapters.map((ch) => {
          const c = ch.counts || {};
          const total = ch.control_count || 1;
          const seg = (n) => `${((n || 0) / total) * 100}%`;
          return (
            <div className="report-chapter-row" key={ch.chapter_id}>
              <span className="chapter-accordion-id">{ch.chapter_id}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>{ch.title}</div>
                <div className="chapter-stackbar">
                  <span className="seg-pass" style={{ width: seg(c.pass) }} />
                  <span className="seg-fail" style={{ width: seg(c.fail) }} />
                  <span className="seg-na" style={{ width: seg(c.n_a) }} />
                  <span className="seg-manual" style={{ width: seg(c.manual_review) }} />
                  <span className="seg-untested" style={{ width: seg(c.not_tested) }} />
                </div>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(`/controls?chapter=${ch.chapter_id}`)}>
                View →
              </button>
            </div>
          );
        })}
        <div className="report-legend">
          {VERDICT_ORDER.map((v) => (
            <span key={v}>
              <span className="report-legend-dot" style={{ background: `var(--v-${v === "n_a" ? "na" : v === "manual_review" ? "manual" : v === "not_tested" ? "untested" : v})` }} />
              {VERDICT_LABEL[v]} ({totals[v] || 0})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
