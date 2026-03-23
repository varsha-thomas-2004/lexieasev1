import StudentTherapist from "../models/StudentTherapist.js";
import User from "../models/User.js";
import SentenceAttempt from "../models/SentenceAttempt.js";
import TwoLetterWordAttempt from "../models/Twoletterattempt.js";
import WordAttempt from "../models/WordAttempt.js";
import LetterState from "../models/LetterState.js";

function buildWordMetrics(attempts) {
  if (!attempts.length) return null;

  const total = attempts.length;
  const correct = attempts.filter((a) => a.wordCorrect).length;
  const avgResponseTime = Math.round(
    attempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0) / total
  );

  const groups = {};
  attempts.forEach((a) => {
    const word = a.expected || "";
    if (!groups[word]) groups[word] = { total: 0, correct: 0, totalRT: 0 };
    groups[word].total++;
    groups[word].totalRT += a.responseTimeMs || 0;
    if (a.wordCorrect) groups[word].correct++;
  });

  const allWords = Object.entries(groups).map(([word, v]) => ({
    word,
    totalAttempts: v.total,
    correctCount: v.correct,
    successRate: ((v.correct / v.total) * 100).toFixed(1),
    errorCount: v.total - v.correct,
    avgResponseTime: Math.round(v.totalRT / v.total),
  }));

  const slowWords = [...allWords]
    .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
    .slice(0, 8);

  const problemWords = allWords
    .filter((w) => w.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5);

  const effortLetters = {};
  attempts.forEach((a) =>
    (a.problemLetters || []).forEach((l) => {
      effortLetters[l] = (effortLetters[l] || 0) + 1;
    })
  );

  const problemLetters = Object.entries(effortLetters)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([letter, count]) => ({
      letter,
      errorCount: count,
      errorRate: ((count / total) * 100).toFixed(1),
    }));

  const groupsByDate = {};
  attempts.forEach((a) => {
    const date = new Date(a.createdAt).toISOString().split("T")[0];
    if (!groupsByDate[date]) groupsByDate[date] = { attempts: 0, correct: 0 };
    groupsByDate[date].attempts++;
    if (a.wordCorrect) groupsByDate[date].correct++;
  });

  const daily = Object.entries(groupsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({
      date,
      attempts: s.attempts,
      successRate: ((s.correct / s.attempts) * 100).toFixed(1),
    }));

  let trend = { direction: "insufficient_data", change: "0", recentAccuracy: "0", previousAvg: 0 };
  if (attempts.length >= 2) {
    const half = Math.floor(attempts.length / 2);
    const firstRate = attempts.slice(0, half).filter((a) => a.wordCorrect).length / half;
    const secondRate = attempts.slice(half).filter((a) => a.wordCorrect).length / (attempts.length - half);
    const change = firstRate === 0 ? 0 : ((secondRate - firstRate) / firstRate) * 100;
    trend = {
      direction: change > 5 ? "improving" : change < -5 ? "declining" : "stable",
      change: change.toFixed(1),
      recentAccuracy: (secondRate * 100).toFixed(1),
      previousAvg: firstRate,
    };
  }

  return {
    overview: {
      totalAttempts: total,
      correctAttempts: correct,
      successRate: ((correct / total) * 100).toFixed(1),
      avgResponseTime,
    },
    trend,
    allWords,
    slowWords,
    problemWords,
    problemLetters,
    daily,
  };
}

