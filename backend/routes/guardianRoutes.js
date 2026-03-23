import express from "express";
import {
  getGuardianStudents,
  getStudentDetail,
  getStudentDashboardSummary,
  getStudentWordReport,
  getStudentSentenceReport,
  getStudentLetterReport,
} from "../controllers/guardianController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// all routes require guardian role
router.use(protect, authorizeRoles("guardian"));

// list of assigned students (could be more than one)
router.get("/students", getGuardianStudents);

// detail and reports for a specific student
router.get("/students/:studentId", getStudentDetail);
router.get("/students/:studentId/summary", getStudentDashboardSummary);
router.get("/students/:studentId/report/words", getStudentWordReport);
router.get("/students/:studentId/report/sentences", getStudentSentenceReport);
router.get("/students/:studentId/report/letters", getStudentLetterReport);

export default router;
