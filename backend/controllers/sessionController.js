import asyncHandler from 'express-async-handler';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Session from '../models/SessionModel.js';
import Groq from 'groq-sdk';

// ── Groq client — lazy init so GROQ_API_KEY is read after dotenv loads ────────
let groqInstance;
const getGroq = () => {
    if (!groqInstance) groqInstance = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return groqInstance;
};

// ── Helper: push socket event to a user's room ────────────────────────────────
const pushSocketUpdate = (io, userId, sessionId, status, message, session = null) => {
    io.to(userId.toString()).emit('sessionUpdate', {
        sessionId,
        status,
        message,
        session,
    });
};

// ── POST /api/sessions ────────────────────────────────────────────────────────
const createSession = asyncHandler(async (req, res) => {
    const { role, level, interviewType, count } = req.body;
    const userId = req.user._id;

    if (!role || !level || !interviewType || !count) {
        res.status(400);
        throw new Error('Please specify role, level, interview type, and question count.');
    }

    let session = await Session.create({
        user: userId,
        role,
        level,
        interviewType,
        status: 'pending',
    });

    const io = req.app.get('io');

    // Reply immediately — AI runs in background
    res.status(202).json({
        message: 'Session created. Generating questions...',
        sessionId: session._id,
        status: 'processing',
    });

    // Background IIFE — runs after HTTP response is sent
    (async () => {
        const groq = getGroq(); // ← init here so dotenv is ready
        try {
            pushSocketUpdate(io, userId, session._id, 'AI_GENERATING_QUESTIONS',
                `Generating ${count} questions for ${role}...`);

            const completion = await groq.chat.completions.create({
                model: 'llama3-70b-8192',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a technical interview question generator. ' +
                            'Return ONLY a valid JSON array of question strings. ' +
                            'No explanation, no markdown, no extra text. ' +
                            'Example: ["Question 1?", "Question 2?"]',
                    },
                    {
                        role: 'user',
                        content:
                            `Generate exactly ${count} technical interview questions for a ${level} ${role}. ` +
                            `Interview type: ${interviewType === 'coding-mix' ? 'Mix of coding challenges and oral questions' : 'Oral conceptual questions only'}. ` +
                            `Return ONLY a JSON array.`,
                    },
                ],
                temperature: 0.7,
            });

            const raw = completion.choices[0].message.content.trim();
            const cleaned = raw.replace(/```json|```/g, '').trim();
            const questions = JSON.parse(cleaned);

            if (!Array.isArray(questions)) {
                throw new Error('Groq did not return a valid array of questions.');
            }

            const codingCount = interviewType === 'coding-mix'
                ? Math.floor(count * 0.2) : 0;

            const questionArray = questions.map((qText, index) => ({
                questionText: qText,
                questionType: index < codingCount ? 'coding' : 'oral',
                isEvaluated: false,
                isSubmitted: false,
            }));

            session.questions = questionArray;
            session.status = 'in-progress';
            await session.save();

            pushSocketUpdate(io, userId, session._id, 'QUESTIONS_READY',
                'Questions ready! Starting interview.', session);

        } catch (error) {
            console.error(`Session Creation Failure for ${session._id}:`, error.message);
            session.status = 'failed';
            await session.save();
            pushSocketUpdate(io, userId, session._id, 'GENERATION_FAILED',
                `Question generation failed: ${error.message}`);
        }
    })();
});

// ── GET /api/sessions ─────────────────────────────────────────────────────────
const getSessions = asyncHandler(async (req, res) => {
    const sessions = await Session.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .select('-questions.userAnswerText -questions.userSubmittedCode');
    res.json(sessions);
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────
const getSessionById = asyncHandler(async (req, res) => {
    const session = await Session.findOne({
        _id: req.params.id,
        user: req.user._id,
    });
    if (session) {
        res.json(session);
    } else {
        res.status(404);
        throw new Error('Session not found or user unauthorized');
    }
});

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────────
const deleteSession = asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);
    if (!session) {
        res.status(404);
        throw new Error('Session not found');
    }
    if (session.user.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Not authorized');
    }
    await session.deleteOne();
    res.status(200).json({ id: req.params.id });
});

