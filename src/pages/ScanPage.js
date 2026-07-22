// src/pages/ScanPage.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../App.css";
import { repositoryService, scanService } from "../api/services";
import { api } from "../api/client";

function ScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRepoId = searchParams.get("repoId");
  
  const [inputMode, setInputMode] = useState(initialRepoId ? "repository" : "direct"); // direct | repository
  const [directCode, setDirectCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [repositories, setRepositories] = useState([]);
  const [repository, setRepository] = useState(initialRepoId || "");
  const [repoBranches, setRepoBranches] = useState([]); // Dynamic branches
  const [branch, setBranch] = useState("main");
  const [scanScope, setScanScope] = useState("all"); // all | selected
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [repoFilesLoading, setRepoFilesLoading] = useState(false);
  const [repoFilesError, setRepoFilesError] = useState("");
  const [scanMode, setScanMode] = useState("deep"); // quick | deep | custom
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState("");
  const [logs, setLogs] = useState([]);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [toast, setToast] = useState("");
  const [currentScanId, setCurrentScanId] = useState(null);
  const [scanSummary, setScanSummary] = useState(null);
  const pollInterval = useRef(null);
  const wsRef = useRef(null);
  const lineCount = directCode.split("\n").length;
  const lineCountColor = lineCount > 390 ? "#f97373" : lineCount > 360 ? "#f59e0b" : "#888";
  const [resumeScanId, setResumeScanId] = useState(null);
  const [resumeStatus, setResumeStatus] = useState("");
  const [diffBase, setDiffBase]         = useState("main");
  const [diffHead, setDiffHead]         = useState("HEAD");
  const [diffFiles, setDiffFiles]       = useState([]);
  const [diffLoading, setDiffLoading]   = useState(false);
  const [diffFetched, setDiffFetched]   = useState(false);

  useEffect(() => {
    if (currentScanId || scanning) return;
    const lastScanId = localStorage.getItem("lastScanId");
    if (!lastScanId) return;
    const cached = localStorage.getItem(`scan_${lastScanId}`);
    if (!cached) return;
    try {
      const summary = JSON.parse(cached);
      setCurrentScanId(lastScanId);
      setScanSummary(summary);
    } catch (err) {
      console.error("Failed to restore cached scan summary:", err);
    }
  }, [currentScanId, scanning]);

  useEffect(() => {
    const checkResume = async () => {
      const lastScanId = localStorage.getItem("lastScanId");
      if (!lastScanId) return;
      if (currentScanId || scanning) return;
      try {
        const statusRes = await scanService.getStatus(lastScanId);
        const status = statusRes.data;
        if (["PENDING", "RUNNING"].includes(status.state)) {
          setResumeScanId(lastScanId);
          setResumeStatus(status.state);
        }
      } catch {
        // ignore resume errors
      }
    };
    checkResume();
  }, [currentScanId, scanning]);

  const fetchRepositories = useCallback(async () => {
    try {
      const res = await repositoryService.list();
      const repos = res.data || [];
      setRepositories(repos);
      if (repos.length > 0 && !repository) {
        setRepository(initialRepoId || repos[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch repositories:", err);
    }
  }, [repository, initialRepoId]);

  // Fetch branches when repository changes
  const fetchBranches = useCallback(async (repoId) => {
    if (!repoId) return;
    try {
      const res = await repositoryService.getBranches(repoId);
      const branches = Array.isArray(res.data?.branches)
        ? res.data.branches
        : ["main"];
      setRepoBranches(branches);
      if (branches.length > 0 && !branches.includes(branch)) {
        setBranch(branches[0]);
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      setRepoBranches(["main", "dev", "master"]);
    }
  }, [branch]);

  const fetchRepoFiles = useCallback(async () => {
    if (!repository || inputMode !== "repository") return;
    setRepoFilesLoading(true);
    setRepoFilesError("");
    try {
      const res = await repositoryService.getFiles(repository, branch);
      const files = Array.isArray(res.data?.files) ? res.data.files : [];
      setRepoFiles(files);
      setSelectedFiles((prev) => prev.filter((path) => files.includes(path)));
    } catch (err) {
      console.error("Failed to fetch repository files:", err);
      const msg = err.response?.data?.detail || "Failed to load file list.";
      setRepoFilesError(msg);
      setRepoFiles([]);
    } finally {
      setRepoFilesLoading(false);
    }
  }, [repository, branch, inputMode]);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  useEffect(() => {
    if (repository && inputMode === "repository") {
      fetchBranches(repository);
    }
  }, [repository, inputMode, fetchBranches]);

  useEffect(() => {
    setSelectedFiles([]);
    if (scanScope === "selected" && repository && inputMode === "repository") {
      fetchRepoFiles();
    }
  }, [repository, branch, scanScope, inputMode, fetchRepoFiles]);

  // Shared handler: called by both WebSocket and fallback poll
  const handleScanDone = useCallback(async (state, wsSummary) => {
    setScanning(false);
    if (state === "COMPLETED") {
      let summary = wsSummary;
      if (!summary || !summary.vulnerabilities_found) {
        try {
          const r = await scanService.getSummary(currentScanId);
          summary = r.data;
        } catch { /* keep ws summary */ }
      }
      if (summary) {
        setScanSummary(summary);
        setAiConfidence(Math.round((summary?.ai_confidence || 0) * 100));
        localStorage.setItem(`scan_${currentScanId}`, JSON.stringify(summary));
        localStorage.setItem("lastScanId", currentScanId);

        if (summary?.vulnerabilities?.length > 0) {
          const vulnLogs = summary.vulnerabilities.map((v, idx) => {
            const llmClass = v.analysis?.llm_classification?.classification || "N/A";
            const exploitability = v.analysis?.llm_classification?.exploitability
              ? Math.round(v.analysis.llm_classification.exploitability * 100) + "%"
              : "N/A";
            return {
              time: new Date().toLocaleTimeString(),
              text: `#${idx + 1} ${v.type} | ${v.evidence?.source} -> ${v.evidence?.sink} | Line ${v.location?.start_line} | AI: ${llmClass} | Exploit: ${exploitability}`,
              severity: v.severity,
            };
          });
          setLogs((prev) => [...prev, ...vulnLogs]);
        }
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            text: `Scan completed: ${summary.vulnerabilities_found} vulnerabilities (${summary.by_severity?.critical || 0} critical, ${summary.by_severity?.high || 0} high) in ${summary.duration_seconds?.toFixed(2)}s`,
          },
        ]);
        setToast(summary.total_files === 0 ? "No scannable files found in the repository." : "Scan completed successfully.");
      }
    } else {
      setToast(`Scan ${state.toLowerCase()}.`);
    }
    setTimeout(() => setToast(""), 4000);
  }, [currentScanId]);

  // Real-time WebSocket scan streaming (falls back to 2 s polling on WS error)
  useEffect(() => {
    if (!scanning || !currentScanId) return;

    const token = localStorage.getItem("access_token");
    const baseUrl = (api.defaults.baseURL || "http://localhost:8000/api/v1").replace(/^http/, "ws");
    const wsUrl = `${baseUrl}/scans/ws/${currentScanId}?token=${encodeURIComponent(token || "")}`;

    let ws = null;
    let usedFallback = false;

    const startFallbackPoll = () => {
      if (usedFallback) return;
      usedFallback = true;

      const poll = async () => {
        try {
          const statusRes = await scanService.getStatus(currentScanId);
          const status = statusRes.data;
          setProgress(status.progress || 0);
          setEta(status.eta || "");

          const logsRes = await scanService.getLogs(currentScanId);
          const logLines = logsRes.data?.logs || [];
          setLogs(logLines.map((l) => ({ time: new Date().toLocaleTimeString(), text: l })));

          if (["COMPLETED", "FAILED", "CANCELLED"].includes(status.state)) {
            clearInterval(pollInterval.current);
            await handleScanDone(status.state, null);
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      };

      poll();
      pollInterval.current = setInterval(poll, 2000);
    };

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: "[WS] Live stream connected" }]);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "status") {
            setProgress(msg.progress || 0);
            setEta(msg.eta || "");
          } else if (msg.type === "logs") {
            const lines = (msg.lines || []).map((l) => ({ time: new Date().toLocaleTimeString(), text: l }));
            if (lines.length) setLogs((prev) => {
              const existing = new Set(prev.map((x) => x.text));
              return [...prev, ...lines.filter((l) => !existing.has(l.text))];
            });
          } else if (msg.type === "done") {
            handleScanDone(msg.state, msg.summary || null);
          } else if (msg.type === "error") {
            console.warn("[WS] scan error:", msg.message);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        console.warn("[WS] WebSocket error — falling back to polling");
        startFallbackPoll();
      };

      ws.onclose = (evt) => {
        if (evt.code === 4001) {
          console.warn("[WS] Auth failed — falling back to polling");
          startFallbackPoll();
        }
      };
    } catch {
      startFallbackPoll();
    }

    return () => {
      if (ws) ws.close();
      wsRef.current = null;
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [scanning, currentScanId, handleScanDone]);

  const handleDirectCodeChange = (e) => {
    const code = e.target.value;
    const lineCount = code.split('\n').length;
    if (lineCount <= 400) {
      setDirectCode(code);
    } else {
      setToast("Code exceeds 400-line limit!");
      setTimeout(() => setToast(""), 3000);
    }
  };

  const handleStartScan = async () => {
    if (scanning) return;
    
    // Validation based on input mode
    if (inputMode === "direct") {
      if (!directCode.trim()) {
        setToast("Please enter code to scan.");
        return;
      }
      const lineCount = directCode.split('\n').length;
      if (lineCount > 400) {
        setToast("Code exceeds 400-line limit. Please reduce the code size.");
        return;
      }
    } else if (inputMode === "repository") {
      if (!repository) {
        setToast("Please select a repository.");
        return;
      }
      if ((scanScope === "selected" || scanScope === "diff") && selectedFiles.length === 0) {
        setToast("Please select at least one file to scan.");
        return;
      }
    }

    try {
      let scanData;
      
      if (inputMode === "direct") {
        // Direct code scan payload
        scanData = {
          code: directCode,
          language: language,
          scan_mode: scanMode.toUpperCase(),
        };
      } else {
        // Repository scan payload
        scanData = {
          repo_id: repository,
          branch: branch,
          scan_mode: scanMode.toUpperCase(),
        };
        if ((scanScope === "selected" || scanScope === "diff") && selectedFiles.length > 0) {
          scanData.file_paths = selectedFiles;
        }
      }
      
      const res = await scanService.start(scanData);
      setCurrentScanId(res.data.scan_id);
      setScanning(true);
      setProgress(0);
      setLogs([]);
      setScanSummary(null);
      setToast("");
      localStorage.setItem("lastScanId", res.data.scan_id);
      window.dispatchEvent(new CustomEvent("vulcan:scan-started"));
    } catch (err) {
      console.error("Failed to start scan:", err);
      const errorMessage = err.response?.data?.detail 
        || err.response?.data?.message 
        || err.message 
        || "Unknown error occurred";
      setToast("Failed to start scan: " + (typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)));
    }
  };

  const handleCancelScan = async () => {
    if (!currentScanId) return;
    try {
      await scanService.cancel(currentScanId);
      setScanning(false);
      setEta("Scan cancelled");
      setToast("Scan was cancelled.");
      setTimeout(() => setToast(""), 4000);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (pollInterval.current) clearInterval(pollInterval.current);
    } catch (err) {
      console.error("Failed to cancel scan:", err);
    }
  };

  const handleSaveConfig = () => {
    setToast("Scan configuration saved.");
    setTimeout(() => setToast(""), 3000);
  };

  const toggleFileSelection = (path) => {
    setSelectedFiles((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const handleSelectAllFiles = () => {
    setSelectedFiles(repoFiles);
  };

  const handleClearFiles = () => {
    setSelectedFiles([]);
  };

  const handleFetchDiff = async () => {
    if (!repository) { setToast("Select a repository first."); return; }
    setDiffLoading(true);
    setDiffFiles([]);
    setDiffFetched(false);
    try {
      const res = await scanService.getDiffFiles(repository, diffBase, diffHead);
      const files = res.data?.changed_files || [];
      setDiffFiles(files);
      setSelectedFiles(files);
      setDiffFetched(true);
      if (!files.length) setToast("No changed source files between those refs.");
    } catch (err) {
      setToast(err.response?.data?.detail || "Failed to fetch diff.");
    } finally {
      setDiffLoading(false);
    }
  };

  const handleViewGraph = () => {
    if (!currentScanId) {
      setToast("Please complete a scan first.");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    // Navigate to graphs page with actual scan ID
    navigate(`/graphs?scanId=${currentScanId}&fileId=file-1`);
  };

  return (
    <div className="vs-page">
      {/* Optional mini-toast */}
      {toast && <div className="vs-toast">{toast}</div>}

      {resumeScanId && !scanning && (
        <div className="vs-resume-banner">
          <div>RESUME IN-PROGRESS SCAN: <strong>{resumeScanId}</strong> — {resumeStatus}</div>
          <button
            type="button"
            className="vs-view-graph-btn"
            onClick={() => {
              setCurrentScanId(resumeScanId);
              setScanning(true);
              setResumeScanId(null);
            }}
          >
            Resume
          </button>
        </div>
      )}

      {!scanning && currentScanId && scanSummary && (
        <div className="vs-resume-banner">
          <div>LAST SCAN: <strong>{currentScanId}</strong> — {scanSummary.vulnerabilities_found || 0} FINDINGS RECORDED</div>
          <button type="button" className="vs-view-graph-btn" onClick={handleViewGraph}>
            View Last Graph
          </button>
        </div>
      )}

      {/* Header strip */}
      <div className="vs-header">
        <div className="vs-header-left">
          <div className="vs-header-logo-circle">
            <svg className="vs-header-logo-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3l7 3v6c0 4.2-2.7 7.9-7 9-4.3-1.1-7-4.8-7-9V6l7-3z"
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.6"
              />
              <path
                d="M9.6 12.2l1.7 1.7 3.7-3.7"
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="vs-header-title">VERIFICATION SCAN</div>
          <div className="vs-header-status">
            <span className="vs-header-status-dot" />
            <span>ASVS VERIFICATION ENGINE ACTIVE</span>
            <span style={{ opacity: 0.4 }}>{"//"}</span>
            <span>{scanning ? "SCANNING IN PROGRESS" : "AWAITING TARGET"}</span>
          </div>
        </div>
      </div>

      <div className="vs-layout">
        {/* LEFT SIDE: config + progress */}
        <div className="vs-left">
          {/* Main config card */}
          <div className="vs-card vs-main-card">
            {/* Input mode toggle */}
            <div className="vs-row-mode">
              <div className="vs-label">Input Method</div>
              <div className="vs-mode-group">
                <button
                  type="button"
                  className={
                    "vs-mode-btn" + (inputMode === "direct" ? " active" : "")
                  }
                  onClick={() => setInputMode("direct")}
                >
                  Direct Code
                </button>
                <button
                  type="button"
                  className={
                    "vs-mode-btn" + (inputMode === "repository" ? " active" : "")
                  }
                  onClick={() => setInputMode("repository")}
                >
                  Repository
                </button>
              </div>
            </div>

            {/* Conditional input fields */}
            {inputMode === "direct" && (
              <div style={{ marginTop: "1rem" }}>
                <div className="vs-field">
                  <div className="vs-label">Language</div>
                  <select
                    className="vs-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                </div>
                <div className="vs-field" style={{ marginTop: "1rem" }}>
                  <div className="vs-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Enter Code (Max 400 lines)</span>
                    <span style={{ fontSize: "0.85rem", color: lineCountColor }}>
                      {lineCount} / 400 lines
                    </span>
                  </div>
                  <textarea
                    className="vs-select"
                    value={directCode}
                    onChange={handleDirectCodeChange}
                    placeholder="Paste your code here..."
                    rows={15}
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.9rem",
                      resize: "vertical",
                      minHeight: "300px"
                    }}
                  />
                </div>
              </div>
            )}

            {inputMode === "repository" && (
              <div>
                <div className="vs-row-top">
                  <div className="vs-field">
                    <div className="vs-label">Repository</div>
                    <select
                      className="vs-select"
                      value={repository}
                      onChange={(e) => setRepository(e.target.value)}
                    >
                      <option value="">Select repository...</option>
                      {repositories.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="vs-field">
                    <div className="vs-label">Branch</div>
                    <select
                      className="vs-select"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                    >
                      {(repoBranches.length > 0 ? repoBranches : ["main"]).map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="vs-row-mode" style={{ marginTop: "1rem" }}>
                  <div className="vs-label">Scan scope</div>
                  <div className="vs-mode-group">
                    <button
                      type="button"
                      className={"vs-mode-btn" + (scanScope === "all" ? " active" : "")}
                      onClick={() => setScanScope("all")}
                    >
                      Full repository
                    </button>
                    <button
                      type="button"
                      className={"vs-mode-btn" + (scanScope === "selected" ? " active" : "")}
                      onClick={() => setScanScope("selected")}
                    >
                      Select files
                    </button>
                    <button
                      type="button"
                      className={"vs-mode-btn" + (scanScope === "diff" ? " active" : "")}
                      onClick={() => { setScanScope("diff"); setDiffFiles([]); setDiffFetched(false); }}
                    >
                      ⊕ Diff scan
                    </button>
                  </div>
                </div>

                {scanScope === "selected" && (
                  <div className="vs-field" style={{ marginTop: "0.75rem" }}>
                    <div className="vs-label" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Files to scan</span>
                      <span style={{ fontSize: "0.85rem", color: "#888" }}>
                        {selectedFiles.length} selected
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <button type="button" className="vs-save-config-btn" onClick={fetchRepoFiles}>
                        Refresh list
                      </button>
                      <button type="button" className="vs-save-config-btn" onClick={handleSelectAllFiles}>
                        Select all
                      </button>
                      <button type="button" className="vs-save-config-btn" onClick={handleClearFiles}>
                        Clear
                      </button>
                    </div>
                    <div className="vs-file-list" style={{ padding: "0.5rem", maxHeight: "220px", overflow: "auto" }}>
                      {repoFilesLoading && <div style={{ color: "#999" }}>Loading files...</div>}
                      {repoFilesError && <div style={{ color: "#f97373" }}>{repoFilesError}</div>}
                      {!repoFilesLoading && !repoFilesError && repoFiles.length === 0 && (
                        <div style={{ color: "#999" }}>No source files found.</div>
                      )}
                      {!repoFilesLoading &&
                        !repoFilesError &&
                        repoFiles.map((path) => (
                          <label
                            key={path}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.25rem 0",
                              color: "#cbd5f5",
                              fontSize: "0.9rem",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedFiles.includes(path)}
                              onChange={() => toggleFileSelection(path)}
                            />
                            <span>{path}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}

                {scanScope === "diff" && (
                  <div className="vs-diff-panel">
                    <div className="vs-diff-panel-title">⊕ DIFF-BASED SCAN — only changed files</div>
                    <div className="vs-diff-refs">
                      <div className="vs-field">
                        <div className="vs-label">Base ref</div>
                        <input
                          className="vs-select"
                          value={diffBase}
                          onChange={(e) => setDiffBase(e.target.value)}
                          placeholder="main"
                        />
                      </div>
                      <div className="vs-diff-arrow">→</div>
                      <div className="vs-field">
                        <div className="vs-label">Head ref</div>
                        <input
                          className="vs-select"
                          value={diffHead}
                          onChange={(e) => setDiffHead(e.target.value)}
                          placeholder="HEAD"
                        />
                      </div>
                      <button
                        type="button"
                        className="vs-save-config-btn vs-diff-fetch-btn"
                        onClick={handleFetchDiff}
                        disabled={diffLoading || !repository}
                      >
                        {diffLoading ? "Fetching…" : "Fetch Changed Files"}
                      </button>
                    </div>
                    {diffFetched && (
                      <div className="vs-diff-result">
                        <div className="vs-diff-result-header">
                          <span>{diffFiles.length} changed file{diffFiles.length !== 1 ? "s" : ""} detected</span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button type="button" className="vs-save-config-btn" onClick={() => setSelectedFiles(diffFiles)}>All</button>
                            <button type="button" className="vs-save-config-btn" onClick={() => setSelectedFiles([])}>None</button>
                          </div>
                        </div>
                        <div className="vs-file-list" style={{ maxHeight: "160px", overflow: "auto" }}>
                          {diffFiles.length === 0
                            ? <div style={{ color: "#888", padding: "6px 0" }}>No scannable files changed.</div>
                            : diffFiles.map((path) => (
                              <label key={path} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.2rem 0", color: "#cbd5f5", fontSize: "0.88rem" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedFiles.includes(path)}
                                  onChange={() => toggleFileSelection(path)}
                                />
                                <span className="vs-diff-file-path">{path}</span>
                              </label>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Row: scan mode */}
            <div className="vs-row-mode">
              <div className="vs-label">Scan mode</div>
              <div className="vs-mode-group">
                <button
                  type="button"
                  className={
                    "vs-mode-btn" + (scanMode === "quick" ? " active" : "")
                  }
                  onClick={() => setScanMode("quick")}
                >
                  Quick
                </button>
                <button
                  type="button"
                  className={
                    "vs-mode-btn" + (scanMode === "deep" ? " active" : "")
                  }
                  onClick={() => setScanMode("deep")}
                >
                  Deep
                </button>
                <button
                  type="button"
                  className={
                    "vs-mode-btn" + (scanMode === "custom" ? " active" : "")
                  }
                  onClick={() => setScanMode("custom")}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Start button */}
            <div className="vs-row-start">
              <button
                type="button"
                className={`vs-start-btn${scanning ? " vs-scanning" : ""}`}
                onClick={handleStartScan}
              >
                {scanning ? "SCANNING..." : "START SCAN"}
              </button>
            </div>

            {/* Progress */}
            <div className="vs-row-progress">
              <span className="vs-label">Progress</span>
              <div className="vs-progress-bar-wrap">
                <div className="vs-progress-bar-bg">
                  <div
                    className="vs-progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="vs-progress-meta">
                  <span>{eta}</span>
                  {scanning && (
                    <button
                      type="button"
                      className="vs-cancel-btn"
                      onClick={handleCancelScan}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary / AI confidence card */}
          <div className="vs-card vs-summary-card">
            <div className="vs-summary-title">START SCAN</div>
            <div className="vs-summary-body">
              <div className="vs-summary-progress-row">
                <span className="vs-summary-label">Overall progress</span>
                <span className="vs-summary-pct">{progress}%</span>
              </div>
              <div className="vs-summary-mini-bar">
                <div
                  className="vs-summary-mini-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <div className="vs-summary-meta">
                <div>
                  <span className="vs-summary-label">AI Confidence</span>
                  <span className="vs-summary-value">
                    {aiConfidence}% (ensemble)
                  </span>
                </div>
                <button
                  type="button"
                  className="vs-save-config-btn"
                  onClick={handleSaveConfig}
                >
                  Save configuration
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: live logs */}
        <div className="vs-right">
          <div className="vs-card vs-log-card">
            <div className="vs-log-header">
              <div>
                <div className="vs-log-title">LOG</div>
                <div className="vs-log-sub">
                  {scanSummary ? (
                    <>
                      Results <span className="critical-count">{scanSummary.by_severity?.critical || 0} Critical</span>{" "}
                      <span className="custom-count">{scanSummary.vulnerabilities_found || 0} Total</span>
                    </>
                  ) : (
                    "Waiting for scan results..."
                  )}
                </div>
              </div>
              <button className="vs-log-refresh-btn" type="button">
                Refresh
              </button>
            </div>

            {scanSummary && (
              <div className="vs-log-summary-row">
                <span className="vs-log-dot critical"></span> {scanSummary.by_severity?.critical || 0} Critical
                <span className="vs-log-bullet">-</span> {scanSummary.by_severity?.high || 0} High
                <span className="vs-log-bullet">-</span> {scanSummary.by_severity?.medium || 0} Medium
                <span className="vs-log-bullet">-</span> {scanSummary.by_severity?.low || 0} Low
              </div>
            )}

            <div className="vs-log-list">
              {logs.map((log, idx) => (
                <div key={idx} className="vs-log-item">
                  <span className="vs-log-time">{log.time}</span>
                  <span className="vs-log-text">
                    {log.severity && <span className={`vs-log-dot ${log.severity}`} style={{ marginRight: '6px' }}></span>}
                    {log.text}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="vs-log-item" style={{ opacity: 0.5 }}>
                  <span className="vs-log-text">No logs yet. Start a scan to see results.</span>
                </div>
              )}
            </div>

            <div className="vs-log-footer">
              <button
                type="button"
                className="vs-view-graph-btn"
                onClick={handleViewGraph}
                style={{ marginRight: '0.5rem' }}
              >
                VIEW GRAPH
              </button>
              <button
                type="button"
                className="vs-view-graph-btn"
                onClick={() => {
                  if (!currentScanId) {
                    setToast("Please complete a scan first.");
                    setTimeout(() => setToast(""), 3000);
                    return;
                  }
                  navigate("/controls");
                }}
              >
                VIEW CONTROLS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanPage;
