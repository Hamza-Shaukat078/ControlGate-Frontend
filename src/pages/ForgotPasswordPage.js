// src/pages/ForgotPasswordPage.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../api/services";
import "../App.css";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const { data } = await authService.forgotPassword(email.trim());
      setStatus({ type: "success", message: data?.message || "Check your email for reset instructions." });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to send reset email.";
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
        <h2 className="lp-card-title">Forgot password</h2>
        <p className="lp-helper-text">
          Enter your email address and we will send a reset link.
        </p>

        {status.message ? (
          <div className={`lp-alert lp-alert-${status.type}`}>
            {status.message}
          </div>
        ) : null}

        <form className="lp-form" onSubmit={handleSubmit}>
          <div className="lp-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="lp-primary-btn" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
          <button
            type="button"
            className="lp-link-btn"
            onClick={() => navigate("/login")}
          >
            Back to login
          </button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
