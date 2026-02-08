import { initializeAI } from "./Geminiletter.js";
import WordState from "../models/WordState.js";
import LetterState from "../models/LetterState.js";
import { updateBanditState } from "../src/bandit/updateState.js";

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

    const audioBuffer = audio.buffer;
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
                mimeType: audio.mimetype || "audio/webm",
                data: base64Audio,
              },
            },
            {
              text:
                "Listen to this audio and transcribe ONLY the spoken word. Return only the text.",
            },
          ],
        },
      ],
    });

    const spoken = response.text.toLowerCase().trim();

    const normalize = (text) =>
      text
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const expectedNorm = normalize(expected);
    const spokenNorm = normalize(spoken);

    const wordCorrect = expectedNorm === spokenNorm;

    console.log("HIT /words/attempt-audio", {
      wordId,
      expected,
      spoken,
      responseTimeMs,
    });

    console.log("ATTEMPT UPDATE", {
      wordId,
      expected,
      studentId,
    });

    const problemLetters = new Set();
    const minLen = Math.min(expectedNorm.length, spokenNorm.length);

    for (let i = 0; i < minLen; i++) {
      const expChar = expectedNorm[i];
      const spkChar = spokenNorm[i];

      if (expChar !== spkChar) {
        if (expChar >= "a" && expChar <= "z") {
          problemLetters.add(expChar);
        }
      }
    }

    const fluencyScore = Math.min(1, 3000 / Number(responseTimeMs));

    const wordReward = 0.6 * (wordCorrect ? 1 : 0) + 0.4 * fluencyScore;

    console.log("REWARD DEBUG", {
      responseTimeMs,
      fluencyScore,
      wordCorrect,
      wordReward,
    });

    await updateBanditState(wordState, wordReward);
    wordState.isActive = false;
    await wordState.save();

    for (const letter of problemLetters) {
      const letterState = await LetterState.findOne({ studentId, letter });
      if (!letterState) continue;
      const letterPenalty = 0.2;
      updateBanditState(letterState, -letterPenalty);
      await letterState.save();
    }

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
