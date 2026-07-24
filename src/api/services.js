// src/api/services.js
import { api } from "./client";

const ASVS_LEVEL_ORDER = { L1: 1, L2: 2, L3: 3 };
const levelIncludes = (controlLevel, targetLevel) =>
  ASVS_LEVEL_ORDER[controlLevel] <= ASVS_LEVEL_ORDER[targetLevel];

// Real "no scan has run yet" state, computed from the live catalog — every
// control is not_tested and every level is 0%. Not fabricated data.
function buildEmptyCompliance(chapters, controls) {
  const chaptersWithCounts = chapters.map((ch) => ({
    ...ch,
    counts: { pass: 0, fail: 0, n_a: 0, manual_review: 0, not_tested: ch.control_count },
  }));
  const levels = {};
  for (const level of ["L1", "L2", "L3"]) {
    const applicable = controls.filter((c) => levelIncludes(c.level, level));
    levels[level] = { total: applicable.length, passed: 0, pct: 0 };
  }
  return { scan_id: null, chapters: chaptersWithCounts, levels, results: {}, generated_at: null };
}

// ============= AUTH =============
export const authService = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (payload) => api.post("/auth/register", payload),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  refresh: () => api.post("/auth/refresh"),
  updateProfile: (payload) => api.patch("/auth/me", payload),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token, newPassword) =>
    api.post("/auth/reset-password", { token, new_password: newPassword }),
  validateResetToken: (token) => api.post("/auth/validate-reset-token", { token }),
  googleOAuthUrl: () => `${api.defaults.baseURL}/auth/oauth/google`,
  githubOAuthUrl: () => `${api.defaults.baseURL}/auth/oauth/github`,
};

// ============= DASHBOARD =============
export const dashboardService = {
  getSummary: () => api.get("/dashboard/summary"),
  getRecentScans: () => api.get("/dashboard/recent-scans"),
  getPatchStats: () => api.get("/dashboard/patch-stats"),
};

// ============= NOTIFICATIONS =============
export const notificationService = {
  getNotifications: (page = 1, size = 10) =>
    api.get("/notifications", { params: { page, size } }),
};

// ============= REPOSITORIES =============
export const repositoryService = {
  list: () => api.get("/repositories"),
  create: (data) => api.post("/repositories", data),
  get: (id) => api.get(`/repositories/${id}`),
  delete: (id) => api.delete(`/repositories/${id}`),
  getBranches: (id) => api.get(`/repositories/${id}/branches`),
  getFiles: (id, branch = "main") =>
    api.get(`/repositories/${id}/files`, { params: { branch } }),
  upload: (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/repositories/${id}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ============= SCANS =============
export const scanService = {
  list: () => api.get("/scans"),
  start: (data) => api.post("/scans/start", data),
  getStatus: (scanId) => api.get(`/scans/${scanId}/status`),
  getLogs: (scanId) => api.get(`/scans/${scanId}/logs`),
  getSummary: (scanId) => api.get(`/scans/${scanId}/summary`),
  cancel: (scanId) => api.post(`/scans/${scanId}/cancel`),
  // Diff-based scan: get changed files between two git refs
  getDiffFiles: (repoId, base = "main", head = "HEAD") =>
    api.get("/scans/diff-files", { params: { repo_id: repoId, base, head } }),
};

// ============= REPORTS =============
export const reportService = {
  list: (params = {}) => api.get("/reports", { params }),
  get: (reportId) => api.get(`/reports/${reportId}`),
  // ASVS compliance report — see asvsService for the local-fallback-aware wrapper.
  exportASVSReportPDF: (scanId) =>
    api.get("/export/asvs-report", {
      params: { scan_id: scanId },
      responseType: "blob",
    }),
};

// ============= SEMANTIC ANALYSIS =============
export const analysisService = {
  analyze: (code, language, filename = null) =>
    api.post("/analysis/analyze", { code, language, filename }),
  buildGraph: (code, language, filename = null) =>
    api.post("/analysis/graph", { code, language, filename }),
  getFindings: () => api.get("/analysis/findings"),
};

// ============= ADMIN =============
export const adminService = {
  listUsers: () => api.get("/admin/users"),
  updateUserRole: (userId, role) => api.patch(`/admin/users/${userId}`, { role }),
};

// ============= ASVS CONTROL CATALOG =============
// All calls hit the live backend (asvs_controls collection, /asvs/*,
// /reports/{scan_id}/compliance, /export/asvs-report) — no fallback to
// bundled demo data. If the backend is unreachable, callers see a real error
// rather than a silently substituted fake result.
export const asvsService = {
  listControls: async () => (await api.get("/asvs/controls")).data,
  listChapters: async () => (await api.get("/asvs/chapters")).data,
  getControl: async (controlId) => (await api.get(`/asvs/controls/${controlId}`)).data,

  // Cross-repo dashboard: latest compliance + trend per repo, attestation
  // coverage, and the controls failing across the most repos.
  getPortfolioDashboard: async () => (await api.get("/asvs/portfolio")).data,

  // Most recently COMPLETED scan's id, or null if none has finished yet.
  resolveLatestScanId: async () => {
    const res = await dashboardService.getRecentScans();
    const scans = res.data || [];
    const completed = scans.find((s) => s.status === "COMPLETED");
    return completed?.scan_id || null;
  },

  getComplianceSummary: async (scanId) => {
    const id = scanId || (await asvsService.resolveLatestScanId());
    if (!id) {
      const [chapters, controls] = await Promise.all([
        asvsService.listChapters(),
        asvsService.listControls(),
      ]);
      return buildEmptyCompliance(chapters, controls);
    }
    const res = await api.get(`/reports/${id}/compliance`, { params: { framework: "asvs" } });
    return res.data;
  },
  exportCompliancePDF: (scanId) => reportService.exportASVSReportPDF(scanId),
};

// ============= MANUAL ATTESTATION =============
// Backed by the live `attestations` collection — answers persist server-side,
// tied to the authenticated user (attested_by is set by the backend from the
// current session, not the client). No localStorage fallback.
export const attestationService = {
  list: async () => (await api.get("/attestations")).data,
  submit: async (controlId, { answer, evidence_url = null }) => {
    const res = await api.post("/attestations", { control_id: controlId, answer, evidence_url });
    return res.data;
  },
  uploadEvidence: async (controlId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/attestations/${controlId}/evidence`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};
