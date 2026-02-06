import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  // Temporary mock data (replace with API later)
  const progress = {
    letter: { completed: 42, accuracy: 88 },
    word: { completed: 18, accuracy: 81 },
    sentence: { completed: 9, accuracy: 76 },
    streak: 4,
  };

  return (
    <div style={styles.page}>
      {/* Welcome */}
      <div style={styles.header}>
        <h1 style={styles.title}>Welcome back 👋</h1>
        <p style={styles.subtitle}>
          Small steps every day build reading fluency.
        </p>
      </div>

      {/* Progress Cards */}
      <div style={styles.grid}>
        <ProgressCard
          title="Letter Level"
          completed={progress.letter.completed}
          accuracy={progress.letter.accuracy}
          onClick={() => navigate("/student/letter-level")}
        />

        <ProgressCard
          title="Word Level"
          completed={progress.word.completed}
          accuracy={progress.word.accuracy}
          onClick={() => navigate("/student/word-level")}
        />

        <ProgressCard
          title="Sentence Level"
          completed={progress.sentence.completed}
          accuracy={progress.sentence.accuracy}
          onClick={() => navigate("/student/sentence-level")}
        />
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <div>
          <span style={styles.statLabel}>Practice streak</span>
          <h2 style={styles.statValue}>🔥 {progress.streak} days</h2>
        </div>

        <button
          style={styles.cta}
          onClick={() => navigate("/student/letter-level")}
        >
          Continue Practice
        </button>
      </div>
    </div>
  );
}

/* =========================
   Components
========================== */
function ProgressCard({ title, completed, accuracy, onClick }) {
  return (
    <div style={styles.card} onClick={onClick}>
      <h3 style={styles.cardTitle}>{title}</h3>

      <div style={styles.cardStats}>
        <div>
          <span style={styles.smallLabel}>Completed</span>
          <p style={styles.value}>{completed}</p>
        </div>

        <div>
          <span style={styles.smallLabel}>Accuracy</span>
          <p style={styles.value}>{accuracy}%</p>
        </div>
      </div>

      <span style={styles.cardAction}>Resume →</span>
    </div>
  );
}

/* =========================
   Styles
========================== */
const styles = {
  page: {
    padding: "40px",
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: 800,
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 24,
    marginBottom: 40,
  },
  card: {
    background: "white",
    borderRadius: 20,
    padding: 28,
    boxShadow: "0 15px 30px rgba(0,0,0,0.08)",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 20,
  },
  cardStats: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  smallLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  value: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1e40af",
  },
  cardAction: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e40af",
  },
  summary: {
    background: "linear-gradient(135deg,#1e40af,#3b82f6)",
    color: "white",
    borderRadius: 24,
    padding: 32,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.9,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 800,
    marginTop: 6,
  },
  cta: {
    background: "white",
    color: "#1e40af",
    border: "none",
    padding: "14px 24px",
    borderRadius: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};
