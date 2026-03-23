import express from "express";
import {
  getTherapistStudents,
  getStudentDetail,
  getStudentDashboardSummary,
  getStudentWordReport,
  getStudentSentenceReport,
  getStudentLetterReport,
  assignStudentToTherapist,
  removeStudentFromTherapist
} from "../controllers/therapistController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Protect all routes - only therapist role allowed
router.use(protect, authorizeRoles("therapist"));

// Get all students assigned to therapist
router.get("/students", getTherapistStudents);

// Get specific student details
router.get("/students/:studentId", getStudentDetail);

// Get student dashboard summary
router.get("/students/:studentId/summary", getStudentDashboardSummary);

// Get student word report
router.get("/students/:studentId/report/words", getStudentWordReport);

// Get student sentence report
router.get("/students/:studentId/report/sentences", getStudentSentenceReport);

// Get student letter report
router.get("/students/:studentId/report/letters", getStudentLetterReport);

// Assign student to therapist
router.post("/students/assign", assignStudentToTherapist);

// Remove student from therapist
router.delete("/students/:studentId", removeStudentFromTherapist);

export default router;
