// import mongoose from "mongoose";

// const sentenceAttemptSchema = new mongoose.Schema({
//   studentId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,
//   },
//   sentenceId: String,
//   expected: String,
//   spoken: String,
//   sentenceCorrect: Boolean,
//   sentenceAccuracy: Number,
//   responseTimeMs: Number,
//   problemLetters: [String],
// }, { timestamps: true });

// export default mongoose.model("SentenceAttempt", sentenceAttemptSchema);


import mongoose from "mongoose";

const SentenceAttemptSchema = new mongoose.Schema(
  {
    studentId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sentenceId:      { type: String, required: true },
    expected:        { type: String, required: true },
    spoken:          { type: String, required: true },
    sentenceCorrect: { type: Boolean, required: true },
    sentenceAccuracy:{ type: Number, required: true },   // 0–1
    responseTimeMs:  { type: Number, default: 0 },
    problemLetters:  { type: [String], default: [] },

    // ── Eye-tracking / vision fields ──────────────────────────
    visualScore:     { type: Number, default: 0 },       // hesitation score 0–1
    visualIsHard:    { type: Boolean, default: false },  // vision flagged as hard
  },
  { timestamps: true }
);

export default mongoose.model("SentenceAttempt", SentenceAttemptSchema);