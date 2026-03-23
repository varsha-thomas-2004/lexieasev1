// Add these routes in your backend router file
// e.g. routes/reportRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js"; // your auth middleware
import {
  getDashboardSummary,
  getSentenceReport,
  getWordReport,
  getLetterReport,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/student",           protect, getDashboardSummary);  // dashboard summary
router.get("/student/sentences", protect, getSentenceReport);    // sentence report page
router.get("/student/words",     protect, getWordReport);        // word report page
router.get("/student/letters",   protect, getLetterReport);      // letter report page

export default router;

// ─────────────────────────────────────────
// Add these routes in your React Router config (App.jsx or router file):
//
// <Route path="/student/dashboard"       element={<StudentDashboard />} />
// <Route path="/student/report/sentences" element={<SentenceReport />} />
// <Route path="/student/report/words"    element={<WordReport />} />
// <Route path="/student/report/letters"  element={<LetterReport />} />
// ─────────────────────────────────────────