// ── Helper: evaluate one answer async (runs in background) ───────────────────
const evaluateAnswerAsync = async (io, userId, sessionId, questionIndex, audioFilePath = null, code = null) => {
    const groq = getGroq(); // ← init here
    let transcription = '';

    const questionIdx = typeof questionIndex === 'string'
        ? parseInt(questionIndex, 10)
        : questionIndex;

    // Always fetch fresh session — this runs after the HTTP request has closed
    const session = await Session.findById(sessionId);
    if (!session) {
        console.error(`Session ${sessionId} not found`);
        return;
    }

    const question = session.questions[questionIdx];
    if (!question) {
        pushSocketUpdate(io, userId, sessionId, 'EVALUATION_FAILED',
            `Q${questionIdx + 1} not found.`);
        return;
    }

    // ── Phase 1: Transcription — only if audio file exists ───────────────────
    if (audioFilePath) {
        try {
            pushSocketUpdate(io, userId, sessionId, 'AI_TRANSCRIBING',
                `Transcribing audio for Q${questionIdx + 1}...`);

            const audioStream = fs.createReadStream(audioFilePath);
            const transResponse = await groq.audio.transcriptions.create({
                file: audioStream,
                model: 'whisper-large-v3',
            });
            transcription = transResponse.text || '';

        } catch (error) {
            console.error(`Transcription Error: ${error.message}`);
            // continue — code answer can still be evaluated
        } finally {
            if (audioFilePath && fs.existsSync(audioFilePath)) {
                fs.unlinkSync(audioFilePath);
            }
        }
    }

    // ── Phase 2: AI Evaluation ────────────────────────────────────────────────
    try {
        pushSocketUpdate(io, userId, sessionId, 'AI_EVALUATING',
            `AI is analyzing Q${questionIdx + 1}...`);

        const evalCompletion = await groq.chat.completions.create({
            model: 'llama3-70b-8192',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a strict technical interview evaluator. ' +
                        'Return ONLY valid JSON with no markdown, no explanation, no code fences. ' +
                        'Required keys: technicalScore (0-100), confidenceScore (0-100), aiFeedback (string), idealAnswer (string).',
                },
                {
                    role: 'user',
                    content:
                        `Role: ${session.role}\n` +
                        `Level: ${session.level}\n` +
                        `Question: ${question.questionText}\n` +
                        `Question Type: ${question.questionType}\n` +
                        `User Verbal Answer: ${transcription || 'No verbal answer provided'}\n` +
                        `User Code: ${code || 'No code provided'}\n\n` +
                        `Return ONLY this JSON:\n` +
                        `{"technicalScore": 0-100, "confidenceScore": 0-100, "aiFeedback": "...", "idealAnswer": "..."}`,
                },
            ],
            temperature: 0.3,
        });

        const evalRaw = evalCompletion.choices[0].message.content.trim();
        const evalCleaned = evalRaw.replace(/```json|```/g, '').trim();
        const evalData = JSON.parse(evalCleaned);

        // ── Phase 3: Save to MongoDB ──────────────────────────────────────────
        question.userAnswerText = transcription;
        question.userSubmittedCode = code || '';
        question.technicalScore = evalData.technicalScore;
        question.confidenceScore = evalData.confidenceScore;
        question.aiFeedback = evalData.aiFeedback;
        question.idealAnswer = evalData.idealAnswer;
        question.isEvaluated = true;

        const allEvaluated = session.questions.every(q => q.isEvaluated);

        if (session.status === 'completed' || allEvaluated) {
            const scoreSummary = await calculateOverallScore(sessionId);
            session.overallScore = scoreSummary.overallScore || 0;
            session.metrics = {
                avgTechnical: scoreSummary.avgTechnical,
                avgConfidence: scoreSummary.avgConfidence,
            };
            if (allEvaluated) {
                session.status = 'completed';
                session.endTime = session.endTime || new Date();
            }
            await session.save();
            pushSocketUpdate(io, userId, sessionId, 'SESSION_COMPLETED',
                'All answers evaluated. Scores finalized.', session);
        } else {
            // Still in progress — save and notify frontend
            await session.save();
            pushSocketUpdate(io, userId, sessionId, 'EVALUATION_COMPLETE',
                `Q${questionIdx + 1} evaluated.`, session);
        }

    } catch (error) {
        console.error(`Evaluation Error for session ${sessionId}:`, error.message);
        pushSocketUpdate(io, userId, sessionId, 'EVALUATION_FAILED',
            `Evaluation failed: ${error.message}`);
    }
};

