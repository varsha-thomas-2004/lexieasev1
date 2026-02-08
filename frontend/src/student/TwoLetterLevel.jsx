import React, { useState, useRef, useEffect } from "react";

export default function TwoLetterLevel() {
  const [word, setWord] = useState("");
  const [twoLetterWordId, setTwoLetterWordId] = useState(null);
  const [status, setStatus] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const token = localStorage.getItem("token");

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
    try {
      setStatus("Starting microphone...");
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
      setIsRecording(true);
      setStatus("Listening... Say the sound or word clearly");

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          stopRecording();
        }
      }, 3000);
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("Microphone access error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus("");
    }
  };

  const submitAudio = async (audioBlob) => {
    try {
      setStatus("Processing...");
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("twoLetterWordId", twoLetterWordId);
      formData.append("expected", word);

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

      setTimeout(() => {
        loadWord();
      }, 1500);
    } catch (err) {
      console.error("Submit audio error:", err);
      setStatus("Submission failed");
    }
  };

  /* =========================
     Render
  ========================== */
  if (!word) return <div>Loading...</div>;

  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h2>Say the two-letter word or sound aloud</h2>

      <h1 style={{ margin: "30px 0", fontSize: 60 }}>{word}</h1>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={startRecording}
          disabled={isRecording}
          style={{ marginRight: 10, padding: 15 }}
        >
          Start Recording
        </button>

        <button
          onClick={stopRecording}
          disabled={!isRecording}
          style={{ padding: 15 }}
        >
          Stop
        </button>
      </div>

      {status && <p><strong>{status}</strong></p>}

      {feedback?.transcript && (
        <p>
          <strong>You said:</strong> {feedback.transcript}
        </p>
      )}

      {feedback && (
        <div style={{ marginTop: 15 }}>
          <p
            style={{
              color: feedback.wordCorrect ? "green" : "orange",
              fontWeight: "bold",
            }}
          >
            {feedback.message}
          </p>

          {feedback.problemLetters?.length > 0 && (
            <p>
              Focus on:{" "}
              <strong>{feedback.problemLetters.join(", ")}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
