// src/api/services.js
import { api } from "./client";
import {
  getControls,
  getChapters,
  getChapterSummaries,
  getLevelCompletion,
  getAllResults,
  getResult,
} from "../data/asvsCatalog";

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

// ============= GRAPHS =============
export const graphService = {
  getGraph: (scanId, fileId, type = "AST") =>
    api.get(`/graphs/${scanId}/file/${fileId}`, { params: { type } }),
  getNode: (scanId, nodeId) => api.get(`/graphs/${scanId}/nodes/${nodeId}`),
  getPath: (scanId, pathId) => api.get(`/graphs/${scanId}/paths/${pathId}`),
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
// Backend endpoints (asvs_controls collection, /asvs/*, /export/asvs-report) now
// exist (vulcan-backend). Every call here still degrades to the bundled
// OWASP ASVS 5.0.0 Level 1 seed catalog (src/data/asvsCatalog.js) on failure, so
// the UI stays fully functional if the backend is briefly unreachable —
// see the try/catch fallback pattern in each function below.
export const asvsService = {
  listControls: async () => {
    try {
      const res = await api.get("/asvs/controls");
      return res.data;
    } catch {
      return getControls();
    }
  },
  listChapters: async () => {
    try {
      const res = await api.get("/asvs/chapters");
      return res.data;
    } catch {
      return getChapters();
    }
  },
  getControl: async (controlId) => {
    try {
      const res = await api.get(`/asvs/controls/${controlId}`);
      return res.data;
    } catch {
      return {
        control: getControls().find((c) => c.control_id === controlId) || null,
        result: getResult(controlId),
      };
    }
  },
  getComplianceSummary: async (scanId) => {
    try {
      const res = await api.get(`/reports/${scanId}/compliance`, { params: { framework: "asvs" } });
      return res.data;
    } catch {
      return {
        chapters: getChapterSummaries(),
        levels: getLevelCompletion(),
        results: getAllResults(),
      };
    }
  },
  exportCompliancePDF: (scanId) => reportService.exportASVSReportPDF(scanId),
};

// ============= MANUAL ATTESTATION =============
// No `attestations` backend collection exists yet (SRS REQ-MAN-01). Until it does,
// attestation answers are persisted to localStorage in the exact shape the future
// collection will use, so the workflow is real and durable across sessions today.
const ATTESTATION_STORAGE_KEY = "vulcan_attestations";

function readAttestationStore() {
  try {
    return JSON.parse(localStorage.getItem(ATTESTATION_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeAttestationStore(store) {
  localStorage.setItem(ATTESTATION_STORAGE_KEY, JSON.stringify(store));
}

export const attestationService = {
  list: async () => {
    try {
      const res = await api.get("/attestations");
      return res.data;
    } catch {
      return readAttestationStore();
    }
  },
  submit: async (controlId, { answer, evidence_url = null, attested_by = null }) => {
    const record = {
      control_id: controlId,
      answer,
      evidence_url,
      attested_by,
      timestamp: new Date().toISOString(),
    };
    try {
      const res = await api.post("/attestations", record);
      return res.data;
    } catch {
      const store = readAttestationStore();
      store[controlId] = record;
      writeAttestationStore(store);
      return record;
    }
  },
  uploadEvidence: async (controlId, file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/attestations/${controlId}/evidence`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch {
      // No backend storage available — record the filename only.
      return { evidence_url: file?.name || null };
    }
  },
};