/* ================================
   GET LIST OF STUDENTS FOR THERAPIST
================================ */
export const getTherapistStudents = async (req, res) => {
  try {
    const therapistId = req.user._id;

    const students = await StudentTherapist.find({ therapistId })
      .populate({
        path: "studentId",
        select: "name email age lastActive createdAt _id"
      })
      .lean();

    const studentList = students.map(rel => ({
      ...rel.studentId,
      assignedDate: rel.createdAt
    }));

    return res.json({
      success: true,
      students: studentList
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ================================
   GET STUDENT DETAILS
================================ */
export const getStudentDetail = async (req, res) => {
  try {
    const therapistId = req.user._id;
    const { studentId } = req.params;

    // Verify therapist has access to this student
    const relationship = await StudentTherapist.findOne({
      therapistId,
      studentId
    });

    if (!relationship) {
      return res.status(403).json({ error: "Access denied" });
    }

    const student = await User.findById(studentId).select("name email role age lastActive createdAt _id");

    return res.json({
      success: true,
      student
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ================================
   GET STUDENT DASHBOARD SUMMARY
================================ */
export const getStudentDashboardSummary = async (req, res) => {
  try {
    const therapistId = req.user._id;
    const { studentId } = req.params;
    const timeframe = parseInt(req.query.timeframe) || 7;

    // Verify therapist has access to this student
    const relationship = await StudentTherapist.findOne({
      therapistId,
      studentId
    });

    if (!relationship) {
      return res.status(403).json({ error: "Access denied" });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const [sentenceAttempts, wordAttempts, letterStates] = await Promise.all([
      SentenceAttempt.find({ studentId, createdAt: { $gte: startDate } }),
      TwoLetterWordAttempt.find({ studentId, createdAt: { $gte: startDate } }),
      LetterState.find({ studentId })
    ]);

    return res.json({
      success: true,
      summary: {
        sentences: sentenceAttempts.length
          ? {
              total: sentenceAttempts.length,
              successRate: (
                (sentenceAttempts.filter(a => a.sentenceCorrect).length /
                  sentenceAttempts.length) * 100
              ).toFixed(1)
            }
          : null,
        words: wordAttempts.length
          ? {
              total: wordAttempts.length,
              successRate: (
                (wordAttempts.filter(a => a.wordCorrect).length /
                  wordAttempts.length) * 100
              ).toFixed(1)
            }
          : null,
        letters: letterStates.length
          ? {
              total: letterStates.length,
              avgStrength: (
                (letterStates.reduce((s, l) => s + l.avgReward, 0) /
                  letterStates.length) * 100
              ).toFixed(1)
            }
          : null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ================================
   GET STUDENT WORD REPORT
================================ */
export const getStudentWordReport = async (req, res) => {
  try {
    const therapistId = req.user._id;
    const { studentId } = req.params;
    const timeframe = parseInt(req.query.timeframe) || 30;

    // Verify therapist has access to this student
    const relationship = await StudentTherapist.findOne({
      therapistId,
      studentId
    });

    if (!relationship) {
      return res.status(403).json({ error: "Access denied" });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const [twoLetterAttempts, wordAttempts] = await Promise.all([
      TwoLetterWordAttempt.find({ studentId, createdAt: { $gte: startDate } }).sort({ createdAt: 1 }),
      WordAttempt.find({ studentId, createdAt: { $gte: startDate } }).sort({ createdAt: 1 }),
    ]);

    const twoLetter = buildWordMetrics(twoLetterAttempts) || {
      overview: null,
      trend: null,
      allWords: [],
      slowWords: [],
      problemWords: [],
      problemLetters: [],
      daily: [],
    };

    const words = buildWordMetrics(wordAttempts) || {
      overview: null,
      trend: null,
      allWords: [],
      slowWords: [],
      problemWords: [],
      problemLetters: [],
      daily: [],
    };

    const allAttempts = [...twoLetterAttempts, ...wordAttempts];
    const combined = allAttempts.length
      ? {
          totalAttempts: allAttempts.length,
          correctAttempts: allAttempts.filter((a) => a.wordCorrect).length,
          successRate: ((allAttempts.filter((a) => a.wordCorrect).length / allAttempts.length) * 100).toFixed(1),
          avgResponseTime: Math.round(
            allAttempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0) / allAttempts.length
          ),
        }
      : null;

    return res.json({
      success: true,
      data: {
        twoLetter,
        words,
        combined,
        timeframe,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ================================
   GET STUDENT SENTENCE REPORT
================================ */
export const getStudentSentenceReport = async (req, res) => {
  try {
    const therapistId = req.user._id;
    const { studentId } = req.params;

    // Verify therapist has access to this student
    const relationship = await StudentTherapist.findOne({
      therapistId,
      studentId
    });

    if (!relationship) {
      return res.status(403).json({ error: "Access denied" });
    }

    const attempts = await SentenceAttempt.find({ studentId });

    if (!attempts.length) {
      return res.json({
        success: true,
        data: {
          total: 0,
          correct: 0,
          successRate: 0,
          avgAccuracy: 0,
          attempts: [],
          eyeTracking: {
            tracked: 0,
            avgVisualScore: "0.000",
            hesitationLevel: "Low",
            hardSessions: 0,
            hardRate: "0.0"
          }
        }
      });
    }

    const total = attempts.length;
    const correct = attempts.filter(a => a.sentenceCorrect).length;
    const avgAccuracy =
      attempts.reduce((sum, a) => sum + (a.sentenceAccuracy || 0), 0) / total;

    // Calculate eye tracking metrics
    const eyeAttempts = attempts.filter(a => a.visualScore > 0);
    const avgVisual = eyeAttempts.length
      ? eyeAttempts.reduce((s, a) => s + (a.visualScore || 0), 0) / eyeAttempts.length
      : 0;
    const hardCount = attempts.filter(a => a.visualIsHard).length;
    const hesitationLevel =
      avgVisual < 0.3 ? "Low" : avgVisual < 0.6 ? "Moderate" : "High";

    return res.json({
      success: true,
      data: {
        total,
        correct,
        successRate: ((correct / total) * 100).toFixed(1),
        avgAccuracy: (avgAccuracy * 100).toFixed(1),
        attempts: attempts.map(a => ({
          sentence: a.expected || "",
          spoken: a.spoken || "",
          correct: a.sentenceCorrect,
          accuracy: ((a.sentenceAccuracy || 0) * 100).toFixed(1),
          responseTime: a.responseTimeMs,
          date: a.createdAt
        })),
        eyeTracking: {
          tracked: eyeAttempts.length,
          avgVisualScore: avgVisual.toFixed(3),
          hesitationLevel,
          hardSessions: hardCount,
          hardRate: total > 0 ? ((hardCount / total) * 100).toFixed(1) : "0.0"
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ================================
   GET STUDENT LETTER REPORT
================================ */
export const getStudentLetterReport = async (req, res) => {
  try {
    const therapistId = req.user._id;
    const { studentId } = req.params;

    // Verify therapist has access to this student
    const relationship = await StudentTherapist.findOne({
      therapistId,
      studentId
    });

    if (!relationship) {
      return res.status(403).json({ error: "Access denied" });
    }

    const letterStates = await LetterState.find({ studentId });

    if (!letterStates.length) {
      return res.json({
        success: true,
        data: {
          letters: []
        }
      });
    }

    const letterData = letterStates.map(l => ({
      letter: l.letter,
      strength: (l.avgReward * 100).toFixed(1),
      attempts: l.pulls,
      successes: l.successes
    }));

    return res.json({
      success: true,
      data: {
        letters: letterData
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ================================
   ASSIGN STUDENT TO THERAPIST
================================ */
export const assignStudentToTherapist = async (req, res) => {
  try {
    const therapistId = req.user._id;
    const { studentId } = req.body;

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return res.status(400).json({ error: "Invalid student" });
    }

    // Check if already assigned
    const existing = await StudentTherapist.findOne({
      therapistId,
      studentId
    });

    if (existing) {
      return res.status(400).json({ error: "Student already assigned" });
    }

    const assignment = await StudentTherapist.create({
      therapistId,
      studentId
    });

    return res.json({
      success: true,
      message: "Student assigned successfully",
      assignment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ================================
   REMOVE STUDENT FROM THERAPIST
================================ */
export const removeStudentFromTherapist = async (req, res) => {
  try {
    const therapistId = req.user._id;
    const { studentId } = req.params;

    const result = await StudentTherapist.findOneAndDelete({
      therapistId,
      studentId
    });

    if (!result) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    return res.json({
      success: true,
      message: "Student removed successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
