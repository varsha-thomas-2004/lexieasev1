// routes/letterReportRoutes.js
// Add this router to your main app: app.use("/api/reports/student", letterReportRouter)

import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { getLetterReport } from "../controllers/Letterreportcontroller.js";

const router = express.Router();

// GET /api/reports/student/letters?timeframe=7
router.get("/letters", protect, authorizeRoles("student"), getLetterReport);

export default router;