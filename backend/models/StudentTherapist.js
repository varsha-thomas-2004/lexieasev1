import mongoose from "mongoose";

const studentTherapistSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate links
studentTherapistSchema.index({ studentId: 1, therapistId: 1 }, { unique: true });

const StudentTherapist = mongoose.model("StudentTherapist", studentTherapistSchema);

export default StudentTherapist;
