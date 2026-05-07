import express from 'express';
import http from 'http';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Auto-create uploads folder so multer never crashes on fresh deployments
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads', { recursive: true });

import cors from 'cors';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { notFound, errorMiddleware } from './middleware/errorMiddleware.js';
import userRoutes from './routes/userRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import { clerkMiddleware } from './middleware/authMiddleware.js';

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// ── CORS origins ──────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL,
].filter(Boolean);

// ── CORS middleware ───────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
    },
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Clerk auth middleware — must be before routes ─────────────────────────────
app.use(clerkMiddleware());

// ── Make io available inside controllers via req.app.get('io') ────────────────
app.set('io', io);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('API is running'));

app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);

// ── Socket.io connection handler ──────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    const userId = socket.handshake.query.userId;
    if (userId) {
        socket.join(userId);
        console.log(`User ${socket.id} joined room: ${userId}`);
    }

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// ── Error handling — must be last ─────────────────────────────────────────────
app.use(notFound);
app.use(errorMiddleware);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);
