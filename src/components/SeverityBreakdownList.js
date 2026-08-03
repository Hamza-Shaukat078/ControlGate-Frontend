import React from "react";

const ROWS = [
  { key: "critical", label: "Critical", color: "var(--v-fail)", weight: 800 },
  { key: "high",     label: "High",     color: "var(--v-fail)", weight: 600 },
  { key: "medium",   label: "Medium",   color: "var(--v-manual)", weight: 700 },
  { key: "low",      label: "Low",      color: "var(--v-untested)", weight: 700 },
];

/**
 * Shared Critical/High/Medium/Low breakdown — used by the Open Findings
 * stat card and the Risk Distribution widget (same data shape).
 * Critical and High intentionally share --v-fail (red is reserved for
 * fail/critical only, never a second invented shade) and are told apart
 * by weight, not color.
 */
export default function SeverityBreakdownList({ counts = {}, showPercent = false }) {
  const total = ROWS.reduce((sum, r) => sum + (counts[r.key] || 0), 0);

  return (
    <ul className="severity-list">
      {ROWS.map((r) => {
        const count = counts[r.key] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={r.key} className="severity-row" style={{ borderLeftColor: r.color }}>
            <span className="severity-label">{r.label}</span>
            <span className="severity-count" style={{ color: r.color, fontWeight: r.weight }}>
              {count}
              {showPercent && <span className="severity-pct"> · {pct}%</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
