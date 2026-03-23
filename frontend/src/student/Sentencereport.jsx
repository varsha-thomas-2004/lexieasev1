import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/api";
import { jsPDF } from "jspdf";
import 'jspdf-autotable';

/* ─── global styles injected once ──────────────────────────────── */
if (typeof document !== "undefined") {
  const s = document.createElement("style");
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap');
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
    .sr-fade  { animation: fadeUp 0.4s ease both; }
    .sr-fade:nth-child(1){animation-delay:.05s}
    .sr-fade:nth-child(2){animation-delay:.10s}
    .sr-fade:nth-child(3){animation-delay:.15s}
    .sr-fade:nth-child(4){animation-delay:.20s}
    .sr-fade:nth-child(5){animation-delay:.25s}
    .sr-btn  { transition: transform .15s, box-shadow .15s; }
    .sr-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.14); }
    .sr-pulse { animation: pulse 2s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function SentenceReport() {
  const navigate  = useNavigate();
  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [timeframe,setTimeframe]= useState(365);
  const [userInfo, setUserInfo] = useState(null);
  const [downloading,setDownloading] = useState(false);

  useEffect(() => {
    const go = async () => {
      setLoading(true);
      try {
        const [user, data] = await Promise.all([
          apiFetch('/api/auth/me'),
          apiFetch(`/api/reports/student/sentences?timeframe=${timeframe}`),
        ]);
        setUserInfo(user);
        setReport(data);
      } catch (e) {
        console.error("SentenceReport fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    go();
  }, [timeframe]);

  /* ─── PDF export ──────────────────────────────────────────────── */
  const downloadPDF = () => {
    if (!report?.metrics) return;
    setDownloading(true);
    try {
      const doc  = new jsPDF({ unit: "mm", format: "a4" });
      const { metrics } = report;
      const name = userInfo?.name || "Student";
      const date = new Date().toLocaleDateString();
      const eye  = metrics.eyeTracking || {};

      /* ── Header ── */
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, 210, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");   doc.setFontSize(18);
      doc.text("LexCura Speech Therapy", 105, 13, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(12);
      doc.text("Sentence — Clinical Progress Report", 105, 22, { align: "center" });
      doc.setFontSize(9);
      doc.text(`Student: ${name}   |   Period: Last ${timeframe} Days   |   Generated: ${date}`, 105, 30, { align: "center" });

      let y = 46;
      const sec = (txt, rgb) => {
        doc.setTextColor(...rgb); doc.setFont("helvetica","bold"); doc.setFontSize(13);
        doc.text(txt, 15, y); y += 2;
        doc.setDrawColor(...rgb); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 7;
      };

      /* ── Section 1: Overview ── */
      sec("1. Speech Performance Summary", [16, 185, 129]);
      const sr   = parseFloat(metrics.overview.successRate);
      const rtSec= (metrics.overview.avgResponseTime / 1000).toFixed(2);
      doc.autoTable({
        startY: y,
        head:   [["Metric","Value","Clinical Interpretation"]],
        body: [
          ["Sentence Success Rate",  `${metrics.overview.successRate}%`,        sr>=80?"Strong":sr>=60?"Developing":"Needs Support"],
          ["Pronunciation Accuracy", `${metrics.overview.accuracyPercentage}%`, parseFloat(metrics.overview.accuracyPercentage)>=80?"Excellent":"Developing"],
          ["Correct Sentences",      `${metrics.overview.correctAttempts} / ${metrics.overview.totalAttempts}`, "Total session attempts"],
          ["Avg Response Time",      `${rtSec}s`,                               metrics.overview.avgResponseTime<3000?"Fluent":"Needs fluency work"],
          ["Trend",                  metrics.trend?.direction === "insufficient_data" ? "More data needed" : (metrics.trend?.direction || "—"),
            metrics.trend?.direction==="improving"?"Positive trajectory":metrics.trend?.direction==="declining"?"Needs attention":"Consistent"],
        ],
        theme:"grid", styles:{fontSize:9,cellPadding:4},
        headStyles:{fillColor:[16,185,129],textColor:255,fontStyle:"bold"},
        columnStyles:{2:{cellWidth:80}},
      });
      y = doc.lastAutoTable.finalY + 10;

      /* ── Section 2: Eye-Tracking ── */
      sec("2. Eye-Tracking Analysis (Visual Hesitation)", [59, 130, 246]);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
      const eyeNotes = [
        "Visual hesitation score measures how often eyes pause or re-fixate while reading a sentence.",
        "High scores indicate tracking difficulty — a common co-occurring challenge with dyslexia.",
        eye.tracked > 0
          ? `${eye.tracked} of ${metrics.overview.totalAttempts} sessions had eye-tracking data. Average hesitation score: ${eye.avgVisualScore} (${eye.hesitationLevel}).`
          : "No eye-tracking data recorded in this period. Ensure the camera is enabled during practice.",
      ];
      eyeNotes.forEach(l => { doc.text(l, 15, y, { maxWidth: 180 }); y += 6; });
      y += 2;

      if (eye.tracked > 0) {
        doc.autoTable({
          startY: y,
          head:   [["Eye-Tracking Metric","Value","Interpretation"]],
          body: [
            ["Sessions with Eye Data",    `${eye.tracked}`,            `${((eye.tracked/metrics.overview.totalAttempts)*100).toFixed(0)}% of total sessions`],
            ["Avg Visual Hesitation",     eye.avgVisualScore,          eye.hesitationLevel+" hesitation level"],
            ["Hard Sessions (eye flagged)",`${eye.hardSessions}`,      `${eye.hardRate}% flagged as visually demanding`],
            ["Hesitation Zone",           eye.hesitationLevel,
              eye.hesitationLevel==="Low"?"Good visual flow":eye.hesitationLevel==="Moderate"?"Developing tracking ability":"Significant tracking difficulty"],
          ],
          theme:"striped", styles:{fontSize:9},
          headStyles:{fillColor:[59,130,246],textColor:255},
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      /* ── Section 3: Problem Phonemes ── */
      if (metrics.problemLetters?.length > 0) {
        sec("3. Problem Phonemes", [220, 38, 38]);
        doc.autoTable({
          startY: y,
          head:   [["Sound","Errors","Error Rate","Intervention Note"]],
          body: metrics.problemLetters.map(item => [
            item.letter.toUpperCase(), item.errorCount, `${item.errorRate}%`,
            `Practise /${item.letter}/ in isolation, then in sentences`,
          ]),
          theme:"striped", styles:{fontSize:9},
          headStyles:{fillColor:[220,38,38],textColor:255},
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      /* ── Section 4: Difficult Sentences ── */
      if (metrics.difficultSentences?.length > 0) {
        if (y > 220) { doc.addPage(); y = 20; }
        sec("4. Most Challenging Sentences", [245, 158, 11]);
        doc.autoTable({
          startY: y,
          head:   [["Sentence ID","Attempts","Success Rate","Avg Time","Avg Eye Score"]],
          body: metrics.difficultSentences.map(s => [
            s.sentence, s.attempts, `${s.successRate}%`,
            `${(s.avgTime/1000).toFixed(1)}s`, s.avgVisual,
          ]),
          theme:"striped", styles:{fontSize:9},
          headStyles:{fillColor:[245,158,11],textColor:255},
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      /* ── Page 2: Daily + Action Plan ── */
      doc.addPage(); y = 20;

      if (metrics.daily?.length > 0) {
        sec("5. Daily Progress Log", [16, 185, 129]);
        doc.autoTable({
          startY: y,
          head:   [["Date","Sessions","Accuracy","Success Rate","Avg Eye Score"]],
          body: metrics.daily.map(d => [
            new Date(d.date).toLocaleDateString(),
            d.attempts, `${d.accuracy}%`, `${d.successRate}%`, d.avgVisual ?? "—",
          ]),
          theme:"striped", styles:{fontSize:9},
          headStyles:{fillColor:[16,185,129],textColor:255},
        });
        y = doc.lastAutoTable.finalY + 12;
      }

      /* ── Action Plan ── */
      sec("6. Personalised Action Plan", [15, 118, 110]);
      const actions = [];
      if (metrics.overview.avgResponseTime > 3000)
        actions.push(["Fluency Drills",    "Read each sentence aloud twice before recording"]);
      if (eye.tracked > 0 && parseFloat(eye.avgVisualScore) >= 0.3)
        actions.push(["Eye Movement",      'Practise smooth Left to Right tracking: use a pencil to underline as you read']);
      if (eye.hardSessions > 0)
        actions.push(["Hard Sessions",     `Re-practise the ${eye.hardSessions} flagged session(s) — increase font size if possible`]);
      if (metrics.problemLetters?.length > 0)
        actions.push(["Phoneme Drills",    `Isolate: ${metrics.problemLetters.slice(0,3).map(l=>l.letter.toUpperCase()).join(", ")} — use minimal pairs`]);
      if (sr < 60)
        actions.push(["Session Frequency", "Daily 10-min sessions are more effective than long infrequent ones"]);
      actions.push(["Progress Check",      "Re-assess in 2 weeks; compare accuracy and eye-tracking scores"]);

      doc.autoTable({
        startY: y,
        head:   [["Strategy","Action"]],
        body:   actions,
        theme:"grid", styles:{fontSize:9,cellPadding:5},
        headStyles:{fillColor:[15,118,110],textColor:255},
        columnStyles:{0:{cellWidth:42,fontStyle:"bold"}},
      });

      y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(8); doc.setTextColor(150); doc.setFont("helvetica","italic");
      doc.text("This report is generated by LexCura and is intended to support — not replace — clinical assessment by a qualified speech-language pathologist.", 15, y, { maxWidth:180 });

      /* ── Footers ── */
      const pc = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pc; i++) {
        doc.setPage(i);
        doc.setDrawColor(200); doc.line(15,285,195,285);
        doc.setFontSize(8); doc.setTextColor(130); doc.setFont("helvetica","normal");
        doc.text("LexCura — Confidential Clinical Report", 15, 290);
        doc.text(`Page ${i} of ${pc}`, 195, 290, { align:"right" });
      }

      doc.save(`LexCura_Sentence_Report_${name.replace(/\s+/g,"_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Failed to generate PDF.");
    } finally {
      setDownloading(false);
    }
  };

  /* ─── Loading ── */
  if (loading) return (
    <div style={S.center}>
      <div style={S.spinner} />
      <p style={S.loadingText}>Loading sentence report…</p>
    </div>
  );

  /* ─── Empty ── */
  if (!report?.metrics) return (
    <div style={S.center}>
      <div style={{ fontSize:64, marginBottom:20 }}>📝</div>
      <h2 style={S.emptyTitle}>No Sentence Data Yet</h2>
      <p style={S.emptyText}>Complete some sentence exercises to see your report here.</p>
      <button className="sr-btn" style={S.startBtn} onClick={() => navigate("/student/sentence-level")}>
        Start Practising
      </button>
    </div>
  );

  const { metrics } = report;
  const trendDir = metrics.trend?.direction;
  const hasTrend = trendDir && trendDir !== "insufficient_data";
  const eye      = metrics.eyeTracking || {};
  const rtMs     = metrics.overview.avgResponseTime;

  const hesColor =
    eye.hesitationLevel === "Low"      ? "#059669"
    : eye.hesitationLevel === "Moderate" ? "#d97706"
    : "#dc2626";

  return (
    <div style={S.page}>

      {/* ── HEADER ── */}
      <div style={S.header}>
        <div>
          <span style={S.pill}>Sentence Fluency · Clinical Report</span>
          <h1 style={S.title}>Sentence Practice Report</h1>
          <p style={S.subtitle}>{userInfo?.name || "Student"} · Last {timeframe} days</p>
        </div>
        <div style={S.headerRight}>
          <button className="sr-btn"
            style={downloading ? S.dlOff : S.dl}
            onClick={downloadPDF} disabled={downloading}>
            {downloading ? "⏳ Generating…" : "📥 Download Clinical PDF"}
          </button>
          <div style={S.filterGroup}>
            {[7,30,90].map(t => (
              <button key={t} className="sr-btn"
                style={timeframe===t ? S.fOn : S.fOff}
                onClick={() => setTimeframe(t)}>{t}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={S.grid4}>
        <StatCard icon="🎯" label="Success Rate"
          value={`${metrics.overview.successRate}%`}
          sub={`${metrics.overview.correctAttempts} of ${metrics.overview.totalAttempts} correct`}
          accent="#10b981" />
        <StatCard icon="📊" label="Pronunciation Accuracy"
          value={`${metrics.overview.accuracyPercentage}%`}
          sub="word-level match score"
          accent="#3b82f6" />
        <StatCard icon="⚡" label="Avg Response Time"
          value={`${(rtMs/1000).toFixed(1)}s`}
          sub={rtMs < 3000 ? "Fluent ✓" : rtMs < 5000 ? "Moderate ⚠" : "Slow — needs work"}
          accent={rtMs < 3000 ? "#059669" : rtMs < 5000 ? "#d97706" : "#dc2626"} />
        <StatCard icon="📈" label="Naming Trend"
          value={
            !hasTrend              ? "Collecting…"  :
            trendDir==="improving" ? "↗ Improving"  :
            trendDir==="declining" ? "↘ Declining"  : "→ Stable"
          }
          sub={
            !hasTrend              ? "Practice more sessions"  :
            trendDir==="improving" ? "Positive trajectory"     :
            trendDir==="declining" ? "Needs attention"         : "Consistent performance"
          }
          accent={
            trendDir==="improving" ? "#059669" :
            trendDir==="declining" ? "#dc2626" : "#3b82f6"
          } />
      </div>

      {/* ── EYE-TRACKING SECTION ── */}
      <div style={S.eyeSection}>
        <div style={S.eyeSectionHeader}>
          <div style={S.eyeSectionTitle}>
            <span style={S.eyeBigIcon}>👁️</span>
            <div>
              <h2 style={S.eyeH2}>Eye-Tracking Analysis</h2>
              <p style={S.eyeH2Sub}>Visual hesitation measured during sentence reading</p>
            </div>
          </div>
          {eye.tracked > 0 && (
            <div style={{
              ...S.hesitationBadge,
              background: hesColor + "18",
              color: hesColor,
              border: `2px solid ${hesColor}40`,
            }}>
              {eye.hesitationLevel} Hesitation
            </div>
          )}
        </div>

        {eye.tracked > 0 ? (
          <div style={S.eyeBody}>
            {/* Gauge + stats row */}
            <div style={S.eyeTopRow}>
              <HesitationGauge score={parseFloat(eye.avgVisualScore)} level={eye.hesitationLevel} />
              <div style={S.eyeStatsGrid}>
                <EyeStatBox
                  icon="📷" label="Sessions Tracked"
                  value={eye.tracked}
                  sub={`${((eye.tracked / metrics.overview.totalAttempts) * 100).toFixed(0)}% of total`}
                  color="#3b82f6" />
                <EyeStatBox
                  icon="⏸️" label="Avg Hesitation"
                  value={eye.avgVisualScore}
                  sub={eye.hesitationLevel + " level"}
                  color={hesColor} />
                <EyeStatBox
                  icon="🚨" label="Hard Sessions"
                  value={eye.hardSessions}
                  sub={`${eye.hardRate}% flagged`}
                  color={parseInt(eye.hardSessions) > 0 ? "#dc2626" : "#059669"} />
                <EyeStatBox
                  icon="🎯" label="Easy Sessions"
                  value={metrics.overview.totalAttempts - eye.hardSessions}
                  sub="visually comfortable"
                  color="#059669" />
              </div>
            </div>

            {/* Hesitation zone explanation */}
            <div style={S.eyeZoneRow}>
              {[
                { label: "Low", range: "0.0 – 0.3", desc: "Smooth eye flow", color: "#059669" },
                { label: "Moderate", range: "0.3 – 0.6", desc: "Some pausing", color: "#d97706" },
                { label: "High", range: "0.6 – 1.0", desc: "Frequent re-fixation", color: "#dc2626" },
              ].map(z => (
                <div key={z.label} style={{
                  ...S.eyeZoneCard,
                  borderTop: `3px solid ${z.color}`,
                  background: eye.hesitationLevel === z.label ? `${z.color}10` : "#f8fafc",
                  boxShadow: eye.hesitationLevel === z.label ? `0 0 0 2px ${z.color}40` : "none",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: z.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{z.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Fira Code',monospace", color: "#0f172a" }}>{z.range}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{z.desc}</span>
                  {eye.hesitationLevel === z.label && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: z.color, marginTop: 2 }}>← You are here</span>
                  )}
                </div>
              ))}
            </div>

            {/* Clinical note */}
            <div style={S.eyeNote}>
              <span style={{ fontSize: 18 }}>💡</span>
              <p style={S.eyeNoteText}>
                {eye.hesitationLevel === "High"
                  ? "High visual hesitation suggests difficulty tracking text. Practice smooth left-to-right eye movement and try using a finger or ruler to guide reading."
                  : eye.hesitationLevel === "Moderate"
                  ? "Moderate hesitation is common in early reading development. Increasing font size and reducing visual clutter can help improve tracking."
                  : "Great visual tracking! Your eyes are moving smoothly across sentences — this supports faster reading fluency."}
              </p>
            </div>
          </div>
        ) : (
          <div style={S.eyeEmpty}>
            <span style={{ fontSize: 48 }}>📷</span>
            <h4 style={S.eyeEmptyTitle}>No Eye-Tracking Data Yet</h4>
            <p style={S.eyeEmptyText}>Enable the camera during practice sessions to unlock visual hesitation analysis. Eye-tracking helps identify exactly where reading breaks down.</p>
          </div>
        )}
      </div>

      {/* ── TREND CARD ── */}
      {hasTrend && <TrendCard trend={metrics.trend} />}

      {/* ── FEEDBACK ── */}
      {metrics.feedback && <FeedbackSection feedback={metrics.feedback} />}

      {/* ── SENTENCES PRACTICED ── */}
      {metrics.difficultSentences?.length > 0 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}><Dot color="#f59e0b" /> Challenging Sentences</h3>
          <p style={S.cardHint}>Sentences with lowest success rate this period — prioritise re-practice</p>
          <div style={S.sentenceList}>
            {metrics.difficultSentences.map((item, idx) => (
              <SentenceRow key={idx} item={item} rank={idx} />
            ))}
          </div>
        </div>
      )}

      {/* ── PROBLEM PHONEMES ── */}
      {metrics.problemLetters?.length > 0 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}><Dot color="#ef4444" /> Problem Phonemes</h3>
          <p style={S.cardHint}>Sounds producing most errors across all sentences</p>
          <div style={S.phonemeGrid}>
            {metrics.problemLetters.map((item, idx) => (
              <PhonemeCard key={idx} item={item} rank={idx} />
            ))}
          </div>
        </div>
      )}

      {/* ── DAILY CHART ── */}
      {metrics.daily?.length > 0 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}><Dot color="#3b82f6" /> Daily Progress</h3>
          <DailyChart data={metrics.daily} hasEye={eye.tracked > 0} />
        </div>
      )}

      {/* ── CTA ── */}
      <div style={S.cta}>
        <div>
          <h3 style={S.ctaTitle}>Keep reading, keep improving 🚀</h3>
          <p style={S.ctaText}>
            Daily sentence practice of 10–15 minutes — with camera enabled for eye-tracking — gives you the richest progress data.
          </p>
        </div>
        <button className="sr-btn" style={S.ctaBtn} onClick={() => navigate("/student/sentence-level")}>
          Continue Practice →
        </button>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════════════════ */

function Dot({ color }) {
  return <span style={{ display:"inline-block",width:10,height:10,borderRadius:"50%",background:color,marginRight:8,flexShrink:0 }} />;
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="sr-fade" style={{ ...S.statCard, borderTop:`3px solid ${accent}` }}>
      <div style={{ ...S.statIcon, background:`${accent}15` }}>
        <span style={{ fontSize:22 }}>{icon}</span>
      </div>
      <div style={S.statBody}>
        <span style={S.statLabel}>{label}</span>
        <div style={{ ...S.statVal, color:accent }}>{value}</div>
        <span style={S.statSub}>{sub}</span>
      </div>
    </div>
  );
}

function EyeStatBox({ icon, label, value, sub, color }) {
  return (
    <div style={{ ...S.eyeStatBox, borderTop:`3px solid ${color}` }}>
      <span style={{ fontSize:22, marginBottom:6 }}>{icon}</span>
      <span style={{ fontSize:11, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</span>
      <span style={{ fontSize:28, fontWeight:800, color, fontFamily:"'Fira Code',monospace" }}>{value}</span>
      <span style={{ fontSize:12, color:"#64748b" }}>{sub}</span>
    </div>
  );
}

function EyeStat({ label, value, note, color="#0f172a" }) {
  return (
    <div style={S.eyeStat}>
      <span style={S.eyeStatLabel}>{label}</span>
      <span style={{ ...S.eyeStatVal, color }}>{value}</span>
      <span style={S.eyeStatNote}>{note}</span>
    </div>
  );
}

function HesitationGauge({ score, level }) {
  const pct    = Math.min(score * 100, 100);
  const color  = level==="Low"?"#059669":level==="Moderate"?"#d97706":"#dc2626";
  const radius = 54;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={S.gaugeWrap}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={70} cy={70} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={12} />
        <circle cx={70} cy={70} r={radius} fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transformOrigin:"center", transform:"rotate(-90deg)", transition:"stroke-dashoffset .6s ease" }} />
        <text x={70} y={64} textAnchor="middle" fontSize={20} fontWeight={700} fill={color}
          fontFamily="'Fira Code',monospace">{(score).toFixed(2)}</text>
        <text x={70} y={82} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={600}>{level}</text>
        <text x={70} y={96} textAnchor="middle" fontSize={9} fill="#94a3b8">hesitation</text>
      </svg>
    </div>
  );
}

function TrendCard({ trend }) {
  if (!trend || trend.direction==="insufficient_data") return null;
  const improving = trend.direction==="improving";
  const stable    = trend.direction==="stable";
  const prevPct   = trend.previousAvg <= 1
    ? (trend.previousAvg * 100).toFixed(1)
    : parseFloat(trend.previousAvg).toFixed(1);
  const bg = improving
    ? "linear-gradient(135deg,#059669,#10b981)"
    : stable
    ? "linear-gradient(135deg,#3b82f6,#60a5fa)"
    : "linear-gradient(135deg,#dc2626,#f87171)";
  return (
    <div style={{ ...S.trendCard, background:bg }}>
      <div style={S.trendEmoji}>{improving?"🎉":stable?"📊":"💪"}</div>
      <div style={S.trendBody}>
        <h3 style={S.trendTitle}>{improving?"You're Improving!":stable?"Steady Progress":"Let's Refocus"}</h3>
        <p style={S.trendText}>
          {improving && `Accuracy up ${Math.abs(parseFloat(trend.change))}% — keep up the daily practice!`}
          {stable    && "Consistent performance. Focus on your problem phonemes to push forward."}
          {!improving&&!stable && `Recent accuracy dropped ${Math.abs(parseFloat(trend.change))}%. Let's target problem sentences.`}
        </p>
        <div style={S.trendStats}>
          <div><span style={S.trendLbl}>Previous</span><span style={S.trendNum}>{prevPct}%</span></div>
          <span style={S.arrow}>→</span>
          <div><span style={S.trendLbl}>Recent</span><span style={S.trendNum}>{trend.recentAccuracy}%</span></div>
        </div>
      </div>
    </div>
  );
}

function FeedbackSection({ feedback }) {
  return (
    <div style={S.feedbackCard}>
      <h3 style={S.feedbackTitle}>💡 Personalised Feedback</h3>
      <div style={S.fbMessages}>
        {feedback.messages.map((m, i) => (
          <p key={i} style={S.fbMsg}>{m}</p>
        ))}
      </div>
      <div style={S.motivBox}>
        <span style={{ fontSize:28, flexShrink:0 }}>✨</span>
        <p style={S.motivText}>{feedback.motivationalQuote}</p>
      </div>
      {feedback.recommendations.length > 0 && (
        <div style={S.recoBox}>
          <h4 style={S.recoTitle}>📌 Action Items</h4>
          <ul style={S.recoList}>
            {feedback.recommendations.map((r,i) => (
              <li key={i} style={S.recoItem}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SentenceRow({ item, rank }) {
  const sr    = parseFloat(item.successRate);
  const color = sr>=80?"#059669":sr>=50?"#d97706":"#dc2626";
  const vs    = parseFloat(item.avgVisual);
  const eyeColor = vs>=0.6?"#dc2626":vs>=0.3?"#d97706":"#059669";
  return (
    <div style={S.sentRow}>
      <div style={{ ...S.rankBadge, background: rank===0?"#ef4444":rank===1?"#f59e0b":"#94a3b8" }}>
        #{rank+1}
      </div>
      <div style={S.sentMid}>
        <div style={S.sentText}>"{item.sentence}"</div>
        <div style={S.sentMeta}>
          <span style={{ ...S.metaChip, background:`${color}15`, color }}>✓ {item.successRate}% success</span>
          <span style={{ ...S.metaChip, background:"#f1f5f9", color:"#475569" }}>⏱ {(item.avgTime/1000).toFixed(1)}s avg</span>
          <span style={{ ...S.metaChip, background:`${eyeColor}15`, color:eyeColor }}>👁 {item.avgVisual} eye score</span>
          <span style={{ ...S.metaChip, background:"#ede9fe", color:"#7c3aed" }}>📋 {item.attempts} attempt{item.attempts!==1?"s":""}</span>
        </div>
        <div style={S.sentBar}>
          <div style={{ ...S.sentFill, width:`${Math.min(sr,100)}%`, background:color }} />
        </div>
      </div>
    </div>
  );
}

function PhonemeCard({ item, rank }) {
  const colors = ["#ef4444","#f59e0b","#8b5cf6","#3b82f6","#10b981"];
  const c = colors[rank % colors.length];
  return (
    <div style={{ ...S.phonemeCard, borderTop:`3px solid ${c}` }}>
      <div style={{ ...S.phonemeSymbol, color:c }}>{item.letter.toUpperCase()}</div>
      <div style={S.phonemeStats}>
        <span style={S.phonemeCount}>{item.errorCount} errors</span>
        <span style={{ ...S.phonemePct, color:c }}>{item.errorRate}%</span>
      </div>
      <div style={S.phonemeBar}>
        <div style={{ ...S.phonemeFill, width:`${Math.min(parseFloat(item.errorRate),100)}%`, background:c }} />
      </div>
    </div>
  );
}

function DailyChart({ data, hasEye }) {
  const maxAcc = Math.max(...data.map(d => parseFloat(d.accuracy)), 1);
  return (
    <div>
      <div style={S.chartWrap}>
        {data.map((day, idx) => {
          const h     = (parseFloat(day.accuracy) / maxAcc) * 100;
          const color = parseFloat(day.accuracy)>=80?"#10b981":parseFloat(day.accuracy)>=60?"#3b82f6":"#ef4444";
          return (
            <div key={idx} style={S.chartCol}>
              <span style={S.chartPct}>{day.accuracy}%</span>
              <div style={{ ...S.chartBar, height:`${Math.max(h,5)}%`, background:color }} />
              {hasEye && day.avgVisual !== "0.00" && (
                <div style={{ ...S.eyeDot, background:
                  parseFloat(day.avgVisual)<0.3?"#059669":
                  parseFloat(day.avgVisual)<0.6?"#d97706":"#dc2626"
                }} title={`Eye: ${day.avgVisual}`} />
              )}
              <span style={S.chartDate}>
                {new Date(day.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
              </span>
            </div>
          );
        })}
      </div>
      {hasEye && (
        <div style={S.chartLegend}>
          <span style={S.legendItem}><span style={{ ...S.legendDot, background:"#059669" }}/>Low eye hesitation</span>
          <span style={S.legendItem}><span style={{ ...S.legendDot, background:"#d97706" }}/>Moderate</span>
          <span style={S.legendItem}><span style={{ ...S.legendDot, background:"#dc2626" }}/>High</span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════════ */
const FONT = "'Plus Jakarta Sans', sans-serif";

const S = {
  page:       { padding:32, maxWidth:1300, margin:"0 auto", background:"#f0fdf9", fontFamily:FONT, minHeight:"100vh" },
  center:     { display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",textAlign:"center",padding:40,fontFamily:FONT },
  spinner:    { width:44,height:44,border:"4px solid #d1fae5",borderTopColor:"#10b981",borderRadius:"50%",animation:"spin .9s linear infinite" },
  loadingText:{ fontSize:15,color:"#64748b",marginTop:12 },
  emptyTitle: { fontSize:26,fontWeight:800,color:"#0f172a",margin:"0 0 10px" },
  emptyText:  { fontSize:15,color:"#64748b",margin:"0 0 28px",maxWidth:380 },
  startBtn:   { background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",padding:"14px 32px",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FONT },

  /* header */
  header:     { display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32,flexWrap:"wrap",gap:16 },
  pill:       { display:"inline-block",background:"#d1fae5",color:"#065f46",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 12px",borderRadius:999,marginBottom:8 },
  title:      { fontSize:28,fontWeight:800,color:"#0f172a",margin:"0 0 4px" },
  subtitle:   { fontSize:14,color:"#64748b",margin:0 },
  headerRight:{ display:"flex",gap:12,alignItems:"center",flexWrap:"wrap" },
  dl:         { background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",padding:"11px 22px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap" },
  dlOff:      { background:"#94a3b8",color:"white",border:"none",padding:"11px 22px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"not-allowed",fontFamily:FONT,whiteSpace:"nowrap",opacity:.7 },
  filterGroup:{ display:"flex",background:"white",borderRadius:10,padding:3,boxShadow:"0 1px 4px rgba(0,0,0,.08)",gap:2 },
  fOn:        { padding:"8px 14px",border:"none",background:"#10b981",color:"white",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:FONT },
  fOff:       { padding:"8px 14px",border:"none",background:"transparent",color:"#64748b",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:FONT },

  /* stat cards */
  grid4:      { display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16,marginBottom:20 },
  statCard:   { background:"white",borderRadius:14,padding:20,display:"flex",gap:14,alignItems:"flex-start",boxShadow:"0 1px 4px rgba(0,0,0,.07)" },
  statIcon:   { width:50,height:50,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 },
  statBody:   { display:"flex",flexDirection:"column",gap:2 },
  statLabel:  { fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em" },
  statVal:    { fontSize:26,fontWeight:800,lineHeight:1.1,marginTop:2 },
  statSub:    { fontSize:12,color:"#64748b" },

  /* eye-tracking SECTION (prominent) */
  eyeSection:     { background:"white", borderRadius:18, padding:"28px 30px", marginBottom:20, boxShadow:"0 2px 12px rgba(0,0,0,.08)", border:"2px solid #bfdbfe" },
  eyeSectionHeader:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 },
  eyeSectionTitle:{ display:"flex", alignItems:"center", gap:16 },
  eyeBigIcon:     { fontSize:42, flexShrink:0 },
  eyeH2:          { fontSize:20, fontWeight:800, color:"#0f172a", margin:"0 0 4px" },
  eyeH2Sub:       { fontSize:13, color:"#64748b", margin:0 },
  hesitationBadge:{ padding:"8px 18px", borderRadius:999, fontSize:14, fontWeight:800, whiteSpace:"nowrap" },
  eyeBody:        { display:"flex", flexDirection:"column", gap:20 },
  eyeTopRow:      { display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" },
  eyeStatsGrid:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, flex:1 },
  eyeStatBox:     { background:"#f8fafc", borderRadius:12, padding:"14px 16px", display:"flex", flexDirection:"column", gap:4 },
  eyeZoneRow:     { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 },
  eyeZoneCard:    { borderRadius:12, padding:"14px 16px", display:"flex", flexDirection:"column", gap:4, transition:"box-shadow .2s" },
  eyeNote:        { display:"flex", gap:14, alignItems:"flex-start", background:"#eff6ff", borderRadius:12, padding:"16px 20px", border:"1px solid #bfdbfe" },
  eyeNoteText:    { fontSize:14, color:"#1e40af", lineHeight:1.7, margin:0 },
  eyeEmpty:       { display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"40px 20px", gap:12 },
  eyeEmptyTitle:  { fontSize:18, fontWeight:700, color:"#0f172a", margin:0 },
  eyeEmptyText:   { fontSize:14, color:"#64748b", maxWidth:500, lineHeight:1.7, margin:0 },

  /* old eye stats kept for gauge */
  eyePanel:   { background:"white",borderRadius:16,padding:"24px 28px",marginBottom:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)",display:"flex",gap:32,alignItems:"flex-start",flexWrap:"wrap",borderLeft:"4px solid #3b82f6" },
  eyeLeft:    { flex:2,minWidth:240 },
  eyeHeader:  { display:"flex",alignItems:"center",gap:14,marginBottom:20 },
  eyeIcon:    { fontSize:32 },
  eyeTitle:   { fontSize:17,fontWeight:700,color:"#0f172a",margin:"0 0 2px" },
  eyeSub:     { fontSize:12,color:"#64748b",margin:0 },
  eyeStats:   { display:"flex",gap:24,flexWrap:"wrap" },
  eyeStat:    { display:"flex",flexDirection:"column",gap:2 },
  eyeStatLabel:{ fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em" },
  eyeStatVal: { fontSize:24,fontWeight:800,color:"#0f172a",fontFamily:"'Fira Code',monospace" },
  eyeStatNote:{ fontSize:12,color:"#64748b" },
  eyeNoData:  { display:"flex",alignItems:"center",gap:16,padding:"16px",background:"#f8fafc",borderRadius:12,border:"2px dashed #cbd5e1" },
  eyeNoDataText:{ fontSize:13,color:"#64748b",lineHeight:1.6,margin:0 },
  eyeRight:   { flex:1,minWidth:150,display:"flex",justifyContent:"center" },
  gaugeWrap:  { display:"flex",flexDirection:"column",alignItems:"center",gap:8 },

  /* trend */
  trendCard:  { borderRadius:18,padding:"26px 30px",marginBottom:20,color:"white",display:"flex",gap:22,alignItems:"center",boxShadow:"0 8px 24px rgba(0,0,0,.15)",flexWrap:"wrap" },
  trendEmoji: { fontSize:44,flexShrink:0 },
  trendBody:  { flex:1 },
  trendTitle: { fontSize:22,fontWeight:800,margin:"0 0 6px" },
  trendText:  { fontSize:14,opacity:.9,margin:"0 0 14px",lineHeight:1.6 },
  trendStats: { display:"flex",alignItems:"center",gap:20 },
  trendLbl:   { display:"block",fontSize:11,opacity:.75,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em" },
  trendNum:   { display:"block",fontSize:22,fontWeight:800,fontFamily:"'Fira Code',monospace" },
  arrow:      { fontSize:20,opacity:.7 },

  /* feedback */
  feedbackCard:{ background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:18,padding:"28px 30px",marginBottom:20,border:"2px solid #bbf7d0" },
  feedbackTitle:{ fontSize:18,fontWeight:700,color:"#14532d",margin:"0 0 16px" },
  fbMessages:  { display:"flex",flexDirection:"column",gap:10,marginBottom:16 },
  fbMsg:       { fontSize:14,color:"#0f172a",lineHeight:1.6,padding:"10px 14px",background:"white",borderRadius:10,margin:0 },
  motivBox:    { background:"linear-gradient(135deg,#fef3c7,#fde68a)",padding:"16px 20px",borderRadius:12,display:"flex",alignItems:"center",gap:14,marginBottom:16 },
  motivText:   { fontSize:15,fontWeight:700,color:"#78350f",margin:0 },
  recoBox:     { background:"white",padding:"16px 20px",borderRadius:12 },
  recoTitle:   { fontSize:14,fontWeight:700,color:"#0f172a",margin:"0 0 10px" },
  recoList:    { margin:0,paddingLeft:20 },
  recoItem:    { fontSize:13,color:"#475569",marginBottom:6,lineHeight:1.6 },

  /* card */
  card:        { background:"white",borderRadius:14,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,.07)",marginBottom:20 },
  cardTitle:   { fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 4px",display:"flex",alignItems:"center" },
  cardHint:    { fontSize:12,color:"#94a3b8",margin:"0 0 16px" },

  /* sentences */
  sentenceList:{ display:"flex",flexDirection:"column",gap:12 },
  sentRow:     { display:"flex",gap:14,alignItems:"flex-start",padding:"14px 16px",background:"#f8fafc",borderRadius:12 },
  rankBadge:   { minWidth:36,height:36,borderRadius:8,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0 },
  sentMid:     { flex:1 },
  sentText:    { fontSize:15,fontWeight:600,color:"#0f172a",fontStyle:"italic",marginBottom:10,lineHeight:1.5 },
  sentMeta:    { display:"flex",gap:8,flexWrap:"wrap",marginBottom:8 },
  metaChip:    { fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:999 },
  sentBar:     { height:4,background:"#e2e8f0",borderRadius:2,overflow:"hidden" },
  sentFill:    { height:"100%",borderRadius:2,transition:"width .4s ease" },

  /* phoneme grid */
  phonemeGrid: { display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12 },
  phonemeCard: { background:"#f8fafc",borderRadius:12,padding:"14px 16px" },
  phonemeSymbol:{ fontSize:24,fontWeight:800,fontFamily:"'Fira Code',monospace",marginBottom:8 },
  phonemeStats:{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6 },
  phonemeCount:{ fontSize:11,color:"#64748b" },
  phonemePct:  { fontSize:16,fontWeight:700,fontFamily:"'Fira Code',monospace" },
  phonemeBar:  { height:5,background:"#e2e8f0",borderRadius:3,overflow:"hidden" },
  phonemeFill: { height:"100%",borderRadius:3 },

  /* daily chart */
  chartWrap:  { display:"flex",alignItems:"flex-end",gap:8,height:130,paddingBottom:24,paddingTop:8,position:"relative" },
  chartCol:   { flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%",position:"relative",gap:3 },
  chartPct:   { fontSize:9,fontWeight:700,color:"#475569" },
  chartBar:   { width:"100%",borderRadius:"4px 4px 0 0",minHeight:6,transition:"height .4s ease" },
  eyeDot:     { width:8,height:8,borderRadius:"50%",flexShrink:0 },
  chartDate:  { position:"absolute",bottom:0,fontSize:9,color:"#94a3b8",fontWeight:600,textAlign:"center",whiteSpace:"nowrap" },
  chartLegend:{ display:"flex",gap:16,marginTop:12,flexWrap:"wrap" },
  legendItem: { display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#64748b" },
  legendDot:  { width:8,height:8,borderRadius:"50%",flexShrink:0 },

  /* cta */
  cta:     { background:"linear-gradient(135deg,#065f46,#10b981)",borderRadius:18,padding:"26px 30px",display:"flex",justifyContent:"space-between",alignItems:"center",color:"white",flexWrap:"wrap",gap:20 },
  ctaTitle:{ fontSize:20,fontWeight:800,margin:"0 0 6px" },
  ctaText: { fontSize:13,opacity:.85,margin:0,maxWidth:500 },
  ctaBtn:  { background:"white",color:"#065f46",border:"none",padding:"13px 26px",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:FONT,boxShadow:"0 4px 12px rgba(0,0,0,.15)",whiteSpace:"nowrap" },
};