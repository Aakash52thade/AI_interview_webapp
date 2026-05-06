import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL}/users`;

// Restore user from localStorage so Redux state survives page refresh
const user = (() => {
    try {
        return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
        return null;
    }
})();

const initialState = {
    user: user || null,
    token: null,
    isError: false,
    isSuccess: false,
    isLoading: false,
    isProfileLoading: false,
    message: '',
};

// ── GET /api/users/profile ────────────────────────────────────────────────────
export const getUserProfile = createAsyncThunk(
    'auth/getUserProfile',
    async (token, thunkAPI) => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`${API_URL}/profile`, config);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message || error.message || error.toString();
            return thunkAPI.rejectWithValue(message);
        }
    }
);

// ── PUT /api/users/profile ────────────────────────────────────────────────────
export const updateProfile = createAsyncThunk(
    'auth/update',
    async (userData, thunkAPI) => {
        try {
            const token = thunkAPI.getState().auth.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.put(`${API_URL}/profile`, userData, config);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message || error.message || error.toString();
            return thunkAPI.rejectWithValue(message);
        }
    }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        reset: (state) => {
            state.isLoading = false;
            state.isSuccess = false;
            state.isError = false;
            state.message = '';
        },
        setToken: (state, action) => {
            state.token = action.payload;
        },
        clearUser: (state) => {
            state.user = null;
            state.token = null;
            localStorage.removeItem('user');
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getUserProfile.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(getUserProfile.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isSuccess = true;
                state.user = action.payload;
                // Persist to localStorage so socket can access user._id after refresh
                localStorage.setItem('user', JSON.stringify(action.payload));
            })
            .addCase(getUserProfile.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.message = action.payload;
                state.user = null;
            })

            .addCase(updateProfile.pending, (state) => {
                state.isProfileLoading = true;
            })
            .addCase(updateProfile.fulfilled, (state, action) => {
                state.isProfileLoading = false;
                state.isSuccess = true;
                state.user = action.payload;
                localStorage.setItem('user', JSON.stringify(action.payload));
            })
            .addCase(updateProfile.rejected, (state, action) => {
                state.isProfileLoading = false;
                state.isError = true;
                state.message = action.payload;
            });
    },
});

export const { reset, setToken, clearUser } = authSlice.actions;
export default authSlice.reducer;
