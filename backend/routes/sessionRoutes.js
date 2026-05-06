import express from 'express';
import {
  createSession,
  deleteSession,
  endSession,
  getSessionById,
  getSessions,
  submitAnswer,
} from '../controllers/sessionController.js';
import { protect, attachUser } from '../middleware/authMiddleware.js';
import { uploadSingleAudio } from '../middleware/uploadMiddleware.js';


const router = express.Router();

// apply protect and attachUser to ALL routes in this file automatically
// this means every route below is protected - no need to add it individually
router.use(protect, attachUser);

// GET /api/sessions      → get all sessions for logged in user
// POST /api/sessions     → create new session
router.route("/")
  .get(getSessions)
  .post(createSession);

// GET /api/sessions/:id      → get one session by id
// DELETE /api/sessions/:id   → delete one session
router.route("/:id")
  .get(getSessionById)
  .delete(deleteSession);

// POST /api/sessions/:id/submit-answer → submit answer for a question
// uploadSingleAudio removed for now - add back when uploadMiddleware is fixed
router.route("/:id/submit-answer").post(uploadSingleAudio, submitAnswer);

// POST /api/sessions/:id/end → end the session early
router.route("/:id/end").post(endSession);

export default router;