import React, { useEffect } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from '@clerk/clerk-react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import useSocket from './hooks/useSocket.js';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Header from './components/Header.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import InterviewRunner from './pages/InterviewRunner.jsx';
import SessionReview from './pages/sessionReview.jsx';
import NotFound from './pages/NotFound.jsx';
import { getUserProfile, setToken } from './features/auth/authSlice';
import { setAxiosToken } from './features/sessions/sessionSlice';

const App = () => {
    const { isLoaded, getToken } = useAuth();
    const dispatch = useDispatch();

    // On app load: get Clerk token → store in Redux + axios → fetch MongoDB profile
    useEffect(() => {
        const init = async () => {
            const token = await getToken();
            dispatch(setToken(token));
            setAxiosToken(token);
            dispatch(getUserProfile(token));
        };
        if (isLoaded) init();
    }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // Socket connection — lives at App level so it's always active
    useSocket();

    if (!isLoaded) return null;

    return (
        <div className="min-h-screen" style={{ background: '#0d0d1f' }}>
            <Header />
            <main className="container mx-auto p-4">
                <SignedOut>
                    <RedirectToSignIn fallbackRedirectUrl="/" />
                </SignedOut>
                <SignedIn>
                    <Routes>
                        <Route path="/"                    element={<Dashboard />} />
                        <Route path="/profile"             element={<Profile />} />
                        <Route path="/interview/:sessionId" element={<InterviewRunner />} />
                        <Route path="/review/:sessionId"   element={<SessionReview />} />
                        <Route path="*"                    element={<NotFound />} />
                    </Routes>
                </SignedIn>
            </main>
            <ToastContainer position="top-right" autoClose={3000} />
        </div>
    );
};

export default App;
