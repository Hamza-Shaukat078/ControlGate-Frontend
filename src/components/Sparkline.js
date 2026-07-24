// src/components/Sparkline.js
import React, { useId } from "react";

/** Tiny inline-SVG trend line for a series of 0-100 percentages. */
export default function Sparkline({ values, width = 100, height = 32, color }) {
  const gradientId = `spark-fill-${useId()}`;

  if (!values || values.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", fontSize: "0.7rem", color: "var(--t-text-dim)" }}>
        Not enough history
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  });

  const delta = values[values.length - 1] - values[0];
  const lineColor = color || (delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#64748b");
  const path = points.map((p) => p.join(",")).join(" ");
  const last = points[points.length - 1];
  const areaPath = `M${points[0][0]},${height} L${path} L${last[0]},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <polyline points={path} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="5" fill={lineColor} opacity="0.22" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={lineColor} />
    </svg>
  );
}
