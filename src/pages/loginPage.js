// src/pages/LoginPage.js
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, setAccessToken, setCurrentUser } from "../api/client";
import { authService } from "../api/services";
import "../App.css";

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Production: no default credentials, only real backend auth

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = { email: "", password: "" };
    if (!form.email.includes("@")) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!form.password || form.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Try real backend login first
      const { data } = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
      });
      if (data?.access_token) {
        // Clear patch page state so each login starts fresh
        localStorage.removeItem("pg_selectedVuln");
        localStorage.removeItem("pg_patches");
        localStorage.removeItem("pg_selectedPatch");
        localStorage.removeItem("lastScanId");
        setAccessToken(data.access_token);
        try {
          const me = await authService.me();
          setCurrentUser(me.data);
        } catch {
          setCurrentUser(null);
        }
        const dest = location.state?.from?.pathname || "/dashboard";
        navigate(dest, { replace: true });
        return;
      }
      throw new Error("No token in response");
    } catch (err) {
      const msg = err?.userMessage || err?.response?.data?.detail || "Login failed. Please check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-page">
      {/* Top logo + title */}
      <div className="lp-logo-wrap">
        <div className="lp-logo-circle">
          <img src="/logo.svg" alt="ControlGate logo" className="lp-logo-img" />
        </div>
        <div className="lp-logo-text">ControlGate</div>
      </div>


      {/* Card */}
      <div className="lp-card">
        <h2 className="lp-card-title">Login</h2>

        <form className="lp-form" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="lp-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              required
            />
            {fieldErrors.email && <div className="acct-error" style={{ marginTop: "0.4rem" }}>{fieldErrors.email}</div>}
          </div>

          {/* Password */}
          <div className="lp-field">
            <label htmlFor="password">Password</label>
            <div className="lp-password-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="lp-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOff className="lp-password-icon" aria-hidden="true" />
                ) : (
                  <Eye className="lp-password-icon" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.password && <div className="acct-error" style={{ marginTop: "0.4rem" }}>{fieldErrors.password}</div>}
          </div>

          {/* Login button */}
          <button type="submit" className="lp-primary-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          {error && <div className="acct-error" style={{ marginTop: "0.75rem" }}>{error}</div>}
          <div className="lp-links-row">
            <button
              type="button"
              className="lp-link-btn"
              onClick={() => navigate("/register")}
            >
              Create an account
            </button>
            <button
              type="button"
              className="lp-link-btn"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot password?
            </button>
          </div>
          {/* No default credential bypass in production */}
        </form>

        {/* Divider */}
        <div className="lp-divider">
          <span></span>
          <p>or</p>
          <span></span>
        </div>

        {/* Social buttons */}
        <button
          type="button"
          className="lp-oauth-btn lp-google-btn"
          onClick={() => {
            window.location.href = authService.googleOAuthUrl();
          }}
        >
          <span className="lp-oauth-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img" aria-label="Google logo">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.2 1.54 7.63 2.83l5.54-5.54C33.64 3.6 29.2 1.5 24 1.5 14.85 1.5 7.05 6.76 3.2 14.4l6.7 5.2C11.5 13.16 17.27 9.5 24 9.5z"
              />
              <path
                fill="#34A853"
                d="M46.1 24.6c0-1.55-.14-3.04-.4-4.5H24v8.54h12.4c-.54 2.9-2.16 5.35-4.6 7.03l7.08 5.5c4.13-3.8 6.52-9.4 6.52-15.63z"
              />
              <path
                fill="#4285F4"
                d="M9.9 28.9a14.46 14.46 0 0 1-.77-4.9c0-1.7.28-3.35.77-4.9l-6.7-5.2A22.99 22.99 0 0 0 1 24c0 3.7.88 7.18 2.2 10.1l6.7-5.2z"
              />
              <path
                fill="#FBBC05"
                d="M24 46.5c6.2 0 11.4-2.06 15.2-5.56l-7.08-5.5c-1.96 1.32-4.5 2.1-8.12 2.1-6.73 0-12.5-3.66-14.1-8.9l-6.7 5.2C7.05 41.24 14.85 46.5 24 46.5z"
              />
            </svg>
          </span>
          <span>Sign in with Google</span>
        </button>

        <button
          type="button"
          className="lp-oauth-btn lp-github-btn"
          onClick={() => {
            window.location.href = authService.githubOAuthUrl();
          }}
        >
          <span className="lp-oauth-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img" aria-label="GitHub logo">
              <path
                fill="currentColor"
                d="M12 1.5c-5.8 0-10.5 4.7-10.5 10.5 0 4.64 3.04 8.57 7.26 9.96.53.1.73-.23.73-.52v-1.84c-2.95.64-3.57-1.24-3.57-1.24-.48-1.22-1.18-1.55-1.18-1.55-.97-.66.08-.65.08-.65 1.07.08 1.64 1.1 1.64 1.1.95 1.64 2.5 1.16 3.1.88.1-.7.37-1.16.67-1.42-2.36-.27-4.84-1.18-4.84-5.24 0-1.16.42-2.1 1.1-2.84-.1-.27-.48-1.36.1-2.84 0 0 .9-.3 2.96 1.08a10.2 10.2 0 0 1 5.4 0c2.06-1.38 2.96-1.08 2.96-1.08.58 1.48.2 2.57.1 2.84.68.74 1.1 1.68 1.1 2.84 0 4.08-2.48 4.96-4.86 5.22.38.33.72.98.72 1.98v2.94c0 .3.2.62.74.52A10.51 10.51 0 0 0 22.5 12c0-5.8-4.7-10.5-10.5-10.5z"
              />
            </svg>
          </span>
          <span>Sign in with GitHub</span>
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
