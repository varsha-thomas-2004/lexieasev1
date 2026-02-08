import TwoLetterWordState from "../models/TwoLetterWordState.js";
import LetterState from "../models/LetterState.js";
import { selectNextState } from "../src/bandit/selectNext.js";
import { updateBanditState } from "../src/bandit/updateState.js";
import { TWO_LETTER_WORDS } from "../data/twoLetterWords.js";
import { initializeAI } from "./Geminiletter.js";

// Chooses the next two-letter word based on the student's weakest letters (2–3)
export const getNextTwoLetterWord = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get weakest letters
    const weakLetterStates = await LetterState.find({ studentId })
      .sort({ avgReward: 1 }) // lowest = hardest
      .limit(3);

    let weakLetters = weakLetterStates.map(ls => ls.letter);

    // Fallback for new users
    if (weakLetters.length === 0) {
      weakLetters = ["a", "e", "i"];
    }

    // Score two-letter words
    const scoreTwoLetterWord = (wordText, letters) => {
      const text = wordText.toLowerCase();
      let score = 0;

      for (const letter of letters) {
        score += text.split(letter).length - 1;
      }

      return score;
    };

    const rankedTwoLetterWords = TWO_LETTER_WORDS
      .map(w => ({
        ...w,
        score: scoreTwoLetterWord(w.text, weakLetters),
      }))
      .filter(w => w.score > 0);

    // Fallback: if no word stresses weak letters
    const finalWords =
      rankedTwoLetterWords.length > 0
        ? rankedTwoLetterWords
        : TWO_LETTER_WORDS.map(w => ({ ...w, score: 1 }));

    // Ensure TwoLetterWordState exists
    await Promise.all(
      finalWords.map(word =>
        TwoLetterWordState.findOneAndUpdate(
          { studentId, twoLetterWordId: word.id },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );

    // Fetch candidate states
    const candidateStates = await TwoLetterWordState.find({
      studentId,
      twoLetterWordId: { $in: finalWords.map(w => w.id) },
    });

    if (candidateStates.length === 0) {
      return res.status(500).json({
        success: false,
        error: "No two-letter word states available",
      });
    }

    const RECENT_WINDOW_MS = 30 * 1000; // 30 seconds

    const now = Date.now();

    const filteredStates = candidateStates.filter(state => {
      if (!state.lastShownAt) return true;
      return now - new Date(state.lastShownAt).getTime() > RECENT_WINDOW_MS;
    });

    // fallback if all filtered out
    const selectionPool =
      filteredStates.length > 0 ? filteredStates : candidateStates;

    const chosenState = selectNextState(selectionPool);
    // BEFORE activating chosenState
    await TwoLetterWordState.updateMany(
      {
        studentId,
        isActive: true,
        twoLetterWordId: { $ne: chosenState.twoLetterWordId },
      },
      { isActive: false }
    );

    // Bandit selection
    chosenState.isActive = true;
    chosenState.lastShownAt = new Date();
    await chosenState.save();

    // Find word in data
    const chosenWord = TWO_LETTER_WORDS.find(
      w => w.id === chosenState.twoLetterWordId
    );

    return res.json({
      word: chosenWord.text,
      twoLetterWordId: chosenState.twoLetterWordId,
    });
  } catch (err) {
    console.error("Error in getNextTwoLetterWord:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Log an attempt on a two-letter word using Gemini transcription
export const geminiTwoLetterAttempt = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { twoLetterWordId, expected, responseTimeMs } = req.body;
    let spoken = req.body.spoken;

    // If audio file uploaded, use Gemini to transcribe
    if (req.file && !spoken) {
      try {
        const audioBuffer = req.file.buffer;
        const base64Audio = audioBuffer.toString("base64");
        const geminiAI = initializeAI();
        const response = await geminiAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: base64Audio,
                  },
                },
                {
                  text:
                    "Listen to this audio and transcribe ONLY the spoken word or sound. Return only the text.",
                },
              ],
            },
          ],
        });

        spoken = response.text.toLowerCase().trim();
      } catch (tErr) {
        console.error("Gemini transcription failed:", tErr);
        return res.status(500).json({
          success: false,
          message: "Gemini transcription failed",
          error: tErr.message,
        });
      }
    }

    if (!twoLetterWordId || !expected || !spoken) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (twoLetterWordId, expected, spoken)",
      });
    }

    const expected_lower = expected.toLowerCase();
    const spoken_lower = spoken.toLowerCase().trim();

    // Consider correct if exact match or spoken includes expected (handles digraphs)
    const wordCorrect =
      spoken_lower === expected_lower ||
      spoken_lower.includes(expected_lower);

    // Score: exact match 100, includes -> 80, partial letter matches -> proportional
    let score = 0;
    if (spoken_lower === expected_lower) {
      score = 100;
    } else if (spoken_lower.includes(expected_lower)) {
      score = 80;
    } else {
      const expectedChars = expected_lower.split("");
      const spokenChars = spoken_lower.split("");
      let matchCount = 0;
      for (
        let i = 0;
        i < Math.min(expectedChars.length, spokenChars.length);
        i++
      ) {
        if (expectedChars[i] === spokenChars[i]) matchCount++;
      }
      score = Math.round((matchCount / expectedChars.length) * 100);
    }

    // Update TwoLetterWordState
    const state = await TwoLetterWordState.findOneAndUpdate(
      { studentId, twoLetterWordId },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Convert score to reward between 0 and 1 (0-90: 0, 90-100: 1, gradual scaling in between)
    const reward =
      score >= 90 ? 1 : score >= 50 ? 0.6 : score >= 20 ? 0.3 : 0;

    updateBanditState(state, reward);
    await state.save();

    // Update LetterState for each letter in the word
    const expectedWord = expected_lower;
    for (const letter of expectedWord) {
      const letterState = await LetterState.findOneAndUpdate(
        { studentId, letter },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      updateBanditState(letterState, reward);
      await letterState.save();
    }

    // Identify problem letters
    const problemLetters = [];
    const expectedChars = expectedWord.split("");
    const spokenChars = spoken_lower.trim().split("");
    for (let i = 0; i < expectedChars.length; i++) {
      if (spokenChars[i] !== expectedChars[i])
        problemLetters.push(expectedChars[i]);
    }

    return res.json({
      wordCorrect,
      score,
      reward,
      message: wordCorrect
        ? `✓ Great! "${expected}" is correct!`
        : `✗ Not quite. Expected "${expected}", heard "${spoken}"`,
      problemLetters: [...new Set(problemLetters)],
      transcript: spoken_lower,
    });
  } catch (err) {
    console.error("Error in geminiTwoLetterAttempt:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
