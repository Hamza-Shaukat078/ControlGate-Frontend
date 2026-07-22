import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../App.css";
import { graphService, scanService } from "../api/services";

// Module-level cache: survives React route changes (unlike useRef), cleared on page reload
const _graphCache = {};
// Shared in-flight promises: if the same key is requested by a remounted component
// it attaches to the existing promise instead of starting a duplicate fetch
const _inflightFetches = {};

const GRAPH_TYPES = ["AST", "CPG"];
const VIEW_MODES = [
  { id: "trace", label: "Trace Only" },
  { id: "context", label: "Trace + Context" },
  { id: "full", label: "Full Graph" },
];
const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  unknown: "#64748b",
};

function normalizePath(value) {
  return (value || "").replace(/\\/g, "/");
}

function matchesFilePath(left, right) {
  const a = normalizePath(left);
  const b = normalizePath(right);
  if (!a || !b) return false;
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

function severityColor(severity) {
  return SEVERITY_COLORS[(severity || "").toLowerCase()] || SEVERITY_COLORS.unknown;
}

function buildPathEdgeSet(pathIds) {
  const set = new Set();
  for (let i = 0; i < pathIds.length - 1; i += 1) {
    set.add(`${pathIds[i]}=>${pathIds[i + 1]}`);
  }
  return set;
}

const GraphStage = React.memo(function GraphStage({
  graphData,
  selectedVuln,
  selectedNode,
  onSelectNode,
  viewMode,
}) {
  const svgRef = useRef(null);
  const graphNodes = useMemo(() => graphData?.nodes || [], [graphData]);
  const graphEdges = useMemo(() => graphData?.edges || [], [graphData]);
  const pathIds = useMemo(
    () => (selectedVuln?.evidence?.data_flow_path || []).filter((id) => graphNodes.some((node) => node.id === id)),
    [graphNodes, selectedVuln]
  );
  const nodeMap = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);
  const pathIdSet = useMemo(() => new Set(pathIds), [pathIds]);
  const pathEdgeSet = useMemo(() => buildPathEdgeSet(pathIds), [pathIds]);

  const visible = useMemo(() => {
    if (!graphNodes.length) {
      return { nodes: [], edges: [] };
    }
    if (viewMode === "full" || pathIds.length === 0) {
      return { nodes: graphNodes, edges: graphEdges };
    }

    const visibleIds = new Set(pathIds);
    if (viewMode === "context") {
      for (const edge of graphEdges) {
        if (visibleIds.has(edge.from) || visibleIds.has(edge.to)) {
          visibleIds.add(edge.from);
          visibleIds.add(edge.to);
        }
      }
    }

    return {
      nodes: graphNodes.filter((node) => visibleIds.has(node.id)),
      edges: graphEdges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
    };
  }, [graphEdges, graphNodes, pathIds, viewMode]);

  const positioned = useMemo(() => {
    const nodes = visible.nodes;
    const edges = visible.edges;
    if (!nodes.length) {
      return { nodes, edges, positions: new Map(), width: 980, height: 560 };
    }

    const positions = new Map();

    if (viewMode !== "full" && pathIds.length > 0) {
      const width = 980;
      const height = 560;
      const left = 96;
      const right = width - 96;
      const centerY = height / 2;
      const topBase = 130;
      const bottomBase = 430;
      const step = pathIds.length === 1 ? 0 : (right - left) / (pathIds.length - 1);

      pathIds.forEach((id, index) => {
        if (nodeMap.has(id) && nodes.find((node) => node.id === id)) {
          positions.set(id, {
            x: left + step * index,
            y: centerY,
          });
        }
      });

      const neighborGroups = new Map();
      for (const node of nodes) {
        if (pathIdSet.has(node.id)) continue;

        let anchorIndex = 0;
        for (const edge of edges) {
          if (edge.from === node.id && pathIdSet.has(edge.to)) {
            anchorIndex = Math.max(0, pathIds.indexOf(edge.to));
            break;
          }
          if (edge.to === node.id && pathIdSet.has(edge.from)) {
            anchorIndex = Math.max(0, pathIds.indexOf(edge.from));
            break;
          }
        }

        if (!neighborGroups.has(anchorIndex)) {
          neighborGroups.set(anchorIndex, []);
        }
        neighborGroups.get(anchorIndex).push(node);
      }

      for (const [anchorIndex, group] of neighborGroups.entries()) {
        const anchorId = pathIds[Math.min(anchorIndex, pathIds.length - 1)];
        const anchorPos = positions.get(anchorId) || { x: left, y: centerY };
        group.forEach((node, idx) => {
          const lane = idx % 2 === 0 ? "top" : "bottom";
          const offset = Math.floor(idx / 2);
          positions.set(node.id, {
            x: anchorPos.x + (offset % 2 === 0 ? -1 : 1) * (58 + offset * 26),
            y: lane === "top" ? topBase - offset * 34 : bottomBase + offset * 34,
          });
        });
      }

      return { nodes, edges, positions, width, height };
    }

    const width = Math.max(1120, Math.min(1800, 1020 + nodes.length * 6));
    const height = Math.max(860, Math.min(1400, 840 + nodes.length * 2));
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.34;
    const sorted = [...nodes].sort((a, b) => {
      const lineA = a.properties?.line ?? Number.MAX_SAFE_INTEGER;
      const lineB = b.properties?.line ?? Number.MAX_SAFE_INTEGER;
      if (lineA !== lineB) return lineA - lineB;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });

    sorted.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(sorted.length, 1);
      positions.set(node.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
    return { nodes, edges, positions, width, height };
  }, [nodeMap, pathIdSet, pathIds, viewMode, visible.edges, visible.nodes]);

  const showLabelsForAll = viewMode === "full" || positioned.nodes.length <= 22 || viewMode !== "full";
  const pathArray = pathIds;
  const sourceId = pathArray[0];
  const sinkId = pathArray[pathArray.length - 1];

  if (!graphNodes.length) {
    return (
      <div className="tx-empty-graph">
        <div className="tx-empty-title">No graph data available</div>
        <div className="tx-empty-sub">Run a scan on this file or choose another file.</div>
      </div>
    );
  }

  return (
    <div className="tx-graph-scroll">
      <svg
        ref={svgRef}
        width="100%"
        height={viewMode === "full" ? Math.min(920, positioned.height) : Math.min(680, positioned.height)}
        viewBox={`0 0 ${positioned.width} ${positioned.height}`}
        className="tx-graph-svg"
      >
        <defs>
          <marker id="tx-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#36557e" />
          </marker>
          <marker id="tx-arrow-hot" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
          </marker>
        </defs>

        <rect width={positioned.width} height={positioned.height} fill="#08101d" rx="10" />
        <g>
        <g>
          {positioned.edges.map((edge, idx) => {
            const fromPos = positioned.positions.get(edge.from);
            const toPos = positioned.positions.get(edge.to);
            if (!fromPos || !toPos) return null;
            const isHot = pathEdgeSet.has(`${edge.from}=>${edge.to}`);
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const sourceRadius = pathIdSet.has(edge.from) ? 28 : 20;
            const targetRadius = pathIdSet.has(edge.to) ? 28 : 20;
            const x1 = fromPos.x + (dx / len) * sourceRadius;
            const y1 = fromPos.y + (dy / len) * sourceRadius;
            const x2 = toPos.x - (dx / len) * (targetRadius + 8);
            const y2 = toPos.y - (dy / len) * (targetRadius + 8);
            return (
              <line
                key={`${edge.from}-${edge.to}-${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isHot ? "#ef4444" : "rgba(74, 126, 184, 0.45)"}
                strokeWidth={isHot ? 2.8 : 1.4}
                opacity={viewMode === "full" ? (isHot ? 1 : 0.38) : (isHot ? 1 : 0.26)}
                markerEnd={isHot ? "url(#tx-arrow-hot)" : "url(#tx-arrow)"}
              />
            );
          })}
        </g>

        <g>
          {positioned.nodes.map((node) => {
            const pos = positioned.positions.get(node.id);
            if (!pos) return null;
            const isPathNode = pathIdSet.has(node.id);
            const isSource = node.id === sourceId;
            const isSink = node.id === sinkId;
            const isSelected = selectedNode?.id === node.id;
            const radius = viewMode === "full"
              ? (isPathNode ? 26 : 7)
              : (isPathNode ? 28 : 20);
            let fill = "#132137";
            let stroke = "#33557f";
            if (isSource) {
              fill = "#4c1d1d";
              stroke = "#ef4444";
            } else if (isSink) {
              fill = "#5a230f";
              stroke = "#fb923c";
            } else if (isPathNode) {
              fill = "#3d2715";
              stroke = "#f59e0b";
            }
            if (isSelected) {
              stroke = "#22d3ee";
            }

            const label = String(node.label || node.type || "Node");
            const line = node.properties?.line;
            const showLabel = showLabelsForAll || isPathNode || isSelected;

            return (
              <g key={node.id} className="tx-node" onClick={() => onSelectNode(node)}>
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius + 8}
                    fill="none"
                    stroke="#22d3ee"
                    strokeDasharray="4 4"
                    opacity="0.85"
                  />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text x={pos.x} y={pos.y + 2} textAnchor="middle" className="tx-node-core">
                  {viewMode === "full"
                    ? ""
                    : (isSource ? "SRC" : isSink ? "SNK" : isPathNode ? "PATH" : node.type === "NodeType.FILE" ? "FILE" : "N")}
                </text>
                {showLabel && (
                  <>
                    <text x={pos.x} y={pos.y - radius - 12} textAnchor="middle" className="tx-node-label">
                      {label.length > (viewMode === "full" ? 18 : 22) ? `${label.slice(0, viewMode === "full" ? 17 : 21)}...` : label}
                    </text>
                    <text x={pos.x} y={pos.y + radius + 16} textAnchor="middle" className="tx-node-meta">
                      {line ? `L${line}` : (node.type || "").replace("NodeType.", "")}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
        </g>
      </svg>
    </div>
  );
});

function GraphsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scanId = searchParams.get("scanId");
  const fileId = searchParams.get("fileId") || "main";

  const [activeScanId, setActiveScanId] = useState(scanId || localStorage.getItem("lastScanId") || null);
  const [graphType, setGraphType] = useState("AST");
  const [viewMode, setViewMode] = useState("trace");
  const [graphData, setGraphData] = useState(null);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(fileId || "main");
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [selectedVuln, setSelectedVuln] = useState(null);
  const [scanSummary, setScanSummary] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vulnView, setVulnView] = useState("all");
  const [renderGraph, setRenderGraph] = useState(false);
  const lineRefs = useRef({});
  const requestedGraphType = viewMode === "full" ? graphType : "CPG";

  useEffect(() => {
    if (scanId) {
      setActiveScanId(scanId);
      return;
    }
    const stored = localStorage.getItem("lastScanId");
    if (stored) {
      setActiveScanId(stored);
      navigate(`/graphs?scanId=${stored}&fileId=${activeFileId}`, { replace: true });
      return;
    }
    setActiveScanId(null);
  }, [scanId, navigate, activeFileId]);

  useEffect(() => {
    if (fileId && fileId !== "main" && fileId !== activeFileId) {
      setActiveFileId(fileId);
    }
  }, [fileId, activeFileId]);

  useEffect(() => {
    if (activeScanId) {
      localStorage.setItem("lastScanId", activeScanId);
    }
  }, [activeScanId]);

  useEffect(() => {
    if (!activeScanId) return;
    let alive = true;

    async function fetchSummary() {
      try {
        const response = await scanService.getSummary(activeScanId);
        if (!alive) return;
        const scanData = response.data || response;
        const normalizedSummary = {
          ...(scanData.summary || scanData),
          scan_id: scanData.scan_id || scanData.id || scanData.summary?.scan_id,
          status: scanData.status || scanData.summary?.status,
          input_type: scanData.input_type || scanData.summary?.input_type,
          files_scanned: scanData.files_scanned || scanData.summary?.files_scanned,
          total_files: scanData.total_files || scanData.summary?.total_files,
          duration_seconds: scanData.duration_seconds || scanData.summary?.duration_seconds,
          completed_at: scanData.completed_at || scanData.summary?.completed_at,
          by_severity: scanData.by_severity || scanData.summary?.by_severity,
          vulnerabilities_found: scanData.vulnerabilities_found || scanData.summary?.vulnerabilities_found,
          total_vulns: scanData.total_vulns || scanData.summary?.total_vulns,
        };
        setScanSummary(normalizedSummary);
        setVulnerabilities(scanData.vulnerabilities || []);
        setSelectedVuln((prev) => prev || (scanData.vulnerabilities || [])[0] || null);
      } catch (err) {
        console.error("Failed to fetch vulnerabilities:", err);
        setScanSummary(null);
        setVulnerabilities([]);
      }
    }

    fetchSummary();
    return () => {
      alive = false;
    };
  }, [activeScanId]);

  useEffect(() => {
    if (!activeScanId) return;
    let alive = true;

    const fetchKey = `${activeScanId}|${activeFileId}|${requestedGraphType}`;

    // Serve from module-level cache immediately — survives navigation
    if (_graphCache[fetchKey]) {
      const cached = _graphCache[fetchKey];
      setGraphData(cached);
      setAvailableFiles(Array.isArray(cached?.file?.available_files) ? cached.file.available_files : []);
      setActiveFilePath(cached?.file?.file_path || null);
      setLoading(false);
      return () => { alive = false; };
    }

    setLoading(true);
    setError(null);

    // Reuse an in-flight promise for this key so a remounted component never
    // starts a duplicate request — it simply subscribes to the same fetch
    if (!_inflightFetches[fetchKey]) {
      _inflightFetches[fetchKey] = graphService
        .getGraph(activeScanId, activeFileId, requestedGraphType)
        .then((response) => {
          const data = response.data || response;
          _graphCache[fetchKey] = data;
          delete _inflightFetches[fetchKey];
          return data;
        })
        .catch((err) => {
          delete _inflightFetches[fetchKey];
          throw err;
        });
    }

    _inflightFetches[fetchKey]
      .then((data) => {
        if (!alive) return;
        setGraphData(data);
        const files = Array.isArray(data?.file?.available_files) ? data.file.available_files : [];
        setAvailableFiles(files);
        setActiveFilePath(data?.file?.file_path || null);
        if (activeFileId === "main" && data?.file?.file_id && data.file.file_id !== activeFileId) {
          setActiveFileId(data.file.file_id);
          navigate(`/graphs?scanId=${activeScanId}&fileId=${data.file.file_id}`, { replace: true });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        console.error("Failed to fetch graph:", err);
        setGraphData(null);
        setError("Trace data is not available for this scan yet.");
        setLoading(false);
      });

    return () => { alive = false; };
  }, [activeFileId, activeScanId, navigate, requestedGraphType]);

  useEffect(() => {
    if (!selectedVuln || !availableFiles.length || !activeScanId) return;
    const vulnFile = selectedVuln.location?.file;
    if (!vulnFile) return;
    const match = availableFiles.find((file) => matchesFilePath(file.path, vulnFile));
    if (match?.id && activeFileId === "main") {
      setActiveFileId(match.id);
      navigate(`/graphs?scanId=${activeScanId}&fileId=${match.id}`, { replace: true });
    }
  }, [selectedVuln, availableFiles, activeFileId, activeScanId, navigate]);

  useEffect(() => {
    setSelectedNode((prev) => {
      if (!prev || !graphData?.nodes?.some((node) => node.id === prev.id)) {
        return null;
      }
      return prev;
    });
  }, [graphData]);

  const vulnerabilitiesForFile = useMemo(() => {
    if (!activeFilePath) return vulnerabilities;
    return vulnerabilities.filter((vuln) => matchesFilePath(vuln.location?.file, activeFilePath));
  }, [activeFilePath, vulnerabilities]);

  const vulnerabilitiesForSelector = useMemo(() => {
    const source = vulnerabilitiesForFile;
    if (vulnView === "ai") {
      return source.filter((v) => v.analysis?.llm_classification?.classification === "VULNERABLE");
    }
    return source;
  }, [vulnView, vulnerabilitiesForFile]);

  useEffect(() => {
    if (!vulnerabilitiesForSelector.length) {
      setSelectedVuln(null);
      return;
    }
    if (!selectedVuln || !vulnerabilitiesForSelector.find((v) => v.id === selectedVuln.id)) {
      setSelectedVuln(vulnerabilitiesForSelector[0]);
    }
  }, [selectedVuln, vulnerabilitiesForSelector]);

  const fileContent = graphData?.file?.source_content || graphData?.source_content || "";
  const codeLines = useMemo(() => fileContent.split(/\r?\n/), [fileContent]);
  const nodesById = useMemo(() => new Map((graphData?.nodes || []).map((node) => [node.id, node])), [graphData]);
  const selectedPathIds = useMemo(
    () => (selectedVuln?.evidence?.data_flow_path || []).filter((id) => nodesById.has(id)),
    [nodesById, selectedVuln]
  );
  const pathNodes = useMemo(() => selectedPathIds.map((id) => nodesById.get(id)).filter(Boolean), [nodesById, selectedPathIds]);
  const pathLines = useMemo(() => {
    const lines = new Set();
    pathNodes.forEach((node) => {
      const line = node?.properties?.line;
      if (Number.isFinite(line)) lines.add(line);
    });
    return lines;
  }, [pathNodes]);
  const selectedLine = selectedNode?.properties?.line || selectedVuln?.location?.start_line || 1;

  const codeWindow = useMemo(() => {
    const total = codeLines.length;
    if (!total) {
      return { start: 1, end: 0, lines: [] };
    }
    const radius = 200;
    const start = Math.max(1, selectedLine - radius);
    const end = Math.min(total, selectedLine + radius);
    return { start, end, lines: codeLines.slice(start - 1, end) };
  }, [codeLines, selectedLine]);

  useEffect(() => {
    if (!selectedLine) return;
    const el = lineRefs.current[selectedLine];
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedLine, fileContent]);

  useEffect(() => {
    if (!graphData) {
      setRenderGraph(false);
      return;
    }
    let alive = true;
    setRenderGraph(false);

    const schedule = (cb) => {
      if (typeof requestIdleCallback !== "undefined") {
        return requestIdleCallback(cb);
      }
      return setTimeout(cb, 0);
    };

    const cancel = (id) => {
      if (typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };

    const handle = schedule(() => {
      if (alive) setRenderGraph(true);
    });

    const fallback = setTimeout(() => {
      if (alive) setRenderGraph(true);
    }, 120);

    return () => {
      alive = false;
      cancel(handle);
      clearTimeout(fallback);
    };
  }, [graphData, activeFileId, requestedGraphType]);

  const lineNodeMap = useMemo(() => {
    const map = new Map();
    (graphData?.nodes || []).forEach((node) => {
      const line = node.properties?.line;
      if (!Number.isFinite(line)) return;
      if (!map.has(line)) map.set(line, []);
      map.get(line).push(node);
    });
    return map;
  }, [graphData]);

  const summaryCounts = useMemo(() => {
    const base = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    vulnerabilities.forEach((vuln) => {
      const key = (vuln.severity || "").toLowerCase();
      base.total += 1;
      if (base[key] !== undefined) base[key] += 1;
    });
    return base;
  }, [vulnerabilities]);

  const vulnerabilityTitle = selectedVuln?.type || "No vulnerability selected";
  const severity = (selectedVuln?.severity || "unknown").toLowerCase();
  const severityStyle = { color: severityColor(severity), borderColor: `${severityColor(severity)}44` };
  const graphMeta = graphData?.meta || { total_nodes: 0, total_edges: 0, tainted_nodes: 0 };
  const activeLanguage = graphData?.file?.language || "text";

  const handleLineClick = (lineNumber) => {
    const candidates = lineNodeMap.get(lineNumber) || [];
    if (!candidates.length) return;
    const preferred = candidates.find((node) => selectedPathIds.includes(node.id)) || candidates[0];
    setSelectedNode(preferred);
  };

  if (!activeScanId) {
    return (
      <div className="gp-page">
        <div className="gp-state">
          <div className="gp-state-icon">{"// NO SCAN //"}</div>
          <div className="gp-state-text">Select a scan to explore traces.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="gp-page tx-page">
      <div className="gp-header">
        <div>
          <h1 className="gp-title" data-text="TRACE EXPLORER">Trace Explorer</h1>
          <p className="gp-scan-id">
            SCAN_ID: <code>{activeScanId}</code>
          </p>
        </div>
        <div className="tx-summary-cards">
          <div className="tx-summary-card">
            <span className="tx-summary-number">{scanSummary?.files_scanned || availableFiles.length || 0}</span>
            <span className="tx-summary-label">Files</span>
          </div>
          <div className="tx-summary-card">
            <span className="tx-summary-number">{summaryCounts.total}</span>
            <span className="tx-summary-label">Findings</span>
          </div>
          <div className="tx-summary-card tx-summary-card--critical">
            <span className="tx-summary-number">{summaryCounts.critical}</span>
            <span className="tx-summary-label">Critical</span>
          </div>
          <div className="tx-summary-card">
            <span className="tx-summary-number">{graphMeta.total_nodes}</span>
            <span className="tx-summary-label">Nodes</span>
          </div>
        </div>
      </div>

      <div className="tx-toolbar">
        <div className="tx-control">
          <span className="gp-type-label">File</span>
          <select
            value={activeFileId}
            onChange={(e) => {
              const nextId = e.target.value;
              setActiveFileId(nextId);
              navigate(`/graphs?scanId=${activeScanId}&fileId=${nextId}`, { replace: true });
            }}
            className="gp-select gp-select--wide"
          >
            {availableFiles.map((file) => (
              <option key={file.id} value={file.id}>
                {file.path || file.id}
              </option>
            ))}
          </select>
        </div>

        <div className="tx-control tx-control--wide">
          <span className="gp-type-label">Finding</span>
          <div className="tx-vuln-picker">
            <div className="rp6-toggle">
              <button
                type="button"
                className={`rp6-toggle-btn ${vulnView === "all" ? "active" : ""}`}
                onClick={() => setVulnView("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`rp6-toggle-btn ${vulnView === "ai" ? "active" : ""}`}
                onClick={() => setVulnView("ai")}
              >
                AI-validated
              </button>
            </div>
            <select
              value={selectedVuln?.id || ""}
              onChange={(e) => {
                const next = vulnerabilitiesForSelector.find((vuln) => vuln.id === e.target.value) || null;
                setSelectedVuln(next);
                setSelectedNode(null);
              }}
              className="gp-select gp-select--flex"
            >
              {vulnerabilitiesForSelector.map((vuln) => (
                <option key={vuln.id} value={vuln.id}>
                  {vuln.type} - {vuln.severity} (Line {vuln.location?.start_line || "-"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tx-control">
          <span className="gp-type-label">View</span>
          <div className="tx-segment">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`tx-segment-btn ${viewMode === mode.id ? "active" : ""}`}
                onClick={() => setViewMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "full" && (
          <div className="tx-control">
            <span className="gp-type-label">Graph</span>
            <div className="tx-segment">
              {GRAPH_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`tx-segment-btn ${graphType === type ? "active" : ""}`}
                  onClick={() => setGraphType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedVuln && (
        <div className="tx-vuln-banner">
          <div className="tx-vuln-banner-main">
            <div className="tx-vuln-kicker">Selected Finding</div>
            <div className="tx-vuln-title-row">
              <h2 className="tx-vuln-title">{vulnerabilityTitle}</h2>
              <span className="tx-vuln-severity" style={severityStyle}>{(selectedVuln.severity || "unknown").toUpperCase()}</span>
            </div>
            <div className="tx-vuln-meta">
              <span>{selectedVuln.location?.file || activeFilePath || "Unknown file"}</span>
              <span>Line {selectedVuln.location?.start_line || "-"}</span>
              <span>{selectedPathIds.length ? `${selectedPathIds.length} path node${selectedPathIds.length === 1 ? "" : "s"}` : "No explicit data-flow path"}</span>
            </div>
          </div>
          <div className="tx-vuln-io">
            <div><strong>Source</strong><code>{selectedVuln.evidence?.source || "n/a"}</code></div>
            <div><strong>Sink</strong><code>{selectedVuln.evidence?.sink || "n/a"}</code></div>
          </div>
        </div>
      )}

      <div className="tx-main-grid">
        <section className="tx-panel tx-panel--graph">
          <div className="tx-panel-head">
            <div>
              <div className="tx-panel-kicker">Trace Map</div>
              <div className="tx-panel-title">
                {viewMode === "trace" ? "Exploit path only" : viewMode === "context" ? "Path with one-hop context" : "Full file graph"}
              </div>
            </div>
            <div className="tx-graph-stats">
              <span>{graphMeta.total_nodes} nodes</span>
              <span>{graphMeta.total_edges} edges</span>
              <span>{graphMeta.tainted_nodes || 0} tainted</span>
            </div>
          </div>
          {loading ? (
            <div className="gp-state">
              <div className="gp-state-icon">LOADING {requestedGraphType}</div>
              <div className="gp-state-sub">Building trace view...</div>
            </div>
          ) : error ? (
            <div className="gp-state">
              <div className="gp-state-icon">{"// ERROR //"}</div>
              <div className="gp-state-text">{error}</div>
            </div>
          ) : renderGraph ? (
            <GraphStage
              graphData={graphData}
              selectedVuln={selectedVuln}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              viewMode={viewMode}
            />
          ) : (
            <div className="gp-state">
              <div className="gp-state-icon">PREPARING VIEW</div>
              <div className="gp-state-sub">Optimizing trace render…</div>
            </div>
          )}
        </section>

        <section className="tx-panel tx-panel--code">
          <div className="tx-panel-head">
            <div>
              <div className="tx-panel-kicker">Code Viewer</div>
              <div className="tx-panel-title">{activeFilePath || "Current file"}</div>
            </div>
            <div className="tx-code-meta">
              <span>{activeLanguage}</span>
              <span>{codeLines.length} lines</span>
            </div>
          </div>
          {fileContent ? (
            <div className="tx-code-scroll">
              {codeWindow.lines.map((line, index) => {
                const lineNumber = codeWindow.start + index;
                const isVulnLine = selectedVuln?.location?.start_line === lineNumber;
                const isPathLine = pathLines.has(lineNumber);
                const isSelectedLine = selectedNode?.properties?.line === lineNumber;
                const rowClass = [
                  "tx-code-row",
                  isPathLine ? "tx-code-row--path" : "",
                  isVulnLine ? "tx-code-row--vuln" : "",
                  isSelectedLine ? "tx-code-row--selected" : "",
                ].filter(Boolean).join(" ");
                return (
                  <button
                    key={lineNumber}
                    ref={(el) => {
                      lineRefs.current[lineNumber] = el;
                    }}
                    type="button"
                    className={rowClass}
                    onClick={() => handleLineClick(lineNumber)}
                  >
                    <span className="tx-code-gutter">{lineNumber}</span>
                    <span className="tx-code-content">{line || " "}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="tx-empty-graph">
              <div className="tx-empty-title">Source text not stored for this scan</div>
              <div className="tx-empty-sub">Run a fresh scan to unlock synchronized code navigation for this file.</div>
            </div>
          )}
        </section>
      </div>

      <div className="tx-bottom-grid">
        <section className="tx-panel">
          <div className="tx-panel-head">
            <div>
              <div className="tx-panel-kicker">Path Steps</div>
              <div className="tx-panel-title">Click a step to sync graph and code</div>
            </div>
          </div>
          {pathNodes.length ? (
            <div className="tx-path-list">
              {pathNodes.map((node, index) => (
                <button
                  key={node.id}
                  type="button"
                  className={`tx-path-step ${selectedNode?.id === node.id ? "active" : ""}`}
                  onClick={() => setSelectedNode(node)}
                >
                  <span className="tx-path-step-index">{index + 1}</span>
                  <span className="tx-path-step-main">
                    <strong>{node.label || node.type}</strong>
                    <span>{node.properties?.line ? `Line ${node.properties.line}` : node.type}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="tx-empty-sub">This finding does not have a stored data-flow path.</div>
          )}
        </section>

        <section className="tx-panel">
          <div className="tx-panel-head">
            <div>
              <div className="tx-panel-kicker">Selection</div>
              <div className="tx-panel-title">{selectedNode ? "Node details" : "Choose a node or code line"}</div>
            </div>
          </div>
          {selectedNode ? (
            <div className="tx-node-detail">
              <div className="tx-node-detail-row"><strong>Label</strong><span>{selectedNode.label}</span></div>
              <div className="tx-node-detail-row"><strong>Type</strong><span>{selectedNode.type}</span></div>
              <div className="tx-node-detail-row"><strong>Line</strong><span>{selectedNode.properties?.line || "-"}</span></div>
              <div className="tx-node-detail-row"><strong>Column</strong><span>{selectedNode.properties?.column || "-"}</span></div>
              <div className="tx-node-detail-row"><strong>Path status</strong><span>{selectedPathIds.includes(selectedNode.id) ? "In vulnerable trace" : "Context node"}</span></div>
              {selectedNode.properties?.value !== undefined && selectedNode.properties?.value !== null && (
                <div className="tx-node-detail-row"><strong>Value</strong><span>{String(selectedNode.properties.value)}</span></div>
              )}
            </div>
          ) : (
            <div className="tx-empty-sub">Select a path step, graph node, or highlighted code line to inspect it.</div>
          )}
        </section>

        <section className="tx-panel">
          <div className="tx-panel-head">
            <div>
              <div className="tx-panel-kicker">Findings In File</div>
              <div className="tx-panel-title">{vulnerabilitiesForSelector.length} visible finding{vulnerabilitiesForSelector.length === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div className="tx-findings-list">
            {vulnerabilitiesForSelector.map((vuln) => (
              <button
                key={vuln.id}
                type="button"
                className={`tx-finding-item ${selectedVuln?.id === vuln.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedVuln(vuln);
                  setSelectedNode(null);
                }}
              >
                <span className="tx-finding-title">{vuln.type}</span>
                <span className="tx-finding-meta" style={{ color: severityColor(vuln.severity) }}>
                  {(vuln.severity || "unknown").toUpperCase()} · Line {vuln.location?.start_line || "-"}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default GraphsPage;