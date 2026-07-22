// src/pages/RepoIntegrationPage.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { repositoryService } from "../api/services";

const PROVIDERS = ["GITHUB", "LOCAL"];

function RepoIntegrationPage() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [repoBranches, setRepoBranches] = useState({}); // { repoId: [branches] }
  const [pageMessage, setPageMessage] = useState("");
  const [newRepo, setNewRepo] = useState({
    name: "",
    provider: "GITHUB",
    url: "",
    token: "",
  });
  const [addingRepo, setAddingRepo] = useState(false);
  const [githubStatus, setGithubStatus] = useState("Not connected");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const checkedGithubRepoRef = useRef(null);

  // Fetch repositories from API
  const fetchRepositories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await repositoryService.list();
      const repos = res.data || [];
      setRepositories(repos);
      const branchPromises = repos.map(async (repo) => {
        try {
          const resBranches = await repositoryService.getBranches(repo.id);
          return {
            id: repo.id,
            branches: Array.isArray(resBranches.data?.branches) ? resBranches.data.branches : ["main"],
          };
        } catch {
          return { id: repo.id, branches: ["main", "dev", "master"] };
        }
      });
      const branchResults = await Promise.all(branchPromises);
      const nextBranches = {};
      branchResults.forEach((item) => {
        nextBranches[item.id] = item.branches;
      });
      setRepoBranches(nextBranches);
    } catch (err) {
      console.error("Failed to fetch repositories:", err);
      const msg = err.response?.data?.detail || "Failed to load repositories.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch repositories on page load
  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  useEffect(() => {
    const githubRepo = repositories.find((repo) => repo.provider === "GITHUB");
    if (!githubRepo) {
      setGithubStatus("Not connected");
      checkedGithubRepoRef.current = null;
      return;
    }
    if (checkedGithubRepoRef.current === githubRepo.id) {
      return;
    }
    checkedGithubRepoRef.current = githubRepo.id;
    setGithubStatus(githubRepo.url ? "Connected" : "Not connected");
  }, [repositories]);

  // Add new repository
  const handleAddRepository = async (e) => {
    e.preventDefault();
    if (!newRepo.name.trim()) {
      setPageMessage("Repository name is required.");
      return;
    }
    setAddingRepo(true);
    try {
      setPageMessage("");
      const payload = {
        name: newRepo.name.trim(),
        provider: newRepo.provider,
        url: newRepo.url.trim() || undefined,
        token: newRepo.token.trim() || undefined,
        status: "CONNECTED",
      };
      await repositoryService.create(payload);
      setShowAddModal(false);
      setNewRepo({ name: "", provider: "GITHUB", url: "", token: "" });
      fetchRepositories();
    } catch (err) {
      console.error("Failed to add repository:", err);
      const msg = err.response?.data?.detail || "Failed to add repository.";
      setPageMessage(msg);
    } finally {
      setAddingRepo(false);
    }
  };

  // Delete repository by ID
  const handleDelete = async (id) => {
    if (!confirmDeleteId) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await repositoryService.delete(id);
      setRepositories((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete repository:", err);
      const msg = err.response?.data?.detail || "Failed to delete repository.";
      setPageMessage(msg);
      setConfirmDeleteId(null);
    }
  };

  // Trigger a scan for repo
  const handleScanNow = (id) => {
    navigate(`/scan?repoId=${id}`);
  };
  // Upload a local ZIP/TAR source code
  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      setUploadMessage("File must be under 200 MB.");
      return;
    }

    try {
      setUploading(true);
      setUploadMessage("Uploading...");
      // For upload, we need a repo ID. Create a placeholder LOCAL repo first
      const createRes = await repositoryService.create({
        name: file.name.replace(/\.(zip|tar|gz|tar\.gz)$/i, ""),
        provider: "LOCAL",
        status: "CONNECTED",
      });
      const repoId = createRes.data.id;
      // Step 2: Upload the file contents to backend
      await repositoryService.upload(repoId, file);
      setUploadMessage("Upload complete. You can scan now.");
      fetchRepositories();
    } catch (err) {
      console.error("Upload failed:", err);
      const msg = err.response?.data?.detail || err.message || "Upload failed";
      setUploadMessage(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
    // Reset file input
    event.target.value = "";
  };

  if (loading) {
    return (
      <div className="ri-page">
        <div className="ri-cyber-loader">
          <div className="ri-cyber-loader-bar" />
          <span>INITIALIZING REPOSITORY LINK...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ri-page">
        <div style={{ color: "#f97373", marginBottom: "0.5rem", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
          ⚠ {error}
        </div>
        <button className="ri-add-btn" onClick={fetchRepositories}>
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="ri-page">
      <h1 className="ri-heading" data-text="Repository Integration">Repository Integration</h1>
      <p className="ri-subheading">
        Connect a GitHub repository or upload a local archive to scan your codebase.
      </p>
      <div className="ri-cyber-status-bar">
        <span className="ri-cyber-dot" />
        <span>SYSTEM ONLINE</span>
        <span className="ri-cyber-sep">{"//"}</span>
        <span>{repositories.length} {repositories.length === 1 ? "REPOSITORY" : "REPOSITORIES"} LINKED</span>
        <span className="ri-cyber-sep">{"//"}</span>
        <span>SECURE CHANNEL ACTIVE</span>
      </div>

      {pageMessage && <div className="acct-error" style={{ marginBottom: "1rem" }}>{pageMessage}</div>}

      <div className="ri-shell">
        {/* Add new */}
        <div className="ri-header-actions">
          <button
            className="ri-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Link Repository
          </button>
        </div>

        {/* Add Repository Modal */}
        {showAddModal && (
          <div className="ri-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="ri-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ri-modal-header">
                <h2 className="ri-modal-title">Add Repository</h2>
                <p className="ri-modal-subtitle">Connect a GitHub repo or add a local archive.</p>
              </div>
              <form onSubmit={handleAddRepository}>
                <div className="ri-form-grid">
                  <div className="ri-form-group">
                    <label>Repository Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., my-project"
                      value={newRepo.name}
                      onChange={(e) =>
                        setNewRepo((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="ri-form-group">
                    <label>Provider</label>
                    <select
                      value={newRepo.provider}
                      onChange={(e) =>
                        setNewRepo((prev) => ({ ...prev, provider: e.target.value }))
                      }
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ri-form-group full">
                    <label>Repository URL</label>
                    <input
                      type="text"
                      placeholder="https://github.com/user/repo"
                      value={newRepo.url}
                      onChange={(e) =>
                        setNewRepo((prev) => ({ ...prev, url: e.target.value }))
                      }
                    />
                  </div>
                  <div className="ri-form-group full">
                    <label>Access Token (optional)</label>
                    <input
                      type="password"
                      placeholder="Personal access token"
                      value={newRepo.token}
                      onChange={(e) =>
                        setNewRepo((prev) => ({ ...prev, token: e.target.value }))
                      }
                    />
                    <div className="ri-form-helper">
                      Only required for private repositories.
                    </div>
                  </div>
                </div>
                <div className="ri-modal-actions">
                  <button
                    type="button"
                    className="ri-modal-cancel"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ri-add-btn"
                    disabled={addingRepo}
                  >
                    {addingRepo ? "Adding..." : "Add Repository"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PROVIDER LIST - pixel perfect */}
        <div className="ri-provider-stack">
          <ProviderRow
            provider="GitHub"
            icon="/github.svg"
            leftStatus={githubStatus}
            rightStatus={githubStatus}
          />
        </div>

        {/* Upload card */}
        <div className="ri-upload-card">
          <label htmlFor="file-upload" className="ri-upload-inner">
            <div className="ri-upload-icon-circle">
              <svg className="ri-upload-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 4v11"
                  fill="none"
                  stroke="#cbd5f5"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M8 8l4-4 4 4"
                  fill="none"
                  stroke="#cbd5f5"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 14v4h14v-4"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="ri-upload-text-block">
              <div className="ri-upload-title">Upload Local Source Code</div>
              <div className="ri-upload-sub">
                ZIP or TAR.GZ, max size 200 MB
              </div>
              {uploadMessage && (
                <div style={{ color: uploadMessage.startsWith("Upload failed") ? "#f97373" : "#94a3b8", fontSize: "0.85rem", marginTop: "0.35rem" }}>
                  {uploadMessage}
                </div>
              )}
            </div>
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".zip,.tar,.gz,.tar.gz"
            onChange={handleUpload}
            style={{ display: "none" }}
            disabled={uploading}
          />
        </div>

        {/* Table */}
        <div className="ri-table-wrapper">
          <table className="ri-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Branch</th>
                <th>Last Scan</th>
                <th>Findings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {repositories.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", color: "#888" }}>
                    No repositories found. Add one above or upload source code.
                  </td>
                </tr>
              ) : (
                repositories.map((repo) => {
                  const branches = repoBranches[repo.id] || ["main"];
                  const isRepoUrlMissing = repo.provider !== "LOCAL" && !repo.url;
                  return (
                    <tr key={repo.id}>
                      <td>{repo.name}</td>
                      <td>
                        <span className={`ri-provider-badge ri-provider-${(repo.provider || "").toLowerCase()}`}>
                          {repo.provider || "N/A"}
                        </span>
                      </td>
                      <td>
                        <select
                          className="ri-branch-select"
                          defaultValue={repo.default_branch || branches[0] || "main"}
                        >
                          {branches.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {repo.last_scan
                          ? new Date(repo.last_scan).toLocaleString()
                          : "Never"}
                      </td>
                      <td>
                        {repo.vulnerabilities_count !== undefined ? (
                          <span className={repo.vulnerabilities_count > 0 ? "ri-vuln-count" : ""}>
                            {repo.vulnerabilities_count}
                          </span>
                        ) : (
                          <button
                            className="ri-scan-link"
                            onClick={() => handleScanNow(repo.id)}
                            disabled={isRepoUrlMissing}
                            title={isRepoUrlMissing ? "Add a repository URL to scan." : "Scan now"}
                          >
                            Scan Now
                          </button>
                        )}
                      </td>
                      <td className="ri-actions-cell">
                        <button
                          className="ri-scan-link"
                          onClick={() => handleScanNow(repo.id)}
                          style={{ marginRight: "0.5rem" }}
                          disabled={isRepoUrlMissing}
                          title={isRepoUrlMissing ? "Add a repository URL to scan." : "Scan"}
                        >
                          Scan
                        </button>
                        {confirmDeleteId === repo.id ? (
                          <>
                            <button
                              className="ri-delete-link"
                              onClick={() => handleDelete(repo.id)}
                              style={{ marginRight: "0.5rem" }}
                            >
                              Confirm
                            </button>
                            <button
                              className="ri-delete-link"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="ri-delete-link"
                            onClick={() => handleDelete(repo.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({ provider, icon, leftStatus, rightStatus }) {
  return (
    <div className="ri-provider-row">
      {/* Left block: icon + name */}
      <div className="ri-provider-main">
        <div className="ri-provider-logo-circle">
          <img src={icon} alt={provider} className="ri-provider-logo" />
        </div>
        <span className="ri-provider-name">{provider}</span>
      </div>

      {/* Middle & right status, just like mockup */}
      <div className="ri-provider-pill">{leftStatus}</div>
      <div className="ri-provider-pill ri-provider-pill-secondary">
        {rightStatus}
      </div>
    </div>
  );
}

export default RepoIntegrationPage;
