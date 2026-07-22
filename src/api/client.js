// src/api/client.js
import axios from "axios";

const baseURL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

// Debug mode: set to true to see API requests/responses in console
const DEBUG_API = process.env.NODE_ENV === "development";

export const api = axios.create({
  baseURL,
  timeout: 300000, // 5 minutes — benchmark jobs can run 3-5 min on the full corpus
  headers: {
    "Content-Type": "application/json",
  },
});

export const getAccessToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

export const setAccessToken = (t) => {
  if (typeof window === "undefined") return;
  if (!t) localStorage.removeItem("access_token");
  else localStorage.setItem("access_token", t);
};

export const getCurrentUser = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("vulcan_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("vulcan_user");
    return null;
  }
};

export const setCurrentUser = (user) => {
  if (typeof window === "undefined") return;
  if (!user) localStorage.removeItem("vulcan_user");
  else localStorage.setItem("vulcan_user", JSON.stringify(user));
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (DEBUG_API) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.data || "");
    }
    return config;
  },
  (error) => {
    if (DEBUG_API) {
      console.error("[API] Request error:", error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (res) => {
    if (DEBUG_API) {
      console.log(`[API] Response ${res.status}:`, res.data);
    }
    return res;
  },
  async (err) => {
    if (DEBUG_API) {
      console.error(`[API] Error ${err?.response?.status}:`, err?.response?.data || err.message);
    }
    
    if (err?.response?.status === 401) {
      const isAuthEndpoint = err.config?.url?.includes("/auth/");
      const hasToken = getAccessToken();

      if (typeof window !== "undefined") {
        // Notify app to show invalid token warning if a token exists
        if (hasToken) {
          window.dispatchEvent(new CustomEvent("vulcan:invalid-token"));
        }
      }

      // Only clear token and logout if it's an auth endpoint or no token exists
      if (isAuthEndpoint || !hasToken) {
        setAccessToken(null);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("vulcan:unauthorized"));
        }
      }
    }
    
    // Enhance error message for better UX
    if (err?.response?.data?.detail) {
      err.userMessage = err.response.data.detail;
    } else if (err?.code === "ECONNABORTED") {
      err.userMessage = "Request timed out. Please try again.";
    } else if (err?.code === "ERR_NETWORK") {
      err.userMessage = "Cannot connect to server. Please check if the backend is running.";
    } else {
      err.userMessage = err.message || "An unexpected error occurred.";
    }
    
    return Promise.reject(err);
  }
);
