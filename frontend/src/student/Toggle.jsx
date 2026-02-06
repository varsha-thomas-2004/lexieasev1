import { useNavigate } from "react-router-dom";

export default function Toggle() {
  const navigate = useNavigate();

  return (
    <div style={styles.card}>
      <h1 style={styles.title}>Welcome back 👋</h1>
      <p style={styles.subtitle}>
        Choose a practice level to continue improving your reading fluency.
      </p>

      <div style={styles.actions}>
        <button onClick={() => navigate("/student/letter-level")}>
          Letter Level
        </button>
        <button onClick={() => navigate("/student/word-level")}>
          Word Level
        </button>
        <button onClick={() => navigate("/student/sentence-level")}>
          Sentence Level
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "white",
    padding: 40,
    borderRadius: 20,
    boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
    textAlign: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 32,
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
};