// ── POST /api/sessions/:id/submit-answer ──────────────────────────────────────
const submitAnswer = asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    const { questionIndex, code } = req.body;
    const userId = req.user._id;

    const session = await Session.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error('Session not found or user unauthorized');
    }

    const questionIdx = parseInt(questionIndex, 10);
    const question = session.questions[questionIdx];

    if (!question) {
        res.status(400);
        throw new Error(`Question at index ${questionIdx} not found.`);
    }

    let audioFilePath = null;
    if (req.file) {
        audioFilePath = path.join(process.cwd(), req.file.path);
    }

    question.isSubmitted = true;
    await session.save();

    // Reply immediately — AI runs in background
    res.status(202).json({
        message: 'Answer received. Processing...',
        status: 'received',
    });

    const io = req.app.get('io');
    evaluateAnswerAsync(io, userId, sessionId, questionIdx, audioFilePath, code || null);
});

// ── Helper: calculate overall score via MongoDB aggregation ───────────────────
const calculateOverallScore = async (sessionId) => {
    const results = await Session.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(sessionId) } },
        { $unwind: '$questions' },
        {
            $group: {
                _id: '$_id',
                avgTechnical: {
                    $avg: {
                        $cond: [
                            { $eq: ['$questions.isEvaluated', true] },
                            '$questions.technicalScore',
                            0,
                        ],
                    },
                },
                avgConfidence: {
                    $avg: {
                        $cond: [
                            { $eq: ['$questions.isEvaluated', true] },
                            '$questions.confidenceScore',
                            0,
                        ],
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                overallScore: { $round: [{ $avg: ['$avgTechnical', '$avgConfidence'] }, 0] },
                avgTechnical: { $round: ['$avgTechnical', 0] },
                avgConfidence: { $round: ['$avgConfidence', 0] },
            },
        },
    ]);

    return results[0] || { overallScore: 0, avgTechnical: 0, avgConfidence: 0 };
};

// ── POST /api/sessions/:id/end ────────────────────────────────────────────────
const endSession = asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.user._id;

    const session = await Session.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error('Session not found or user unauthorized.');
    }

    const isProcessing = session.questions.some(q => q.isSubmitted && !q.isEvaluated);
    if (isProcessing) {
        res.status(400);
        throw new Error('Cannot end interview while AI is still processing answers.');
    }

    if (session.status === 'completed') {
        res.status(400);
        throw new Error('Session is already completed.');
    }

    const scoreSummary = await calculateOverallScore(sessionId);
    session.overallScore = scoreSummary.overallScore || 0;
    session.status = 'completed';
    session.endTime = new Date();
    session.metrics = {
        avgTechnical: scoreSummary.avgTechnical,
        avgConfidence: scoreSummary.avgConfidence,
    };
    await session.save();

    const io = req.app.get('io');
    pushSocketUpdate(io, userId, sessionId, 'SESSION_COMPLETED',
        'Interview session ended.', session);

    res.json({ message: 'Session ended successfully.', session });
});

export {
    createSession,
    getSessionById,
    getSessions,
    submitAnswer,
    endSession,
    calculateOverallScore,
    deleteSession,
};
