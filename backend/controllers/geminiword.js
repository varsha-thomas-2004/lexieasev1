import { initializeAI } from "./Geminiletter.js";
import WordState from "../models/WordState.js";
import WordAttempt from "../models/WordAttempt.js";   // ← ADD THIS
import LetterState from "../models/LetterState.js";
import { selectNextState } from "../src/bandit/selectNext.js";
import { updateBanditState } from "../src/bandit/updateState.js";
import { getTrainingCorpusForStudent } from "../services/trainingContentService.js";

/* ══════════════════════════════════════════════════════════════
   GET NEXT WORD  (unchanged)
══════════════════════════════════════════════════════════════ */
export const getNextWord = async (req, res) => {
  try {
    const studentId = req.user._id;
    const corpus = await getTrainingCorpusForStudent(studentId);
    const availableWords = corpus.words;
    
    // Get weakest letters
    const weakLetterStates = await LetterState.find({ studentId })
      .sort({ avgReward: 1 })
      .limit(3);

    let weakLetters = weakLetterStates.map(ls => ls.letter);
    if (weakLetters.length === 0) weakLetters = ["a", "e", "i"];

    const scoreWord = (wordText, letters) => {
      const text = wordText.toLowerCase();
      let score = 0;
      for (const letter of letters) score += text.split(letter).length - 1;
      return score;
    };

    const rankedWords = availableWords
      .map(w => ({
        ...w,
        score: scoreWord(w.text, weakLetters),
      }))
      .filter(w => w.score > 0);

    // Fallback: if no word stresses weak letters
    const finalWords =
      rankedWords.length > 0
        ? rankedWords
        : availableWords.map(w => ({ ...w, score: 1 }));

    await Promise.all(
      finalWords.map(word =>
        WordState.findOneAndUpdate(
          { studentId, wordId: word.id },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );

    const candidateStates = await WordState.find({
      studentId,
      wordId: { $in: finalWords.map(w => w.id) },
    });

    if (!candidateStates.length) {
      return res.status(500).json({ success: false, error: "No word states available" });
    }

    const RECENT_WINDOW_MS = 30 * 1000;
    const now = Date.now();
    const filteredStates = candidateStates.filter(s =>
      !s.lastShownAt || now - new Date(s.lastShownAt).getTime() > RECENT_WINDOW_MS
    );
    const selectionPool = filteredStates.length > 0 ? filteredStates : candidateStates;
    const chosenState = selectNextState(selectionPool);

    await WordState.updateMany(
      { studentId, isActive: true, wordId: { $ne: chosenState.wordId } },
      { isActive: false }
    );

    chosenState.isActive = true;
    chosenState.lastShownAt = new Date();
    await chosenState.save();

    // Return word
    const chosenWord = availableWords.find(
      w => w.id === chosenState.wordId
    );
    if (!chosenWord) {
      return res.status(500).json({
        success: false,
        error: "Selected word not found in training corpus",
      });
    }

    return res.json({
      success: true,
      wordId: chosenWord.id,
      word: chosenWord.text,
      sourceSentence: chosenWord.sourceSentence || null,
      sourceDocTitle: chosenWord.sourceDocTitle || null,
      trainingSource: corpus.source,
      targetLetters: weakLetters,
    });
  } catch (err) {
    console.error("getNextWord error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/* ══════════════════════════════════════════════════════════════
   GEMINI WORD ATTEMPT  — now saves to WordAttempt
══════════════════════════════════════════════════════════════ */
export const geminiWordAttempt = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { wordId, expected, responseTimeMs } = req.body;
    const audio = req.file;

    if (!wordId || !expected || !audio || responseTimeMs === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields for word attempt",
      });
    }

    const wordState = await WordState.findOne({ studentId, wordId });
    if (!wordState) {
      return res.status(409).json({
        success: false,
        message: "No active word or word mismatch",
      });
    }

    // ── Gemini transcription ──────────────────────────────────
    const base64Audio = audio.buffer.toString("base64");
    const geminiAI    = initializeAI();
    const response    = await geminiAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: audio.mimetype || "audio/webm", data: base64Audio } },
          { text: "Listen to this audio and transcribe ONLY the spoken word. Return only the text." },
        ],
      }],
    });

    const spoken = response.text.toLowerCase().trim();

    const normalize = (text) =>
      text.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

    const expectedNorm = normalize(expected);
    const spokenNorm   = normalize(spoken);
    const wordCorrect  = expectedNorm === spokenNorm;

    // ── Problem letters ───────────────────────────────────────
    const problemLetters = new Set();
    const minLen = Math.min(expectedNorm.length, spokenNorm.length);
    for (let i = 0; i < minLen; i++) {
      const e = expectedNorm[i];
      if (e !== spokenNorm[i] && e >= "a" && e <= "z") problemLetters.add(e);
    }

    // ── Reward ────────────────────────────────────────────────
    const fluencyScore = Math.min(1, 3000 / Number(responseTimeMs));
    const wordReward   = 0.6 * (wordCorrect ? 1 : 0) + 0.4 * fluencyScore;

    // ── Update WordState bandit ───────────────────────────────
    await updateBanditState(wordState, wordReward);
    wordState.isActive = false;
    await wordState.save();

    // ── Update LetterState for problem letters ────────────────
    for (const letter of problemLetters) {
      const letterState = await LetterState.findOne({ studentId, letter });
      if (!letterState) continue;
      updateBanditState(letterState, -0.2);
      await letterState.save();
    }

    // ── SAVE TO WordAttempt  (this was missing before) ────────
    await WordAttempt.create({
      studentId,
      wordId,
      expected:       expectedNorm,
      transcript:     spokenNorm,
      wordCorrect,
      responseTimeMs: Number(responseTimeMs),
      problemLetters: Array.from(problemLetters),
    });

    return res.json({
      success: true,
      wordCorrect,
      problemLetters: Array.from(problemLetters),
      transcript: spoken,
      message: wordCorrect
        ? "Good job! Keep going."
        : "Nice try! Focus on the highlighted sounds.",
    });
  } catch (err) {
    console.error("Gemini word attempt error:", err);
    return res.status(500).json({ success: false, message: "Gemini word evaluation failed" });
  }
};