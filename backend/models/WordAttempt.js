import mongoose from "mongoose";

const wordAttemptSchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  wordId:         { type: String, required: true },
  expected:       { type: String, required: true },
  transcript:     { type: String, default: "" },
  wordCorrect:    { type: Boolean, required: true },
  responseTimeMs: { type: Number, default: 0 },
  problemLetters: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.model("WordAttempt", wordAttemptSchema);