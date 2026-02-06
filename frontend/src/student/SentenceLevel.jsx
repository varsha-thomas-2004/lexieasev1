// import { useEffect, useRef, useState } from "react";
// import { apiFetch } from "../api/api";

// export default function SentenceLevel() {
//   const [sentence, setSentence] = useState(null);
//   const [sentenceId, setSentenceId] = useState(null);
//   const [spoken, setSpoken] = useState("");
//   const [shownAt, setShownAt] = useState(null);
//   const [feedback, setFeedback] = useState(null);
//   const [isRecording, setIsRecording] = useState(false);

//   const recognitionRef = useRef(null);
//   const spokenRef = useRef("");
  
//   /* =========================
//      Load next sentence
//   ========================== */
//   const loadSentence = async () => {
//     const res = await apiFetch("/api/sentences/next");
//     setSentence(res.sentence);
//     setSentenceId(res.sentenceId);
//     setFeedback(null);
//     setSpoken("");
//     setShownAt(Date.now());
//   };

//   useEffect(() => {
//     loadSentence();
//   }, []);

//   /* =========================
//      Setup Web Speech API
//   ========================== */
//   useEffect(() => {
//     const SpeechRecognition =
//       window.SpeechRecognition || window.webkitSpeechRecognition;

//     if (!SpeechRecognition) {
//       alert("Speech Recognition not supported in this browser");
//       return;
//     }

//     const recognition = new SpeechRecognition();
//     recognition.lang = "en-US";
//     recognition.interimResults = false;
//     recognition.continuous = false;

//     // recognition.onresult = (event) => {
//     //   const transcript = event.results[0][0].transcript;
//     //   setSpoken(transcript);
//     // };
//     recognition.onresult = (event) => {
//     const transcript = event.results[0][0].transcript;
//     spokenRef.current = transcript;
//     setSpoken(transcript);
//   };


//     recognition.onerror = (err) => {
//       console.error("Speech error:", err);
//       setIsRecording(false);
//     };

//     recognition.onend = () => {
//       setIsRecording(false);
//     };

//     recognitionRef.current = recognition;
//   }, []);

//   /* =========================
//      Recording controls
//   ========================== */
//   const startRecording = () => {
//     if (!recognitionRef.current) return;

//     setSpoken("");
//     setFeedback(null);
//     setShownAt(Date.now());
//     setIsRecording(true);
//     recognitionRef.current.start();
//   };

// const stopRecording = async () => {
//   if (!recognitionRef.current) return;

//   recognitionRef.current.stop();
//   setIsRecording(false);

//   const currentSentenceId = sentenceId;
//   const currentSentence = sentence;
//   const currentSpoken = spokenRef.current;
//   const currentShownAt = shownAt;

//   if (!currentSpoken) {
//     alert("Speech not captured. Please try again.");
//     return;
//   }

//   const responseTimeMs = Date.now() - currentShownAt;

//   const res = await apiFetch("/api/sentences/attempt", {
//     method: "POST",
//     body: JSON.stringify({
//       sentenceId: currentSentenceId,
//       expected: currentSentence,
//       spoken: currentSpoken,
//       responseTimeMs,
//     }),
//   });

//   setFeedback(res);

//   setTimeout(() => {
//     loadSentence();
//   }, 1500);
// };


//   /* =========================
//      Render
//   ========================== */
//   if (!sentence) return <div>Loading...</div>;

//   return (
//     <div style={{ textAlign: "center", marginTop: 40 }}>
//       <h2>Read the sentence aloud</h2>

//       <h1 style={{ margin: "30px 0" }}>{sentence}</h1>

//       <div style={{ marginBottom: 20 }}>
//         <button
//           onClick={startRecording}
//           disabled={isRecording}
//           style={{ marginRight: 10, padding: 15 }}
//         >
//           Start Reading
//         </button>

//         <button
//           onClick={stopRecording}
//           disabled={!isRecording}
//           style={{ padding: 15 }}
//         >
//           Stop
//         </button>
//       </div>

//       {spoken && (
//         <p>
//           <strong>You said:</strong> {spoken}
//         </p>
//       )}

//       {feedback && (
//         <div style={{ marginTop: 15 }}>
//           <p
//             style={{
//               color: feedback.sentenceCorrect ? "green" : "orange",
//               fontWeight: "bold",
//             }}
//           >
//             {feedback.message}
//           </p>

