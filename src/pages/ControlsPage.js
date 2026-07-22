// src/pages/ControlsPage.js
import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import "../App.css";
import ControlDetailDrawer from "../components/ControlDetailDrawer";
import { getChapterSummaries, getControlsByChapter, getResult } from "../data/asvsCatalog";

const VERDICT_LABEL = {
  pass: "Pass",
  fail: "Fail",
  n_a: "N/A",
  manual_review: "Manual review",
  not_tested: "Not tested",
};

export default function ControlsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialChapter = searchParams.get("chapter");
  const initialControl = searchParams.get("control");

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [verdictFilter, setVerdictFilter] = useState("all");
  const [openChapters, setOpenChapters] = useState(() => new Set(initialChapter ? [initialChapter] : []));
  const [selected, setSelected] = useState(null);

  const chapterSummaries = useMemo(() => getChapterSummaries(), []);

  const matchesFilters = (control) => {
    const result = getResult(control.control_id);
    if (levelFilter !== "all" && control.level !== levelFilter) return false;
    if (verdictFilter !== "all" && result.verdict !== verdictFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!control.control_id.toLowerCase().includes(q) && !control.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  };

  const toggleChapter = (chapterId) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const openControl = (control) => {
    setSelected({ control, result: getResult(control.control_id) });
  };

  React.useEffect(() => {
    if (initialControl) {
      const chapterId = initialControl.split(".")[0];
      const control = getControlsByChapter(chapterId).find((c) => c.control_id === initialControl);
      if (control) {
        setOpenChapters((prev) => new Set(prev).add(chapterId));
        openControl(control);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDrawer = () => {
    setSelected(null);
    if (searchParams.get("control")) {
      const next = new URLSearchParams(searchParams);
      next.delete("control");
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Control Catalog</h1>
        <p className="page-subtitle">
          All {chapterSummaries.reduce((s, c) => s + c.control_count, 0)} ASVS 5.0.0 Level 1 requirements across {chapterSummaries.length} chapters.
        </p>
      </div>

      <div className="controls-toolbar">
        <input
          className="input"
          placeholder="Search control ID or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input filter-select" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="all">All levels</option>
          <option value="L1">L1</option>
          <option value="L2">L2</option>
          <option value="L3">L3</option>
        </select>
        <select className="input filter-select" value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
          <option value="all">All verdicts</option>
          {Object.entries(VERDICT_LABEL).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        {chapterSummaries.map((chapter) => {
          const isOpen = openChapters.has(chapter.chapter_id);
          const chapterControls = getControlsByChapter(chapter.chapter_id).filter(matchesFilters);
          const c = chapter.counts || {};
          return (
            <div className="accordion-item" key={chapter.chapter_id}>
              <div className="accordion-head" onClick={() => toggleChapter(chapter.chapter_id)}>
                <div className="chapter-accordion-title">
                  <span className={`chapter-chevron ${isOpen ? "open" : ""}`}><ChevronRight size={16} /></span>
                  <span className="chapter-accordion-id">{chapter.chapter_id}</span>
                  <span className="chapter-accordion-name">{chapter.title}</span>
                  <span className="chapter-accordion-count">({chapter.control_count})</span>
                </div>
                <div className="chapter-accordion-counts">
                  {c.pass > 0 && <span className="badge badge-pass">{c.pass} pass</span>}
                  {c.fail > 0 && <span className="badge badge-fail">{c.fail} fail</span>}
                  {c.not_tested > 0 && <span className="badge badge-not_tested">{c.not_tested} untested</span>}
                </div>
              </div>
              {isOpen && (
                <div className="accordion-body">
                  {chapterControls.length === 0 ? (
                    <div className="empty-state">No controls match the current filters.</div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Description</th>
                          <th>Level</th>
                          <th>Strategy</th>
                          <th>Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapterControls.map((control) => {
                          const result = getResult(control.control_id);
                          return (
                            <tr key={control.control_id} className="is-clickable" onClick={() => openControl(control)}>
                              <td className="control-row-id">{control.control_id}</td>
                              <td className="control-row-desc">{control.description}</td>
                              <td><span className={`badge badge-level-${control.level}`}>{control.level}</span></td>
                              <td>
                                <span className="badge badge-strategy">
                                  {control.detection_strategy === "manual_attestation" ? "Manual" : control.detection_strategy.replace("_", " ")}
                                </span>
                              </td>
                              <td><span className={`badge badge-${result.verdict}`}>{VERDICT_LABEL[result.verdict]}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <ControlDetailDrawer control={selected.control} result={selected.result} onClose={closeDrawer} />
      )}
    </div>
  );
}
