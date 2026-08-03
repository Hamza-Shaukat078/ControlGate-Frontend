// src/pages/DashboardPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { dashboardService, notificationService, asvsService } from "../api/services";
import { getDashboardCache, setDashboardCache, markDashboardDirty } from "../cache/dashboardCache";
import Sparkline from "../components/Sparkline";
import Skeleton from "../components/Skeleton";
import RadialGauge from "../components/RadialGauge";
import AreaTrendChart from "../components/AreaTrendChart";
import StatCard from "../components/StatCard";
import SeverityBreakdownList from "../components/SeverityBreakdownList";
import { getNotificationIcon } from "../utils/notificationIcon";
import {
  ShieldCheck,
  AlertTriangle,
  FolderGit,
  ScanSearch,
  ClipboardCheck,
  FileBarChart,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const RISK_COLOR = { Clean: "var(--v-pass)", Low: "var(--v-pass)", Medium: "var(--v-manual)", High: "var(--v-fail)", Critical: "var(--v-fail)" };
const STRATEGY_LABELS = {
  static_code: "Static Analysis",
  config_inspection: "Config Inspection",
  dependency_scan: "Dependency Scanning",
  dynamic_probe: "Dynamic Probe",
};
const SCAN_STATUS_ICON = {
  COMPLETED: { Icon: CheckCircle2, color: "var(--v-pass)" },
  RUNNING: { Icon: Loader2, color: "var(--accent)", spin: true },
  PENDING: { Icon: Loader2, color: "var(--accent)", spin: true },
  FAILED: { Icon: XCircle, color: "var(--v-fail)" },
  CANCELLED: { Icon: XCircle, color: "var(--t-text-dim)" },
};

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
          <div className="repo-card-actions">
            <button type="button" className="btn btn-ghost repo-card-view-btn" onClick={() => onViewReport(repo.latest_scan_id)}>
              View report →
            </button>
            <button type="button" className="btn btn-secondary repo-card-scan-btn" onClick={() => onRunScan(repo.repo_id)}>
              Scan
            </button>
          </div>
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
  const [summary, setSummary] = useState(null);
  const [complianceSummary, setComplianceSummary] = useState(null);
  const [prevRiskScore, setPrevRiskScore] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const cache = getDashboardCache();

    if (cache.recentScans)   { setRecentScans(cache.recentScans);   setLoading(false); }
    if (cache.notifications) { setNotifications(cache.notifications); }
    if (cache.portfolio)     { setPortfolio(cache.portfolio);       setPortfolioLoading(false); }
    if (cache.riskScore != null) setPrevRiskScore(cache.riskScore);

    if (!cache.dirty && cache.portfolio) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetchAll = async () => {
      setError(null);
      const priorRiskScore = getDashboardCache().riskScore;
      if (!cache.portfolio) setLoading(true);
      else setRefreshing(true);

      try {
        const [recentRes, notifRes, portfolioRes, summaryRes, complianceRes] = await Promise.allSettled([
          dashboardService.getRecentScans(),
          notificationService.getNotifications(1, 10),
          asvsService.getPortfolioDashboard(),
          dashboardService.getSummary(),
          asvsService.getComplianceSummary(),
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
        if (summaryRes.status === "fulfilled") {
          const s = summaryRes.value.data;
          updates.riskScore = s?.risk?.score ?? null;
          if (mounted) { setSummary(s); setPrevRiskScore(priorRiskScore ?? null); }
        }
        if (complianceRes.status === "fulfilled") {
          if (mounted) setComplianceSummary(complianceRes.value);
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

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const id = (await asvsService.resolveLatestScanId()) || "latest";
      const res = await asvsService.exportCompliancePDF(id);
      const blob = res.data || res;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "controlgate-asvs-compliance-report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      // Export endpoint may not be available in this environment — fail quietly,
      // ReportsPage surfaces the same failure with a full explanatory message.
    } finally {
      setExporting(false);
    }
  };

  const repos = useMemo(() => portfolio?.repos || [], [portfolio]);
  const topRisks = portfolio?.top_failing_controls || [];

  // portfolioLoading flips false the instant a *cached* portfolio paints,
  // which can happen well before summary/complianceSummary (no cache path
  // of their own) actually arrive — gate those two on the real in-flight
  // fetch state instead, so a fast cache hit doesn't flash "unavailable".
  const dataLoading = loading || refreshing;

  const healthyCount = repos.filter((r) => r.l1_pct !== null && r.l1_pct >= 70).length;
  const needsAttentionCount = repos.length - healthyCount;

  // Real per-repo trend points, averaged by matching scan-index position —
  // an honest approximation, not a real backend portfolio history (there
  // isn't one). Labeled as such in the chart subtitle below.
  const trendPoints = useMemo(() => {
    if (repos.length === 0) return [];
    const maxLen = Math.max(...repos.map((r) => r.trend?.length || 0));
    const points = [];
    for (let i = 0; i < maxLen; i++) {
      const vals = repos.map((r) => r.trend?.[i]?.pct).filter((v) => v != null);
      if (vals.length > 0) {
        points.push({ label: `Scan ${i + 1}`, value: vals.reduce((a, b) => a + b, 0) / vals.length });
      }
    }
    return points;
  }, [repos]);

  const riskDelta = useMemo(() => {
    if (prevRiskScore == null || !summary?.risk) return null;
    const diff = summary.risk.score - prevRiskScore;
    if (diff === 0) return null;
    return { direction: diff > 0 ? "down" : "up", text: `${Math.abs(diff)} vs last visit` };
    // (down = risk went up = bad, arrow inverted intentionally in RadialGauge's trend coloring)
  }, [prevRiskScore, summary]);

  // Both derived from the SAME single getComplianceSummary() fetch (latest
  // completed scan only, not a true cross-repo aggregate — see chapter cards'
  // "Latest scan" label below).
  const chapters = useMemo(() => complianceSummary?.chapters || [], [complianceSummary]);
  // Worst-first preview of 6 (dashboard is an overview, not the full catalog —
  // ControlsPage already lists every chapter in depth via "View all →").
  const chapterPreview = useMemo(() => {
    const pctOf = (ch) => (ch.control_count ? (ch.counts?.pass || 0) / ch.control_count : 1);
    return [...chapters].sort((a, b) => pctOf(a) - pctOf(b)).slice(0, 6);
  }, [chapters]);
  const strategyCoverage = useMemo(() => {
    const buckets = {};
    chapters.forEach((ch) => {
      const strat = ch.detection_strategy;
      if (!STRATEGY_LABELS[strat]) return;
      if (!buckets[strat]) buckets[strat] = { pass: 0, total: 0 };
      buckets[strat].pass += ch.counts?.pass || 0;
      buckets[strat].total += ch.control_count || 0;
    });
    return Object.keys(STRATEGY_LABELS).map((key) => ({
      key,
      label: STRATEGY_LABELS[key],
      pct: buckets[key]?.total ? Math.round((buckets[key].pass / buckets[key].total) * 100) : 0,
    }));
  }, [chapters]);

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
      <div className="page-header dash-header">
        <div>
          <h1 className="page-title">Executive Security Overview</h1>
          <p className="page-subtitle">
            Real-time visibility into ASVS 5.0.0 Level 1 compliance across {portfolioLoading ? "…" : portfolio?.repo_count ?? 0} repositor{portfolio?.repo_count === 1 ? "y" : "ies"}.
          </p>
        </div>
        <button type="button" className="btn btn-secondary dash-export-btn" onClick={handleExportPDF} disabled={exporting}>
          <Download size={15} /> {exporting ? "Exporting…" : "Export"}
        </button>
      </div>
      {refreshing && <div className="v-refreshing">Syncing latest data…</div>}

      {/* Stat row */}
      <div className="report-summary-grid">
        <StatCard title="Portfolio Risk Score" icon={<AlertTriangle size={15} />}>
          {dataLoading ? (
            <Skeleton variant="text" height="4.5rem" />
          ) : summary ? (
            <div className="stat-gauge-row">
              <RadialGauge
                value={summary.risk.score}
                size={54}
                strokeWidth={6}
                color={RISK_COLOR[summary.risk.label] || "var(--accent)"}
                trend={riskDelta}
              />
              <div className="stat-gauge-label" style={{ color: RISK_COLOR[summary.risk.label] }}>{summary.risk.label} Risk</div>
            </div>
          ) : (
            <div className="stat-card-subtitle">Risk data unavailable</div>
          )}
        </StatCard>

        <StatCard title="ASVS Compliance" icon={<ShieldCheck size={15} />}>
          <div className="report-stat-value">{portfolioLoading ? "…" : `${portfolio?.overall_avg_pct ?? 0}%`}</div>
          <div className="pbar" style={{ marginTop: "0.5rem" }}>
            <div className="pbar-fill" style={{ width: `${portfolio?.overall_avg_pct ?? 0}%` }} />
          </div>
          {complianceSummary?.levels?.L1 && (
            <div className="stat-card-subtitle">{complianceSummary.levels.L1.passed} / {complianceSummary.levels.L1.total} controls passing</div>
          )}
        </StatCard>

        <StatCard title="Open Findings" icon={<AlertTriangle size={15} />}>
          <div className="report-stat-value" style={{ color: "var(--v-fail)" }}>{dataLoading ? "…" : summary?.totals?.vulnerabilities ?? 0}</div>
          {dataLoading ? (
            <Skeleton variant="rows" rows={4} />
          ) : summary ? (
            <SeverityBreakdownList counts={{ critical: summary.severity.CRITICAL, high: summary.severity.HIGH, medium: summary.severity.MEDIUM, low: summary.severity.LOW }} />
          ) : (
            <div className="stat-card-subtitle">Findings data unavailable</div>
          )}
        </StatCard>

        <StatCard title="Repositories" icon={<FolderGit size={15} />}>
          <div className="report-stat-value">{portfolioLoading ? "…" : portfolio?.repo_count ?? 0}</div>
          {!portfolioLoading && (
            <ul className="severity-list" style={{ marginTop: "0.5rem" }}>
              <li className="severity-row" style={{ borderLeftColor: "var(--v-pass)" }}>
                <span className="severity-label">Healthy</span>
                <span className="severity-count" style={{ color: "var(--v-pass)" }}>{healthyCount}</span>
              </li>
              <li className="severity-row" style={{ borderLeftColor: "var(--v-fail)" }}>
                <span className="severity-label">Need Attention</span>
                <span className="severity-count" style={{ color: "var(--v-fail)" }}>{needsAttentionCount}</span>
              </li>
            </ul>
          )}
        </StatCard>
      </div>

      {/* Trend + Top risks */}
      <div className="v-row v-row-2-1">
        <section className="card">
          <header className="v-card-header"><h2>Portfolio Compliance Trend</h2></header>
          {portfolioLoading ? (
            <Skeleton variant="text" height="90px" className="dash-chart-skeleton" />
          ) : (
            <AreaTrendChart points={trendPoints} height={90} subtitle="Average of per-repository trend, last scans per repo — not a backend-tracked portfolio history." />
          )}
        </section>

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
      </div>

      {/* Repository health + Recent scans */}
      <div className="v-row v-row-2-1">
        <section className="card">
          <header className="v-card-header">
            <h2>Repository Health</h2>
            <button type="button" className="btn-ghost btn" onClick={() => navigate("/repositories")}>Manage repositories</button>
          </header>
          <div className="repo-row-scroll">
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

        <section className="card">
          <header className="v-card-header"><h2>Recent Scans</h2></header>
          <div className="v-recent-list">
            {loading ? (
              <Skeleton variant="rows" rows={4} />
            ) : recentScans.length > 0 ? (
              recentScans.slice(0, 4).map((scan, idx) => {
                const statusMeta = SCAN_STATUS_ICON[scan.status] || SCAN_STATUS_ICON.COMPLETED;
                const { Icon, color, spin } = statusMeta;
                return (
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
                      <Icon size={16} style={{ color, flexShrink: 0 }} className={spin ? "spin-icon" : undefined} />
                      <div>
                        <p className="v-recent-title">{scan.repository_name || scan.repo_id || scan.scan_id || "Scan"}</p>
                        <p className="v-recent-sub">
                          {scan.created_at ? new Date(scan.created_at).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <p style={{ margin: "0 0 0.75rem" }}>No scans yet</p>
                <button type="button" className="btn btn-primary" onClick={handleScanNow}>Run your first scan</button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Compliance by chapter + Notifications */}
      <div className="v-row v-row-2-1">
        <section className="card">
          <header className="v-card-header">
            <h2>Compliance by Chapter</h2>
            <button type="button" className="btn-ghost btn" onClick={() => navigate("/controls")}>View all →</button>
          </header>
          <div className="chapter-mini-grid">
            {dataLoading ? (
              <Skeleton variant="cards" rows={2} />
            ) : chapters.length === 0 ? (
              <div className="empty-state">Chapter data unavailable</div>
            ) : (
              chapterPreview.map((ch) => {
                const pct = ch.control_count ? Math.round(((ch.counts?.pass || 0) / ch.control_count) * 100) : 0;
                const color = pct >= 70 ? "var(--v-pass)" : pct >= 40 ? "var(--v-manual)" : "var(--v-fail)";
                return (
                  <div key={ch.chapter_id} className="chapter-mini-card" onClick={() => navigate(`/controls?chapter=${ch.chapter_id}`)}>
                    <div className="chapter-mini-id">{ch.chapter_id}</div>
                    <div className="chapter-mini-title">{ch.title}</div>
                    <div className="chapter-mini-pct" style={{ color }}>{pct}%</div>
                    <div className="pbar"><div className="pbar-fill" style={{ width: `${pct}%`, background: color }} /></div>
                  </div>
                );
              })
            )}
          </div>
          <div className="stat-card-subtitle" style={{ padding: "0 0.9rem 0.5rem" }}>Lowest {chapterPreview.length} of {chapters.length} chapters · latest scan only.</div>
        </section>

        <section className="card">
          <header className="v-card-header"><h2>Notifications</h2></header>
          <ul className="v-notifications">
            {notifications.length > 0 ? (
              notifications.slice(0, 6).map((n, i) => {
                const { Icon, color } = getNotificationIcon(n.message || n.title || "");
                return (
                  <li key={i} className="dash-notif-row">
                    <Icon size={14} style={{ color, flexShrink: 0 }} />
                    <span>
                      {n.message || n.title || n}
                      {n.created_at && (
                        <span style={{ color: "var(--t-text-dim)", marginLeft: "0.5rem", fontSize: "0.78rem" }}>
                          {new Date(n.created_at).toLocaleTimeString()}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })
            ) : (
              <li style={{ color: "var(--t-text-dim)" }}>No notifications</li>
            )}
          </ul>
        </section>
      </div>

      {/* Detection strategy + Risk distribution + Quick actions */}
      <div className="v-row v-row-3">
        <section className="card">
          <header className="v-card-header"><h2>Detection Strategy Coverage</h2></header>
          <div className="strategy-ring-row">
            {dataLoading ? (
              <Skeleton variant="rows" rows={1} />
            ) : (
              strategyCoverage.map((s) => (
                <div key={s.key} className="strategy-ring-item">
                  <RadialGauge value={s.pct} size={42} strokeWidth={5} color="var(--accent)" />
                  <span className="strategy-ring-label">{s.label}</span>
                </div>
              ))
            )}
          </div>
          <div className="stat-card-subtitle" style={{ padding: "0 0.9rem 0.5rem" }}>Latest scan only.</div>
        </section>

        <section className="card">
          <header className="v-card-header"><h2>Risk Distribution</h2></header>
          <div style={{ padding: "0.4rem 0.9rem 0.6rem" }}>
            {dataLoading ? (
              <Skeleton variant="rows" rows={4} />
            ) : summary ? (
              <SeverityBreakdownList
                counts={{ critical: summary.severity.CRITICAL, high: summary.severity.HIGH, medium: summary.severity.MEDIUM, low: summary.severity.LOW }}
                showPercent
              />
            ) : (
              <div className="stat-card-subtitle">Risk data unavailable</div>
            )}
          </div>
        </section>

        <section className="card">
          <header className="v-card-header"><h2>Quick Actions</h2></header>
          <div className="quick-tile-grid">
            <button type="button" className="quick-tile" onClick={handleScanNow}>
              <ScanSearch size={18} /> New Scan
            </button>
            <button type="button" className="quick-tile" onClick={() => navigate("/repositories")}>
              <FolderGit size={18} /> Import Repo
            </button>
            <button type="button" className="quick-tile" onClick={() => navigate("/reports")}>
              <FileBarChart size={18} /> Reports
            </button>
            <button type="button" className="quick-tile" onClick={() => navigate("/controls")}>
              <ShieldCheck size={18} /> Controls
            </button>
            <button type="button" className="quick-tile" onClick={() => navigate("/attestation")}>
              <ClipboardCheck size={18} /> Attestation
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
