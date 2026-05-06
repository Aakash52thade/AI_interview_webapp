import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { socketUpdateSession } from '../features/sessions/sessionSlice';

// Socket connects to base URL (no /api)
const BACKEND_URL = import.meta.env.VITE_API_URL.replace('/api', '');

const useSocket = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user }  = useSelector((state) => state.auth);
    const socketRef = useRef(null);

    useEffect(() => {
        // Only connect once user is loaded from MongoDB (has _id)
        if (!user?._id) return;

        const socket = io(BACKEND_URL, {
            query: { userId: user._id },
            transports: ['websocket'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket.io connected:', socket.id);
        });

        socket.on('disconnect', () => {
            console.log('Socket.io disconnected.');
        });

        socket.on('sessionUpdate', (payload) => {
            console.log('Real-time update:', payload.status);

            // Update Redux state (sessions list + activeSession)
            dispatch(socketUpdateSession(payload));

            // Navigate to interview page when questions are ready
            if (payload.status === 'QUESTIONS_READY') {
                navigate(`/interview/${payload.sessionId}`);
            }
        });

        // Cleanup on unmount or when user changes
        return () => {
            socket.disconnect();
        };

    // Only re-run if user changes — NOT on navigate/dispatch changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    return socketRef.current;
};

export default useSocket;
