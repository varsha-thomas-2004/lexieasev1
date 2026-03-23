/**
 * GET /api/reports/student/letters?timeframe=7
 *
 * Returns aggregated letter practice metrics for the authenticated student.
 * Mirrors the structure of the word report endpoint so the frontend
 * dashboard can consume it identically.
 *
 * Expected shape:
 * {
 *   metrics: {
 *     overview: { successRate, totalAttempts, correctAttempts, avgResponseTime },
 *     trend:    { direction, change, previousAvg, recentAccuracy } | null,
 *     problemLetters: [{ letter, errorCount, errorRate }],
 *     letterMastery:  [{ letter, pulls, avgReward, totalReward }],
 *     daily:          [{ date, attempts, successRate }],
 *   }
 * }
 */

import LetterState from "../models/LetterState.js";
import LetterAttempt from "../models/LetterAttempt.js";  // ← create if not yet present (see note below)

// ────────────────────────────────────────────────────────────────────────────
// NOTE: This controller assumes you have a LetterAttempt model that records
// each individual attempt. If you don't have one yet, a minimal schema is:
//
//   { studentId, letter, correct: Boolean, responseTimeMs: Number,
//     score: Number, createdAt: Date }
//
// If you track attempts differently (e.g. embedded in LetterState), adapt
// the queries below accordingly.
// ────────────────────────────────────────────────────────────────────────────

export const getLetterReport = async (req, res) => {
  try {
    const studentId = req.user._id;
    const timeframe = parseInt(req.query.timeframe) || 7;
    const since = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

    // ── 1. Raw attempts within timeframe ────────────────────────
    const attempts = await LetterAttempt.find({
      studentId,
      createdAt: { $gte: since },
    }).sort({ createdAt: 1 });

    if (!attempts.length) {
      return res.json({ metrics: null });
    }

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a) => a.correct).length;
    const successRate = ((correctAttempts / totalAttempts) * 100).toFixed(1);
    const avgResponseTime =
      attempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0) / totalAttempts;

    // ── 2. Problem letters ───────────────────────────────────────
    const letterErrors = {};
    const letterCounts = {};
    attempts.forEach((a) => {
      const l = a.letter.toLowerCase();
      letterCounts[l] = (letterCounts[l] || 0) + 1;
      if (!a.correct) letterErrors[l] = (letterErrors[l] || 0) + 1;
    });

    const problemLetters = Object.entries(letterErrors)
      .map(([letter, errorCount]) => ({
        letter,
        errorCount,
        errorRate: ((errorCount / letterCounts[letter]) * 100).toFixed(1),
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 8);

    // ── 3. Letter mastery from LetterState ───────────────────────
    const letterStates = await LetterState.find({ studentId });
    const letterMastery = letterStates
      .filter((s) => s.pulls > 0)
      .map((s) => ({
        letter: s.letter,
        pulls: s.pulls,
        avgReward: s.avgReward,
        totalReward: s.totalReward,
      }))
      .sort((a, b) => b.pulls - a.pulls);

    // ── 4. Daily breakdown ───────────────────────────────────────
    const dailyMap = {};
    attempts.forEach((a) => {
      const day = a.createdAt.toISOString().split("T")[0];
      if (!dailyMap[day]) dailyMap[day] = { attempts: 0, correct: 0 };
      dailyMap[day].attempts += 1;
      if (a.correct) dailyMap[day].correct += 1;
    });

    const daily = Object.entries(dailyMap)
      .map(([date, v]) => ({
        date,
        attempts: v.attempts,
        successRate: ((v.correct / v.attempts) * 100).toFixed(1),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── 5. Trend (compare first half vs second half of timeframe) ─
    let trend = null;
    if (attempts.length >= 6) {
      const mid = Math.floor(attempts.length / 2);
      const older = attempts.slice(0, mid);
      const recent = attempts.slice(mid);

      const olderAvg = older.filter((a) => a.correct).length / older.length;
      const recentAvg = recent.filter((a) => a.correct).length / recent.length;
      const change = ((recentAvg - olderAvg) * 100).toFixed(1);
      const recentAccuracy = (recentAvg * 100).toFixed(1);

      trend = {
        direction:
          Math.abs(parseFloat(change)) < 2
            ? "stable"
            : parseFloat(change) > 0
            ? "improving"
            : "declining",
        change,
        previousAvg: olderAvg,
        recentAccuracy,
      };
    } else {
      trend = { direction: "insufficient_data" };
    }

    return res.json({
      metrics: {
        overview: {
          successRate,
          totalAttempts,
          correctAttempts,
          avgResponseTime: Math.round(avgResponseTime),
        },
        trend,
        problemLetters,
        letterMastery,
        daily,
      },
    });
  } catch (err) {
    console.error("getLetterReport error:", err);
    res.status(500).json({ message: "Failed to generate letter report" });
  }
};