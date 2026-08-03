import React from "react";

/**
 * SVG radial progress gauge. Reuses the .ring-* classes already defined in
 * App.css (stroke-width 8, -90deg rotation convention) — this is the first
 * component to actually render them.
 */
export default function RadialGauge({
  value,
  size = 96,
  strokeWidth = 8,
  color = "var(--accent)",
  label,
  hint,
  trend,
}) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-bg" cx={center} cy={center} r={radius} style={{ strokeWidth }} />
        <circle
          className="ring-fill"
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          style={{ strokeWidth, strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <div className="ring-label">
        <span className="pct">{label ?? `${Math.round(clamped)}%`}</span>
        {hint && <span className="hint">{hint}</span>}
        {trend && (
          <span className="ring-trend" style={{ color: trend.direction === "down" ? "var(--v-fail)" : "var(--v-pass)" }}>
            {trend.direction === "down" ? "↓" : "↑"} {trend.text}
          </span>
        )}
      </div>
    </div>
  );
}
