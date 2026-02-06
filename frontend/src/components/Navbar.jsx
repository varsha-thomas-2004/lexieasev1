import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.logo}>
        LexCura
      </Link>

      <div style={styles.navLinks}>
        <Link to="/login" style={styles.loginLink}>
          Login
        </Link>
        <Link to="/signup" style={styles.signupBtn}>
          Sign Up
        </Link>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px 48px",
    background: "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  },
  logo: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#1e40af",
    letterSpacing: "-0.5px",
    textDecoration: "none",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  loginLink: {
    textDecoration: "none",
    color: "#475569",
    fontWeight: 500,
    fontSize: "15px",
    padding: "10px 20px",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  },
  signupBtn: {
    textDecoration: "none",
    background: "#1e40af",
    color: "white",
    padding: "10px 24px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "15px",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
};
