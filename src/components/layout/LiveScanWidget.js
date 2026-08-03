import React from "react";
import { useNavigate } from "react-router-dom";
import { useActiveScan } from "../../context/ActiveScanContext";
import RadialGauge from "../RadialGauge";

/** Pinned bottom-of-sidebar widget — only renders while a scan is running. */
export default function LiveScanWidget() {
  const navigate = useNavigate();
  const { scanning, scanId, repoName, progress, eta, currentFile } = useActiveScan();

  if (!scanning) return null;

  return (
    <div className="v-livescan">
      <div className="v-livescan-head">
        <span className="v-livescan-dot" />
        <span className="v-livescan-label">Live Scan</span>
      </div>
      <div className="v-livescan-name">{repoName || "Repository scan"}</div>
      <div className="v-livescan-id">{scanId}</div>
      <div className="v-livescan-body">
        <RadialGauge value={progress} size={48} strokeWidth={5} label={`${Math.round(progress)}%`} />
        <div className="v-livescan-detail">
          <div className="v-livescan-file">{currentFile ? `Scanning ${currentFile}` : "Scanning…"}</div>
          {eta && <div className="v-livescan-eta">ETA: {eta}</div>}
        </div>
      </div>
      <button type="button" className="btn btn-secondary v-livescan-btn" onClick={() => navigate("/scan")}>
        View Scan
      </button>
    </div>
  );
}
