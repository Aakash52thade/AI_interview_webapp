import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL}/sessions`;

const api = axios.create({ baseURL: API_URL });

// Stores Clerk's getToken function — set once from App.jsx
let getClerkToken = null;

export const setTokenGetter = (fn) => {
    getClerkToken = fn;
};

// kept for backwards compat — App.jsx still calls it
export const setAxiosToken = (_token) => {};

// Every request automatically gets a fresh Clerk token
api.interceptors.request.use(async (request) => {
    if (getClerkToken) {
        const token = await getClerkToken();
        request.headers.Authorization = `Bearer ${token}`;
    }
    return request;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.error('Session API 401 — token may be expired');
        }
        return Promise.reject(error);
    }
);

const initialState = {
    sessions:      [],
    activeSession: null,
    isGenerating:  false,
    isError:       false,
    isLoading:     false,
    message:       '',
};

export const getSessions = createAsyncThunk('sessions/getAll', async (_, thunkAPI) => {
    try {
        const res = await api.get('/');
        return res.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || error.message || error.toString()
        );
    }
});

export const createSession = createAsyncThunk('sessions/create', async (sessionData, thunkAPI) => {
    try {
        const res = await api.post('/', sessionData);
        return res.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || error.message || error.toString()
        );
    }
});

export const getSessionById = createAsyncThunk('sessions/getOne', async (sessionId, thunkAPI) => {
    try {
        const res = await api.get(`/${sessionId}`);
        return res.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || error.message || error.toString()
        );
    }
});

export const deleteSession = createAsyncThunk('sessions/delete', async (sessionId, thunkAPI) => {
    try {
        const res = await api.delete(`/${sessionId}`);
        return res.data.id;
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || error.message || error.toString()
        );
    }
});

export const submitAnswer = createAsyncThunk(
    'sessions/submitAnswer',
    async ({ sessionId, formData }, thunkAPI) => {
        try {
            const res = await api.post(`/${sessionId}/submit-answer`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message || error.toString()
            );
        }
    }
);

export const endSession = createAsyncThunk('sessions/endSession', async (sessionId, thunkAPI) => {
    try {
        const res = await api.post(`/${sessionId}/end`);
        return res.data; // { message, session?, status? }
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || error.message || error.toString()
        );
    }
});

export const sessionSlice = createSlice({
    name: 'sessions',
    initialState,
    reducers: {
        reset: (state) => {
            state.isError     = false;
            state.message     = '';
            state.isLoading   = false;
            state.isGenerating = false;
        },

        socketUpdateSession: (state, action) => {
            const { sessionId, status, message, session } = action.payload;
            state.message = message;

            if (status === 'QUESTIONS_READY' || status === 'GENERATION_FAILED') {
                state.isGenerating = false;
            }

            // Update sessions list on dashboard
            if (session) {
                const exists = state.sessions.find(s => s._id === sessionId);
                if (exists) {
                    state.sessions = state.sessions.map(s =>
                        s._id === sessionId
                            ? { ...s, status: session.status, overallScore: session.overallScore }
                            : s
                    );
                } else {
                    state.sessions = [session, ...state.sessions];
                }
            }

            // Update activeSession for InterviewRunner
            if (session && state.activeSession?._id === sessionId) {
                state.activeSession = {
                    ...state.activeSession,
                    status:       session.status,
                    overallScore: session.overallScore,
                    metrics:      session.metrics,
                    // Merge questions — keep local submitted state, apply evaluated data
                    questions: state.activeSession.questions.map((currentQ, index) => {
                        const incomingQ = session.questions?.[index];
                        if (!incomingQ) return currentQ;
                        // If AI just evaluated this question, use incoming
                        if (incomingQ.isEvaluated) return incomingQ;
                        // If locally submitted but incoming not yet evaluated, keep local
                        if (currentQ.isSubmitted && !incomingQ.isSubmitted) return currentQ;
                        return incomingQ;
                    }),
                };
            }
        },

        setActiveSession: (state, action) => {
            state.activeSession = action.payload;
        },
    },

    extraReducers: (builder) => {
        builder
            .addCase(getSessions.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(getSessions.fulfilled, (state, action) => {
                state.isLoading  = false;
                state.sessions   = action.payload;
            })
            .addCase(getSessions.rejected, (state, action) => {
                state.isLoading = false;
                state.isError   = true;
                state.message   = action.payload;
            })

            .addCase(createSession.pending, (state) => {
                state.isLoading    = true;
                state.isGenerating = true;
                state.activeSession = null;
            })
            .addCase(createSession.fulfilled, (state) => {
                state.isLoading = false;
                // isGenerating stays true until socket fires QUESTIONS_READY
            })
            .addCase(createSession.rejected, (state, action) => {
                state.isLoading    = false;
                state.isError      = true;
                state.isGenerating = false;
                state.message      = action.payload;
            })

            .addCase(getSessionById.fulfilled, (state, action) => {
                state.activeSession = action.payload;
            })
            .addCase(getSessionById.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload;
            })

            .addCase(deleteSession.fulfilled, (state, action) => {
                state.sessions = state.sessions.filter(s => s._id !== action.payload);
            })
            .addCase(deleteSession.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload;
            })

            .addCase(submitAnswer.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload;
            })

            .addCase(endSession.fulfilled, (state, action) => {
                // Only update activeSession if a completed session was returned
                // When status === 'ending', there is no session object in the response
                if (action.payload?.session) {
                    state.activeSession = action.payload.session;
                }
            })
            .addCase(endSession.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload;
            });
    },
});

export const { reset, socketUpdateSession, setActiveSession } = sessionSlice.actions;
export default sessionSlice.reducer;
