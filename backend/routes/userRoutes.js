import express from 'express';
import { getUserProfile, updateUserProfile } from "../controllers/userController.js";
import { protect, attachUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get("/profile", protect, attachUser, getUserProfile);
router.put("/profile", protect, attachUser, updateUserProfile);

export default router;