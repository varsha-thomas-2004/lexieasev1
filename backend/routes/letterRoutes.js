import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import {
  getNextLetter,
  geminiLetterAttempt,
} from "../controllers/Geminiletter.js";

const router = express.Router();

router.get(
  "/next",
  protect,
  authorizeRoles("student"),
  getNextLetter
);

router.post(
  "/attempt",
  protect,
  authorizeRoles("student"),
  upload.single("audio"),
  geminiLetterAttempt
);

export default router;