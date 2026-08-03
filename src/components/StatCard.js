import React from "react";

/** Dense stat-card wrapper for the Dashboard's top hero row. */
export default function StatCard({ title, value, subtitle, icon, accentColor, children }) {
  return (
    <div className="card stat-card-hero">
      <div className="stat-card-head">
        {icon && <span className="stat-card-icon" style={accentColor ? { color: accentColor } : undefined}>{icon}</span>}
        <span className="report-stat-label">{title}</span>
      </div>
      {children ? (
        children
      ) : (
        <>
          <div className="report-stat-value" style={accentColor ? { color: accentColor } : undefined}>{value}</div>
          {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        </>
      )}
    </div>
  );
}
