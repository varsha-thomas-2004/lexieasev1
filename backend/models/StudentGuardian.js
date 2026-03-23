import mongoose from "mongoose";

const studentGuardianSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// ensure a student-guardian pair is unique
studentGuardianSchema.index({ studentId: 1, guardianId: 1 }, { unique: true });

const StudentGuardian = mongoose.model("StudentGuardian", studentGuardianSchema);

export default StudentGuardian;
