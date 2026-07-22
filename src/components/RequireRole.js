// src/components/RequireRole.js
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService } from "../api/services";
import { getCurrentUser, setCurrentUser } from "../api/client";

function RequireRole({ roles, children, fallback = null }) {
  const location = useLocation();
  const [user, setUser] = useState(getCurrentUser());
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (user) return;
      try {
        const res = await authService.me();
        if (!mounted) return;
        setCurrentUser(res.data);
        setUser(res.data);
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return <div className="v-placeholder-page">Checking access...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = user?.role || "normal";
  if (!roles.includes(role)) {
    return fallback || (
      <div className="v-placeholder-page">
        You do not have access to this section.
      </div>
    );
  }

  return children;
}

export default RequireRole;
