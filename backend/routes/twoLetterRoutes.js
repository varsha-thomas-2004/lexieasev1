import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { getNextTwoLetterWord, geminiTwoLetterAttempt } from "../controllers/geminitwoLetter.js";

const router = express.Router();

router.get("/next", protect, authorizeRoles("student"), getNextTwoLetterWord);
router.post(
  "/attempt",
  protect,
  authorizeRoles("student"),
  upload.single("audio"),
  geminiTwoLetterAttempt
);

export default router;
