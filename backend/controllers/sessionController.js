import asyncHandler from 'express-async-handler';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Session from '../models/SessionModel.js';
import Groq from 'groq-sdk';

// ── Groq client ───────────────────────────────────────────────────────────────
let groqInstance;
const getGroq = () => {
    if (!groqInstance) groqInstance = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return groqInstance;
};

// ── Helper: push socket event ─────────────────────────────────────────────────
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

    const session = await Session.create({
        user: userId,
        role,
        level,
        interviewType,
        status: 'pending',
    });

    const io = req.app.get('io');

    res.status(202).json({
        message: 'Session created. Generating questions...',
        sessionId: session._id,
        status: 'processing',
    });

    (async () => {
        const groq = getGroq();
        try {
            pushSocketUpdate(io, userId, session._id, 'AI_GENERATING_QUESTIONS',
                `Generating ${count} questions for ${role}...`);

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
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
                            `Return ONLY a JSON array of strings.`,
                    },
                ],
                temperature: 0.7,
            });

            const raw = completion.choices[0].message.content.trim();
            const cleaned = raw.replace(/```json|```/g, '').trim();
            const questions = JSON.parse(cleaned);

            if (!Array.isArray(questions) || questions.length === 0) {
                throw new Error('Groq did not return a valid array of questions.');
            }

            const codingCount = interviewType === 'coding-mix'
                ? Math.floor(Number(count) * 0.4) : 0;

            const questionArray = questions.slice(0, Number(count)).map((qText, index) => ({
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
            console.error(`Session Creation Failure [${session._id}]: ${error.message}`);
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

// ── Helper: calculate overall score ──────────────────────────────────────────
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
                            null,
                        ],
                    },
                },
                avgConfidence: {
                    $avg: {
                        $cond: [
                            { $eq: ['$questions.isEvaluated', true] },
                            '$questions.confidenceScore',
                            null,
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

// ── Helper: evaluate one answer in background ─────────────────────────────────
const evaluateAnswerAsync = async (io, userId, sessionId, questionIndex, audioFilePath = null, code = null) => {
    const groq = getGroq();
    let transcription = '';

    const questionIdx = typeof questionIndex === 'string'
        ? parseInt(questionIndex, 10)
        : questionIndex;

    // Re-fetch session fresh — this runs after HTTP response already closed
    let session = await Session.findById(sessionId);
    if (!session) {
        console.error(`evaluateAnswerAsync: session ${sessionId} not found`);
        return;
    }

    const question = session.questions[questionIdx];
    if (!question) {
        pushSocketUpdate(io, userId, sessionId, 'EVALUATION_FAILED',
            `Q${questionIdx + 1} not found.`);
        return;
    }

    // ── Phase 1: Transcription ────────────────────────────────────────────────
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
            console.error(`Transcription Error Q${questionIdx + 1}: ${error.message}`);
        } finally {
            if (audioFilePath && fs.existsSync(audioFilePath)) {
                fs.unlinkSync(audioFilePath);
            }
        }
    }

    // ── Phase 2: Evaluation ───────────────────────────────────────────────────
    try {
        pushSocketUpdate(io, userId, sessionId, 'AI_EVALUATING',
            `AI is analyzing Q${questionIdx + 1}...`);

        const evalCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a strict technical interview evaluator. ' +
                        'Return ONLY valid JSON — no markdown, no explanation, no code fences. ' +
                        'Required keys: technicalScore (0-100 integer), confidenceScore (0-100 integer), aiFeedback (string), idealAnswer (string).',
                },
                {
                    role: 'user',
                    content:
                        `Role: ${session.role}\n` +
                        `Level: ${session.level}\n` +
                        `Question: ${question.questionText}\n` +
                        `Question Type: ${question.questionType}\n` +
                        `Candidate Verbal Answer: ${transcription || 'No verbal answer provided'}\n` +
                        `Candidate Code: ${code || 'No code provided'}\n\n` +
                        `Return ONLY this JSON object:\n` +
                        `{"technicalScore": <integer 0-100>, "confidenceScore": <integer 0-100>, "aiFeedback": "<string>", "idealAnswer": "<string>"}`,
                },
            ],
            temperature: 0.3,
        });

        const evalRaw = evalCompletion.choices[0].message.content.trim();
        const evalCleaned = evalRaw.replace(/```json|```/g, '').trim();
        const evalData = JSON.parse(evalCleaned);

        // ── Phase 3: Atomic save — re-fetch to avoid overwriting concurrent evaluations
        session = await Session.findById(sessionId);
        const q = session.questions[questionIdx];

        q.userAnswerText    = transcription;
        q.userSubmittedCode = code || '';
        q.technicalScore    = Number(evalData.technicalScore)  || 0;
        q.confidenceScore   = Number(evalData.confidenceScore) || 0;
        q.aiFeedback        = evalData.aiFeedback  || '';
        q.idealAnswer       = evalData.idealAnswer || '';
        q.isEvaluated       = true;

        const allEvaluated = session.questions.every(qt => qt.isEvaluated);

        // auto-complete if user already clicked Finish (status = 'ending')
        if (allEvaluated || session.status === 'ending') {
            const scoreSummary = await calculateOverallScore(sessionId);
            session.overallScore = scoreSummary.overallScore || 0;
            session.metrics = {
                avgTechnical:  scoreSummary.avgTechnical,
                avgConfidence: scoreSummary.avgConfidence,
            };
            session.status  = 'completed';
            session.endTime = session.endTime || new Date();
            await session.save();

            pushSocketUpdate(io, userId, sessionId, 'SESSION_COMPLETED',
                'All answers evaluated. Scores finalized.', session);
        } else {
            await session.save();
            pushSocketUpdate(io, userId, sessionId, 'EVALUATION_COMPLETE',
                `Q${questionIdx + 1} evaluated.`, session);
        }

    } catch (error) {
        console.error(`Evaluation Error [session ${sessionId}]: ${error.message}`);
        pushSocketUpdate(io, userId, sessionId, 'EVALUATION_FAILED',
            `Evaluation failed: ${error.message}`);
    }
};

