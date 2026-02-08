import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/api";

export default function WordLevel() {
  const [word, setWord] = useState(null);
  const [wordId, setWordId] = useState(null);
  const [spoken, setSpoken] = useState("");
  const [shownAt, setShownAt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  
  /* =========================
     Load next word
  ========================== */
  const loadWord = async () => {
    const res = await apiFetch("/api/words/next");
    setWord(res.word);
    setWordId(res.wordId);
    setFeedback(null);
    setSpoken("");
    setShownAt(Date.now());
  };

  useEffect(() => {
    loadWord();
  }, []);

  /* =========================
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
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });

        // stop tracks
        try {
          streamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {}

        const currentWordId = wordId;
        const currentWord = word;
        const responseTimeMs = Date.now() - shownAt;

        const form = new FormData();
        form.append('audio', blob, 'speech.webm');
        form.append('wordId', currentWordId);
        form.append('expected', currentWord);
        form.append('responseTimeMs', responseTimeMs);

        const res = await fetch('http://localhost:5001/api/words/attempt-audio', {
          method: 'POST',
          credentials: 'include',
          body: form,
        });

        const data = await res.json();
        setFeedback(data);
        if (data?.transcript) setSpoken(data.transcript);

        setTimeout(() => loadWord(), 1500);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording start failed', err);
      alert('Unable to access microphone');
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
  if (!word) return <div>Loading...</div>;

  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h2>Say the word aloud</h2>

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

      {spoken && (
        <p>
          <strong>You said:</strong> {spoken}
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
