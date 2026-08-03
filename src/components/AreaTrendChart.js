import React, { useId, useRef, useState } from "react";

/**
 * Hero area/line chart with hover crosshair + tooltip (dataviz skill:
 * crosshair finds the X, snaps to nearest point, tooltip value leads).
 * Separate from Sparkline on purpose — different contract (large,
 * interactive, axed) vs Sparkline's tiny fixed-size inline primitive.
 */
export default function AreaTrendChart({ points = [], height = 220, color = "var(--accent)", subtitle }) {
  const gradientId = `trend-fill-${useId()}`;
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!points || points.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-text-dim)", fontSize: "0.85rem" }}>
        Not enough scan history yet
      </div>
    );
  }

  const width = 720;
  const padX = 12;
  const padY = 16;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xy = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((p.value - min) / range) * (height - padY * 2);
    return [x, y];
  });

  const linePath = xy.map((p) => p.join(",")).join(" ");
  const areaPath = `M${xy[0][0]},${height - padY} L${linePath} L${xy[xy.length - 1][0]},${height - padY} Z`;

  const gridLines = [0.25, 0.5, 0.75].map((f) => padY + f * (height - padY * 2));

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    xy.forEach(([x], i) => {
      const d = Math.abs(x - relX);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hover = hoverIdx != null ? { point: points[hoverIdx], xy: xy[hoverIdx] } : null;

  return (
    <div className="trend-chart-wrap">
      {subtitle && <div className="trend-chart-subtitle">{subtitle}</div>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ display: "block", cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((y, i) => (
          <line key={i} x1={padX} y1={y} x2={width - padX} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <polyline points={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover && (
          <>
            <line
              x1={hover.xy[0]} y1={padY} x2={hover.xy[0]} y2={height - padY}
              stroke="var(--chart-crosshair)" strokeWidth="1" strokeDasharray="4 3"
            />
            <circle cx={hover.xy[0]} cy={hover.xy[1]} r="4" fill={color} stroke="var(--t-bg-card)" strokeWidth="2" />
          </>
        )}
      </svg>

      {hover && (
        <div
          className="trend-chart-tooltip"
          style={{
            left: `${(hover.xy[0] / width) * 100}%`,
            top: `${(hover.xy[1] / height) * 100}%`,
          }}
        >
          <div className="trend-chart-tooltip-value">{Math.round(hover.point.value)}%</div>
          <div className="trend-chart-tooltip-label">{hover.point.label}</div>
        </div>
      )}
    </div>
  );
}
