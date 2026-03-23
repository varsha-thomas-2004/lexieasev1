import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/api";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

/* ─── Global keyframes ───────────────────────────────────────── */
const _style = document.createElement("style");
_style.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .rnd-fade { animation: fadeUp 0.38s ease both; }
  .rnd-fade:nth-child(1){animation-delay:.04s}
  .rnd-fade:nth-child(2){animation-delay:.09s}
  .rnd-fade:nth-child(3){animation-delay:.14s}
  .rnd-fade:nth-child(4){animation-delay:.19s}
  button:hover:not(:disabled) { transform: translateY(-2px); }
`;
document.head.appendChild(_style);

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function WordReport() {
  const navigate = useNavigate();
  const [report,      setReport]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [timeframe,   setTimeframe]   = useState(365);
  const [userInfo,    setUserInfo]    = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [user, data] = await Promise.all([
          apiFetch("/api/auth/me"),
          apiFetch(`/api/reports/student/words?timeframe=${timeframe}`),
        ]);
        setUserInfo(user);
        setReport(data);
      } catch (err) {
        console.error("Failed to fetch word report:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [timeframe]);

  /* ── Derived data ──
     Backend now returns { twoLetter, words, combined, success }
  ── */
  const twM = report?.twoLetter ?? null;
  const wdM = report?.words     ?? null;
  const cmb = report?.combined  ?? null;

  const combinedAttempts = cmb?.totalAttempts   ?? ((twM?.overview?.totalAttempts   ?? 0) + (wdM?.overview?.totalAttempts   ?? 0));
  const combinedCorrect  = cmb?.correctAttempts ?? ((twM?.overview?.correctAttempts ?? 0) + (wdM?.overview?.correctAttempts ?? 0));
  const combinedRate     = cmb?.successRate     ?? (combinedAttempts > 0 ? +((combinedCorrect / combinedAttempts) * 100).toFixed(1) : 0);
  const avgRT            = cmb?.avgResponseTime ?? (() => {
    const rts = [twM?.overview?.avgResponseTime, wdM?.overview?.avgResponseTime].filter(Boolean);
    return rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
  })();

  /* ── PDF ── */
  const downloadPDF = () => {
    if (!report) return;
    setDownloading(true);
    try {
      const doc  = new jsPDF({ unit: "mm", format: "a4" });
      const name = userInfo?.name || "Student";
      const date = new Date().toLocaleDateString("en-GB");

      // ── Colour palette (RGB arrays for jsPDF) ────────────────
      const PURPLE = [109, 40, 217];
      const TEAL   = [15, 118, 110];
      const AMBER  = [180, 83, 9];
      const RED    = [220, 38, 38];
      const GREY   = [100, 116, 139];
      const WHITE  = [255, 255, 255];

      // ── Helper: section header ────────────────────────────────
      let y = 48;
      const section = (title, rgb) => {
        if (y > 248) { doc.addPage(); y = 20; }
        doc.setTextColor(...rgb);
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text(title, 15, y); y += 2;
        doc.setDrawColor(...rgb); doc.setLineWidth(0.4);
        doc.line(15, y, 195, y); y += 7;
      };

      // ── Helper: RT status text (no emoji — jsPDF safe) ───────
      const rtStatus = (ms) =>
        ms < 2000 ? "On Target" : ms < 4000 ? "Borderline" : "Delayed";

      // ── Helper: performance label ─────────────────────────────
      const perfLabel = (rate) =>
        parseFloat(rate) >= 80 ? "Strong"
        : parseFloat(rate) >= 60 ? "Developing"
        : "Needs Practice";

      // ════════════════════════════════════════════════════════
      //  HEADER
      // ════════════════════════════════════════════════════════
      doc.setFillColor(...PURPLE);
      doc.rect(0, 0, 210, 42, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold"); doc.setFontSize(20);
      doc.text("LexCura Speech Therapy", 105, 14, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      doc.text("Rapid Naming Deficit — Word Practice Report", 105, 24, { align: "center" });
      doc.setFontSize(9);
      doc.text(
        `Student: ${name}   |   Period: Last ${timeframe} days   |   Generated: ${date}`,
        105, 33, { align: "center" }
      );

      // ════════════════════════════════════════════════════════
      //  SECTION 1 — Combined overview
      // ════════════════════════════════════════════════════════
      section("1. Performance Overview", PURPLE);

      const overviewRows = [];
      if (twM) overviewRows.push([
        "Two-Letter Words",
        String(twM.overview.totalAttempts),
        String(twM.overview.correctAttempts),
        `${twM.overview.successRate}%`,
        `${(twM.overview.avgResponseTime / 1000).toFixed(2)}s`,
        rtStatus(twM.overview.avgResponseTime),
      ]);
      if (wdM) overviewRows.push([
        "Multi-Letter Words",
        String(wdM.overview.totalAttempts),
        String(wdM.overview.correctAttempts),
        `${wdM.overview.successRate}%`,
        `${(wdM.overview.avgResponseTime / 1000).toFixed(2)}s`,
        rtStatus(wdM.overview.avgResponseTime),
      ]);
      if (cmb) overviewRows.push([
        "COMBINED TOTAL",
        String(cmb.totalAttempts),
        String(cmb.correctAttempts),
        `${cmb.successRate}%`,
        `${(cmb.avgResponseTime / 1000).toFixed(2)}s`,
        rtStatus(cmb.avgResponseTime),
      ]);

      doc.autoTable({
        startY: y,
        head: [["Level", "Attempts", "Correct", "Success Rate", "Avg Response", "Speed Status"]],
        body: overviewRows,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4, font: "helvetica" },
        headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: "bold" },
        bodyStyles: { textColor: [30, 30, 30] },
        columnStyles: { 5: { fontStyle: "bold" } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 5) {
            const val = data.cell.raw;
            if (val === "On Target")  data.cell.styles.textColor = [5, 150, 105];
            else if (val === "Borderline") data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [220, 38, 38];
          }
          // Highlight combined row
          if (data.section === "body" && data.row.index === overviewRows.length - 1 && cmb) {
            data.cell.styles.fillColor = [237, 233, 254];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      y = doc.lastAutoTable.finalY + 10;

      // ════════════════════════════════════════════════════════
      //  SECTION 2 — Naming Speed Analysis (RND core metric)
      // ════════════════════════════════════════════════════════
      section("2. Naming Speed Analysis", PURPLE);

      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.setTextColor(...GREY);
      doc.text(
        "Rapid Automatic Naming (RAN) speed is the primary indicator for RND. Target: under 2.0s per word.",
        15, y, { maxWidth: 180 }
      );
      y += 8;

      const speedZoneRows = [
        ["Fluent", "< 2.0s", "Reading fluency target — aim for all words here"],
        ["Borderline", "2.0s - 4.0s", "Mild delay — consistent practice will reduce this"],
        ["Significant Delay", "> 4.0s", "RND high-risk zone — priority for intervention"],
      ];

      const levels = [];
      if (twM) levels.push({ label: "Two-Letter", ms: twM.overview.avgResponseTime });
      if (wdM) levels.push({ label: "Multi-Letter", ms: wdM.overview.avgResponseTime });

      const zoneBody = speedZoneRows.map(([zone, range, note]) => {
        const match = levels.filter(l =>
          (zone === "Fluent"              && l.ms < 2000) ||
          (zone === "Borderline"          && l.ms >= 2000 && l.ms < 4000) ||
          (zone === "Significant Delay"   && l.ms >= 4000)
        ).map(l => `${l.label}: ${(l.ms/1000).toFixed(2)}s`).join(", ");
        return [zone, range, note, match || "—"];
      });

      doc.autoTable({
        startY: y,
        head: [["Zone", "Range", "Clinical Note", "This Student"]],
        body: zoneBody,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: "bold" },
        columnStyles: { 2: { cellWidth: 70 }, 3: { fontStyle: "bold" } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 3 && data.cell.raw !== "—") {
            const row = data.row.index;
            if (row === 0) data.cell.styles.textColor = [5, 150, 105];
            else if (row === 1) data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [220, 38, 38];
          }
        },
      });
      y = doc.lastAutoTable.finalY + 10;

      // ════════════════════════════════════════════════════════
      //  SECTION 3 — Words Practiced with naming speed
      // ════════════════════════════════════════════════════════
      const allWordsCombined = [
        ...(twM?.allWords ?? []).map(w => ({ ...w, level: "Two-Letter" })),
        ...(wdM?.allWords ?? []).map(w => ({ ...w, level: "Multi-Letter" })),
      ].sort((a, b) => b.avgResponseTime - a.avgResponseTime);

      if (allWordsCombined.length > 0) {
        section("3. Words Practiced — Naming Speed", TEAL);
        doc.autoTable({
          startY: y,
          head: [["Word", "Level", "Attempts", "Correct", "Accuracy", "Avg Response", "Speed"]],
          body: allWordsCombined.map(w => [
            w.word.toUpperCase(),
            w.level,
            String(w.totalAttempts),
            String(w.correctCount),
            `${w.successRate}%`,
            `${(w.avgResponseTime / 1000).toFixed(2)}s`,
            rtStatus(w.avgResponseTime),
          ]),
          theme: "striped",
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: TEAL, textColor: WHITE, fontStyle: "bold" },
          columnStyles: { 6: { fontStyle: "bold" } },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 6) {
              const val = data.cell.raw;
              if (val === "On Target") data.cell.styles.textColor = [5, 150, 105];
              else if (val === "Borderline") data.cell.styles.textColor = [180, 83, 9];
              else data.cell.styles.textColor = [220, 38, 38];
            }
            if (data.section === "body" && data.column.index === 1) {
              data.cell.styles.textColor = data.cell.raw === "Two-Letter"
                ? [15, 118, 110] : [180, 83, 9];
            }
          },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ════════════════════════════════════════════════════════
      //  SECTION 4 — Daily progress
      // ════════════════════════════════════════════════════════
      const hasDailyData = twM?.daily?.length > 0 || wdM?.daily?.length > 0;
      if (hasDailyData) {
        if (y > 200) { doc.addPage(); y = 20; }
        section("4. Daily Progress Log", PURPLE);

        const dailyRows = [];
        (twM?.daily ?? []).forEach(d => dailyRows.push([
          new Date(d.date).toLocaleDateString("en-GB"),
          "Two-Letter",
          String(d.attempts),
          `${d.successRate}%`,
          perfLabel(d.successRate),
        ]));
        (wdM?.daily ?? []).forEach(d => dailyRows.push([
          new Date(d.date).toLocaleDateString("en-GB"),
          "Multi-Letter",
          String(d.attempts),
          `${d.successRate}%`,
          perfLabel(d.successRate),
        ]));
        dailyRows.sort((a, b) => a[0].localeCompare(b[0]));

        doc.autoTable({
          startY: y,
          head: [["Date", "Level", "Sessions", "Success Rate", "Performance"]],
          body: dailyRows,
          theme: "striped",
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: "bold" },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 1) {
              data.cell.styles.textColor = data.cell.raw === "Two-Letter"
                ? [15, 118, 110] : [180, 83, 9];
            }
            if (data.section === "body" && data.column.index === 4) {
              const v = data.cell.raw;
              if (v === "Strong") data.cell.styles.textColor = [5, 150, 105];
              else if (v === "Developing") data.cell.styles.textColor = [180, 83, 9];
              else data.cell.styles.textColor = [220, 38, 38];
            }
          },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ════════════════════════════════════════════════════════
      //  SECTION 5 — Personalised Action Plan
      // ════════════════════════════════════════════════════════
      if (y > 210) { doc.addPage(); y = 20; }
      section("5. Personalised RND Action Plan", TEAL);

      const actions = [];
      const slowTwoLetter = (twM?.slowWords ?? []).filter(w => w.avgResponseTime >= 2000).slice(0, 3);
      const slowMulti     = (wdM?.slowWords ?? []).filter(w => w.avgResponseTime >= 2000).slice(0, 3);

      if (avgRT >= 2000)
        actions.push(["Speed Drills",
          "Daily 5-min timed naming: hold up word cards and say each one as fast as possible. Track your time."]);
      if (slowTwoLetter.length > 0)
        actions.push(["Two-Letter Speed",
          `Slowest words: ${slowTwoLetter.map(w => w.word.toUpperCase()).join(", ")} — practise 20 rapid-fire reps each session.`]);
      if (slowMulti.length > 0)
        actions.push(["Multi-Letter Speed",
          `Slowest words: ${slowMulti.map(w => w.word.toUpperCase()).join(", ")} — say each word the moment you see it, without pausing.`]);

      const wdRate = parseFloat(wdM?.overview?.successRate ?? 0);
      const twRate = parseFloat(twM?.overview?.successRate ?? 0);
      if (twRate < 80 && twM)
        actions.push(["Build Foundation",
          "Achieve 80%+ on two-letter words before spending most practice time on longer words."]);
      if (wdRate < 60 && wdM)
        actions.push(["Accuracy Focus",
          "For multi-letter words, slow down slightly to improve accuracy first — then work on speed."]);

      actions.push(["Daily Habit",
        "10 minutes every day is more effective than 60 minutes once a week. Short, frequent sessions build automaticity."]);
      actions.push(["Progress Review",
        "Re-assess in 2 weeks. Compare average response times — improvement of 0.5s or more is significant progress."]);

      doc.autoTable({
        startY: y,
        head: [["Strategy", "Action"]],
        body: actions,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: TEAL, textColor: WHITE, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 40, fontStyle: "bold", textColor: TEAL } },
      });
      y = doc.lastAutoTable.finalY + 12;

      // ── Disclaimer ─────────────────────────────────────────
      doc.setFontSize(8); doc.setTextColor(...GREY); doc.setFont("helvetica", "italic");
      doc.text(
        "This report is generated by LexCura and is intended to support — not replace — clinical assessment by a qualified speech-language pathologist.",
        15, y, { maxWidth: 180 }
      );

      // ── Page footers ───────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(15, 285, 195, 285);
        doc.setFontSize(8); doc.setTextColor(...GREY); doc.setFont("helvetica", "normal");
        doc.text("LexCura Speech Therapy — Confidential Clinical Report", 15, 290);
        doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: "right" });
      }

      doc.save(`LexCura_RND_${name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Failed to generate PDF report.");
    } finally {
      setDownloading(false);
    }
  };
  /* ── Loading / empty ── */
  if (loading) return (
    <div style={S.center}>
      <div style={S.spinner} />
      <p style={{ fontSize: 15, color: "#64748b", marginTop: 16 }}>Loading your progress…</p>
    </div>
  );

  const hasData = twM || wdM;
  if (!report || !hasData) return (
    <div style={S.center}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>📊</div>
      <h2 style={{ fontWeight: 800, fontSize: 24, color: "#0f172a", margin: "0 0 10px" }}>No Data Yet</h2>
      <p style={{ color: "#64748b", marginBottom: 28 }}>Complete some exercises to see your progress here.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button style={{ ...S.actionBtn, background: "#0f766e" }} onClick={() => navigate("/student/two-letter-level")}>Two-Letter Words</button>
        <button style={{ ...S.actionBtn, background: "#6d28d9" }} onClick={() => navigate("/student/word-level")}>Multi-Letter Words</button>
      </div>
    </div>
  );

  const studentName = userInfo?.name || "Student";
  const rtColor = avgRT < 2000 ? "#059669" : avgRT < 4000 ? "#d97706" : "#dc2626";

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🔡 Word Practice Report</h1>
          <p style={S.subtitle}>Welcome, {studentName}</p>
        </div>
        <div style={S.headerActions}>
          <button style={downloading ? S.dlBtnOff : S.dlBtn} onClick={downloadPDF} disabled={downloading}>
            {downloading ? "⏳ Generating…" : "📥 Download PDF"}
          </button>
          <div style={S.filterGroup}>
            {[7, 30, 90].map(t => (
              <button key={t} style={timeframe === t ? S.filterOn : S.filterOff} onClick={() => setTimeframe(t)}>
                {t} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={S.statsGrid}>
        <StatCard className="rnd-fade" icon="🎯" label="Combined Accuracy"
          value={`${combinedRate}%`} sub={`${combinedCorrect} of ${combinedAttempts} correct`} color="#6d28d9" />
        <StatCard className="rnd-fade" icon="⚡" label="Avg Response Time"
          value={avgRT > 0 ? `${(avgRT / 1000).toFixed(1)}s` : "—"}
          sub={avgRT === 0 ? "No data" : avgRT < 2000 ? "Within target ✓" : avgRT < 4000 ? "Mild delay ⚠" : "Significant delay ✗"}
          color={rtColor} />
        <StatCard className="rnd-fade" icon="🔤" label="Two-Letter Rate"
          value={twM ? `${twM.overview.successRate}%` : "—"}
          sub={twM ? `${twM.overview.totalAttempts} attempts` : "No sessions yet"} color="#0f766e" />
        <StatCard className="rnd-fade" icon="🔡" label="Multi-Letter Rate"
          value={wdM ? `${wdM.overview.successRate}%` : "—"}
          sub={wdM ? `${wdM.overview.totalAttempts} attempts` : "No sessions yet"} color="#b45309" />
      </div>

      {/* ── Personalised motivation ── */}
      <PersonalisedMotivation
        studentName={studentName}
        combinedRate={combinedRate}
        combinedAttempts={combinedAttempts}
        avgRT={avgRT}
        twM={twM}
        wdM={wdM}
      />

      {/* ── Progress visualization ── */}
      <ProgressVisualization twM={twM} wdM={wdM} />

      {/* ── Words Practiced ── */}
      <WordsPracticed twM={twM} wdM={wdM} />

      {/* ── Slow words ── */}
      <SlowWords twM={twM} wdM={wdM} />

      {/* ── Daily charts ── */}
      {(twM?.daily?.length > 0 || wdM?.daily?.length > 0) && (
        <div style={S.twoCol}>
          {twM?.daily?.length > 0 && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>📈 Two-Letter Daily Progress</h3>
              <DailyChart data={twM.daily} color="#0f766e" />
            </div>
          )}
          {wdM?.daily?.length > 0 && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>📈 Multi-Letter Daily Progress</h3>
              <DailyChart data={wdM.daily} color="#b45309" />
            </div>
          )}
        </div>
      )}

      {/* ── Trend cards ── */}
      {((twM?.trend && twM.trend.direction !== "insufficient_data") ||
        (wdM?.trend && wdM.trend.direction !== "insufficient_data")) && (
        <div style={S.twoCol}>
          {twM?.trend && twM.trend.direction !== "insufficient_data" && (
            <TrendCard trend={twM.trend} label="Two-Letter Trend" color="#0f766e" />
          )}
          {wdM?.trend && wdM.trend.direction !== "insufficient_data" && (
            <TrendCard trend={wdM.trend} label="Multi-Letter Trend" color="#b45309" />
          )}
        </div>
      )}

      {/* ── CTA ── */}
      <div style={S.cta}>
        <div>
          <h3 style={S.ctaTitle}>Keep naming, keep improving 🚀</h3>
          <p style={S.ctaText}>Master two-letter words first, then build up to longer words.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={{ ...S.actionBtn, background: "#0f766e" }} onClick={() => navigate("/student/two-letter-level")}>Two-Letter Practice</button>
          <button style={{ ...S.actionBtn, background: "#b45309" }} onClick={() => navigate("/student/word-level")}>Word Practice</button>
        </div>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PERSONALISED MOTIVATION
══════════════════════════════════════════════════════════════ */
function PersonalisedMotivation({ studentName, combinedRate, combinedAttempts, avgRT, twM, wdM }) {
  const firstName = studentName.split(" ")[0];
  const rate      = +combinedRate;
  const twRate    = twM ? +twM.overview.successRate : null;
  const wdRate    = wdM ? +wdM.overview.successRate : null;

  const tier =
    rate >= 80 && avgRT < 2000 ? "excellent"  :
    rate >= 65 && avgRT < 4000 ? "good"       :
    rate >= 50                 ? "developing" : "needs_support";

  const headline =
    tier === "excellent"  ? `Outstanding work, ${firstName}! 🌟` :
    tier === "good"       ? `Great progress, ${firstName}! 👏`   :
    tier === "developing" ? `You're getting there, ${firstName}! 💪` :
    `Every session counts, ${firstName}! 🌱`;

  const overallMessage =
    tier === "excellent"
      ? `You're naming words quickly and accurately — that's exactly what fluent reading looks like. Your ${combinedAttempts} attempts across both levels show real dedication. Keep this momentum going!`
      : tier === "good"
      ? `You're making solid progress with ${rate}% accuracy across ${combinedAttempts} attempts. Your brain is building faster naming pathways with every session. A bit more focus on the tricky words and you'll be flying!`
      : tier === "developing"
      ? `You've logged ${combinedAttempts} attempts — that's a real commitment! RND improves with consistent practice, and you're showing up. Keep going and you'll see big improvements soon.`
      : `You've made a great start with ${combinedAttempts} attempts logged. The key is consistency — short daily sessions of even 5–10 minutes will build your naming speed faster than you think!`;

  const tips = [];

  if (twRate !== null && wdRate !== null) {
    if (twRate < 70) {
      tips.push({ icon: "🔤", title: "Build two-letter fluency first",
        text: `Your two-letter accuracy is ${twRate}%. Aim for 80%+ here before spending lots of time on longer words — strong foundations make everything else easier.`,
        color: "#0f766e", bg: "#f0fdfa" });
    } else if (twRate >= 80 && wdRate < 65) {
      tips.push({ icon: "🚀", title: "Ready to level up!",
        text: `Two-letter words are going well at ${twRate}%! Now channel that energy into multi-letter words — your foundations are solid enough to push further.`,
        color: "#6d28d9", bg: "#faf5ff" });
    }
  }

  if (avgRT >= 4000) {
    tips.push({ icon: "⏱️", title: "Speed is the key skill",
      text: `Your average response time is ${(avgRT / 1000).toFixed(1)}s. For RND, the target is under 2s. Try daily 5-minute timed flashcard drills — speed comes from repetition, not pressure.`,
      color: "#dc2626", bg: "#fef2f2" });
  } else if (avgRT >= 2000) {
    tips.push({ icon: "⏱️", title: "Working on naming speed",
      text: `You're at ${(avgRT / 1000).toFixed(1)}s average — making progress toward the 2s target. Keep practising; speed naturally improves as words become more familiar.`,
      color: "#d97706", bg: "#fffbeb" });
  }

  const allProblemWords = [
    ...(twM?.problemWords ?? []).map(w => w.word),
    ...(wdM?.problemWords ?? []).map(w => w.word),
  ].slice(0, 4);

  if (allProblemWords.length > 0) {
    tips.push({ icon: "🎯", title: "Priority words to drill",
      text: `Focus extra time on: ${allProblemWords.map(w => w.toUpperCase()).join(", ")}. Say each one out loud 10 times slowly, then try a timed round. Repetition is the shortcut.`,
      color: "#dc2626", bg: "#fef2f2" });
  }

  if (combinedAttempts < 30) {
    tips.push({ icon: "🔁", title: "More sessions = faster gains",
      text: `You've done ${combinedAttempts} attempts so far. Aim for 30–50 per week across both levels — just 2 short sessions a day makes a huge difference over time.`,
      color: "#3b82f6", bg: "#eff6ff" });
  }

  if (tier === "excellent") {
    tips.push({ icon: "🏆", title: "Keep pushing the pace",
      text: `With accuracy this strong, challenge yourself to respond faster — try to beat your own response time each session. The goal is automatic, effortless naming.`,
      color: "#6d28d9", bg: "#faf5ff" });
  }

  const borderColor = tier === "excellent" ? "#6d28d9" : tier === "good" ? "#0f766e" : tier === "developing" ? "#d97706" : "#dc2626";
  const headerBg    = tier === "excellent" ? "linear-gradient(135deg, #6d28d9, #8b5cf6)" : tier === "good" ? "linear-gradient(135deg, #0f766e, #14b8a6)" : tier === "developing" ? "linear-gradient(135deg, #d97706, #fbbf24)" : "linear-gradient(135deg, #dc2626, #f87171)";
  const emoji       = tier === "excellent" ? "🏆" : tier === "good" ? "🎉" : tier === "developing" ? "💪" : "🌱";
  const quote       = tier === "excellent" ? `"Fluency is built one word at a time." Keep it up, ${firstName}!` : tier === "good" ? `"Progress, not perfection, is the goal." You're doing great, ${firstName}!` : tier === "developing" ? `"Every expert was once a beginner." You're on the right path, ${firstName}!` : `"Small daily improvements lead to stunning results." Keep going, ${firstName}!`;

  return (
    <div style={{ ...S.feedbackCard, borderColor }}>
      <div style={{ ...S.feedbackHeader, background: headerBg }}>
        <div style={{ flex: 1 }}>
          <h3 style={S.feedbackHeadline}>{headline}</h3>
          <p style={S.feedbackOverall}>{overallMessage}</p>
        </div>
        <div style={S.feedbackEmoji}>{emoji}</div>
      </div>
      {tips.length > 0 && (
        <div style={S.feedbackBody}>
          <h4 style={S.tipsTitle}>📋 Your personalised tips</h4>
          <div style={S.tipsGrid}>
            {tips.map((tip, idx) => (
              <div key={idx} style={{ ...S.tipCard, background: tip.bg, borderLeft: `4px solid ${tip.color}` }}>
                <div style={S.tipHeader}>
                  <span style={{ fontSize: 18 }}>{tip.icon}</span>
                  <span style={{ ...S.tipTitle, color: tip.color }}>{tip.title}</span>
                </div>
                <p style={S.tipText}>{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={S.feedbackQuote}>
        <span style={S.feedbackQuoteText}>{quote}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROGRESS VISUALIZATION
══════════════════════════════════════════════════════════════ */
function ProgressVisualization({ twM, wdM }) {
  const [activeLevel, setActiveLevel] = useState(twM ? "twoLetter" : "words");

  const d     = activeLevel === "twoLetter" ? twM : wdM;
  const color = activeLevel === "twoLetter" ? "#0f766e" : "#b45309";

  if (!d) return null;

  const rt       = d.overview.avgResponseTime;
  const rtPct    = Math.min((rt / 8000) * 100, 96);
  const rtColor  = rt < 2000 ? "#059669" : rt < 4000 ? "#d97706" : "#dc2626";
  const maxRate  = d.daily?.length ? Math.max(...d.daily.map(x => parseFloat(x.successRate)), 1) : 100;
  const hasTrend = d.trend && d.trend.direction !== "insufficient_data";

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h3 style={{ ...S.cardTitle, margin: 0 }}>📊 Progress at a Glance</h3>
        <div style={S.filterGroup}>
          {twM && (
            <button style={activeLevel === "twoLetter" ? { ...S.filterOn, background: "#0f766e" } : S.filterOff}
              onClick={() => setActiveLevel("twoLetter")}>🔤 Two-Letter</button>
          )}
          {wdM && (
            <button style={activeLevel === "words" ? { ...S.filterOn, background: "#b45309" } : S.filterOff}
              onClick={() => setActiveLevel("words")}>🔡 Multi-Letter</button>
          )}
        </div>
      </div>

      <div style={S.miniStatRow}>
        <MiniStat label="Accuracy"     value={`${d.overview.successRate}%`}    color={color} />
        <MiniStat label="Avg Response" value={`${(rt / 1000).toFixed(1)}s`}    color={rtColor}
          sub={rt < 2000 ? "On target ✓" : rt < 4000 ? "Mild delay ⚠" : "Delayed ✗"} />
        <MiniStat label="Correct"      value={`${d.overview.correctAttempts}`}  color={color}
          sub={`of ${d.overview.totalAttempts}`} />
        <MiniStat label="Trend"
          value={!hasTrend ? "Collecting…" : d.trend.direction === "improving" ? "↗ Improving" : d.trend.direction === "declining" ? "↘ Declining" : "→ Stable"}
          color={d.trend?.direction === "improving" ? "#059669" : d.trend?.direction === "declining" ? "#dc2626" : color} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={S.cardHint}>Naming speed zone</p>
        <div style={S.zoneTrack}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 6,
            background: "linear-gradient(to right, #05966933 0%, #d9770633 40%, #dc262633 68%)" }} />
          <div style={{ ...S.zoneNeedle, left: `${rtPct}%`, background: rtColor }} />
        </div>
        <div style={S.zoneLabels}>
          <span style={{ color: "#059669", fontSize: 11, fontWeight: 700 }}>Fluent &lt;2s</span>
          <span style={{ color: "#d97706", fontSize: 11, fontWeight: 700 }}>Borderline</span>
          <span style={{ color: "#dc2626", fontSize: 11, fontWeight: 700 }}>&gt;4s Delay</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: rtColor, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
          {(rt / 1000).toFixed(2)}s
        </div>
      </div>

      {d.daily?.length > 0 && (
        <>
          <p style={S.cardHint}>Daily accuracy</p>
          <div style={S.chartBars}>
            {d.daily.map((day, idx) => {
              const h   = (parseFloat(day.successRate) / maxRate) * 100;
              const clr = parseFloat(day.successRate) >= 80 ? "#059669" : parseFloat(day.successRate) >= 60 ? "#d97706" : "#dc2626";
              return (
                <div key={idx} style={S.chartBarCol}>
                  <span style={S.chartPct}>{day.successRate}%</span>
                  <div style={{ ...S.chartBarFill, height: `${Math.max(h, 5)}%`, background: clr }} />
                  <span style={S.chartDate}>
                    {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
══════════════════════════════════════════════════════════════ */
function StatCard({ icon, label, value, sub, color, className }) {
  return (
    <div className={`rnd-fade ${className || ""}`} style={{ ...S.statCard, borderTop: `3px solid ${color}` }}>
      <div style={{ ...S.statIcon, background: `${color}15` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={S.statLabel}>{label}</span>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        {sub && <span style={{ fontSize: 11, color: "#64748b" }}>{sub}</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: "center", flex: 1, minWidth: 80 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ProblemRow({ label, count, rate, rank, color, mono }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <div style={{ minWidth: 56, height: 40, borderRadius: 8, background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, padding: "0 10px", flexShrink: 0,
        fontFamily: mono ? "monospace" : "inherit" }}>{label}</div>
      <div style={{ flex: 1 }}>
        <div style={S.barBg}>
          <div style={{ ...S.barFill, width: `${Math.min(parseFloat(rate), 100)}%`, background: color }} />
        </div>
        <span style={{ fontSize: 11, color: "#64748b" }}>{count} error{count !== 1 ? "s" : ""} · {rate}%</span>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
        background: rank < 2 ? "#fef2f2" : "#fffbeb",
        color: rank < 2 ? "#dc2626" : "#d97706" }}>{rank < 2 ? "HIGH" : "MED"}</span>
    </div>
  );
}

function DailyChart({ data, color }) {
  const maxRate = Math.max(...data.map(d => parseFloat(d.successRate)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110, paddingBottom: 24, paddingTop: 8 }}>
      {data.map((day, idx) => {
        const h   = (parseFloat(day.successRate) / maxRate) * 100;
        const clr = parseFloat(day.successRate) >= 80 ? "#059669" : parseFloat(day.successRate) >= 60 ? "#d97706" : "#dc2626";
        return (
          <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative", gap: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#475569" }}>{day.successRate}%</span>
            <div style={{ width: "100%", borderRadius: "4px 4px 0 0", height: `${Math.max(h, 5)}%`, background: clr, transition: "height .4s ease" }} />
            <span style={{ position: "absolute", bottom: 0, fontSize: 9, color: "#94a3b8", textAlign: "center", whiteSpace: "nowrap" }}>
              {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrendCard({ trend, label, color }) {
  if (!trend || trend.direction === "insufficient_data") return null;
  const improving = trend.direction === "improving";
  const stable    = trend.direction === "stable";
  const prevPct   = trend.previousAvg <= 1
    ? (trend.previousAvg * 100).toFixed(1)
    : parseFloat(trend.previousAvg).toFixed(1);
  return (
    <div style={{
      borderRadius: 16, padding: "22px 26px", color: "white",
      display: "flex", gap: 20, alignItems: "flex-start",
      boxShadow: "0 8px 24px rgba(0,0,0,.12)", flexWrap: "wrap",
      background: improving ? "linear-gradient(135deg, #059669, #34d399)"
        : stable ? `linear-gradient(135deg, ${color}, ${color}cc)`
        : "linear-gradient(135deg, #d97706, #fbbf24)",
    }}>
      <div style={{ fontSize: 38, flexShrink: 0 }}>{improving ? "🎉" : stable ? "📊" : "💪"}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8, marginBottom: 4 }}>{label}</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>
          {improving ? "You're Improving!" : stable ? "Steady Progress" : "Let's Refocus"}
        </h3>
        <p style={{ fontSize: 13, opacity: 0.9, margin: "0 0 12px", lineHeight: 1.6, color: "#fff" }}>
          {improving && `Success rate up ${Math.abs(parseFloat(trend.change))}% — great momentum!`}
          {stable    && "Consistent performance. Keep up your daily sessions."}
          {!improving && !stable && `Recent rate dropped ${Math.abs(parseFloat(trend.change))}%. Focus on problem words below.`}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <span style={{ display: "block", fontSize: 10, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.06em" }}>Previous</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{prevPct}%</span>
          </div>
          <span style={{ fontSize: 18, opacity: 0.7, color: "#fff" }}>→</span>
          <div>
            <span style={{ display: "block", fontSize: 10, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{trend.recentAccuracy}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   WORDS PRACTICED
   Shows every unique word the student has attempted, colour-coded
   by their success rate: green ≥80%, amber 50–79%, red <50%
══════════════════════════════════════════════════════════════ */
function WordsPracticed({ twM, wdM }) {
  const [activeTab, setActiveTab] = useState(
    wdM?.allWords?.length ? "words" : "twoLetter"
  );

  const wordsData     = wdM?.allWords ?? [];
  const twoLetterData = twM?.allWords ?? [];
  const activeData    = activeTab === "words" ? wordsData : twoLetterData;
  const activeColor   = activeTab === "words" ? "#b45309" : "#0f766e";

  if (!wordsData.length && !twoLetterData.length) return null;

  const sr      = (item) => parseFloat(item.successRate);
  const color   = (s) => s >= 80 ? "#059669" : s >= 50 ? "#d97706" : "#dc2626";
  const bg      = (s) => s >= 80 ? "#f0fdf4" : s >= 50 ? "#fffbeb" : "#fef2f2";
  const label   = (s) => s >= 80 ? "✓ Good" : s >= 50 ? "Developing" : "Needs work";

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ ...S.cardTitle, margin: 0 }}>📝 Words Practiced</h3>
          <p style={{ ...S.cardHint, margin: "4px 0 0" }}>
            {activeData.length} word{activeData.length !== 1 ? "s" : ""} attempted · sorted by accuracy
          </p>
        </div>
        <div style={S.filterGroup}>
          {wdM && (
            <button style={activeTab === "words" ? { ...S.filterOn, background: "#b45309" } : S.filterOff}
              onClick={() => setActiveTab("words")}>🔡 Multi-Letter</button>
          )}
          {twM && (
            <button style={activeTab === "twoLetter" ? { ...S.filterOn, background: "#0f766e" } : S.filterOff}
              onClick={() => setActiveTab("twoLetter")}>🔤 Two-Letter</button>
          )}
        </div>
      </div>

      {activeData.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>
          No data yet. Complete some practice sessions!
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {activeData.map((item, idx) => {
            const s = sr(item);
            return (
              <div key={idx} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: bg(s), border: `1.5px solid ${color(s)}33`,
                borderRadius: 12, padding: "10px 14px",
                minWidth: 150, flex: "1 1 150px",
              }}>
                <div style={{
                  background: activeColor, color: "#fff", borderRadius: 8,
                  padding: "5px 10px", fontSize: 14, fontWeight: 800,
                  fontFamily: "monospace", flexShrink: 0, letterSpacing: "0.05em",
                }}>
                  {item.word.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: color(s) }}>{label(s)}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: color(s), fontFamily: "monospace" }}>{s}%</span>
                  </div>
                  <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${s}%`, background: color(s), transition: "width .4s ease" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    {item.correctCount}/{item.totalAttempts} correct
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
        {[
          { color: "#059669", label: "Good (≥80% correct)" },
          { color: "#d97706", label: "Developing (50–79%)" },
          { color: "#dc2626", label: "Needs work (<50%)" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLOW WORDS  — the RND-specific insight section
   Shows which words took the longest to name. Speed is the
   core deficit in RND, not accuracy. This is more actionable
   than error counts for these students.
══════════════════════════════════════════════════════════════ */
function SlowWords({ twM, wdM }) {
  const [activeTab, setActiveTab] = useState(
    wdM?.slowWords?.length ? "words" : "twoLetter"
  );

  const wordsData     = wdM?.slowWords ?? [];
  const twoLetterData = twM?.slowWords ?? [];
  const activeData    = activeTab === "words" ? wordsData : twoLetterData;
  const activeColor   = activeTab === "words" ? "#b45309" : "#0f766e";

  if (!wordsData.length && !twoLetterData.length) return null;

  const maxRT     = Math.max(...activeData.map(w => w.avgResponseTime), 1);
  const rtColor   = (ms) => ms < 2000 ? "#059669" : ms < 4000 ? "#d97706" : "#dc2626";
  const rtLabel   = (ms) => ms < 2000 ? "Fluent" : ms < 4000 ? "Borderline" : "Slow";

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ ...S.cardTitle, margin: 0 }}>⏱️ Naming Speed by Word</h3>
          <p style={{ ...S.cardHint, margin: "4px 0 0" }}>
            Slowest words to name — these need the most speed practice. Target: under 2s.
          </p>
        </div>
        <div style={S.filterGroup}>
          {wdM && (
            <button style={activeTab === "words" ? { ...S.filterOn, background: "#b45309" } : S.filterOff}
              onClick={() => setActiveTab("words")}>🔡 Multi-Letter</button>
          )}
          {twM && (
            <button style={activeTab === "twoLetter" ? { ...S.filterOn, background: "#0f766e" } : S.filterOff}
              onClick={() => setActiveTab("twoLetter")}>🔤 Two-Letter</button>
          )}
        </div>
      </div>

      {/* Target line explanation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
        <span style={{ fontSize: 14 }}>🎯</span>
        <span style={{ fontSize: 12, color: "#065f46", fontWeight: 500 }}>
          Target: name each word in under 2 seconds. Fluent readers do this automatically.
        </span>
      </div>

      {activeData.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>
          No data yet for this level.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeData.map((item, idx) => {
            const ms    = item.avgResponseTime;
            const clr   = rtColor(ms);
            const barW  = Math.min((ms / maxRT) * 100, 100);
            const target= Math.min((2000 / maxRT) * 100, 100);

            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Word badge */}
                <div style={{
                  background: activeColor, color: "#fff", borderRadius: 8,
                  padding: "6px 12px", fontSize: 14, fontWeight: 800,
                  fontFamily: "monospace", flexShrink: 0, minWidth: 56,
                  textAlign: "center", letterSpacing: "0.05em",
                }}>
                  {item.word.toUpperCase()}
                </div>

                {/* Bar + time */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: clr }}>{rtLabel(ms)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: clr, fontFamily: "monospace" }}>
                      {(ms / 1000).toFixed(2)}s
                    </span>
                  </div>
                  {/* Bar with 2s target marker */}
                  <div style={{ position: "relative", height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "visible" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${barW}%`, background: clr,
                      transition: "width .5s ease",
                    }} />
                    {/* 2s target line */}
                    <div style={{
                      position: "absolute", top: -3, bottom: -3,
                      left: `${target}%`, width: 2,
                      background: "#059669", borderRadius: 1,
                      transform: "translateX(-50%)",
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
                    {item.totalAttempts} attempt{item.totalAttempts !== 1 ? "s" : ""} · {item.correctCount}/{item.totalAttempts} correct
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 2, height: 14, background: "#059669", borderRadius: 1 }} />
          <span style={{ fontSize: 11, color: "#64748b" }}>2s target</span>
        </div>
        {[
          { color: "#059669", label: "Fluent (<2s)" },
          { color: "#d97706", label: "Borderline (2–4s)" },
          { color: "#dc2626", label: "Slow (>4s)" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════ */
const S = {
  page:    { padding: 32, maxWidth: 1400, margin: "0 auto", background: "#f5f3ff" },
  center:  { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: 40 },
  spinner: { width: 44, height: 44, border: "4px solid #e2e8f0", borderTopColor: "#6d28d9", borderRadius: "50%", animation: "spin .9s linear infinite" },
  header:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 },
  title:        { fontSize: 28, fontWeight: 900, color: "#18102e", margin: "0 0 4px" },
  subtitle:     { fontSize: 14, color: "#7c6fa0", margin: 0 },
  headerActions:{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  dlBtn:        { background: "linear-gradient(135deg, #6d28d9, #5b21b6)", color: "#fff", border: "none", padding: "11px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  dlBtnOff:     { background: "#94a3b8", color: "#fff", border: "none", padding: "11px 22px", borderRadius: 10, fontSize: 13, cursor: "not-allowed", whiteSpace: "nowrap", opacity: 0.7 },
  filterGroup:  { display: "flex", background: "#fff", borderRadius: 10, padding: 3, boxShadow: "0 1px 4px rgba(0,0,0,.08)", gap: 2 },
  filterOn:     { padding: "7px 14px", border: "none", background: "#6d28d9", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  filterOff:    { padding: "7px 14px", border: "none", background: "transparent", color: "#7c6fa0", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  statsGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 20 },
  statCard:     { background: "#fff", borderRadius: 14, padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: "0 1px 4px rgba(0,0,0,.07)" },
  statIcon:     { width: 46, height: 46, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statLabel:    { fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" },
  feedbackCard:     { borderRadius: 20, border: "2px solid", marginBottom: 24, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  feedbackHeader:   { padding: "28px 32px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  feedbackHeadline: { fontSize: 22, fontWeight: 700, margin: "0 0 8px" },
  feedbackOverall:  { fontSize: 15, opacity: 0.95, margin: 0, lineHeight: 1.6, maxWidth: 680 },
  feedbackEmoji:    { fontSize: 56, flexShrink: 0 },
  feedbackBody:     { padding: "24px 32px", background: "#fff" },
  tipsTitle:        { fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 16, marginTop: 0 },
  tipsGrid:         { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 },
  tipCard:          { borderRadius: 12, padding: 16 },
  tipHeader:        { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  tipTitle:         { fontSize: 14, fontWeight: 700 },
  tipText:          { fontSize: 13, color: "#4b5563", margin: 0, lineHeight: 1.6 },
  feedbackQuote:    { padding: "16px 32px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" },
  feedbackQuoteText:{ fontSize: 13, color: "#64748b", fontStyle: "italic" },
  miniStatRow:  { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", background: "#f8fafc", borderRadius: 12, padding: "14px 20px" },
  zoneTrack:    { position: "relative", height: 12, borderRadius: 6, overflow: "visible", marginBottom: 6, background: "#f1f5f9" },
  zoneNeedle:   { position: "absolute", top: -5, bottom: -5, width: 3, borderRadius: 2, transform: "translateX(-50%)", transition: "left .5s ease" },
  zoneLabels:   { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  chartBars:    { display: "flex", alignItems: "flex-end", gap: 6, height: 120, paddingBottom: 24, paddingTop: 8 },
  chartBarCol:  { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative", gap: 3 },
  chartPct:     { fontSize: 9, fontWeight: 700, color: "#475569" },
  chartBarFill: { width: "100%", borderRadius: "4px 4px 0 0", minHeight: 6, transition: "height .4s ease" },
  chartDate:    { position: "absolute", bottom: 0, fontSize: 9, color: "#94a3b8", textAlign: "center", whiteSpace: "nowrap" },
  twoCol:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 20 },
  card:      { background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,.07)", marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#18102e", margin: "0 0 4px" },
  cardHint:  { fontSize: 12, color: "#94a3b8", margin: "0 0 14px" },
  barBg:     { height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginBottom: 3 },
  barFill:   { height: "100%", borderRadius: 3, transition: "width .4s ease" },
  cta:       { background: "linear-gradient(135deg, #2e1065, #6d28d9)", borderRadius: 18, padding: "26px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", flexWrap: "wrap", gap: 20, marginTop: 4 },
  ctaTitle:  { fontSize: 20, fontWeight: 800, margin: "0 0 6px" },
  ctaText:   { fontSize: 13, opacity: 0.85, margin: 0 },
  actionBtn: { color: "#fff", border: "none", padding: "12px 22px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
};