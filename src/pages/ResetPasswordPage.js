// src/pages/ResetPasswordPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "../api/services";
import "../App.css";

function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [loading, setLoading] = useState(false);

  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") || "";
  }, [location.search]);

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setStatus({ type: "error", message: "Reset token is missing." });
        setTokenValid(false);
        setValidating(false);
        return;
      }
      setValidating(true);
      try {
        const { data } = await authService.validateResetToken(token);
        if (data?.valid) {
          setTokenValid(true);
          setStatus({ type: "success", message: "Token verified. Set a new password." });
        } else {
          setTokenValid(false);
          setStatus({ type: "error", message: data?.message || "Invalid or expired reset token." });
        }
      } catch (err) {
        setTokenValid(false);
        setStatus({ type: "error", message: "Failed to validate reset token." });
      } finally {
        setValidating(false);
      }
    };
    validate();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setStatus({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirm) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const { data } = await authService.resetPassword(token, password);
      setStatus({ type: "success", message: data?.message || "Password reset successfully." });
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to reset password.";
      setStatus({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-page">
      <div className="lp-logo-wrap">
        <div className="lp-logo-circle">
          <img src="/vulcanlogo.png" alt="ControlGate logo" className="lp-logo-img" />
        </div>
        <div className="lp-logo-text">ControlGate</div>
      </div>

      <div className="lp-card">
        <h2 className="lp-card-title">Reset password</h2>
        {validating ? (
          <p className="lp-helper-text">Validating reset token...</p>
        ) : null}

        {status.message ? (
          <div className={`lp-alert lp-alert-${status.type}`}>
            {status.message}
          </div>
        ) : null}

        {tokenValid ? (
          <form className="lp-form" onSubmit={handleSubmit}>
            <div className="lp-field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="lp-field">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="lp-primary-btn" disabled={loading}>
              {loading ? "Updating..." : "Reset password"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="lp-link-btn"
            onClick={() => navigate("/forgot-password")}
          >
            Request a new reset link
          </button>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
