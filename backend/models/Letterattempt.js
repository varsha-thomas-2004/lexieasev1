import mongoose from "mongoose";

const letterAttemptSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    letter: {
      type: String,
      required: true,
    },
    transcript: {
      type: String,
      default: "",
    },
    score: {
      type: Number,
      default: 0,
    },
    correct: {
      type: Boolean,
      required: true,
    },
    responseTimeMs: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

letterAttemptSchema.index({ studentId: 1, createdAt: -1 });

export default mongoose.model("LetterAttempt", letterAttemptSchema);