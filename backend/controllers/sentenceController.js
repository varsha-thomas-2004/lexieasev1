import SentenceState from "../models/SentenceState.js";
import LetterState from "../models/LetterState.js";
import { selectNextState } from "../src/bandit/selectNext.js";
import { updateBanditState } from "../src/bandit/updateState.js";
import { getTrainingCorpusForStudent } from "../services/trainingContentService.js";
import { initializeAI } from "./Geminiletter.js";
import SentenceAttempt from "../models/SentenceAttempt.js";


// ─────────────────────────────────────────────────────────────────
// Chooses the next sentence based on the student's weakest letters
// ─────────────────────────────────────────────────────────────────
export const getNextSentence = async (req, res) => {
  try {
    const studentId = req.user._id;
    const corpus = await getTrainingCorpusForStudent(studentId);
    const availableSentences = corpus.sentences;
    
    // Get weakest letters
    const weakLetterStates = await LetterState.find({ studentId })
      .sort({ avgReward: 1 }) // lowest = hardest
      .limit(3);

    let weakLetters = weakLetterStates.map(ls => ls.letter);

    // Fallback for new users
    if (weakLetters.length === 0) {
      weakLetters = ["a", "e", "i"];
    }

    // Score sentences by how many weak letters they contain
    const scoreSentence = (sentenceText, letters) => {
      const text = sentenceText.toLowerCase();
      let score = 0;
      for (const letter of letters) {
        score += text.split(letter).length - 1;
      }
      return score;
    };

    const rankedSentences = availableSentences
      .map(s => ({
        ...s,
        score: scoreSentence(s.text, weakLetters),
      }))
      .filter(s => s.score > 0);

    // Fallback: if no sentence stresses weak letters
    const finalSentences =
      rankedSentences.length > 0
        ? rankedSentences
        : availableSentences.map(s => ({ ...s, score: 1 }));

    // Ensure SentenceState exists for each candidate
    await Promise.all(
      finalSentences.map(sentence =>
        SentenceState.findOneAndUpdate(
          { studentId, sentenceId: sentence.id },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );

    // Fetch candidate states
    const candidateStates = await SentenceState.find({
      studentId,
      sentenceId: { $in: finalSentences.map(s => s.id) },
    });

    if (candidateStates.length === 0) {
      return res.status(500).json({
        success: false,
        error: "No sentence states available",
      });
    }

    // Filter out recently shown sentences (30s cooldown)
    const RECENT_WINDOW_MS = 30 * 1000;
    const now = Date.now();

    const filteredStates = candidateStates.filter(state => {
      if (!state.lastShownAt) return true;
      return now - new Date(state.lastShownAt).getTime() > RECENT_WINDOW_MS;
    });

    // Fallback if all filtered out
    const selectionPool =
      filteredStates.length > 0 ? filteredStates : candidateStates;

    const chosenState = selectNextState(selectionPool);

    // Deactivate any other currently active sentence
    await SentenceState.updateMany(
      {
        studentId,
        isActive: true,
        sentenceId: { $ne: chosenState.sentenceId },
      },
      { isActive: false }
    );

    chosenState.isActive = true;
    chosenState.lastShownAt = new Date();
    await chosenState.save();

    // Return sentence
    const chosenSentence = availableSentences.find(
      s => s.id === chosenState.sentenceId
    );
    if (!chosenSentence) {
      return res.status(500).json({
        success: false,
        error: "Selected sentence not found in training corpus",
      });
    }

    return res.json({
      success: true,
      sentenceId: chosenSentence.id,
      sentence: chosenSentence.text,
      focusWords: chosenSentence.focusWords || [],
      sourceDocTitle: chosenSentence.sourceDocTitle || null,
      trainingSource: corpus.source,
      targetLetters: weakLetters,
    });

  } catch (err) {
    console.error("getNextSentence error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};


// ─────────────────────────────────────────────────────────────────
// Evaluates a sentence attempt and reinforces letter learning
// ─────────────────────────────────────────────────────────────────
// export const logSentenceAttempt = async (req, res) => {
//   console.log("HIT /sentences/attempt", req.body);
//   try {
//     const studentId = req.user._id;
//     const { sentenceId, expected, spoken, responseTimeMs, visualIsHard } = req.body;

//     // FIX: destructured as const originally — must be let so we can default it
//     let visualScore = Number(req.body.visualScore) || 0;

//     if (!sentenceId || !expected || !spoken || responseTimeMs === undefined) {
//       return res.status(400).json({
//         success: false,
//         error: "Missing required fields",
//       });
//     }

//     const sentenceState = await SentenceState.findOne({ studentId, sentenceId });
//     console.log("ATTEMPT UPDATE", { sentenceId, expected, studentId });

//     if (!sentenceState) {
//       return res.status(409).json({
//         success: false,
//         error: "No active sentence or sentence mismatch",
//       });
//     }

//     // ── Normalize ────────────────────────────────────────────────
//     const normalize = (text) =>
//       text.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

//     const expectedNorm  = normalize(expected);
//     const spokenNorm    = normalize(spoken);
//     const expectedWords = expectedNorm.split(" ");
//     const spokenWords   = spokenNorm.split(" ");

//     // ── Position-aware word matching ─────────────────────────────
//     // Compares each expected word at its own index.
//     // ±1 tolerance handles minor speech insertions/deletions
//     // (e.g. "I like to really read books" still matches "I like to read books")
//     let matchedCount = 0;
//     const wrongEntries = []; // { word, wordIdx } — index preserved to handle duplicate words

//     for (let i = 0; i < expectedWords.length; i++) {
//       const exp = expectedWords[i];
//       const matched =
//         spokenWords[i]     === exp ||
//         spokenWords[i - 1] === exp ||
//         spokenWords[i + 1] === exp;

//       if (matched) {
//         matchedCount++;
//       } else {
//         wrongEntries.push({ word: exp, wordIdx: i });
//       }
//     }

//     const sentenceAccuracy = matchedCount / expectedWords.length;

//     // Strict threshold for RND:
//     //   - 0 wrong words        → always correct
//     //   - 1 wrong word         → correct only if sentence is 6+ words (small tolerance)
//     //   - 2+ wrong words       → always incorrect
//     const sentenceCorrect =
//       wrongEntries.length === 0 ||
//       (wrongEntries.length === 1 && expectedWords.length >= 6);

//     // ── Problem letter extraction ─────────────────────────────────
//     // For each wrong word, do a full char-by-char comparison against
//     // what the student actually said at that position.
//     // Every mismatched or missing expected character is recorded.
//     // Uses wordIdx (not indexOf) so duplicate words in a sentence are handled correctly.
//     const problemLetters = new Set();

//     for (const { word, wordIdx } of wrongEntries) {
//       const spokenEquiv = spokenWords[wordIdx] || "";
//       const maxLen = Math.max(word.length, spokenEquiv.length);

//       for (let i = 0; i < maxLen; i++) {
//         const expChar = word[i]        || null; // expected char at position i
//         const spkChar = spokenEquiv[i] || null; // spoken char at position i (null = missing)

//         // Only flag expected chars — if student added extra letters we don't penalise
//         if (expChar && expChar !== spkChar) {
//           problemLetters.add(expChar);
//         }
//       }
//     }

//     // ── Reward calculation ───────────────────────────────────────
//     const fluencyScore   = Math.min(1, 3000 / responseTimeMs);
//     const visionPenalty  = visualScore * 0.2;
//     const sentenceReward = 0.6 * (sentenceCorrect ? 1 : 0) + 0.4 * fluencyScore;
//     const finalReward    = Math.max(0, sentenceReward - visionPenalty); // kept for future use

//     console.log("REWARD DEBUG", {
//       responseTimeMs,
//       fluencyScore,
//       sentenceCorrect,
//       sentenceReward,
//       visualScore,
//       visualIsHard,
//     });

//     // ── Update bandit state ──────────────────────────────────────
//     await updateBanditState(sentenceState, sentenceReward);
//     sentenceState.isActive = false;
//     await sentenceState.save();

//     // ── Penalise weak letters in bandit ─────────────────────────
//     for (const letter of problemLetters) {
//       const letterState = await LetterState.findOne({ studentId, letter });
//       if (!letterState) continue;
//       updateBanditState(letterState, -0.2);
//       await letterState.save();
//     }

//     // ── Persist attempt ──────────────────────────────────────────
//     await SentenceAttempt.create({
//       studentId,
//       sentenceId,
//       expected,
//       spoken,
//       sentenceCorrect,
//       sentenceAccuracy,
//       responseTimeMs,
//       problemLetters: Array.from(problemLetters),
//       visualScore,
//       visualIsHard: Boolean(visualIsHard),
//     });

//     // ── Respond ──────────────────────────────────────────────────
//     return res.json({
//       success: true,
//       sentenceCorrect,
//       sentenceAccuracy,
//       problemLetters: Array.from(problemLetters),
//       message: sentenceCorrect
//         ? "Good job! Keep going."
//         : "Nice try! Focus on the highlighted sounds.",
//     });

//   } catch (err) {
//     console.error("logSentenceAttempt error:", err);
//     return res.status(500).json({
//       success: false,
//       error: "Internal server error",
//     });
//   }
// };
export const logSentenceAttempt = async (req, res) => {
  console.log("HIT /sentences/attempt", req.body);
  try {
    const studentId = req.user._id;

    // Accept either JSON { spoken } OR an uploaded audio file (multipart/form-data)
    let { sentenceId, expected, responseTimeMs, visualScore, visualIsHard } = req.body;
    let spoken = req.body.spoken; // may be undefined when audio is uploaded

    // If audio was uploaded, use Gemini to transcribe
    if (req.file && !spoken) {
      try {
        const audioBuffer = req.file.buffer;
        const base64Audio = audioBuffer.toString("base64");
        const geminiAI = initializeAI();

        const gResp = await geminiAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: req.file.mimetype || "audio/webm",
                    data: base64Audio,
                  },
                },
                {
                  text:
                    "Listen to this audio and transcribe ONLY the spoken sentence. Return only the text.",
                },
              ],
            },
          ],
        });

        spoken = (gResp?.text || "").toLowerCase().trim();
      } catch (tErr) {
        console.error("Gemini transcription failed (sentence):", tErr);
        return res.status(500).json({
          success: false,
          message: "Gemini transcription failed",
          error: tErr.message,
        });
      }
    }

    // Normalize numeric fields from multipart/form-data (strings)
    responseTimeMs = Number(responseTimeMs);
    visualScore = Number(visualScore) || 0;
    visualIsHard = visualIsHard === "true" || visualIsHard === true;

    if (!sentenceId || !expected || !spoken || responseTimeMs === undefined || Number.isNaN(responseTimeMs)) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Verify active sentence
    const sentenceState = await SentenceState.findOne({
      studentId,
      sentenceId,
    });
    console.log("ATTEMPT UPDATE", {
      sentenceId,
      expected,
      studentId,
    });

    if (!sentenceState) {
      return res.status(409).json({
        success: false,
        error: "No active sentence or sentence mismatch",
      });
    }

    // ── Normalize ────────────────────────────────────────────────
    const normalize = (text) =>
      text.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

    const expectedNorm  = normalize(expected);
    const spokenNorm    = normalize(spoken);
    const expectedWords = expectedNorm.split(" ");
    const spokenWords   = spokenNorm.split(" ");

    // ── Position-aware word matching ─────────────────────────────
    // Each expected word is checked at its own index.
    // ±1 tolerance handles minor speech insertions
    // e.g. "I like to really read books" still matches "I like to read books"
    let matchedCount = 0;
    const wrongEntries = []; // { word, wordIdx } — index kept to handle duplicate words correctly

    for (let i = 0; i < expectedWords.length; i++) {
      const exp = expectedWords[i];
      const matched =
        spokenWords[i]     === exp ||
        spokenWords[i - 1] === exp ||
        spokenWords[i + 1] === exp;

      if (matched) {
        matchedCount++;
      } else {
        wrongEntries.push({ word: exp, wordIdx: i });
      }
    }

    const sentenceAccuracy = matchedCount / expectedWords.length;

    // Strict threshold for RND:
    //   0 wrong words → always correct
    //   1 wrong word  → correct only if sentence is 6+ words
    //   2+ wrong      → always incorrect
    const sentenceCorrect =
      wrongEntries.length === 0 ||
      (wrongEntries.length === 1 && expectedWords.length >= 6);

    // ── Problem letter extraction ─────────────────────────────────
    // Full char-by-char diff of each wrong word against what was spoken.
    // Catches substitutions, dropped endings, collapsed blends.
    // Uses wordIdx not indexOf — safe for sentences with duplicate words.
    const problemLetters = new Set();

    for (const { word, wordIdx } of wrongEntries) {
      const spokenEquiv = spokenWords[wordIdx] || "";
      const maxLen = Math.max(word.length, spokenEquiv.length);

      for (let i = 0; i < maxLen; i++) {
        const expChar = word[i]        || null;
        const spkChar = spokenEquiv[i] || null;

        // Only flag expected chars — extra spoken chars are not penalised
        if (expChar && expChar !== spkChar) {
          problemLetters.add(expChar);
        }
      }
    }

    // Update SentenceState   
    const fluencyScore = Math.min(1, 3000 / responseTimeMs);
    const visualScoreValue = Number(visualScore || 0);
    const visionPenalty = visualScoreValue * 0.2;

    const sentenceReward =
      0.6 * (sentenceCorrect ? 1 : 0) +
      0.4 * fluencyScore;

    const finalReward = Math.max(0, sentenceReward - visionPenalty);

    console.log("REWARD DEBUG", {
    responseTimeMs,
    fluencyScore,
    sentenceCorrect,
    sentenceReward,
    visualScore: visualScoreValue,
    visualIsHard
  });

    // ── Update bandit state ──────────────────────────────────────
    await updateBanditState(sentenceState, sentenceReward);
    sentenceState.isActive = false;
    await sentenceState.save();

    // ── Penalise weak letters in bandit ─────────────────────────
    for (const letter of problemLetters) {
      const letterState = await LetterState.findOne({ studentId, letter });
      if (!letterState) continue;
      updateBanditState(letterState, -0.2);
      await letterState.save();
    }

    // ── Persist attempt ──────────────────────────────────────────
    await SentenceAttempt.create({
      studentId,
      sentenceId,
      expected,
      spoken,
      sentenceCorrect,
      sentenceAccuracy,
      responseTimeMs,
      problemLetters: Array.from(problemLetters),
      visualScore,
      visualIsHard: Boolean(visualIsHard),
    });

    // ── Respond ────────────────────────────────────────────────── (include Gemini transcript when available)
    return res.json({
      success: true,
      sentenceCorrect,
      sentenceAccuracy,
      problemLetters: Array.from(problemLetters),
      transcript: spoken,
      message: sentenceCorrect
        ? "Good job! Keep going."
        : "Nice try! Focus on the highlighted sounds.",
    });

  } catch (err) {
    console.error("logSentenceAttempt error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};