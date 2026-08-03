import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const ActiveScanContext = createContext();

const PATH_LIKE = /[\w./-]+\.\w{1,10}(?::\d+)?/;

function extractFilePath(text) {
  if (!text) return null;
  const match = text.match(PATH_LIKE);
  return match ? match[0] : null;
}

export function ActiveScanProvider({ children }) {
  const [state, setState] = useState({
    scanning: false,
    scanId: null,
    repoName: null,
    progress: 0,
    eta: "",
    currentFile: null,
    startedAt: null,
  });

  const startScan = useCallback(({ scanId, repoName }) => {
    setState({
      scanning: true,
      scanId,
      repoName: repoName || null,
      progress: 0,
      eta: "",
      currentFile: null,
      startedAt: Date.now(),
    });
  }, []);

  const updateProgress = useCallback(({ progress, eta }) => {
    setState((s) => (s.scanning ? { ...s, progress: progress ?? s.progress, eta: eta ?? s.eta } : s));
  }, []);

  const appendLog = useCallback((text) => {
    const file = extractFilePath(text);
    if (!file) return;
    setState((s) => (s.scanning ? { ...s, currentFile: file } : s));
  }, []);

  const finishScan = useCallback(() => {
    setState((s) => ({ ...s, scanning: false }));
  }, []);

  const clearScan = useCallback(() => {
    setState({
      scanning: false,
      scanId: null,
      repoName: null,
      progress: 0,
      eta: "",
      currentFile: null,
      startedAt: null,
    });
  }, []);

  /** Seed from a real status payload (e.g. after a hard reload) without a live WS. */
  const seedFromStatus = useCallback(({ scanId, repoName, progress, eta }) => {
    setState({
      scanning: true,
      scanId,
      repoName: repoName || null,
      progress: progress ?? 0,
      eta: eta || "",
      currentFile: null,
      startedAt: Date.now(),
    });
  }, []);

  const value = useMemo(
    () => ({ ...state, startScan, updateProgress, appendLog, finishScan, clearScan, seedFromStatus }),
    [state, startScan, updateProgress, appendLog, finishScan, clearScan, seedFromStatus]
  );

  return <ActiveScanContext.Provider value={value}>{children}</ActiveScanContext.Provider>;
}

export function useActiveScan() {
  return useContext(ActiveScanContext);
}
