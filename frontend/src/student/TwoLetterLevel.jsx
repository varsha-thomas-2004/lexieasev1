import React, { useState, useRef, useEffect } from "react";

export default function TwoLetterLevel() {
  const [word, setWord] = useState("");
  const [twoLetterWordId, setTwoLetterWordId] = useState(null);
  const [status, setStatus] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [ripple, setRipple] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartRef = useRef(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setStatus("❌ Microphone recording not supported in this browser.");
    }
  }, []);

  /* =========================
     Speech feedback
  ========================== */
  const speakFeedback = (correct, score) => {
    if (!("speechSynthesis" in window)) return;

    let text;
    if (correct) {
      text =
        score >= 90
          ? "Excellent work! Congratulations."
          : score >= 75
          ? "Well done. You are very close."
          : "Good job! Keep it up.";
    } else {
      text =
        score >= 55
          ? "Good effort. Relax and try again."
          : "Don't worry. Take your time and keep trying.";
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const loadWord = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/twoletterwords/next", {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      const data = await res.json();
      setWord(data.word);
      setTwoLetterWordId(data.twoLetterWordId);
      setFeedback(null);
      setStatus("");
    } catch (err) {
      console.error("Failed to load two-letter word:", err);
      setStatus("Could not load word");
    }
  };

  useEffect(() => {
    loadWord();
  }, []);

  const startRecording = async () => {
    if (!isSupported) return;

    try {
      setFeedback(null);
      setStatus("🎤 Listening...");
      setRipple(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        await submitAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      recordingStartRef.current = Date.now();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          stopRecording();
        }
      }, 3000);
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("❌ Microphone access error");
      setRipple(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRipple(false);
      setStatus("");
    }
  };

  const submitAudio = async (audioBlob) => {
    try {
      const responseTimeMs = recordingStartRef.current ? Date.now() - recordingStartRef.current : 0;
      setStatus("⏳ Processing...");
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("twoLetterWordId", twoLetterWordId);
      formData.append("expected", word);
      formData.append("responseTimeMs", responseTimeMs);

      const res = await fetch("http://localhost:5001/api/twoletterwords/attempt", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await res.json();
      setFeedback(data);
      setStatus("");

      // Trigger speech feedback using wordCorrect and score from the response
      speakFeedback(data.wordCorrect, data.score ?? (data.wordCorrect ? 80 : 40));

      setTimeout(() => {
        loadWord();
      }, 1500);
    } catch (err) {
      console.error("Submit audio error:", err);
      setStatus("Submission failed");
    }
  };

  if (!word) return <div style={styles.loading}>Loading…</div>;

  const correct = feedback?.wordCorrect;

  return (
    <>
      <style>{`
        @keyframes rippleOut {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes wordPop {
          0% { transform: scale(0.85); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }

        .word-display {
          animation: wordPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .feedback-box {
          animation: fadeSlideUp 0.35s ease both;
        }

        .ripple-ring {
          animation: rippleOut 1.2s ease-out infinite;
        }

        .btn-record {
          transition: background-color 0.2s, transform 0.15s, box-shadow 0.2s;
        }

        .btn-record:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(59,130,246,0.35);
        }

        .btn-record:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-stop {
          transition: background-color 0.2s, transform 0.15s;
        }

        .btn-stop:hover:not(:disabled) {
          transform: translateY(-2px);
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.card}>

          {/* Header */}
          <h2 style={styles.title}>🔤 Two-Letter Practice</h2>

          <div style={styles.instructions}>
            Click the microphone and clearly say: <strong>"{word}"</strong>
          </div>

          {/* Word Display */}
          <div key={word} className="word-display" style={styles.wordDisplay}>
            {word}
          </div>

          {/* Mic Button */}
          <div style={styles.buttonContainer}>
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {ripple && (
                <div className="ripple-ring" style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  border: "3px solid rgba(239,68,68,0.5)",
                  pointerEvents: "none",
                }} />
              )}
              <button
                className="btn-record"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!isSupported}
                style={{
                  ...styles.recordButton,
                  backgroundColor: isRecording ? "#ef4444" : "#3b82f6",
                  animation: isRecording ? "pulse 1.5s ease-in-out infinite" : "none",
                  opacity: !isSupported ? 0.5 : 1,
                  cursor: !isSupported ? "not-allowed" : "pointer",
                }}
              >
                {isRecording ? "🔴 Stop" : "🎤 Speak"}
              </button>
            </div>
          </div>

          {/* Status */}
          {status && (
            <p style={styles.status}>{status}</p>
          )}

          {/* Transcript */}
          {feedback?.transcript && (
            <p style={styles.transcript}>
              <span style={styles.transcriptLabel}>You said:</span> {feedback.transcript}
            </p>
          )}

          {/* Feedback */}
          {feedback && (
            <div
              className="feedback-box"
              style={{
                ...styles.feedbackBox,
                backgroundColor: correct ? "#d1fae5" : "#fff7ed",
                borderColor: correct ? "#6ee7b7" : "#fcd34d",
              }}
            >
              <p style={{
                ...styles.feedbackText,
                color: correct ? "#059669" : "#d97706",
              }}>
                {feedback.message}
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
    </>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "linear-gradient(to bottom, #f8fafc, #ffffff)",
    padding: "24px",
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "16px",
    padding: "40px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    maxWidth: "600px",
    width: "100%",
    textAlign: "center",
  },
  title: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "26px",
    fontWeight: 400,
    marginBottom: "8px",
    color: "#0f172a",
  },
  instructions: {
    fontSize: "16px",
    color: "#6b7280",
    marginBottom: "8px",
  },
  wordDisplay: {
    fontSize: 64,
    fontWeight: 700,
    color: "#1e40af",
    margin: "30px 0",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "24px",
  },
  recordButton: {
    padding: "14px 36px",
    fontSize: "16px",
    fontWeight: "600",
    color: "white",
    border: "none",
    borderRadius: "8px",
    letterSpacing: "0.02em",
  },
  status: {
    fontSize: "16px",
    color: "#6b7280",
    margin: "0 0 16px",
    minHeight: "24px",
  },
  transcript: {
    fontSize: "16px",
    color: "#374151",
    marginTop: "8px",
    marginBottom: "12px",
  },
  transcriptLabel: {
    fontWeight: 600,
    color: "#111827",
  },
  feedbackBox: {
    marginTop: "16px",
    padding: "20px",
    borderRadius: "12px",
    border: "1.5px solid",
  },
  feedbackText: {
    fontSize: "18px",
    fontWeight: 600,
    margin: 0,
  },
  problem: {
    fontSize: "14px",
    marginTop: "10px",
    color: "#6b7280",
    margin: "8px 0 0",
  },
  loading: {
    textAlign: "center",
    marginTop: "100px",
    fontSize: "18px",
    fontFamily: "'DM Sans', sans-serif",
    color: "#6b7280",
  },
};