import SentenceAttempt from "../models/SentenceAttempt.js";
import LetterState from "../models/LetterState.js";
import TwoLetterWordAttempt from "../models/Twoletterattempt.js";
import WordAttempt from "../models/WordAttempt.js";       // ← ADD THIS
import { SENTENCES } from "../data/sentences.js";

/* ══════════════════════════════════════════════════════════════
   SHARED HELPER  — builds the same metrics shape from any
   array of word-attempt documents (works for both collections)
══════════════════════════════════════════════════════════════ */
function buildWordMetrics(attempts) {
  if (!attempts.length) return null;

  const total   = attempts.length;
  const correct = attempts.filter(a => a.wordCorrect).length;
  const avgRT   = attempts.reduce((s, a) => s + (a.responseTimeMs || 0), 0) / total;

  // ── Trend ──────────────────────────────────────────────────
  let trend = { direction: "insufficient_data", change: "0", recentAccuracy: "0", previousAvg: 0 };
  if (attempts.length >= 2) {
    const half       = Math.floor(attempts.length / 2);
    const firstRate  = attempts.slice(0, half).filter(a => a.wordCorrect).length / half;
    const secondRate = attempts.slice(half).filter(a => a.wordCorrect).length / (attempts.length - half);
    const change     = firstRate === 0 ? 0 : ((secondRate - firstRate) / firstRate) * 100;
    trend = {
      direction:      change > 5 ? "improving" : change < -5 ? "declining" : "stable",
      change:         change.toFixed(1),
      recentAccuracy: (secondRate * 100).toFixed(1),
      previousAvg:    firstRate,
    };
  }

  // ── Problem words ──────────────────────────────────────────
  const wordFreq = {};
  attempts.forEach(a => {
    if (!wordFreq[a.expected]) wordFreq[a.expected] = { total: 0, correct: 0, totalRT: 0 };
    wordFreq[a.expected].total++;
    wordFreq[a.expected].totalRT += (a.responseTimeMs || 0);
    if (a.wordCorrect) wordFreq[a.expected].correct++;
  });

  // All practiced words — sorted best success rate first
  const allWords = Object.entries(wordFreq)
    .map(([word, v]) => ({
      word,
      totalAttempts: v.total,
      correctCount:  v.correct,
      successRate:   ((v.correct / v.total) * 100).toFixed(1),
      errorCount:    v.total - v.correct,
      avgResponseTime: Math.round(v.totalRT / v.total),
    }))
    .sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));

  // Slow words — all words with avg RT, sorted slowest first (RND-relevant)
  const slowWords = [...allWords]
    .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
    .slice(0, 8);

  // Keep problemWords for PDF only (not shown in UI anymore)
  const problemWords = allWords
    .filter(w => w.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5);

  // ── Problem letters ────────────────────────────────────────
  const letterFreq = {};
  attempts.forEach(a =>
    (a.problemLetters || []).forEach(l => {
      letterFreq[l] = (letterFreq[l] || 0) + 1;
    })
  );
  const problemLetters = Object.entries(letterFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([letter, count]) => ({
      letter,
      errorCount: count,
      errorRate:  ((count / total) * 100).toFixed(1),
    }));

  // ── Daily breakdown ────────────────────────────────────────
  const groups = {};
  attempts.forEach(a => {
    const date = new Date(a.createdAt).toISOString().split("T")[0];
    if (!groups[date]) groups[date] = { attempts: 0, correct: 0 };
    groups[date].attempts++;
    if (a.wordCorrect) groups[date].correct++;
  });
  const daily = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({
      date,
      attempts:    s.attempts,
      successRate: ((s.correct / s.attempts) * 100).toFixed(1),
    }));

  return {
    overview: {
      totalAttempts:   total,
      correctAttempts: correct,
      successRate:     ((correct / total) * 100).toFixed(1),
      avgResponseTime: Math.round(avgRT),
    },
    trend,
    allWords,
    slowWords,
    problemWords,
    problemLetters,
    daily,
  };
}

