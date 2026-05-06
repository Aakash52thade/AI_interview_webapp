import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL}/sessions`;

const api = axios.create({ baseURL: API_URL });

let clerkToken = null;

export const setAxiosToken = (token) => {
    clerkToken = token;
};

// Attach Clerk token to every request automatically
api.interceptors.request.use((request) => {
    if (clerkToken) {
        request.headers.Authorization = `Bearer ${clerkToken}`;
    }
    return request;
});

// Log 401s — Clerk will refresh token on next getToken() call
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.error('Session unauthorized - token may have expired');
        }
        return Promise.reject(error);
    }
);

const initialState = {
    sessions: [],
    activeSession: null,
    isGenerating: false,
    isError: false,
    isLoading: false,
    message: '',
};

// ── GET /api/sessions ─────────────────────────────────────────────────────────
export const getSessions = createAsyncThunk('sessions/getAll', async (_, thunkAPI) => {
    try {
        const response = await api.get('/');
        return response.data;
    } catch (error) {
        const message =
            error.response?.data?.message || error.message || error.toString();
        return thunkAPI.rejectWithValue(message);
    }
});

// ── POST /api/sessions ────────────────────────────────────────────────────────
export const createSession = createAsyncThunk('sessions/create', async (sessionData, thunkAPI) => {
    try {
        const response = await api.post('/', sessionData);
        return response.data;
    } catch (error) {
        const message =
            error.response?.data?.message || error.message || error.toString();
        return thunkAPI.rejectWithValue(message);
    }
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────
export const getSessionById = createAsyncThunk('sessions/getOne', async (sessionId, thunkAPI) => {
    try {
        const response = await api.get(`/${sessionId}`);
        return response.data;
    } catch (error) {
        const message =
            error.response?.data?.message || error.message || error.toString();
        return thunkAPI.rejectWithValue(message);
    }
});

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────────
export const deleteSession = createAsyncThunk('sessions/delete', async (sessionId, thunkAPI) => {
    try {
        const response = await api.delete(`/${sessionId}`);
        return response.data.id;
    } catch (error) {
        const message =
            error.response?.data?.message || error.message || error.toString();
        return thunkAPI.rejectWithValue(message);
    }
});

// ── POST /api/sessions/:id/submit-answer ──────────────────────────────────────
export const submitAnswer = createAsyncThunk(
    'sessions/submitAnswer',
    async ({ sessionId, formData }, thunkAPI) => {
        try {
            const response = await api.post(`/${sessionId}/submit-answer`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message || error.message || error.toString();
            return thunkAPI.rejectWithValue(message);
        }
    }
);

// ── POST /api/sessions/:id/end ────────────────────────────────────────────────
export const endSession = createAsyncThunk('sessions/endSession', async (sessionId, thunkAPI) => {
    try {
        const response = await api.post(`/${sessionId}/end`);
        return response.data;
    } catch (error) {
        const message =
            error.response?.data?.message || error.message || error.toString();
        return thunkAPI.rejectWithValue(message);
    }
});

// ── Slice ─────────────────────────────────────────────────────────────────────
export const sessionSlice = createSlice({
    name: 'sessions',
    initialState,
    reducers: {
        reset: (state) => {
            state.isError = false;
            state.message = '';
            state.isLoading = false;
            state.isGenerating = false;
        },

        // Called by useSocket when a Socket.io event arrives
        socketUpdateSession: (state, action) => {
            const { sessionId, status, message, session } = action.payload;
            state.message = message;

            // Stop generating spinner when AI is done or failed
            if (status === 'QUESTIONS_READY' || status === 'GENERATION_FAILED') {
                state.isGenerating = false;
            }

            // Always update the sessions list so Dashboard reflects new status
            if (session) {
                const exists = state.sessions.find(s => s._id === sessionId);
                if (exists) {
                    // Update existing session in list
                    state.sessions = state.sessions.map(s =>
                        s._id === sessionId
                            ? { ...s, status: session.status, overallScore: session.overallScore }
                            : s
                    );
                } else if (status === 'QUESTIONS_READY' || status === 'AI_GENERATING_QUESTIONS') {
                    // New session just created — add it to the list
                    state.sessions = [session, ...state.sessions];
                }
            }

            // Update activeSession (InterviewRunner page)
            if (session && state.activeSession && state.activeSession._id === sessionId) {
                state.activeSession.questions = state.activeSession.questions.map(
                    (currentQ, index) => {
                        const incomingQ = session.questions?.[index];
                        if (!incomingQ) return currentQ;
                        if (incomingQ.isEvaluated) return incomingQ;
                        if (currentQ.isSubmitted && !incomingQ.isSubmitted) return currentQ;
                        return incomingQ;
                    }
                );
                state.activeSession.overallScore = session.overallScore;
                state.activeSession.status = session.status;
                state.activeSession.metrics = session.metrics;
            }
        },

        setActiveSession: (state, action) => {
            state.activeSession = action.payload;
        },
    },

    extraReducers: (builder) => {
        builder
            // getSessions
            .addCase(getSessions.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(getSessions.fulfilled, (state, action) => {
                state.isLoading = false;
                state.sessions = action.payload;
            })
            .addCase(getSessions.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.message = action.payload;
            })

            // createSession
            .addCase(createSession.pending, (state) => {
                state.isLoading = true;
                state.isGenerating = true;
                state.activeSession = null;
            })
            .addCase(createSession.fulfilled, (state) => {
                state.isLoading = false;
                // isGenerating stays true — socket QUESTIONS_READY will clear it
            })
            .addCase(createSession.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.isGenerating = false;
                state.message = action.payload;
            })

            // getSessionById
            .addCase(getSessionById.fulfilled, (state, action) => {
                state.activeSession = action.payload;
            })
            .addCase(getSessionById.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload;
            })

            // deleteSession
            .addCase(deleteSession.fulfilled, (state, action) => {
                state.sessions = state.sessions.filter(s => s._id !== action.payload);
            })

            // submitAnswer
            .addCase(submitAnswer.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload;
            })

            // endSession
            .addCase(endSession.fulfilled, (state, action) => {
                state.activeSession = action.payload.session;
            })
            .addCase(endSession.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload;
            });
    },
});

export const { reset, socketUpdateSession, setActiveSession } = sessionSlice.actions;
export default sessionSlice.reducer;