// ── POST /api/sessions/:id/submit-answer ──────────────────────────────────────
const submitAnswer = asyncHandler(async (req, res) => {
    const sessionId   = req.params.id;
    const { questionIndex, code } = req.body;
    const userId      = req.user._id;

    const session = await Session.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error('Session not found or user unauthorized');
    }

    const questionIdx = parseInt(questionIndex, 10);
    const question    = session.questions[questionIdx];

    if (!question) {
        res.status(400);
        throw new Error(`Question at index ${questionIdx} not found.`);
    }

    if (question.isSubmitted) {
        res.status(400);
        throw new Error('Answer already submitted for this question.');
    }

    let audioFilePath = null;
    if (req.file) {
        audioFilePath = path.join(process.cwd(), req.file.path);
    }

    question.isSubmitted = true;
    await session.save();

    res.status(202).json({ message: 'Answer received. Processing...', status: 'received' });

    const io = req.app.get('io');
    evaluateAnswerAsync(io, userId, sessionId, questionIdx, audioFilePath, code || null);
});

// ── POST /api/sessions/:id/end ────────────────────────────────────────────────
const endSession = asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    const userId    = req.user._id;

    const session = await Session.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error('Session not found or user unauthorized.');
    }

    if (session.status === 'completed') {
        return res.json({ message: 'Session already completed.', session });
    }

    const isProcessing = session.questions.some(q => q.isSubmitted && !q.isEvaluated);

    if (isProcessing) {
        // Mark as ending — evaluateAnswerAsync will finalize when last answer is done
        session.status = 'ending';
        await session.save();

        const io = req.app.get('io');
        pushSocketUpdate(io, userId, sessionId, 'SESSION_ENDING',
            'Finishing up last evaluations... hang tight!');

        return res.status(202).json({
            message: 'AI is finishing evaluation. You will be redirected automatically.',
            status: 'ending',
        });
    }

    // No pending evaluations — finalize immediately
    const scoreSummary = await calculateOverallScore(sessionId);
    session.overallScore = scoreSummary.overallScore || 0;
    session.status       = 'completed';
    session.endTime      = new Date();
    session.metrics = {
        avgTechnical:  scoreSummary.avgTechnical,
        avgConfidence: scoreSummary.avgConfidence,
    };
    await session.save();

    const io = req.app.get('io');
    pushSocketUpdate(io, userId, sessionId, 'SESSION_COMPLETED',
        'Interview complete!', session);

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
