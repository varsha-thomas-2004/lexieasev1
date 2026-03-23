import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/api";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export default function LetterReport() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState(7);
  const [userInfo, setUserInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [user, data] = await Promise.all([
          apiFetch("/api/auth/me"),
          apiFetch(`/api/reports/student/letters?timeframe=${timeframe}`),
        ]);
        setUserInfo(user);
        setReport(data);
      } catch (error) {
        console.error("Failed to fetch letter report:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [timeframe]);

  const downloadPDFReport = () => {
    if (!report?.metrics) return;
    setDownloading(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const { metrics } = report;
      const allLetters = metrics.letters || [];
      const problemLetters = allLetters.filter(
        (l) => l.attempts > 0 && parseFloat(l.strength) < 0
      );
      const studentName = userInfo?.name || "Student";
      const date = new Date().toLocaleDateString();
      const avgStrength = parseFloat(metrics.overview.avgStrength);

      // Header
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, 210, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("LexCura Speech Therapy", 105, 13, { align: "center" });
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Letter Naming — Clinical Progress Report", 105, 22, { align: "center" });
      doc.setFontSize(9);
      doc.text(
        `Student: ${studentName}   |   Period: Last ${timeframe} Days   |   Generated: ${date}`,
        105, 30, { align: "center" }
      );

      // Section 1: Overview
      let y = 46;
      doc.setTextColor(16, 185, 129);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("1. Performance Summary", 15, y);
      y += 2;
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.5);
      doc.line(15, y, 195, y);
      y += 6;

      doc.autoTable({
        startY: y,
        head: [["Metric", "Value", "Interpretation"]],
        body: [
          ["Letters Practised", `${totalPracticed} / 26`, "Alphabet coverage"],
          ["Total Attempts", metrics.overview.totalAttempts, "Session activity"],
          ["Avg Strength Score", avgStrength.toFixed(1),
            avgStrength >= 20 ? "Strong overall performance" :
            avgStrength >= 0  ? "Developing — keep practising" :
            "Needs focused intervention"],
          ["Focus Areas",
            problemLetters.length > 0
              ? problemLetters.slice(0, 5).map(l => l.letter.toUpperCase()).join(", ")
              : "None — all practised letters are positive",
            problemLetters.length > 0 ? "Priority practice targets" : "Well done!"],
        ],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
        columnStyles: { 2: { cellWidth: 80 } },
      });
      y = doc.lastAutoTable.finalY + 10;

      // Section 2: Problem Letters
      if (problemLetters.length > 0) {
        doc.setTextColor(220, 38, 38);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("2. Letters Needing Focus", 15, y);
        y += 2;
        doc.setDrawColor(220, 38, 38);
        doc.line(15, y, 195, y);
        doc.setDrawColor(16, 185, 129);
        y += 6;
        doc.autoTable({
          startY: y,
          head: [["Letter", "Attempts", "Strength Score", "Priority", "Recommended Drill"]],
          body: problemLetters.map((item, i) => [
            item.letter.toUpperCase(),
            item.attempts,
            parseFloat(item.strength).toFixed(1),
            i < 2 ? "HIGH" : "MEDIUM",
            "Isolation drill + minimal pairs practice",
          ]),
          theme: "striped",
          styles: { fontSize: 9 },
          headStyles: { fillColor: [220, 38, 38], textColor: 255 },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // Section 3: Full breakdown
      doc.addPage();
      y = 20;
      doc.setTextColor(16, 185, 129);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("3. Full Letter Strength Breakdown", 15, y);
      y += 2;
      doc.setDrawColor(16, 185, 129);
      doc.line(15, y, 195, y);
      y += 6;
      doc.autoTable({
        startY: y,
        head: [["Letter", "Attempts", "Strength", "Level"]],
        body: allLetters.filter(l => l.attempts > 0).map(item => [
          item.letter.toUpperCase(),
          item.attempts,
          parseFloat(item.strength).toFixed(1),
          parseFloat(item.strength) >= 40 ? "Strong" :
          parseFloat(item.strength) >= 0  ? "Developing" : "Needs Focus",
        ]),
        theme: "striped",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      });
      y = doc.lastAutoTable.finalY + 12;

      // Section 4: Action Plan
      doc.setTextColor(15, 118, 110);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("4. Personalised Action Plan", 15, y);
      y += 2;
      doc.setDrawColor(15, 118, 110);
      doc.line(15, y, 195, y);
      y += 6;
      const actions = [];
      if (problemLetters.length > 0)
        actions.push(["Focus Letters",
          `Prioritise: ${problemLetters.slice(0, 3).map(l => l.letter.toUpperCase()).join(", ")} — 20 reps each before next session`]);
      if (totalPracticed < 20)
        actions.push(["Coverage", "Try to practise all 26 letters — unexplored letters score 0 by default"]);
      actions.push(["Phoneme Drill", "Practise each problem letter in isolation, then in CVC words"]);
      actions.push(["Progress Check", "Re-assess in 2 weeks and compare strength scores"]);
      doc.autoTable({
        startY: y,
        head: [["Strategy", "Action"]],
        body: actions,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [15, 118, 110], textColor: 255 },
        columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } },
      });
      y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.setFont("helvetica", "italic");
      doc.text(
        "This report is generated by LexCura and is intended to support — not replace — clinical assessment by a qualified speech-language pathologist.",
        15, y, { maxWidth: 180 }
      );

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(200);
        doc.line(15, 285, 195, 285);
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.setFont("helvetica", "normal");
        doc.text("LexCura Speech Therapy — Confidential Clinical Report", 15, 290);
        doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: "right" });
      }
      doc.save(`LexCura_Letter_Report_${studentName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF error:", error);
      alert("Failed to generate report.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading letter report...</p>
      </div>
    );
  }

  if (!report?.metrics) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>🔤</div>
        <h2 style={styles.emptyTitle}>No Letter Data Yet</h2>
        <p style={styles.emptyText}>Complete some letter exercises to see your report here.</p>
        <button style={styles.startButton} onClick={() => navigate("/student/letter-level")}>
          Start Practising Letters
        </button>
      </div>
    );
  }

  const { metrics } = report;
  const allLetters = metrics.letters || [];
  const problemLetters = allLetters
    .filter((l) => l.attempts > 0 && parseFloat(l.strength) < 0)
    .sort((a, b) => parseFloat(a.strength) - parseFloat(b.strength));
  const strongLetters = allLetters
    .filter((l) => l.attempts > 0 && parseFloat(l.strength) >= 0)
    .sort((a, b) => parseFloat(b.strength) - parseFloat(a.strength));
  const avgStrength = parseFloat(metrics.overview.avgStrength);
  const totalPracticed = allLetters.filter((l) => l.attempts > 0).length;

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🔤 Letter Practice Report</h1>
          <p style={styles.subtitle}>Welcome, {userInfo?.name || "Student"}</p>
        </div>
        <div style={styles.headerActions}>
          <button
            style={downloading ? styles.downloadButtonDisabled : styles.downloadButton}
            onClick={downloadPDFReport}
            disabled={downloading}
          >
            {downloading ? "⏳ Generating..." : "📥 Download PDF"}
          </button>
          <div style={styles.filterContainer}>
            {[7, 30, 90].map((t) => (
              <button
                key={t}
                style={timeframe === t ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setTimeframe(t)}
              >
                {t} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        <StatCard icon="📚" label="Letters Practised" value={`${totalPracticed} / 26`} color="#10b981" />
        <StatCard icon="🔁" label="Total Attempts" value={metrics.overview.totalAttempts} color="#3b82f6" />
        <StatCard
          icon="💪"
          label="Avg Strength"
          value={`${avgStrength >= 0 ? "+" : ""}${avgStrength.toFixed(1)}`}
          subValue={avgStrength >= 20 ? "Strong" : avgStrength >= 0 ? "Developing" : "Needs Work"}
          color={avgStrength >= 20 ? "#10b981" : avgStrength >= 0 ? "#f59e0b" : "#ef4444"}
        />
        <StatCard
          icon="🎯"
          label="Focus Areas"
          value={problemLetters.length}
          subValue={problemLetters.length > 0
            ? problemLetters.slice(0, 4).map((l) => l.letter.toUpperCase()).join("  ·  ")
            : "All good! ✓"}
          color={problemLetters.length > 0 ? "#ef4444" : "#10b981"}
        />
      </div>

      {/* Letter Strength Grid */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🔡 Letter Strength Overview</h3>
        <p style={styles.cardSubtitle}>
          🟢 Strong (≥40) &nbsp;·&nbsp; 🟡 Developing (0–39) &nbsp;·&nbsp;
          🔴 Needs Focus (&lt;0) &nbsp;·&nbsp; ⚪ Not yet practised
        </p>
        <LetterStrengthGrid data={allLetters} />
      </div>

      {/* Problem + Strong letters */}
      <div style={styles.twoColumnGrid}>
        {problemLetters.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>⚠️ Letters Needing Focus</h3>
            <div style={styles.problemList}>
              {problemLetters.map((item, idx) => {
                const strength = parseFloat(item.strength);
                const barWidth = Math.min(100, Math.abs(strength));
                return (
                  <div key={idx} style={styles.problemItem}>
                    <div style={{ ...styles.badge, background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
                      {item.letter.toUpperCase()}
                    </div>
                    <div style={styles.problemInfo}>
                      <span style={styles.problemCount}>
                        {item.attempts} attempt{item.attempts !== 1 ? "s" : ""} · strength {strength.toFixed(1)}
                      </span>
                      <div style={styles.progressBarBg}>
                        <div style={{ ...styles.progressBarFill, width: `${barWidth}%`, background: "#ef4444" }} />
                      </div>
                    </div>
                    <span style={styles.strengthLabel}>{strength.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {strongLetters.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>✅ Strongest Letters</h3>
            <div style={styles.problemList}>
              {strongLetters.slice(0, 6).map((item, idx) => {
                const strength = parseFloat(item.strength);
                const barWidth = Math.min(100, strength);
                return (
                  <div key={idx} style={styles.problemItem}>
                    <div style={{
                      ...styles.badge,
                      background: strength >= 40
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : "linear-gradient(135deg,#f59e0b,#d97706)",
                    }}>
                      {item.letter.toUpperCase()}
                    </div>
                    <div style={styles.problemInfo}>
                      <span style={styles.problemCount}>
                        {item.attempts} attempt{item.attempts !== 1 ? "s" : ""} · strength {strength.toFixed(1)}
                      </span>
                      <div style={styles.progressBarBg}>
                        <div style={{
                          ...styles.progressBarFill,
                          width: `${barWidth}%`,
                          background: strength >= 40 ? "#10b981" : "#f59e0b",
                        }} />
                      </div>
                    </div>
                    <span style={styles.strengthLabel}>{strength.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Personalised Feedback */}
      <PersonalisedFeedback
        avgStrength={avgStrength}
        problemLetters={problemLetters}
        strongLetters={strongLetters}
        totalPracticed={totalPracticed}
        totalAttempts={metrics.overview.totalAttempts}
        studentName={userInfo?.name || "Student"}
      />

      {/* CTA */}
      <div style={styles.ctaCard}>
        <div>
          <h3 style={styles.ctaTitle}>Keep it up! 🚀</h3>
          <p style={styles.ctaText}>
            {problemLetters.length > 0
              ? `Focus on: ${problemLetters.slice(0, 3).map((l) => l.letter.toUpperCase()).join(", ")} — these need the most practice.`
              : "Great work! Keep practising to maintain your strength scores."}
          </p>
        </div>
        <button style={styles.ctaButton} onClick={() => navigate("/student/letter-level")}>
          Continue Practice
        </button>
      </div>

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function PersonalisedFeedback({ avgStrength, problemLetters, strongLetters, totalPracticed, totalAttempts, studentName }) {
  // Determine overall performance tier
  const tier =
    avgStrength >= 40 && problemLetters.length === 0 ? "excellent" :
    avgStrength >= 20 && problemLetters.length <= 2   ? "good" :
    avgStrength >= 0  && problemLetters.length <= 5   ? "developing" :
    "needs_support";

  const firstName = studentName.split(" ")[0];

  // Build personalised messages based on data
  const headline =
    tier === "excellent"    ? `Outstanding work, ${firstName}! 🌟` :
    tier === "good"         ? `Great progress, ${firstName}! 👏` :
    tier === "developing"   ? `You're getting there, ${firstName}! 💪` :
    `Let's build up your skills, ${firstName}! 🌱`;

  const overallMessage =
    tier === "excellent"
      ? `You've mastered ${strongLetters.length} letters with strong scores — that's a fantastic achievement! Your hard work and consistent practice are clearly paying off. Keep challenging yourself with more sessions.`
      : tier === "good"
      ? `You're showing real progress with ${strongLetters.length} letters performing well. Your practice sessions are making a difference. Just a little more focus on the tricky ones and you'll be flying!`
      : tier === "developing"
      ? `You've completed ${totalAttempts} attempts across ${totalPracticed} letters — that's a solid start! Every practice session builds your skills. Keep going and you'll see big improvements soon.`
      : `You've made a start with ${totalPracticed} letters practised and ${totalAttempts} attempts logged. The key is consistency — short daily sessions will get you there faster than you think!`;

  // Specific tips based on problem letters
  const tips = [];

  if (problemLetters.length > 0) {
    const topProblems = problemLetters.slice(0, 3).map(l => l.letter.toUpperCase());
    tips.push({
      icon: "🎯",
      title: "Priority letters to focus on",
      text: `Spend extra time on ${topProblems.join(", ")}. Say each one out loud 10 times slowly, then try to use them in short words.`,
      color: "#ef4444",
      bg: "#fef2f2",
    });
  }

  if (strongLetters.length > 0) {
    const topStrong = strongLetters.slice(0, 3).map(l => l.letter.toUpperCase());
    tips.push({
      icon: "⭐",
      title: "Your star letters",
      text: `${topStrong.join(", ")} are your strongest! Use these as your confidence boosters at the start of each session to get into the zone.`,
      color: "#10b981",
      bg: "#f0fdf4",
    });
  }

  if (totalPracticed < 20) {
    const remaining = 26 - totalPracticed;
    tips.push({
      icon: "🗺️",
      title: "Explore more letters",
      text: `You still have ${remaining} letters you haven't practised yet. Try to cover all 26 — even letters you find easy help strengthen your overall phonics skills.`,
      color: "#3b82f6",
      bg: "#eff6ff",
    });
  }

  if (totalAttempts < 20) {
    tips.push({
      icon: "🔁",
      title: "More practice = faster progress",
      text: `You've done ${totalAttempts} attempts so far. Aim for at least 30–40 attempts per week — just 5 minutes a day makes a huge difference over time!`,
      color: "#f59e0b",
      bg: "#fffbeb",
    });
  }

  if (tier === "excellent") {
    tips.push({
      icon: "🚀",
      title: "Ready for the next challenge?",
      text: `With letter naming this strong, you're well prepared to move on to two-letter words and beyond. Keep the momentum going!`,
      color: "#8b5cf6",
      bg: "#faf5ff",
    });
  }

  const borderColor =
    tier === "excellent" ? "#10b981" :
    tier === "good"      ? "#3b82f6" :
    tier === "developing"? "#f59e0b" :
    "#ef4444";

  const headerBg =
    tier === "excellent" ? "linear-gradient(135deg,#10b981,#34d399)" :
    tier === "good"      ? "linear-gradient(135deg,#3b82f6,#60a5fa)" :
    tier === "developing"? "linear-gradient(135deg,#f59e0b,#fbbf24)" :
    "linear-gradient(135deg,#ef4444,#f87171)";

  return (
    <div style={{ ...styles.feedbackCard, borderColor }}>
      {/* Feedback header */}
      <div style={{ ...styles.feedbackHeader, background: headerBg }}>
        <div>
          <h3 style={styles.feedbackHeadline}>{headline}</h3>
          <p style={styles.feedbackOverall}>{overallMessage}</p>
        </div>
        <div style={styles.feedbackEmoji}>
          {tier === "excellent" ? "🏆" : tier === "good" ? "🎉" : tier === "developing" ? "💪" : "🌱"}
        </div>
      </div>

      {/* Tip cards */}
      {tips.length > 0 && (
        <div style={styles.feedbackTips}>
          <h4 style={styles.feedbackTipsTitle}>📋 Your personalised tips</h4>
          <div style={styles.tipsGrid}>
            {tips.map((tip, idx) => (
              <div key={idx} style={{ ...styles.tipCard, background: tip.bg, borderLeft: `4px solid ${tip.color}` }}>
                <div style={styles.tipHeader}>
                  <span style={styles.tipIcon}>{tip.icon}</span>
                  <span style={{ ...styles.tipTitle, color: tip.color }}>{tip.title}</span>
                </div>
                <p style={styles.tipText}>{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivational footer quote */}
      <div style={styles.feedbackQuote}>
        <span style={styles.feedbackQuoteText}>
          {tier === "excellent"
            ? `"Excellence is not a destination but a continuous journey." Keep practising, ${firstName}!`
            : tier === "good"
            ? `"Progress, not perfection, is the goal." You're doing great, ${firstName}!`
            : tier === "developing"
            ? `"Every expert was once a beginner." You're on the right path, ${firstName}!`
            : `"Small daily improvements lead to stunning results." Keep going, ${firstName}!`}
        </span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: `${color}15` }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
      </div>
      <div style={styles.statContent}>
        <span style={styles.statLabel}>{label}</span>
        <h3 style={{ ...styles.statValue, color }}>{value}</h3>
        {subValue && <span style={styles.statSubValue}>{subValue}</span>}
      </div>
    </div>
  );
}

function LetterStrengthGrid({ data }) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  const map = {};
  data.forEach((item) => { map[item.letter.toLowerCase()] = item; });

  return (
    <div style={styles.masteryGrid}>
      {alphabet.map((char) => {
        const item = map[char];
        const notPractised = !item || item.attempts === 0;
        const strength = item ? parseFloat(item.strength) : null;

        const bg = notPractised ? "#f1f5f9"
          : strength >= 40      ? "#d1fae5"
          : strength >= 0       ? "#fef3c7"
          :                       "#fee2e2";

        const textColor = notPractised ? "#94a3b8"
          : strength >= 40            ? "#065f46"
          : strength >= 0             ? "#92400e"
          :                             "#991b1b";

        return (
          <div
            key={char}
            title={notPractised
              ? `${char.toUpperCase()}: not yet practised`
              : `${char.toUpperCase()}: ${item.attempts} attempts · strength ${strength.toFixed(1)}`}
            style={{ ...styles.masteryCell, background: bg, color: textColor }}
          >
            <span style={styles.masteryLetter}>{char.toUpperCase()}</span>
            {!notPractised && (
              <span style={styles.masteryPct}>
                {strength >= 0 ? "+" : ""}{strength.toFixed(0)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = {
  page: { padding: "32px", maxWidth: "1400px", margin: "0 auto", background: "#f0fdf4" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" },
  spinner: { width: "48px", height: "48px", border: "4px solid #e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" },
  loadingText: { fontSize: "16px", color: "#64748b" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: "40px" },
  emptyIcon: { fontSize: "64px", marginBottom: "24px" },
  emptyTitle: { fontSize: "28px", fontWeight: "700", color: "#0f172a", marginBottom: "12px" },
  emptyText: { fontSize: "16px", color: "#64748b", marginBottom: "32px", maxWidth: "400px" },
  startButton: { background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", padding: "14px 32px", borderRadius: "12px", fontSize: "16px", fontWeight: "600", cursor: "pointer" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", flexWrap: "wrap", gap: "16px" },
  title: { fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px" },
  subtitle: { fontSize: "15px", color: "#64748b", margin: 0 },
  headerActions: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  downloadButton: { background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", padding: "12px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" },
  downloadButtonDisabled: { background: "#94a3b8", color: "white", border: "none", padding: "12px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "not-allowed", opacity: 0.7, whiteSpace: "nowrap" },
  filterContainer: { display: "flex", gap: "8px", background: "white", padding: "4px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  filterBtn: { padding: "8px 16px", border: "none", background: "transparent", color: "#64748b", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "500" },
  filterBtnActive: { padding: "8px 16px", border: "none", background: "#10b981", color: "white", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "24px" },
  statCard: { background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display: "flex", gap: "16px", alignItems: "flex-start" },
  statIcon: { width: "56px", height: "56px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statContent: { flex: 1, display: "flex", flexDirection: "column", gap: "4px" },
  statLabel: { fontSize: "13px", color: "#64748b", fontWeight: "500" },
  statValue: { fontSize: "28px", fontWeight: "700", lineHeight: 1 },
  statSubValue: { fontSize: "13px", color: "#64748b" },
  card: { background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "24px" },
  cardTitle: { fontSize: "18px", fontWeight: "700", color: "#0f172a", marginBottom: "8px" },
  cardSubtitle: { fontSize: "13px", color: "#64748b", marginBottom: "16px" },
  twoColumnGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "24px" },
  problemList: { display: "flex", flexDirection: "column", gap: "12px" },
  problemItem: { display: "flex", alignItems: "center", gap: "16px" },
  badge: { minWidth: "48px", height: "48px", borderRadius: "12px", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "700", flexShrink: 0 },
  problemInfo: { flex: 1 },
  problemCount: { fontSize: "14px", color: "#64748b", display: "block", marginBottom: "6px" },
  strengthLabel: { fontSize: "13px", fontWeight: "700", color: "#374151", minWidth: "40px", textAlign: "right" },
  progressBarBg: { height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: "4px", transition: "width 0.3s ease" },
  masteryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))", gap: "10px" },
  masteryCell: { borderRadius: "12px", padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", cursor: "default", transition: "transform 0.15s" },
  masteryLetter: { fontSize: "20px", fontWeight: "700" },
  masteryPct: { fontSize: "11px", fontWeight: "600" },

  // Personalised feedback
  feedbackCard: { borderRadius: "20px", border: "2px solid", marginBottom: "24px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  feedbackHeader: { padding: "28px 32px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" },
  feedbackHeadline: { fontSize: "22px", fontWeight: "700", margin: "0 0 8px" },
  feedbackOverall: { fontSize: "15px", opacity: 0.95, margin: 0, lineHeight: 1.6, maxWidth: "680px" },
  feedbackEmoji: { fontSize: "56px", flexShrink: 0 },
  feedbackTips: { padding: "24px 32px", background: "white" },
  feedbackTipsTitle: { fontSize: "15px", fontWeight: "700", color: "#374151", marginBottom: "16px", marginTop: 0 },
  tipsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" },
  tipCard: { borderRadius: "12px", padding: "16px", borderLeft: "4px solid" },
  tipHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
  tipIcon: { fontSize: "18px" },
  tipTitle: { fontSize: "14px", fontWeight: "700" },
  tipText: { fontSize: "13px", color: "#4b5563", margin: 0, lineHeight: 1.6 },
  feedbackQuote: { padding: "16px 32px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" },
  feedbackQuoteText: { fontSize: "13px", color: "#64748b", fontStyle: "italic" },

  ctaCard: { background: "linear-gradient(135deg, #059669, #10b981)", borderRadius: "20px", padding: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", flexWrap: "wrap", gap: "20px" },
  ctaTitle: { fontSize: "24px", fontWeight: "700", marginBottom: "8px", marginTop: 0 },
  ctaText: { fontSize: "15px", opacity: 0.9, margin: 0 },
  ctaButton: { background: "white", color: "#059669", border: "none", padding: "14px 28px", borderRadius: "12px", fontSize: "16px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  button:hover:not(:disabled) { transform: translateY(-2px); }
`;
document.head.appendChild(styleSheet);