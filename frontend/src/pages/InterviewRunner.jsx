import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionById, submitAnswer, endSession } from '../features/sessions/sessionSlice';
import MonacoEditor from '@monaco-editor/react';
import { toast } from 'react-toastify';

const SUPPORTED_LANGUAGES = [
    { label: 'JavaScript', value: 'javascript' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python',     value: 'python'     },
    { label: 'Java',       value: 'java'       },
    { label: 'C++',        value: 'cpp'        },
    { label: 'C#',         value: 'csharp'     },
    { label: 'Go',         value: 'go'         },
    { label: 'Swift',      value: 'swift'      },
    { label: 'Kotlin',     value: 'kotlin'     },
    { label: 'SQL',        value: 'sql'        },
    { label: 'Shell',      value: 'shell'      },
    { label: 'YAML',       value: 'yaml'       },
    { label: 'Solidity',   value: 'solidity'   },
    { label: 'Plain Text', value: 'plaintext'  },
];

const ROLE_LANGUAGE_MAP = {
    'MERN Stack Developer':           'javascript',
    'MEAN Stack Developer':           'typescript',
    'Full Stack Python':              'python',
    'Full Stack Java':                'java',
    'Frontend Developer':             'javascript',
    'Backend Developer':              'javascript',
    'Data Scientist':                 'python',
    'Data Analyst':                   'python',
    'Machine Learning Engineer':      'python',
    'DevOps Engineer':                'shell',
    'Cloud Engineer (AWS/Azure/GCP)': 'yaml',
    'Cybersecurity Engineer':         'python',
    'Blockchain Developer':           'solidity',
    'Mobile Developer (iOS/Android)': 'swift',
    'Game Developer':                 'csharp',
    'QA Automation Engineer':         'python',
    'UI/UX Designer':                 'plaintext',
    'Product Manager':                'plaintext',
};

function InterviewRunner() {
    const { sessionId } = useParams();
    const navigate      = useNavigate();
    const dispatch      = useDispatch();

    const { activeSession, isLoading, message } = useSelector(state => state.sessions);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedLanguage, setSelectedLanguage]         = useState('javascript');
    const [submittedLocal, setSubmittedLocal]             = useState({});

    const [drafts, setDrafts] = useState(() => {
        try {
            const saved = localStorage.getItem(`drafts_${sessionId}`);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const [isRecording, setIsRecording]   = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    const mediaRecorderRef  = useRef(null);
    const audioChunksRef    = useRef([]);
    const streamRef         = useRef(null);
    const timerIntervalRef  = useRef(null);

    // Fetch session on mount
    useEffect(() => {
        dispatch(getSessionById(sessionId));
    }, [dispatch, sessionId]);

    // Auto-detect language from role
    useEffect(() => {
        if (activeSession?.role) {
            setSelectedLanguage(ROLE_LANGUAGE_MAP[activeSession.role] || 'plaintext');
        }
    }, [activeSession?.role]);

    // Persist drafts
    useEffect(() => {
        localStorage.setItem(`drafts_${sessionId}`, JSON.stringify(drafts));
    }, [drafts, sessionId]);

    // Derived question state
    const currentQuestion    = activeSession?.questions?.[currentQuestionIndex];
    const isReduxSubmitted   = currentQuestion?.isSubmitted === true;
    const isLocallySubmitted = submittedLocal[currentQuestionIndex] === true;
    const isQuestionLocked   = isReduxSubmitted || isLocallySubmitted;
    const isProcessing       = isQuestionLocked && !currentQuestion?.isEvaluated;

    const handleNavigation = (index) => {
        if (index < 0 || index >= (activeSession?.questions?.length ?? 0)) return;
        if (isRecording) stopRecording();
        setCurrentQuestionIndex(index);
        setRecordingTime(0);
    };

    const updateDraftCode = (newCode) => {
        if (isQuestionLocked) return;
        setDrafts(prev => ({
            ...prev,
            [currentQuestionIndex]: { ...prev[currentQuestionIndex], code: newCode },
        }));
    };

    // ── Audio recording ───────────────────────────────────────────────────────
    const startRecording = async () => {
        if (isQuestionLocked) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current        = stream;
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current   = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setDrafts(prev => ({
                    ...prev,
                    [currentQuestionIndex]: { ...prev[currentQuestionIndex], audioBlob: blob },
                }));
            };

            mediaRecorderRef.current.start(1000);
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
        } catch {
            toast.error('Microphone access denied.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            streamRef.current?.getTracks().forEach(t => t.stop());
            clearInterval(timerIntervalRef.current);
            setIsRecording(false);
        }
    };

    // ── Submit answer ─────────────────────────────────────────────────────────
    const handleSubmitAnswer = async () => {
        if (isQuestionLocked) return;
        if (isRecording) stopRecording();

        const draft = drafts[currentQuestionIndex] || {};
        const code  = draft.code  || '';
        const audio = draft.audioBlob;

        if (!code && !audio) {
            toast.warning('Please provide a code answer or record your verbal answer.');
            return;
        }

        setSubmittedLocal(prev => ({ ...prev, [currentQuestionIndex]: true }));

        const formData = new FormData();
        formData.append('questionIndex', currentQuestionIndex);
        if (code)  formData.append('code', code);
        if (audio) formData.append('audio', audio, 'answer.webm');

        dispatch(submitAnswer({ sessionId, formData }))
            .unwrap()
            .catch(() => {
                setSubmittedLocal(prev => ({ ...prev, [currentQuestionIndex]: false }));
                toast.error('Submission failed. Please try again.');
            });
    };

    // ── Finish interview ──────────────────────────────────────────────────────
    const handleFinishInterview = async () => {
        if (!window.confirm('Are you sure you want to finish the interview?')) return;

        dispatch(endSession(sessionId))
            .unwrap()
            .then((data) => {
                if (data.status === 'ending') {
                    toast.info('Almost done! AI is finishing evaluation. You will be redirected automatically.');
                } else {
                    localStorage.removeItem(`drafts_${sessionId}`);
                    navigate(`/review/${sessionId}`);
                }
            })
            .catch(() => toast.error('Something went wrong. Please try again.'));
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (!activeSession) return (
        <div className="text-center py-20 text-violet-400 font-bold animate-pulse uppercase tracking-widest">
            Loading Interview...
        </div>
    );

    const currentDraft = drafts[currentQuestionIndex] || {};

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 pb-32">

            {/* ── Top bar ── */}
            <div className="flex justify-between items-center bg-[#120f2a] border border-violet-700/30 p-5 rounded-2xl mb-6">
                <div>
                    <h1 className="text-lg font-black text-white">{activeSession.role}</h1>
                    <p className="text-xs text-violet-400 mt-1 font-semibold uppercase tracking-widest">
                        {activeSession.level} · {activeSession.interviewType === 'coding-mix' ? 'Coding Mix' : 'Oral Only'}
                    </p>
                    <div className="flex gap-2 mt-3">
                        {activeSession.questions?.map((q, i) => (
                            <div
                                key={i}
                                onClick={() => handleNavigation(i)}
                                title={`Question ${i + 1}`}
                                className={`w-3 h-3 rounded-full cursor-pointer transition-all ${
                                    i === currentQuestionIndex
                                        ? 'bg-violet-500 scale-125 ring-2 ring-violet-400/40'
                                        : q.isEvaluated
                                        ? 'bg-emerald-500'
                                        : (q.isSubmitted || submittedLocal[i])
                                        ? 'bg-amber-400 animate-pulse'
                                        : 'bg-slate-600'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleFinishInterview}
                    disabled={isLoading}
                    className="text-xs font-black uppercase tracking-widest text-white px-5 py-2.5 rounded-xl border-none cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-80"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
                >
                    {isLoading ? 'Finalizing...' : 'Finish Interview'}
                </button>
            </div>

            {/* ── Question text ── */}
            <div className="bg-[#1a1035] border border-violet-700/30 p-8 rounded-2xl mb-6">
                <span className="text-violet-400 text-xs font-bold uppercase tracking-widest">
                    Question {currentQuestionIndex + 1} of {activeSession.questions.length}
                </span>
                <h2 className="text-xl sm:text-2xl mt-3 font-semibold text-white leading-relaxed">
                    {currentQuestion?.questionText}
                </h2>
                <span className={`inline-block mt-4 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
                    currentQuestion?.questionType === 'coding'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                }`}>
                    {currentQuestion?.questionType === 'coding' ? '💻 Coding' : '🎤 Oral'}
                </span>
            </div>

            {/* ── Answer panels ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                {/* Audio Panel */}
                <div className="bg-[#120f2a] border border-violet-700/30 p-6 rounded-2xl flex flex-col items-center justify-center min-h-[300px]">
                    <h3 className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-8">
                        Verbal Answer
                    </h3>

                    {!isRecording && !currentDraft.audioBlob && (
                        <button
                            onClick={startRecording}
                            disabled={isQuestionLocked}
                            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}
                        >
                            🎤
                        </button>
                    )}

                    {isRecording && (
                        <div className="text-center">
                            <div
                                onClick={stopRecording}
                                className="w-20 h-20 bg-rose-600 rounded-full flex items-center justify-center text-white text-3xl animate-pulse cursor-pointer hover:bg-rose-700 transition-all"
                                style={{ boxShadow: '0 0 24px rgba(220,38,38,0.4)' }}
                            >
                                ⏹
                            </div>
                            <p className="mt-4 font-mono text-rose-400 font-bold text-lg">{recordingTime}s</p>
                            <p className="text-xs text-slate-400 mt-1">Click to stop</p>
                        </div>
                    )}

                    {!isRecording && currentDraft.audioBlob && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center text-3xl mx-auto">
                                ✅
                            </div>
                            <p className="text-emerald-400 font-bold text-sm mt-3">Audio Captured</p>
                            {!isQuestionLocked && (
                                <button
                                    onClick={() => setDrafts(prev => ({
                                        ...prev,
                                        [currentQuestionIndex]: { ...prev[currentQuestionIndex], audioBlob: null },
                                    }))}
                                    className="text-xs text-slate-500 underline hover:text-rose-400 mt-2 block transition-colors"
                                >
                                    Delete & Re-record
                                </button>
                            )}
                        </div>
                    )}

                    {isProcessing && (
                        <p className="mt-4 text-xs text-violet-400 animate-pulse font-mono">
                            🤖 AI is analyzing...
                        </p>
                    )}
                </div>

                {/* Code Editor */}
                <div className="bg-[#120f2a] border border-violet-700/30 rounded-2xl overflow-hidden h-[380px]">
                    <div className="flex justify-between items-center px-4 py-3 border-b border-violet-700/30 bg-[#1a1035]">
                        <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">
                            Code Editor
                        </span>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            disabled={isQuestionLocked}
                            className="text-xs bg-[#0d0d1f] border border-violet-700/40 text-violet-300 rounded-lg px-2 py-1 disabled:opacity-40 focus:outline-none"
                        >
                            {SUPPORTED_LANGUAGES.map(l => (
                                <option key={l.value} value={l.value} className="bg-[#1e1535]">{l.label}</option>
                            ))}
                        </select>
                    </div>
                    <MonacoEditor
                        height="100%"
                        language={selectedLanguage}
                        theme="vs-dark"
                        value={currentDraft.code || ''}
                        onChange={updateDraftCode}
                        options={{
                            minimap:             { enabled: false },
                            fontSize:            13,
                            scrollBeyondLastLine: false,
                            readOnly:            isQuestionLocked,
                            domReadOnly:         isQuestionLocked,
                        }}
                    />
                </div>
            </div>

            {/* ── AI Feedback (after evaluation) ── */}
            {currentQuestion?.isEvaluated && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl mb-6">
                    <h3 className="text-emerald-400 font-bold mb-2 text-sm">💡 AI Feedback</h3>
                    <p className="text-emerald-300 text-sm leading-relaxed">{currentQuestion.aiFeedback}</p>
                    <div className="mt-4 flex gap-3">
                        <span className="bg-[#120f2a] border border-emerald-500/20 px-3 py-1 rounded-lg text-xs font-bold text-emerald-400">
                            Technical: {currentQuestion.technicalScore}/100
                        </span>
                        <span className="bg-[#120f2a] border border-blue-500/20 px-3 py-1 rounded-lg text-xs font-bold text-blue-400">
                            Confidence: {currentQuestion.confidenceScore}/100
                        </span>
                    </div>
                </div>
            )}

            {/* ── Fixed bottom nav ── */}
            <div
                className="fixed bottom-0 left-0 right-0 border-t border-violet-800/30 p-4 px-6 flex justify-between items-center z-50"
                style={{ background: '#0d0d1f' }}
            >
                <button
                    onClick={() => handleNavigation(currentQuestionIndex - 1)}
                    disabled={currentQuestionIndex === 0}
                    className="text-sm font-bold text-violet-400 hover:text-white disabled:opacity-25 transition-colors"
                >
                    ← Previous
                </button>

                <div className="flex flex-col items-center gap-2">
                    {isProcessing && message && (
                        <div className="text-xs font-mono text-violet-400 bg-violet-900/30 border border-violet-700/30 px-3 py-1 rounded-full animate-pulse">
                            🤖 {message}
                        </div>
                    )}
                    <button
                        onClick={handleSubmitAnswer}
                        disabled={isQuestionLocked}
                        className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white border-none transition-all
                            ${isProcessing
                                ? 'cursor-wait opacity-60'
                                : currentQuestion?.isEvaluated
                                ? 'cursor-default'
                                : isQuestionLocked
                                ? 'cursor-not-allowed opacity-60'
                                : 'cursor-pointer hover:opacity-90 active:scale-95'
                            }`}
                        style={{
                            background: currentQuestion?.isEvaluated
                                ? 'linear-gradient(135deg, #059669, #047857)'
                                : isQuestionLocked
                                ? 'rgba(255,255,255,0.08)'
                                : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            boxShadow: (!isQuestionLocked && !currentQuestion?.isEvaluated)
                                ? '0 4px 14px rgba(124,58,237,0.4)'
                                : 'none',
                        }}
                    >
                        {isProcessing
                            ? 'Analyzing...'
                            : currentQuestion?.isEvaluated
                            ? '✓ Answer Evaluated'
                            : isQuestionLocked
                            ? 'Submitted'
                            : 'Submit Answer'}
                    </button>
                </div>

                <button
                    onClick={() => handleNavigation(currentQuestionIndex + 1)}
                    disabled={currentQuestionIndex === (activeSession.questions.length - 1)}
                    className="text-sm font-bold text-violet-400 hover:text-white disabled:opacity-25 transition-colors"
                >
                    Next →
                </button>
            </div>
        </div>
    );
}

export default InterviewRunner;
