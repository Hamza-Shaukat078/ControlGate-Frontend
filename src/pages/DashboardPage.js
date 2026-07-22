// src/pages/DashboardPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { dashboardService, notificationService, asvsService } from "../api/services";
import { getDashboardCache, setDashboardCache, markDashboardDirty } from "../cache/dashboardCache";

const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;
const LEVEL_COLOR = { L1: "var(--level-l1)", L2: "var(--level-l2)", L3: "var(--level-l3)" };
const LEVEL_DESC = {
  L1: "Opportunistic — minimum baseline",
  L2: "Standard — most applications",
  L3: "Advanced — high-value / high-assurance",
};

function LevelRing({ level, data, loading }) {
  const pct = data?.pct ?? 0;
  const offset = RING_C - (RING_C * pct) / 100;
  return (
    <div className="card level-card">
      <div className="ring-wrap">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle className="ring-bg" cx="40" cy="40" r={RING_R} />
          <circle
            className="ring-fill"
            cx="40" cy="40" r={RING_R}
            stroke={LEVEL_COLOR[level]}
            strokeDasharray={RING_C}
            strokeDashoffset={loading ? RING_C : offset}
          />
        </svg>
        <div className="ring-label">
          <span className="pct">{loading ? "…" : `${pct}%`}</span>
          <span className="hint">{level}</span>
        </div>
      </div>
      <div className="level-meta">
        <div className="level-name">{level} completion</div>
        <div className="level-desc">{LEVEL_DESC[level]}</div>
        <div className="level-count">{loading ? "—" : `${data?.passed ?? 0} / ${data?.total ?? 0} controls passing`}</div>
      </div>
    </div>
  );
}

