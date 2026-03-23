import express from "express";
<<<<<<< HEAD
import { register, login, logout, changePassword } from "../controllers/authController.js";
=======
import { register, login, logout, getTherapists, getGuardians } from "../controllers/authController.js";
>>>>>>> varsha
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);
<<<<<<< HEAD
router.patch("/change-password", protect, changePassword);
=======
router.get("/therapists", getTherapists);
router.get("/guardians", getGuardians);
>>>>>>> varsha

// ADD THIS NEW ENDPOINT - Get current user info
router.get("/me", protect, async (req, res) => {
  try {
    // req.user is already populated by the protect middleware
    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;