/* ══════════════════════════════════════════════════════════════
   WORD REPORT  — queries BOTH collections and returns
   { twoLetter, words, combined }  (new shape the frontend expects)
══════════════════════════════════════════════════════════════ */
export const getWordReport = async (req, res) => {
  try {
    const studentId = req.user._id;
    const timeframe = parseInt(req.query.timeframe) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    // Query both collections in parallel
    const [twoLetterAttempts, wordAttempts] = await Promise.all([
      TwoLetterWordAttempt.find({ studentId, createdAt: { $gte: startDate } }).sort({ createdAt: 1 }),
      WordAttempt.find({          studentId, createdAt: { $gte: startDate } }).sort({ createdAt: 1 }),
    ]);

    const twoLetter = buildWordMetrics(twoLetterAttempts);
    const words     = buildWordMetrics(wordAttempts);

    // Combined overview across both levels
    const allAttempts = [...twoLetterAttempts, ...wordAttempts];
    const combined = allAttempts.length ? {
      totalAttempts:   allAttempts.length,
      correctAttempts: allAttempts.filter(a => a.wordCorrect).length,
      successRate:     ((allAttempts.filter(a => a.wordCorrect).length / allAttempts.length) * 100).toFixed(1),
      avgResponseTime: Math.round(
        allAttempts.reduce((s, a) => s + (a.responseTimeMs || 0), 0) / allAttempts.length
      ),
    } : null;

    return res.json({ success: true, twoLetter, words, combined, timeframe });
  } catch (err) {
    console.error("getWordReport error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════
   SENTENCE REPORT  (unchanged)
══════════════════════════════════════════════════════════════ */
export const getSentenceReport = async (req, res) => {
  try {
    const studentId = req.user._id;
    const timeframe = parseInt(req.query.timeframe) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const attempts = await SentenceAttempt.find({
      studentId,
      createdAt: { $gte: startDate },
    }).sort({ createdAt: 1 });

    if (!attempts.length) return res.json({ success: true, metrics: null });

    const total       = attempts.length;
    const correct     = attempts.filter(a => a.sentenceCorrect).length;
    const avgAccuracy = attempts.reduce((s, a) => s + (a.sentenceAccuracy || 0), 0) / total;
    const avgRT       = attempts.reduce((s, a) => s + (a.responseTimeMs   || 0), 0) / total;

    const eyeAttempts     = attempts.filter(a => a.visualScore > 0);
    const avgVisual       = eyeAttempts.length
      ? eyeAttempts.reduce((s, a) => s + (a.visualScore || 0), 0) / eyeAttempts.length
      : 0;
    const hardCount       = attempts.filter(a => a.visualIsHard).length;
    const eyeTracked      = eyeAttempts.length;
    const hesitationLevel = avgVisual < 0.3 ? "Low" : avgVisual < 0.6 ? "Moderate" : "High";

    let trend = { direction: "insufficient_data", change: 0, recentAccuracy: 0, previousAvg: 0 };
    if (attempts.length >= 2) {
      const half      = Math.floor(attempts.length / 2);
      const firstAvg  = attempts.slice(0, half).reduce((s, a) => s + (a.sentenceAccuracy || 0), 0) / half;
      const secondAvg = attempts.slice(half).reduce((s, a) => s + (a.sentenceAccuracy || 0), 0) / (attempts.length - half);
      const change    = firstAvg === 0 ? 0 : ((secondAvg - firstAvg) / firstAvg) * 100;
      trend = {
        direction:      change > 5 ? "improving" : change < -5 ? "declining" : "stable",
        change:         change.toFixed(1),
        recentAccuracy: (secondAvg * 100).toFixed(1),
        previousAvg:    firstAvg,
      };
    }

    const letterFreq = {};
    attempts.forEach(a => (a.problemLetters || []).forEach(l => {
      letterFreq[l] = (letterFreq[l] || 0) + 1;
    }));
    const problemLetters = Object.entries(letterFreq)
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([letter, count]) => ({ letter, errorCount: count, errorRate: ((count / total) * 100).toFixed(1) }));

    const sentenceStats = {};
    attempts.forEach(a => {
      if (!sentenceStats[a.sentenceId])
        sentenceStats[a.sentenceId] = { attempts: 0, correct: 0, totalTime: 0, totalVisual: 0, visualCount: 0, expected: a.expected };
      const s = sentenceStats[a.sentenceId];
      s.attempts++;
      if (a.sentenceCorrect) s.correct++;
      s.totalTime += (a.responseTimeMs || 0);
      if (a.visualScore > 0) { s.totalVisual += a.visualScore; s.visualCount++; }
    });
    const difficultSentences = Object.entries(sentenceStats)
      .map(([id, s]) => {
        const sd = SENTENCES.find(sen => sen.id === id);
        return {
          sentenceId:  id,
          sentence:    sd?.text || s.expected || id,
          attempts:    s.attempts,
          successRate: ((s.correct / s.attempts) * 100).toFixed(1),
          avgTime:     Math.round(s.totalTime / s.attempts),
          avgVisual:   s.visualCount ? (s.totalVisual / s.visualCount).toFixed(2) : "0.00",
        };
      })
      .sort((a, b) => parseFloat(a.successRate) - parseFloat(b.successRate))
      .slice(0, 3);

    const groups = {};
    attempts.forEach(a => {
      const date = new Date(a.createdAt).toISOString().split("T")[0];
      if (!groups[date]) groups[date] = { attempts: 0, correct: 0, totalAccuracy: 0, totalVisual: 0, visualCount: 0 };
      const g = groups[date];
      g.attempts++;
      if (a.sentenceCorrect) g.correct++;
      g.totalAccuracy += (a.sentenceAccuracy || 0);
      if (a.visualScore > 0) { g.totalVisual += a.visualScore; g.visualCount++; }
    });
    const daily = Object.entries(groups).map(([date, g]) => ({
      date,
      attempts:    g.attempts,
      accuracy:    ((g.totalAccuracy / g.attempts) * 100).toFixed(1),
      successRate: ((g.correct / g.attempts) * 100).toFixed(1),
      avgVisual:   g.visualCount ? (g.totalVisual / g.visualCount).toFixed(2) : "0.00",
    }));

    const feedback = genSentenceFeedback({
      avgAccuracy, trend, problemLetters,
      avgResponseTime: avgRT, correctAttempts: correct, total,
      avgVisual, hardCount, eyeTracked,
    });

    return res.json({
      success: true,
      metrics: {
        overview: {
          totalAttempts:      total,
          correctAttempts:    correct,
          successRate:        ((correct / total) * 100).toFixed(1),
          accuracyPercentage: (avgAccuracy * 100).toFixed(1),
          avgResponseTime:    Math.round(avgRT),
        },
        eyeTracking: {
          tracked:        eyeTracked,
          avgVisualScore: avgVisual.toFixed(3),
          hesitationLevel,
          hardSessions:   hardCount,
          hardRate:       total > 0 ? ((hardCount / total) * 100).toFixed(1) : "0.0",
        },
        trend,
        problemLetters,
        difficultSentences,
        daily,
        feedback,
        timeframe,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

function genSentenceFeedback({ avgAccuracy, trend, problemLetters, avgResponseTime,
  correctAttempts, total, avgVisual = 0, hardCount = 0, eyeTracked = 0 }) {
  const messages = [], recommendations = [];

  if (avgAccuracy >= 0.9)      messages.push("Excellent work! Your pronunciation is very strong.");
  else if (avgAccuracy >= 0.7) messages.push("Good progress! Keep practising to improve accuracy.");
  else                         messages.push("Keep trying! Focus on the problem areas highlighted below.");

  if (trend.direction === "improving")
    messages.push(`Great job! Accuracy improved by ${Math.abs(parseFloat(trend.change))}% recently.`);
  else if (trend.direction === "declining") {
    messages.push(`Accuracy dropped by ${Math.abs(parseFloat(trend.change))}%. Let's focus on problem areas.`);
    recommendations.push("Take more time reading each sentence before recording");
  }

  if (avgResponseTime < 2000)      messages.push("Your response time is excellent!");
  else if (avgResponseTime > 5000) {
    messages.push("Try to respond a bit faster as you gain confidence.");
    recommendations.push("Practise reading sentences aloud before recording");
  }

  if (eyeTracked > 0) {
    if (avgVisual >= 0.6) {
      messages.push("Eye-tracking shows significant visual hesitation.");
      recommendations.push("Practise smooth left-to-right eye movement across sentences");
      recommendations.push("Use a finger or pointer to guide your eyes while reading");
    } else if (avgVisual >= 0.3) {
      messages.push("Moderate visual hesitation detected. Eye movement is developing.");
      recommendations.push("Try reading sentences in larger font to reduce tracking effort");
    } else {
      messages.push("Great eye movement! Minimal visual hesitation detected.");
    }
    if (hardCount > 0)
      recommendations.push(`${hardCount} session${hardCount > 1 ? "s" : ""} flagged as visually hard — practise those sentences again`);
  }

  if (problemLetters.length > 0)
    recommendations.push(`Focus on these sounds: ${problemLetters.slice(0, 3).map(l => l.letter).join(", ")}`);

  if ((correctAttempts / total) * 100 < 50) {
    recommendations.push("Review the pronunciation guide for difficult sounds");
    recommendations.push("Practise in a quiet environment to reduce distractions");
  }

  const motivationalQuote =
    avgAccuracy >= 0.9 ? "You're mastering this! Keep up the fantastic work! 🌟"
    : trend.direction === "improving" ? "Every practice session makes you better. You're on the right track! 📈"
    : "Progress takes time. Keep practising, you've got this! 💪";

  return { messages, recommendations, motivationalQuote };
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD SUMMARY  (updated to include WordAttempt)
══════════════════════════════════════════════════════════════ */
export const getDashboardSummary = async (req, res) => {
  try {
    const studentId = req.user._id;
    const timeframe = parseInt(req.query.timeframe) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const [sentenceAttempts, twoLetterAttempts, wordAttempts, letterStates] = await Promise.all([
      SentenceAttempt.find({       studentId, createdAt: { $gte: startDate } }),
      TwoLetterWordAttempt.find({  studentId, createdAt: { $gte: startDate } }),
      WordAttempt.find({           studentId, createdAt: { $gte: startDate } }),
      LetterState.find({ studentId }),
    ]);

    const allWordAttempts = [...twoLetterAttempts, ...wordAttempts];

    return res.json({
      success: true,
      summary: {
        sentences: sentenceAttempts.length ? {
          total:       sentenceAttempts.length,
          successRate: ((sentenceAttempts.filter(a => a.sentenceCorrect).length / sentenceAttempts.length) * 100).toFixed(1),
        } : null,
        words: allWordAttempts.length ? {
          total:       allWordAttempts.length,
          successRate: ((allWordAttempts.filter(a => a.wordCorrect).length / allWordAttempts.length) * 100).toFixed(1),
        } : null,
        letters: letterStates.length ? {
          total:       letterStates.length,
          avgStrength: ((letterStates.reduce((s, l) => s + l.avgReward, 0) / letterStates.length) * 100).toFixed(1),
        } : null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════
   LETTER REPORT  (unchanged)
══════════════════════════════════════════════════════════════ */
export const getLetterReport = async (req, res) => {
  try {
    const studentId  = req.user._id;
    const letterStates = await LetterState.find({ studentId }).sort({ avgReward: 1 });

    if (!letterStates.length) return res.json({ success: true, metrics: null });

    const totalAttempts = letterStates.reduce((sum, ls) => sum + ls.pulls, 0);
    const avgStrength   = letterStates.reduce((sum, ls) => sum + ls.avgReward, 0) / letterStates.length;

    return res.json({
      success: true,
      metrics: {
        overview: {
          totalLettersPracticed: letterStates.length,
          totalAttempts,
          avgStrength: (avgStrength * 100).toFixed(1),
        },
        letters: letterStates.map(ls => ({
          letter:   ls.letter,
          strength: (ls.avgReward * 100).toFixed(1),
          attempts: ls.pulls,
        })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};