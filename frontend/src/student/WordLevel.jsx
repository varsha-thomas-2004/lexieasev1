import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { apiFetch } from "../api/api";
import ReadingLens from "./ReadingLens";
import { computeVisualHesitationScore } from "../utils/visionUtils";
import {
  applyBrushToKeys,
  getTargetsWithinBrush,
} from "./brushUtils";
import {
  initializeEyeTracking,
  startSegment,
  endSegment,
  getSegmentMetrics,
  shutdownEyeTracking,
} from "../utils/eyeTrackingController";

import {
  buildWordFeedbackSpeech,
  speakText,
  splitIntoSyllables,
  getGoogleStylePronunciation,
  speakSyllables,
  speakWordBreakdown,
} from "../utils/syllabify";

export default function WordLevel() {
  const outletContext = useOutletContext();
  const readingStyle = outletContext?.readingStyle;
  const setLivePreference = outletContext?.setLivePreference;
  const isBrushDown = outletContext?.isBrushDown;
  const setIsBrushDown = outletContext?.setIsBrushDown;
  const brushState = outletContext?.brushState;
  const clearHighlightsVersion = outletContext?.clearHighlightsVersion;
  const [syllables, setSyllables] = useState([]);
  const [pronunciation, setPronunciation] = useState("");

  const [word, setWord] = useState(null);
  const [wordId, setWordId] = useState(null);
  const [sourceSentence, setSourceSentence] = useState("");
  const [sourceDocTitle, setSourceDocTitle] = useState("");
  const [spoken, setSpoken] = useState("");
  const [shownAt, setShownAt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [paintedLetters, setPaintedLetters] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef(null);
  const spokenRef = useRef("");
  const shouldSubmitRef = useRef(false);
  
  const wordIdRef = useRef(null);
  const wordRef = useRef(null);
  const shownAtRef = useRef(null);

  // Add animation styles
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes wave {
        0%, 100% { height: 10px; }
        50% { height: 35px; }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  
  useEffect(() => {
    wordIdRef.current = wordId;
    wordRef.current = word;
    shownAtRef.current = shownAt;
  }, [wordId, word, shownAt]);

  /* =========================
     Varied Feedback Messages
  ========================== */
  const getSuccessFeedback = () => {
    const messages = [
      "Perfect! You nailed it!",
      "Excellent pronunciation! Well done!",
      "Outstanding work! That was spot on!",
      "Brilliant! You said it perfectly!",
      "Fantastic! Keep it up!",
      "Wonderful! You got it right!",
      "Amazing job! Keep going!",
      "Superb! You're doing great!",
      "Incredible! That was perfect!",
      "Great work! You've got this!",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getEncouragementFeedback = () => {
    const messages = [
      "Good attempt! Keep practicing!",
      "Nice try! You're getting better!",
      "Keep going! You're improving!",
      "Good effort! Try again!",
      "You're close! Keep trying!",
      "Almost there! Don't give up!",
      "Great attempt! Practice makes perfect!",
      "You're doing well! Keep at it!",
      "Nice effort! You can do it!",
      "Keep practicing! You're making progress!",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const lensAreaRef = useRef(null);
  const letterRefs = useRef({});

  useEffect(() => {
    console.log("WordLevel mounted");
    if (!videoRef.current) {
      console.log("VideoRef is null");
      return;
    }
    const init = async () => {
      console.log("Initialiazing eye tracking...");
      await initializeEyeTracking(videoRef.current);
    };

    init();

    return () => {
      console.log("Shutting down eye tracking...");
      shutdownEyeTracking();
    };
  }, [videoRef.current]);

  useEffect(() => {
    if (!word) return;
    startSegment();
  }, [word]);

  /* =========================
     Load next word
  ========================== */
  const loadWord = async () => {
    try {
      const res = await apiFetch("/api/words/next");
      console.log("✅ Word loaded:", res);
      setWord(res.word);
      setWordId(res.wordId);
      setFeedback(null);
      setSpoken("");
      spokenRef.current = "";
      setShownAt(Date.now());
    } catch (error) {
      console.error("❌ Failed to load word:", error);
      setWord("Error loading word. Please refresh.");
    }
    const res = await apiFetch("/api/words/next");
    console.log("Loaded word: ", res.word);
    setWord(res.word);
    setPaintedLetters({});
    setSourceSentence(res.sourceSentence || "");
    setSourceDocTitle(res.sourceDocTitle || "");
    const s = await splitIntoSyllables(res.word || "");
    setSyllables(s);
    setPronunciation(getGoogleStylePronunciation(s));

    setWordId(res.wordId);
    setFeedback(null);
    setSpoken("");
    setShownAt(Date.now());
  };

  useEffect(() => {
    loadWord();
  }, []);

  useEffect(() => {
    setPaintedLetters({});
  }, [clearHighlightsVersion]);

  const applyBrushAtPoint = (clientX, clientY) => {
    const keys = getTargetsWithinBrush(
      letterRefs.current,
      { x: clientX, y: clientY },
      brushState?.size || readingStyle?.brushSize || 24
    );

    applyBrushToKeys(
      keys,
      brushState?.mode || "paint",
      brushState?.color || readingStyle?.brushColor || readingStyle?.colors.ink,
      setPaintedLetters
    );
  };

  const paintLetterKey = (key) => {
    applyBrushToKeys(
      [key],
      brushState?.mode || "paint",
      brushState?.color || readingStyle?.brushColor || readingStyle?.colors.ink,
      setPaintedLetters
    );
  };

  /* =========================
     Audio Feedback
  ========================== */
  // const speakFeedback = (feedback) => {
  //   if (!("speechSynthesis" in window)) return;

  //   // Always pick a random message, not using the same one as visual
  //   const text = feedback.wordCorrect
  //     ? getSuccessFeedback()
  //     : getEncouragementFeedback();

  //   window.speechSynthesis.cancel();
  //   const utterance = new SpeechSynthesisUtterance(text);
    
  //   utterance.rate = 1.0;
  //   utterance.pitch = 1.1;
  //   utterance.volume = 1.0;
    
  //   window.speechSynthesis.speak(utterance);
  // };

  /* =========================
     Submit Attempt
  ========================== */
  const submitAttempt = async () => {
    console.log("📤 submitAttempt called");
    console.log("📊 Current refs:", {
      wordId: wordIdRef.current,
      word: wordRef.current,
      spoken: spokenRef.current,
      shownAt: shownAtRef.current,
    });
    
    if (!wordIdRef.current || !wordRef.current || !spokenRef.current || !shownAtRef.current) {
      console.log("❌ Missing data, aborting submit");
      alert("Missing data - check console");
      return;
    }

    setIsProcessing(true); // Show processing indicator

    try {
      const responseTimeMs = Date.now() - shownAtRef.current;
      
      const payload = {
        wordId: wordIdRef.current,
        expected: wordRef.current,
        spoken: spokenRef.current,
        responseTimeMs,
      };
      
      console.log("📤 Exact payload being sent:", JSON.stringify(payload, null, 2));

      const response = await fetch("http://localhost:5001/api/words/attempt", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("📡 Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Backend error response:", errorText);
        throw new Error(`Server error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const res = await response.json();

      console.log("✅ API Response:", res);

      // Add varied feedback message
      const feedbackMessage = res.wordCorrect
        ? getSuccessFeedback()
        : getEncouragementFeedback();

      setFeedback({
        ...res,
        displayMessage: feedbackMessage,
      });
      
      setIsProcessing(false); // Hide processing indicator
      
      speakFeedback(res);

      // Load next word after delay
      setTimeout(() => {
        console.log("⏭️ Loading next word...");
        loadWord();
      }, 1600);
    } catch (error) {
      console.error("❌ Failed to submit attempt:", error);
      console.error("❌ Error details:", error.message);
      setIsProcessing(false); // Hide processing indicator
      setFeedback({
        wordCorrect: false,
        displayMessage: "Error: " + error.message,
      });
    }
  };

  /* =========================
     Speech Recognition Setup
  ========================== */
  useEffect(() => {
    console.log("🎙️ Setting up speech recognition (ONCE)");
    
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true; // Changed to true
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("🎙️ Recognition started");
    };

    recognition.onresult = (event) => {
      console.log("🎤 onresult event triggered, results count:", event.results.length);
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        const isFinal = result.isFinal;
        
        console.log(`🎤 Result ${i}: "${transcript}" (confidence: ${confidence?.toFixed(2) || 'N/A'}, final: ${isFinal})`);
        
        // Save both final AND interim results (Web Speech API sometimes doesn't send final)
        if (transcript && transcript.trim()) {
          spokenRef.current = transcript.trim();
          setSpoken(transcript.trim());
          console.log(`${isFinal ? '✅' : '📝'} Saved ${isFinal ? 'final' : 'interim'} transcript:`, transcript);
        }
      }
    };

    recognition.onaudiostart = () => {
      console.log("🔊 Audio capture started");
    };

    recognition.onaudioend = () => {
      console.log("🔇 Audio capture ended");
    };

    recognition.onsoundstart = () => {
      console.log("🔊 Sound detected!");
    };

    recognition.onsoundend = () => {
      console.log("🔇 Sound ended");
    };

    recognition.onspeechstart = () => {
      console.log("🗣️ Speech detected!");
    };

    recognition.onspeechend = () => {
      console.log("🗣️ Speech ended");
    };

    recognition.onerror = (event) => {
      console.error("❌ Recognition error:", event.error);
      console.error("❌ Error message:", event.message);
      setIsRecording(false);
      shouldSubmitRef.current = false;
      
      if (event.error === 'no-speech') {
        alert('No speech detected. Please try again and speak clearly.');
      } else if (event.error === 'audio-capture') {
        alert('Microphone not accessible. Please check permissions.');
      }
    };

    recognition.onend = () => {
      console.log(`🎙️ Recognition ended. hasTranscript: ${!!spokenRef.current}`);
      setIsRecording(false);

      // ✅ AUTO-SUBMIT if we have a transcript
      if (spokenRef.current) {
        console.log("✅ Calling submitAttempt");
        submitAttempt();
      } else {
        console.log("⚠️ Not submitting - no transcript");
      }

      shouldSubmitRef.current = false;
    };

    recognitionRef.current = recognition;
    console.log("✅ Speech recognition ready");

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        console.log("🧹 Recognition cleaned up on unmount");
      }
    };
  }, []); // Empty array - only setup once

  /* =========================
     Cleanup speech synthesis
  ========================== */
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);


  /* =======================  
    Recording controls (MediaRecorder -> upload to Gemini)
  ========================== */
  const startRecording = async () => {
    try {
      setSpoken("");
      setFeedback(null);
      setShownAt(Date.now());

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || "audio/webm",
        });

        // stop tracks
        try {
          streamRef.current.getTracks().forEach((t) => t.stop());
        } catch (e) {}

        const currentWordId = wordId;
        const currentWord = word;
        const responseTimeMs = Date.now() - shownAt;
        endSegment();

        const metrics = getSegmentMetrics();

        let visionResult = { usable: false, score: 0, isHard: false };

        if (responseTimeMs >= 1000) {
          visionResult = computeVisualHesitationScore(metrics);
        }

        console.log("=== VISION DEBUG ===");
        console.log("Response Time:", responseTimeMs);
        console.log("Samples:", metrics.samples);
        console.log("Fixation Count:", metrics.fixationCount);
        console.log(
          "Mean Fixation Duration:",
          metrics.meanFixationDuration.toFixed(2),
          "ms",
        );
        console.log("Visual Score:", visionResult.score.toFixed(3));
        console.log("Is Hard:", visionResult.isHard);
        console.log("====================");

        const form = new FormData();
        form.append("audio", blob, "speech.webm");
        form.append("wordId", currentWordId);
        form.append("expected", currentWord);
        form.append("responseTimeMs", responseTimeMs);
        form.append("visionUsable", visionResult.usable);
        form.append("visualScore", visionResult.score);
        form.append("visionHard", visionResult.isHard);

        const res = await fetch(
          "http://localhost:5001/api/words/attempt-audio",
          {
            method: "POST",
            credentials: "include",
            body: form,
          },
        );

        const data = await res.json();
        setFeedback(data);
        if (data?.transcript) setSpoken(data.transcript);

        speakFeedback(data); // ✅ Added: speak feedback after audio attempt

        setTimeout(() => loadWord(), 1500);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording start failed", err);
      alert("Unable to access microphone");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  /* =========================
     Render
  ========================== */
  if (!word) return <div style={styles.loading}>Loading…</div>;
  const speakFeedback = (feedback) => {
    if (!("speechSynthesis" in window) || !feedback) return;
    speakText(
      buildWordFeedbackSpeech({
        word,
        syllables,
        feedback,
      }),
      { rate: 0.74, pitch: 1.02 }
    );
  };

  return (
    <div
      style={{
        ...styles.container,
        background: readingStyle?.colors.page || styles.container.background,
        fontFamily: readingStyle?.fontFamily || styles.container.fontFamily,
      }}
    >
      <div
        style={{
          ...styles.card,
          backgroundColor: readingStyle?.colors.card || styles.card.backgroundColor,
          border: `1px solid ${readingStyle?.colors.border || "#e2e8f0"}`,
        }}
      >
        {/* <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ display: "none" }}
        /> */}
        <h2 style={styles.title}>🗣️ Word Pronunciation</h2>

        <div ref={lensAreaRef} style={styles.lensArea}>
          <div
            onPointerDown={(event) => {
              if (!readingStyle?.paintbrushEnabled) return;
              setIsBrushDown?.(true);
              applyBrushAtPoint(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (!readingStyle?.paintbrushEnabled || !isBrushDown) return;
              applyBrushAtPoint(event.clientX, event.clientY);
            }}
            style={{
              ...styles.wordDisplay,
              color: readingStyle?.colors.ink || styles.wordDisplay.color,
              fontFamily: readingStyle?.fontFamily || styles.wordDisplay.fontFamily,
              fontSize: `${64 * (readingStyle?.fontScale || 1)}px`,
              letterSpacing: readingStyle?.letterSpacing || "0.08em",
              wordSpacing: readingStyle?.wordSpacing || "0.18em",
              lineHeight: readingStyle?.lineHeight || 1.65,
              background: readingStyle?.focusColor || "transparent",
              transform: "scale(1)",
              transition: "background 0.18s ease",
              borderRadius: 18,
              display: "inline-block",
              padding: "8px 18px",
              touchAction: readingStyle?.paintbrushEnabled ? "none" : "auto",
              userSelect: readingStyle?.paintbrushEnabled ? "none" : "text",
            }}
          >
            {(word || "").split("").map((char, index) => (
              <span
                key={`${char}-${index}`}
                ref={(element) => {
                  if (element) {
                    letterRefs.current[index] = element;
                  } else {
                    delete letterRefs.current[index];
                  }
                }}
                onPointerDown={() => {
                  if (!readingStyle?.paintbrushEnabled) return;
                  setIsBrushDown?.(true);
                  paintLetterKey(index);
                }}
                onPointerEnter={() => {
                  if (!readingStyle?.paintbrushEnabled || !isBrushDown) return;
                  paintLetterKey(index);
                }}
                style={{
                  color: paintedLetters[index] || "inherit",
                  borderRadius: 8,
                  padding: "0 2px",
                  transition: "color 0.18s ease",
                }}
              >
                {char}
              </span>
            ))}
          </div>
          <ReadingLens
            visible={readingStyle?.magnifierEnabled}
            containerRef={lensAreaRef}
            size={readingStyle?.lensSize || 180}
            zoom={readingStyle?.lensZoom || 1.35}
            shape={readingStyle?.lensShape || "rounded"}
            opacity={readingStyle?.lensOpacity ?? 0.18}
            onZoomIn={() =>
              setLivePreference(
                "lensZoom",
                Math.min(2.2, Number(((readingStyle?.lensZoom || 1.35) + 0.1).toFixed(2)))
              )
            }
            onZoomOut={() =>
              setLivePreference(
                "lensZoom",
                Math.max(1, Number(((readingStyle?.lensZoom || 1.35) - 0.1).toFixed(2)))
              )
            }
            onResizeUp={() =>
              setLivePreference(
                "lensSize",
                Math.min(280, (readingStyle?.lensSize || 180) + 20)
              )
            }
            onResizeDown={() =>
              setLivePreference(
                "lensSize",
                Math.max(120, (readingStyle?.lensSize || 180) - 20)
              )
            }
            onResizeTo={(nextSize) => setLivePreference("lensSize", nextSize)}
            onClose={() => setLivePreference("magnifierEnabled", false)}
          />
        </div>
        {(sourceSentence || sourceDocTitle) && (
          <p
            style={{
              ...styles.sourceMeta,
              color: readingStyle?.colors.muted || styles.sourceMeta.color,
              fontFamily: readingStyle?.fontFamily || styles.sourceMeta.fontFamily,
              letterSpacing: readingStyle?.letterSpacing || "0.08em",
              wordSpacing: readingStyle?.wordSpacing || "0.18em",
              lineHeight: readingStyle?.lineHeight || 1.65,
            }}
          >
            {sourceDocTitle ? `Doc: ${sourceDocTitle}. ` : ""}
            {sourceSentence ? `Mapped sentence: "${sourceSentence}"` : ""}
          </p>
        )}

        {syllables.length > 0 && (
          <p
            style={{
              ...styles.syllables,
              color: readingStyle?.colors.muted || styles.syllables.color,
              fontFamily: readingStyle?.fontFamily || styles.syllables.fontFamily,
              fontSize: `${20 * (readingStyle?.fontScale || 1)}px`,
              letterSpacing: readingStyle?.letterSpacing || "0.08em",
              wordSpacing: readingStyle?.wordSpacing || "0.18em",
              lineHeight: readingStyle?.lineHeight || 1.65,
            }}
          >
            Syllables: {syllables.join(" - ")}
          </p>
        )}
        {pronunciation && (
          <p
            style={{
              ...styles.pronunciation,
              color: readingStyle?.colors.muted || styles.pronunciation.color,
              fontFamily: readingStyle?.fontFamily || styles.pronunciation.fontFamily,
              fontSize: `${18 * (readingStyle?.fontScale || 1)}px`,
              letterSpacing: readingStyle?.letterSpacing || "0.08em",
              wordSpacing: readingStyle?.wordSpacing || "0.18em",
              lineHeight: readingStyle?.lineHeight || 1.65,
            }}
          >
            Pronunciation: {pronunciation}
          </p>
        )}
        {syllables.length > 0 && (
          <button
            style={{ ...styles.primaryButton, marginBottom: 24, marginRight: 12 }}
            onClick={() => speakWordBreakdown(word, syllables)}
          >
            Hear Word Breakdown
          </button>
        )}
        {syllables.length > 0 && (
          <button
            style={{ ...styles.secondaryAction, marginBottom: 24 }}
            onClick={() => speakSyllables(syllables)}
          >
            Hear Syllables Only
          </button>
        )}

        <div style={styles.buttonRow}>
          <button
            onClick={startRecording}
            disabled={isRecording}
            style={{
              ...styles.primaryButton,
              opacity: isRecording ? 0.6 : 1,
            }}
          >
            🎤 Start
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            style={{
              ...styles.stopButton,
              opacity: !isRecording ? 0.6 : 1,
            }}
          >
            ⏹ Stop
          </button>
        </div>

        {spoken && (
          <p style={styles.spoken}>
            <strong>You said:</strong> {spoken}
          </p>
        )}

        {isProcessing && (
          <div style={styles.processingContainer}>
            <div style={styles.waveContainer}>
              <div style={{...styles.wave, animationDelay: '0s'}}></div>
              <div style={{...styles.wave, animationDelay: '0.1s'}}></div>
              <div style={{...styles.wave, animationDelay: '0.2s'}}></div>
              <div style={{...styles.wave, animationDelay: '0.3s'}}></div>
              <div style={{...styles.wave, animationDelay: '0.4s'}}></div>
            </div>
            <p style={styles.processingText}>Processing your answer...</p>
          </div>
        )}

        {feedback && (
          <div
            style={{
              ...styles.feedbackBox,
              backgroundColor: feedback.wordCorrect ? "#d1fae5" : "#fff7ed",
            }}
          >
            <p
              style={{
                ...styles.feedbackText,
                color: feedback.wordCorrect ? "#059669" : "#d97706",
              }}
            >
              {feedback.displayMessage || feedback.message}
            </p>

            {feedback.problemLetters?.length > 0 && (
              <p style={styles.problem}>
                💡 Focus on: <strong>{feedback.problemLetters.join(", ")}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Styles (matches original LetterLevel)
========================== */
const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "linear-gradient(to bottom, #f8fafc, #ffffff)",
    padding: 24,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 40,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    maxWidth: 600,
    width: "100%",
    textAlign: "center",
  },
  lensArea: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 170,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 20,
    color: "#0f172a",
  },
  wordDisplay: {
    fontSize: 64,
    fontWeight: 700,
    color: "#1e40af",
    margin: "30px 0",
  },
  syllables: {
    fontSize: 20,
    color: "#334155",
    marginTop: -12,
    marginBottom: 6,
  },
  sourceMeta: {
    marginTop: 8,
    fontSize: 13,
    color: "#475569",
  },
  pronunciation: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 14,
  },
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    padding: "14px 28px",
    fontSize: 16,
    fontWeight: 600,
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  secondaryAction: {
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 600,
    backgroundColor: "#e0f2fe",
    color: "#0f172a",
    border: "1px solid #7dd3fc",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 10,
  },
  stopButton: {
    padding: "14px 28px",
    fontSize: 16,
    fontWeight: 600,
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  spoken: {
    fontSize: 16,
    color: "#374151",
    marginTop: 10,
  },
  feedbackBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: 600,
  },
  problem: {
    fontSize: 14,
    marginTop: 8,
    color: "#6b7280",
  },
  loading: {
    textAlign: "center",
    marginTop: 100,
    fontSize: 18,
  },
  processingContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    border: "2px solid #bae6fd",
  },
  waveContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    height: 40,
    marginBottom: 10,
  },
  wave: {
    width: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
    animation: "wave 1.2s ease-in-out infinite",
  },
  processingText: {
    fontSize: 16,
    color: "#1e40af",
    fontWeight: 600,
    margin: 0,
  },
};