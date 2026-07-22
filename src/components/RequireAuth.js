// src/components/RequireAuth.js
import React, { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { setAccessToken, setCurrentUser } from "../api/client";

function RequireAuth({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const handler = () => {
      setAccessToken(null);
      setCurrentUser(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener("vulcan:unauthorized", handler);
    return () => window.removeEventListener("vulcan:unauthorized", handler);
  }, [navigate]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default RequireAuth;
