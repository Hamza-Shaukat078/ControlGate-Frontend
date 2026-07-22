// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { ThemeProvider } from "./context/ThemeContext";

import LoginPage from "./pages/loginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import AccountPage from "./pages/AccountPage";
import DashboardPage from "./pages/DashboardPage";
import ScanPage from "./pages/ScanPage";
import RepoIntegrationPage from "./pages/RepoIntegrationPage";
import GraphsPage from "./pages/GraphsPage";
import ControlsPage from "./pages/ControlsPage";
import AttestationPage from "./pages/AttestationPage";
import ReportsPage from "./pages/ReportsPage";
import AppLayout from "./components/layout/AppLayout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import AdminUsersPage from "./pages/AdminUsersPage";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

          {/* Authenticated routes — single shared AppLayout, never remounts on navigation */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/scan"          element={<ScanPage />} />
            <Route path="/repositories"  element={<RepoIntegrationPage />} />
            <Route path="/controls"      element={<ControlsPage />} />
            <Route path="/attestation"   element={<AttestationPage />} />
            <Route path="/graphs"        element={<GraphsPage />} />
            <Route path="/reports"       element={<ReportsPage />} />
            <Route path="/account"       element={<AccountPage />} />

            <Route
              path="/admin/users"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminUsersPage />
                </RequireRole>
              }
            />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
