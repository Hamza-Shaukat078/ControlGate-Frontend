import React from "react";

/**
 * Shimmering placeholder for loading states. Mirrors the shape of the
 * content it stands in for (rows, cards, or a single text/block bar)
 * so nothing jumps once real data replaces it.
 */
export default function Skeleton({ variant = "text", rows = 3, height, width, className = "" }) {
  if (variant === "rows") {
    return (
      <div className={`skeleton-stack ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton skeleton-row" />
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className={`skeleton-cards ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton skeleton-block ${className}`}
      style={{ height: height || "1em", width: width || "100%" }}
    />
  );
}
