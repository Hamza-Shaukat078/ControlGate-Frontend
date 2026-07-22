// src/components/layout/AppLayout.js
import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import "../../App.css";
import { authService } from "../../api/services";
import { getAccessToken, getCurrentUser, setCurrentUser, setAccessToken } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";

// ==== MODERN ICONS (Lucide) ====
import {
  LayoutDashboard,
  FolderGit,
  ScanSearch,
  ShieldCheck,
  ClipboardCheck,
  FileBarChart,
  Search,
  Users,
  Sun,
  Moon,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",     to: "/dashboard",     icon: <LayoutDashboard size={20} />, roles: ["normal", "premium", "admin"] },
  { label: "Repositories",  to: "/repositories",  icon: <FolderGit size={20} />,       roles: ["normal", "premium", "admin"] },
  { label: "Scan",          to: "/scan",          icon: <ScanSearch size={20} />,      roles: ["normal", "premium", "admin"] },
  { label: "Controls",      to: "/controls",      icon: <ShieldCheck size={20} />,     roles: ["normal", "premium", "admin"] },
  { label: "Attestation",   to: "/attestation",   icon: <ClipboardCheck size={20} />,  roles: ["normal", "premium", "admin"] },
  { label: "Reports",       to: "/reports",       icon: <FileBarChart size={20} />,    roles: ["normal", "premium", "admin"] },
  { label: "Users",         to: "/admin/users",   icon: <Users size={20} />,           roles: ["admin"] },
];


function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(getCurrentUser());
  const [invalidToken, setInvalidToken] = useState(false);
  const profileRef = useRef(null);

  const sampleRepos = ["frontend-app", "backend-service", "utility-lib"];
  const suggestions =
    search.length >= 3
      ? sampleRepos.filter((r) =>
          r.toLowerCase().includes(search.toLowerCase())
        )
      : [];

  useEffect(() => {
    const handler = (e) => {
      if (!profileRef.current?.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      try {
        const res = await authService.me();
        if (!mounted) return;
        setUser(res.data);
        setCurrentUser(res.data);
        setInvalidToken(false);
      } catch {
        if (!mounted) return;
        setUser(null);
        setCurrentUser(null);
        setInvalidToken(!!getAccessToken());
      }
    };
    if (!user) {
      loadProfile();
    }
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    const handler = () => setInvalidToken(true);
    window.addEventListener("vulcan:invalid-token", handler);
    return () => window.removeEventListener("vulcan:invalid-token", handler);
  }, []);

  useEffect(() => {
    if (!invalidToken || !getAccessToken()) return;
    let alive = true;

    const recheckSession = async () => {
      try {
        const res = await authService.me();
        if (!alive) return;
        setUser(res.data);
        setCurrentUser(res.data);
        setInvalidToken(false);
      } catch {
        if (!alive) return;
        setInvalidToken(true);
      }
    };

    recheckSession();
    return () => {
      alive = false;
    };
  }, [invalidToken, location.pathname]);

  const handleRetryToken = async () => {
    try {
      const res = await authService.me();
      setUser(res.data);
      setCurrentUser(res.data);
      setInvalidToken(false);
    } catch {
      setInvalidToken(true);
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setCurrentUser(null);
    localStorage.removeItem("lastScanId");
    navigate("/login", { replace: true });
  };


  return (
    <div className="v-layout">
      {invalidToken && (
        <div className="v-invalid-token-overlay" role="alert" aria-live="assertive">
          <div className="v-invalid-token-card">
            <div className="v-invalid-token-icon">⚠</div>
            <div className="v-invalid-token-title">Invalid token</div>
            <div className="v-invalid-token-subtitle">
              Your session token is invalid or expired. Please retry.
            </div>
            <button type="button" className="v-invalid-token-btn" onClick={handleRetryToken}>
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Sidebar */}
      <aside className="v-sidebar">
        <div className="v-brand">
          <div className="v-brand-logo-circle">
            <img src="/vulcanlogo.png" alt="ControlGate" className="v-brand-logo-img" />
          </div>
          <div className="v-brand-text-col">
            <span className="v-brand-text">ControlGate</span>
            <span className="v-brand-sub">ASVS 5.0.0</span>
          </div>
        </div>

        <nav className="v-nav">
          {navItems
            .filter((item) => (item.roles || []).includes(user?.role || "normal"))
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "v-nav-item" + (location.pathname === item.to ? " v-nav-item-active" : "")
                }
              >
                <span className="v-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="v-main">
        <header className="v-topbar">
          <div className="v-topbar-right">

            {/* Theme toggle */}
            <button
              type="button"
              className="v-theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Search */}
            <div className="v-search-wrap">
              <span className="v-search-icon">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(e.target.value.length >= 3);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => setShowSuggestions(search.length >= 3)}
              />

              {showSuggestions && suggestions.length > 0 && (
                <div className="v-search-suggestions">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSearch(item);
                        setShowSuggestions(false);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="v-profile-wrap" ref={profileRef}>
              <button
                type="button"
                className="v-profile-avatar"
                onClick={() => setProfileOpen((o) => !o)}
              >
                👤
              </button>

              {profileOpen && (
                <div className="v-profile-menu">
                  <div className="v-profile-menu-header">
                    <p className="v-profile-name">{user?.full_name || "ControlGate User"}</p>
                    <p className="v-profile-email">{user?.email || "user@controlgate.app"}</p>
                    <p className={`v-profile-role v-role-${user?.role || "normal"}`}>
                      {(user?.role || "normal").toUpperCase()}
                    </p>
                  </div>

                  <button type="button" onClick={() => navigate("/account")}>
                    Account settings
                  </button>
                  <button type="button">API keys</button>
                  <button
                    type="button"
                    className="v-profile-logout"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        <main className="v-content"><Outlet /></main>
      </div>
    </div>
  );
}

export default AppLayout;
