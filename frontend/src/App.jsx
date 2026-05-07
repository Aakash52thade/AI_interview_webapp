import { useEffect, useRef } from 'react';
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
import { setTokenGetter } from './features/sessions/sessionSlice';

const App = () => {
    const { isLoaded, getToken } = useAuth();
    const dispatch  = useDispatch();
    const initDone  = useRef(false); // prevent double-init in StrictMode

    useEffect(() => {
        if (!isLoaded || initDone.current) return;
        initDone.current = true;

        const init = async () => {
            const token = await getToken();
            dispatch(setToken(token));
            setTokenGetter(getToken);           // all session API calls refresh token automatically
            dispatch(getUserProfile(token));    // fetch MongoDB user → socket room joins
        };

        init();
    }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
                        <Route path="/"                     element={<Dashboard />} />
                        <Route path="/profile"              element={<Profile />} />
                        <Route path="/interview/:sessionId" element={<InterviewRunner />} />
                        <Route path="/review/:sessionId"    element={<SessionReview />} />
                        <Route path="*"                     element={<NotFound />} />
                    </Routes>
                </SignedIn>
            </main>
            <ToastContainer position="top-right" autoClose={3000} theme="dark" />
        </div>
    );
};

export default App;
