import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { createSession, getSessions, reset, deleteSession, setAxiosToken } from '../features/sessions/sessionSlice';
import { setToken } from '../features/auth/authSlice';
import { toast } from 'react-toastify';
import SessionCard from '../components/SessionCard';

const ROLES = [
    'MERN Stack Developer', 'MEAN Stack Developer', 'Full Stack Python',
    'Full Stack Java', 'Frontend Developer', 'Backend Developer',
    'Data Scientist', 'Data Analyst', 'Machine Learning Engineer',
    'DevOps Engineer', 'Cloud Engineer (AWS/Azure/GCP)', 'Cybersecurity Engineer',
    'Blockchain Developer', 'Mobile Developer (iOS/Android)', 'Game Developer',
    'UI/UX Designer', 'QA Automation Engineer', 'Product Manager',
];
const LEVELS = ['Junior', 'Mid-Level', 'Senior'];
const TYPES = [
    { label: 'Oral Only',    value: 'oral-only' },
    { label: 'Coding Mix',   value: 'coding-mix' },
];
const COUNTS = [5, 10, 15];

const Dashboard = () => {
    const dispatch  = useDispatch();
    const navigate  = useNavigate();
    const { getToken } = useAuth();

    const { user }    = useSelector((state) => state.auth);
    const { sessions, isLoading, isGenerating, isError, message } = useSelector((state) => state.sessions);

    const [formData, setFormData] = useState({
        role:          ROLES[0],
        level:         LEVELS[0],
        interviewType: TYPES[1].value,
        count:         COUNTS[0],
    });

    // Refresh axios token and load sessions on mount
    useEffect(() => {
        const init = async () => {
            const token = await getToken();
            dispatch(setToken(token));
            setAxiosToken(token);
            dispatch(getSessions());
        };
        init();
    }, [dispatch, getToken]);

    // Pre-fill role from user's preferredRole
    useEffect(() => {
        if (user?.preferredRole) {
            setFormData(prev => ({ ...prev, role: user.preferredRole }));
        }
    }, [user]);

    // Show error toasts
    useEffect(() => {
        if (isError && message) {
            toast.error(message);
            dispatch(reset());
        }
    }, [isError, message, dispatch]);

    const onChange = (e) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        // Always get fresh token before creating session
        const token = await getToken();
        dispatch(setToken(token));
        setAxiosToken(token);
        dispatch(createSession(formData));
    };

    const viewSession = (session) => {
        if (session.status === 'completed')   navigate(`/review/${session._id}`);
        else if (session.status === 'in-progress') navigate(`/interview/${session._id}`);
        else toast.info('Session is still being generated. Please wait...');
    };

    const handleDelete = (e, sessionId) => {
        e.stopPropagation();
        if (window.confirm('Delete this session?')) {
            dispatch(deleteSession(sessionId));
            toast.success('Session deleted');
        }
    };

    const displayName = user?.name?.split(' ')[0] || 'there';

    const selectClass =
        'w-full bg-[#1e1535] border border-violet-600/40 rounded-xl px-3 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer';
    const labelClass =
        'block text-xs font-bold text-violet-300 uppercase tracking-widest mb-1.5';

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">

            {/* ── Welcome Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-violet-700/30 pb-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        Welcome,{' '}
                        <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                            {displayName}
                        </span>
                    </h1>
                    <p className="text-slate-400 mt-1.5 text-sm font-medium">
                        Ready for your technical prep?
                    </p>
                </div>

                <div className="bg-violet-900/30 border border-violet-600/40 rounded-2xl px-6 py-4 text-center">
                    <p className="text-xs font-bold text-violet-300 uppercase tracking-widest">
                        Total Sessions
                    </p>
                    <p className="text-3xl font-black text-white mt-1 leading-none">
                        {sessions.length}
                    </p>
                </div>
            </div>

            {/* ── New Interview Card ── */}
            <div className="rounded-2xl overflow-hidden border border-violet-700/30 bg-[#120f2a]">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-violet-700/30 bg-[#1a1035]">
                    <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-violet-400 to-blue-400" />
                    <h2 className="text-white font-bold text-base">New Interview</h2>
                </div>

                <form
                    onSubmit={onSubmit}
                    className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
                >
                    <div>
                        <label className={labelClass}>Role</label>
                        <select name="role" value={formData.role} onChange={onChange} className={selectClass}>
                            {ROLES.map(r => (
                                <option key={r} value={r} className="bg-[#1e1535]">{r}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Level</label>
                        <select name="level" value={formData.level} onChange={onChange} className={selectClass}>
                            {LEVELS.map(l => (
                                <option key={l} value={l} className="bg-[#1e1535]">{l}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Length</label>
                        <select name="count" value={formData.count} onChange={onChange} className={selectClass}>
                            {COUNTS.map(c => (
                                <option key={c} value={c} className="bg-[#1e1535]">{c} Qs</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Type</label>
                        <select name="interviewType" value={formData.interviewType} onChange={onChange} className={selectClass}>
                            {TYPES.map(t => (
                                <option key={t.value} value={t.value} className="bg-[#1e1535]">{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isGenerating}
                        className={`h-11 rounded-xl text-xs font-black uppercase tracking-widest text-white border-none flex items-center justify-center gap-2 transition-opacity
                            ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
                        style={{
                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                        }}
                    >
                        {isGenerating ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : 'Start Interview'}
                    </button>
                </form>
            </div>

            {/* ── Session History ── */}
            <div className="space-y-5">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-violet-900/40 border border-violet-600/40 flex items-center justify-center text-base">
                        📊
                    </span>
                    Interview History
                </h2>

                {isLoading && sessions.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-2 border-violet-700 border-t-violet-400 rounded-full animate-spin" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="border-2 border-dashed border-violet-700/40 rounded-2xl py-16 text-center">
                        <p className="text-slate-400 font-semibold text-base">
                            No sessions yet. Start your first interview above!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map(session => (
                            <SessionCard
                                key={session._id}
                                session={session}
                                onClick={viewSession}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
