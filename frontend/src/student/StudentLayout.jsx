import { Outlet, useLocation, useNavigate } from "react-router-dom";

const levels = [
  { label: "Letter", path: "/student/letter-level" },
  { label: "Word", path: "/student/word-level" },
  { label: "Sentence", path: "/student/sentence-level" },
];

export default function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const showToggle = location.pathname !== "/student/dashboard";

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <header style={styles.header}>
       <div style={styles.left}>
  <div
    style={styles.logo}
    onClick={() => navigate("/student/dashboard")}
  >
    LexCura
  </div>

  <button
    onClick={() => navigate("/student/dashboard")}
    style={styles.dashboardBtn}
  >
    Dashboard
  </button>
</div>


        {showToggle && (
          <div style={styles.toggleBar}>
            {levels.map((level) => {
              const active = location.pathname === level.path;
              return (
                <button
                  key={level.path}
                  onClick={() => navigate(level.path)}
                  style={{
                    ...styles.toggleBtn,
                    ...(active ? styles.active : {}),
                  }}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        )}

        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </header>

      {/* Page Content */}
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

/* =========================
   Styles (THIS WAS MISSING)
========================== */
const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 28px",
    background: "white",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: "#1e40af",
    cursor: "pointer",
  },
  toggleBar: {
    display: "flex",
    gap: 10,
  },
  left: {
  display: "flex",
  alignItems: "center",
  gap: 16,
},
dashboardBtn: {
  background: "transparent",
  border: "1px solid #c7d2fe",
  color: "#1e40af",
  padding: "6px 14px",
  borderRadius: 999,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
},

  toggleBtn: {
    padding: "8px 16px",
    borderRadius: 999,
    border: "1px solid #c7d2fe",
    background: "white",
    color: "#1e40af",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  active: {
    background: "#1e40af",
    color: "white",
  },
  logoutBtn: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    padding: 32,
    maxWidth: 1200,
    margin: "0 auto",
  },
};
