// src/pages/AdminUsersPage.js
import React, { useEffect, useState } from "react";
import "../App.css";
import { adminService } from "../api/services";

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [filter, setFilter] = useState("");
  const [pendingRole, setPendingRole] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await adminService.listUsers();
        if (!mounted) return;
        setUsers(res.data || []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.userMessage || "Failed to load users.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRoleChange = (userId, nextRole) => {
    setPendingRole({ userId, nextRole });
  };

  const confirmRoleChange = async () => {
    if (!pendingRole) return;
    const { userId, nextRole } = pendingRole;
    const previous = users.find((u) => u.id === userId);
    setSavingId(userId);
    setError("");
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    try {
      const res = await adminService.updateUserRole(userId, nextRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...res.data } : u))
      );
    } catch (err) {
      setError(err?.userMessage || "Failed to update user role.");
      if (previous) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: previous.role } : u)));
      }
    } finally {
      setSavingId(null);
      setPendingRole(null);
    }
  };

  const cancelRoleChange = () => {
    setPendingRole(null);
  };

  const filteredUsers = users.filter((u) => {
    if (!filter.trim()) return true;
    const value = filter.trim().toLowerCase();
    return (u.email || "").toLowerCase().includes(value);
  });

  return (
    <div className="v-dashboard">
      <div className="v-card">
        <div className="v-card-header">
          <h2>All Users</h2>
        </div>
        <div style={{ padding: "0 1.5rem 1rem" }}>
          <input
            type="text"
            placeholder="Search by email"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rv-filter-select"
            style={{ width: "280px" }}
          />
        </div>

        {loading ? <p>Loading users...</p> : null}
        {error ? <p className="acct-error">{error}</p> : null}

        {!loading && !error ? (
          <div className="rv-table-scroll">
            <table className="rv-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="rv-filter-select"
                        value={u.role || "normal"}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={savingId === u.id}
                      >
                        <option value="normal">Normal</option>
                        <option value="premium">Premium</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{u.status || (u.is_active ? "active" : "inactive")}</td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleString() : "-"}</td>
                    <td>
                      {pendingRole?.userId === u.id ? (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="rv-top-btn" onClick={confirmRoleChange} disabled={savingId === u.id}>
                            Confirm
                          </button>
                          <button className="rv-top-btn" onClick={cancelRoleChange} disabled={savingId === u.id}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AdminUsersPage;
