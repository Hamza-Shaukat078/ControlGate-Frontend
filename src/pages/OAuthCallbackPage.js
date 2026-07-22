// src/pages/OAuthCallbackPage.js
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setAccessToken, setCurrentUser } from "../api/client";
import { authService } from "../api/services";
import "../App.css";

function OAuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") || "";
  }, [location.search]);

  useEffect(() => {
    const finish = async () => {
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }
      localStorage.removeItem("pg_selectedVuln");
      localStorage.removeItem("pg_patches");
      localStorage.removeItem("pg_selectedPatch");
      setAccessToken(token);
      try {
        const me = await authService.me();
        setCurrentUser(me.data);
      } catch {
        setCurrentUser(null);
      }
      navigate("/dashboard", { replace: true });
    };
    finish();
  }, [token, navigate]);

  return (
    <div className="lp-page">
      <div className="lp-card">
        <h2 className="lp-card-title">Signing you in...</h2>
        <p className="lp-helper-text">Completing Google login.</p>
      </div>
    </div>
  );
}

export default OAuthCallbackPage;
