import mongoose from "mongoose";

const twoLetterWordAttemptSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  twoLetterWordId: {
    type: String,
    required: true,
  },
  expected: {
    type: String,
    required: true,
  },
  transcript: {
    type: String,
    default: "",
  },
  wordCorrect: {
    type: Boolean,
    required: true,
  },
  responseTimeMs: {
    type: Number,
    default: 0,
  },
  problemLetters: {
    type: [String],
    default: [],
  },
}, { timestamps: true });

export default mongoose.model("TwoLetterWordAttempt", twoLetterWordAttemptSchema);