// src/pages/DashboardPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { dashboardService, notificationService, asvsService } from "../api/services";
import { getDashboardCache, setDashboardCache, markDashboardDirty } from "../cache/dashboardCache";
import Sparkline from "../components/Sparkline";
import Skeleton from "../components/Skeleton";

function RepoCard({ repo, onViewReport, onRunScan }) {
  const neverScanned = repo.l1_pct === null;
  return (
    <div className="card repo-card">
      <div className="repo-card-top">
        <div>
          <div className="repo-card-name">{repo.repo_name}</div>
          <div className="repo-card-meta">
            {neverScanned
              ? "Never scanned"
              : `Last scanned ${new Date(repo.latest_scan_at).toLocaleString()} · ${repo.scan_count} scan${repo.scan_count === 1 ? "" : "s"}`}
          </div>
        </div>
        {!neverScanned && (
          <div className="repo-card-pct" style={{ color: repo.l1_pct >= 70 ? "var(--v-pass)" : repo.l1_pct >= 40 ? "var(--v-manual)" : "var(--v-fail)" }}>
            {repo.l1_pct}%
          </div>
        )}
      </div>

      {neverScanned ? (
        <div className="repo-card-empty">
          <p>No scan has been run against this repository yet.</p>
          <button type="button" className="btn btn-primary" onClick={() => onRunScan(repo.repo_id)}>Run first scan →</button>
        </div>
      ) : (
        <>
          <div className="chapter-stackbar" style={{ marginBottom: "0.6rem" }}>
            <span className="seg-pass" style={{ width: `${(repo.passed / repo.total) * 100}%` }} title={`${repo.passed} pass`} />
            <span className="seg-fail" style={{ width: `${(repo.fail_count / repo.total) * 100}%` }} title={`${repo.fail_count} fail`} />
            <span className="seg-untested" style={{ width: `${(repo.not_tested_count / repo.total) * 100}%` }} title={`${repo.not_tested_count} not tested`} />
          </div>
          <div className="repo-card-bottom">
            <div className="repo-card-counts">
              <span><i className="legend-dot" style={{ background: "var(--v-pass)" }} /><strong style={{ color: "var(--v-pass)" }}>{repo.passed}</strong> pass</span>
              <span><i className="legend-dot" style={{ background: "var(--v-fail)" }} /><strong style={{ color: "var(--v-fail)" }}>{repo.fail_count}</strong> fail</span>
              <span><i className="legend-dot" style={{ background: "var(--v-untested)" }} /><strong style={{ color: "var(--v-untested)" }}>{repo.not_tested_count}</strong> untested</span>
            </div>
            <Sparkline values={repo.trend.map((t) => t.pct)} />
          </div>
          <button type="button" className="btn btn-ghost repo-card-view-btn" onClick={() => onViewReport(repo.latest_scan_id)}>
            View report →
          </button>
        </>
      )}
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [recentScans, setRecentScans] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const cache = getDashboardCache();

    if (cache.recentScans)   { setRecentScans(cache.recentScans);   setLoading(false); }
    if (cache.notifications) { setNotifications(cache.notifications); }
    if (cache.portfolio)     { setPortfolio(cache.portfolio);       setPortfolioLoading(false); }

    if (!cache.dirty && cache.portfolio) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetchAll = async () => {
      setError(null);
      if (!cache.portfolio) setLoading(true);
      else setRefreshing(true);

      try {
        const [recentRes, notifRes, portfolioRes] = await Promise.allSettled([
          dashboardService.getRecentScans(),
          notificationService.getNotifications(1, 10),
          asvsService.getPortfolioDashboard(),
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
        if (portfolioRes.status === "fulfilled") {
          updates.portfolio = portfolioRes.value;
          if (mounted) { setPortfolio(updates.portfolio); setPortfolioLoading(false); }
        } else if (mounted) {
          setPortfolioLoading(false);
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
  const handleRunScan = (repoId) => navigate(`/scan?repoId=${repoId}`);
  const handleViewReport = (scanId) => {
    if (scanId) localStorage.setItem("lastScanId", scanId);
    navigate("/reports");
  };

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

  const repos = portfolio?.repos || [];
  const attestation = portfolio?.attestation_coverage || { answered: 0, total: 0, pct: 0 };
  const topRisks = portfolio?.top_failing_controls || [];

  return (
    <div className="v-dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          ASVS 5.0.0 Level 1 compliance across {portfolioLoading ? "…" : portfolio?.repo_count ?? 0} repositor{portfolio?.repo_count === 1 ? "y" : "ies"}.
        </p>
      </div>
      {refreshing && <div className="v-refreshing">Syncing latest data…</div>}

      <div className="report-summary-grid">
        <div className="card report-stat-card">
          <div className="report-stat-label">Portfolio avg. L1 completion</div>
          <div className="report-stat-value">{portfolioLoading ? "…" : `${portfolio?.overall_avg_pct ?? 0}%`}</div>
        </div>
        <div className="card report-stat-card">
          <div className="report-stat-label">Repositories tracked</div>
          <div className="report-stat-value">{portfolioLoading ? "…" : portfolio?.repo_count ?? 0}</div>
        </div>
        <div className="card report-stat-card">
          <div className="report-stat-label" style={{ color: "var(--v-fail)" }}>Open failures</div>
          <div className="report-stat-value" style={{ color: "var(--v-fail)" }}>{portfolioLoading ? "…" : portfolio?.total_open_fails ?? 0}</div>
        </div>
        <div className="card report-stat-card">
          <div className="report-stat-label">Attestation coverage</div>
          <div className="report-stat-value">{portfolioLoading ? "…" : `${attestation.pct}%`}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--t-text-dim)", marginTop: "0.2rem" }}>
            {attestation.answered} / {attestation.total} manual controls answered
          </div>
        </div>
      </div>

      <div className="v-row">
        <section className="card v-card-wide" style={{ gridColumn: "1 / -1" }}>
          <header className="v-card-header">
            <h2>Per-repository compliance</h2>
            <button type="button" className="btn-ghost btn" onClick={() => navigate("/repositories")}>Manage repositories</button>
          </header>
          <div className="repo-grid">
            {portfolioLoading ? (
              <Skeleton variant="cards" rows={2} />
            ) : repos.length === 0 ? (
              <div className="empty-state">
                <p style={{ margin: "0 0 0.75rem" }}>No repositories connected yet</p>
                <button type="button" className="btn btn-primary" onClick={() => navigate("/repositories")}>Connect a repository</button>
              </div>
            ) : (
              repos.map((repo) => (
                <RepoCard key={repo.repo_id} repo={repo} onViewReport={handleViewReport} onRunScan={handleRunScan} />
              ))
            )}
          </div>
        </section>
      </div>

      <div className="v-row">
        <section className="card">
          <header className="v-card-header"><h2>Top risks across portfolio</h2></header>
          <div className="risk-list">
            {portfolioLoading ? (
              <Skeleton variant="rows" rows={4} />
            ) : topRisks.length === 0 ? (
              <div className="empty-state">No failing controls across any scanned repository. Nice work.</div>
            ) : (
              topRisks.map((r) => (
                <div key={r.control_id} className="risk-row" onClick={() => navigate(`/controls?control=${r.control_id}`)}>
                  <div>
                    <span className="chapter-accordion-id">{r.control_id}</span>
                    <span className="risk-row-desc">{r.description}</span>
                  </div>
                  <span className="badge badge-fail">{r.repo_fail_count} repo{r.repo_fail_count === 1 ? "" : "s"}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="stack gap-md">
          <div className="card">
            <header className="v-card-header"><h2>Recent Scans</h2></header>
            <div className="v-recent-list">
              {loading ? (
                <Skeleton variant="rows" rows={4} />
              ) : recentScans.length > 0 ? (
                recentScans.slice(0, 5).map((scan, idx) => (
                  <div
                    key={idx}
                    className="v-recent-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      localStorage.setItem("lastScanId", scan.scan_id || scan.id);
                      navigate("/reports");
                    }}
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