//           {feedback.problemLetters?.length > 0 && (
//             <p>
//               Focus on:{" "}
//               <strong>{feedback.problemLetters.join(", ")}</strong>
//             </p>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }


import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/api";

export default function SentenceLevel() {
  const [sentence, setSentence] = useState(null);
  const [sentenceId, setSentenceId] = useState(null);
  const [spoken, setSpoken] = useState("");
  const [shownAt, setShownAt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const recognitionRef = useRef(null);
  const spokenRef = useRef("");

  const loadSentence = async () => {
    const res = await apiFetch("/api/sentences/next");
    setSentence(res.sentence);
    setSentenceId(res.sentenceId);
    setFeedback(null);
    setSpoken("");
    setShownAt(Date.now());
  };

  useEffect(() => {
    loadSentence();
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      spokenRef.current = transcript;
      setSpoken(transcript);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
  }, []);

  const startRecording = () => {
    if (!recognitionRef.current) return;
    setSpoken("");
    setFeedback(null);
    setShownAt(Date.now());
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = async () => {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setIsRecording(false);

    if (!spokenRef.current) {
      alert("Speech not captured. Try again.");
      return;
    }

    const res = await apiFetch("/api/sentences/attempt", {
      method: "POST",
      body: JSON.stringify({
        sentenceId,
        expected: sentence,
        spoken: spokenRef.current,
        responseTimeMs: Date.now() - shownAt,
      }),
    });

    setFeedback(res);
    setTimeout(loadSentence, 1600);
  };

  if (!sentence) return <div style={styles.loading}>Preparing your session…</div>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.subtitle}>Read this sentence clearly</p>


        <div style={styles.sentenceWrap}>
          <h1 style={styles.sentence}>{sentence}</h1>
        </div>

        <div style={styles.controls}>
          <button
            onClick={startRecording}
            disabled={isRecording}
            style={{
              ...styles.micBtn,
              ...(isRecording ? styles.micActive : {}),
            }}
          >
            🎤
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            style={styles.stopBtn}
          >
            Stop
          </button>
        </div>

        {spoken && (
          <div style={styles.spokenCard}>
            <span style={styles.label}>You said</span>
            <p>{spoken}</p>
          </div>
        )}

        {feedback && (
          <div
            style={{
              ...styles.feedback,
              background: feedback.sentenceCorrect
                ? "linear-gradient(135deg,#ecfeff,#d1fae5)"
                : "linear-gradient(135deg,#fff7ed,#ffedd5)",
            }}
          >
            <strong>{feedback.message}</strong>

            {feedback.problemLetters?.length > 0 && (
              <p style={styles.coach}>
                Coach tip: focus on{" "}
                <strong>{feedback.problemLetters.join(", ")}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   PREMIUM ED-TECH STYLES
========================== */
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, #eef2ff 0%, #f8fafc 60%)",
    display: "flex",
    justifyContent: "center",
    paddingTop: 80,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: 820,
    background: "white",
    borderRadius: 24,
    padding: "48px",
    boxShadow: "0 30px 60px rgba(15,23,42,0.12)",
    textAlign: "center",
  },
  subtitle: {
  fontSize: 22,
  color: "#0f172a",
  marginBottom: 36,
  fontWeight: 700,
  letterSpacing: "0.02em",
},

  sentenceWrap: {
  padding: "48px",
  borderRadius: 24,
  background:
    "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
  color: "white",
  marginBottom: 56,
},

  sentence: {
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1.4,
  },
  controls: {
    display: "flex",
    justifyContent: "center",
    gap: 24,
    marginBottom: 30,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    border: "none",
    fontSize: 32,
    background: "#1e40af",
    color: "white",
    cursor: "pointer",
    boxShadow: "0 10px 25px rgba(30,64,175,0.4)",
    transition: "all 0.25s ease",
  },
  micActive: {
    animation: "pulse 1.4s infinite",
    background: "#dc2626",
  },
  stopBtn: {
    padding: "16px 28px",
    borderRadius: 14,
    border: "1px solid #c7d2fe",
    background: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  spokenCard: {
    background: "#f1f5f9",
    borderRadius: 14,
    padding: 20,
    marginTop: 10,
    textAlign: "left",
  },
  label: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  feedback: {
    marginTop: 24,
    padding: 22,
    borderRadius: 16,
    fontSize: 16,
  },
  coach: {
    marginTop: 8,
    fontSize: 14,
    color: "#475569",
  },
  loading: {
    marginTop: 120,
    fontSize: 20,
    color: "#475569",
  },
};