function ChapterTable({ chapters, loading, onOpenChapter }) {
  if (loading) {
    return <div className="empty-state">Loading chapter breakdown…</div>;
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Chapter</th>
          <th>Verdict breakdown</th>
          <th>Controls</th>
        </tr>
      </thead>
      <tbody>
        {chapters.map((ch) => {
          const c = ch.counts || {};
          const total = ch.control_count || 1;
          const seg = (n) => `${((n || 0) / total) * 100}%`;
          return (
            <tr key={ch.chapter_id} className="is-clickable" onClick={() => onOpenChapter(ch.chapter_id)}>
              <td>
                <div className="chapter-accordion-title">
                  <span className="chapter-accordion-id">{ch.chapter_id}</span>
                  <span className="chapter-accordion-name">{ch.title}</span>
                </div>
              </td>
              <td>
                <div className="chapter-bar-cell">
                  <div className="chapter-stackbar">
                    <span className="seg-pass" style={{ width: seg(c.pass) }} title={`Pass: ${c.pass || 0}`} />
                    <span className="seg-fail" style={{ width: seg(c.fail) }} title={`Fail: ${c.fail || 0}`} />
                    <span className="seg-na" style={{ width: seg(c.n_a) }} title={`N/A: ${c.n_a || 0}`} />
                    <span className="seg-manual" style={{ width: seg(c.manual_review) }} title={`Manual review: ${c.manual_review || 0}`} />
                    <span className="seg-untested" style={{ width: seg(c.not_tested) }} title={`Not tested: ${c.not_tested || 0}`} />
                  </div>
                </div>
              </td>
              <td>{ch.control_count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [recentScans, setRecentScans] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [asvsSummary, setAsvsSummary] = useState(null);
  const [asvsLoading, setAsvsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const cache = getDashboardCache();

    if (cache.recentScans)   { setRecentScans(cache.recentScans);   setLoading(false); }
    if (cache.notifications) { setNotifications(cache.notifications); }
    if (cache.asvsSummary)   { setAsvsSummary(cache.asvsSummary);   setAsvsLoading(false); }

    if (!cache.dirty && cache.asvsSummary) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetchAll = async () => {
      setError(null);
      if (!cache.asvsSummary) setLoading(true);
      else setRefreshing(true);

      try {
        const [recentRes, notifRes, complianceRes] = await Promise.allSettled([
          dashboardService.getRecentScans(),
          notificationService.getNotifications(1, 10),
          asvsService.getComplianceSummary(localStorage.getItem("lastScanId") || "latest"),
        ]);

        const updates = {};

        if (recentRes.status === "fulfilled") {
          updates.recentScans = recentRes.value.data || [];
          if (mounted) setRecentScans(updates.recentScans);
        }
        if (notifRes.status === "fulfilled") {
          const d = notifRes.value.data;
          updates.notifications = d?.items || d || [];
          if (mounted) setNotifications(updates.notifications);
        }
        if (complianceRes.status === "fulfilled") {
          updates.asvsSummary = complianceRes.value;
          if (mounted) { setAsvsSummary(updates.asvsSummary); setAsvsLoading(false); }
        } else if (mounted) {
          setAsvsLoading(false);
        }

        setDashboardCache(updates);
      } catch (err) {
        if (mounted) setError(err?.userMessage || "Failed to load dashboard data.");
      } finally {
        if (mounted) { setLoading(false); setRefreshing(false); }
      }
    };

    fetchAll();

    const onInvalidate = () => { markDashboardDirty(); fetchAll(); };
    window.addEventListener("vulcan:scan-started", onInvalidate);
    window.addEventListener("vulcan:scan-completed", onInvalidate);

    return () => {
      mounted = false;
      window.removeEventListener("vulcan:scan-started", onInvalidate);
      window.removeEventListener("vulcan:scan-completed", onInvalidate);
    };
  }, []);

  const handleScanNow = () => navigate("/scan");
  const handleOpenChapter = (chapterId) => navigate(`/controls?chapter=${chapterId}`);

  const levels = asvsSummary?.levels || {};
  const chapters = asvsSummary?.chapters || [];

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="icon">⚠</div>
          <div style={{ marginBottom: "1rem" }}>{error}</div>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="v-dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">ASVS 5.0.0 Level 1 compliance overview across all 15 chapters.</p>
      </div>
      {refreshing && <div className="v-refreshing">Syncing latest data…</div>}

      <div className="compliance-levels">
        {["L1", "L2", "L3"].map((level) => (
          <LevelRing key={level} level={level} data={levels[level]} loading={asvsLoading} />
        ))}
      </div>

      <div className="v-row">
        <section className="card v-card-wide chapter-table-wrap">
          <header className="v-card-header">
            <h2>Chapters</h2>
            <button type="button" className="btn-ghost btn" onClick={() => navigate("/controls")}>View all controls</button>
          </header>
          <ChapterTable chapters={chapters} loading={asvsLoading} onOpenChapter={handleOpenChapter} />
        </section>

        <section className="stack gap-md" style={{ gridColumn: "span 1" }}>
          <div className="card">
            <header className="v-card-header"><h2>Recent Scans</h2></header>
            <div className="v-recent-list">
              {loading ? (
                <div className="empty-state">Loading…</div>
              ) : recentScans.length > 0 ? (
                recentScans.slice(0, 5).map((scan, idx) => (
                  <div
                    key={idx}
                    className="v-recent-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/graphs?scanId=${scan.scan_id || scan.id}&fileId=main`)}
                  >
                    <div className="v-recent-left">
                      <span className="v-recent-icon">↗</span>
                      <div>
                        <p className="v-recent-title">{scan.repository_name || scan.repo_id || scan.scan_id || "Scan"}</p>
                        <p className="v-recent-sub">
                          {scan.created_at ? new Date(scan.created_at).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p style={{ margin: "0 0 0.75rem" }}>No scans yet</p>
                  <button type="button" className="btn btn-primary" onClick={handleScanNow}>Run your first scan</button>
                </div>
              )}
            </div>
          </div>

          <div className="card quick-links">
            <header className="v-card-header" style={{ padding: 0, border: "none", marginBottom: "0.25rem" }}><h2>Quick actions</h2></header>
            <button type="button" className="quick-link-btn" onClick={handleScanNow}>Run a verification scan →</button>
            <button type="button" className="quick-link-btn" onClick={() => navigate("/controls")}>Browse control catalog →</button>
            <button type="button" className="quick-link-btn" onClick={() => navigate("/attestation")}>Manual attestation →</button>
            <button type="button" className="quick-link-btn" onClick={() => navigate("/reports")}>Export compliance report →</button>
          </div>
        </section>
      </div>

      <div className="card">
        <header className="v-card-header"><h2>Notifications</h2></header>
        <ul className="v-notifications">
          {notifications.length > 0 ? (
            notifications.slice(0, 4).map((n, i) => (
              <li key={i}>
                {n.message || n.title || n}
                {n.created_at && (
                  <span style={{ color: "var(--t-text-dim)", marginLeft: "0.5rem", fontSize: "0.78rem" }}>
                    {new Date(n.created_at).toLocaleTimeString()}
                  </span>
                )}
              </li>
            ))
          ) : (
            <li style={{ color: "var(--t-text-dim)" }}>No notifications</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default DashboardPage;
