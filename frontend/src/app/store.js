import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import sessionReducer from '../features/sessions/sessionSlice';

const store = configureStore({
    reducer: {
        auth: authReducer,
        sessions: sessionReducer,
    },
    // disable Redux DevTools in production — don't expose state to browser extensions
    devTools: import.meta.env.DEV,
});

export default store;
