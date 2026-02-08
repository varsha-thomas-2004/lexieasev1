import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { getNextWord, logWordAttempt } from "../controllers/wordController.js";
import { geminiWordAttempt } from "../controllers/geminiword.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.get("/next", protect, authorizeRoles("student"), getNextWord);
router.post("/attempt", protect, authorizeRoles("student"), logWordAttempt);
router.post(
	"/attempt-audio",
	protect,
	authorizeRoles("student"),
	upload.single("audio"),
	geminiWordAttempt
);

export default router;
