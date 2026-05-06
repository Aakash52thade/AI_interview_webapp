import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import { getSessionById } from '../features/sessions/sessionSlice';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ── Helpers — kept exactly from reference, logic is correct ──────────────────
const formatDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const diff = new Date(end) - new Date(start);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
};

const sanitizeQuestionText = (text) => {
    return text.replace(/^\d+[\s\.\)]+/, '').trim();
};

const formatIdealAnswer = (text) => {
    try {
        if (!text) return 'Pending evaluation.';
        let cleanText = text.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }
        if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
            const parsed = JSON.parse(cleanText);
            if (parsed.verbalAnswer || parsed.idealAnswer || parsed.idealanswer) {
                return parsed.verbalAnswer || parsed.idealAnswer || parsed.idealanswer;
            }
            const explanation = parsed.explanation || parsed.understanding || '';
            const code = parsed.code || parsed.codeExample || parsed.example || '';
            if (explanation || code) return `${explanation}\n\n${code}`.trim();
        }
        return text;
    } catch (e) {
        return text;
    }
};

function SessionReview() {
    const { sessionId } = useParams();
    const dispatch = useDispatch();
    const { activeSession, isLoading } = useSelector(state => state.sessions);

    useEffect(() => {
        dispatch(getSessionById(sessionId));
    }, [dispatch, sessionId]);

    // ── Loading state ─────────────────────────────────────────────────────────
    if (isLoading) return (
        <div className="text-center py-20 font-bold text-violet-400 animate-pulse uppercase tracking-widest">
            Generating Analysis...
        </div>
    );

    // ── Not ready state ───────────────────────────────────────────────────────
    if (!activeSession || activeSession.status !== 'completed') {
        return (
            <div className="max-w-xl mx-auto mt-10 sm:mt-20 p-8 sm:p-10 rounded-2xl text-center border border-violet-700/30 bg-[#120f2a]">
                <div className="w-14 h-14 rounded-2xl bg-violet-900/40 border border-violet-600/30 flex items-center justify-center text-2xl mx-auto mb-6">
                    ⏳
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mb-3 uppercase tracking-tight">
                    Report Not Ready
                </h2>
                <p className="text-slate-400 mb-8 text-sm font-medium">
                    This session is still being processed by our AI network.
                </p>
                <Link
                    to="/"
                    className="inline-block text-white text-xs font-black uppercase tracking-widest px-8 py-3 rounded-xl no-underline hover:opacity-90 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}
                >
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const { overallScore, metrics, role, level, questions, startTime, endTime } = activeSession;
    const finalMetrics = metrics || {};

    // ── Chart config — violet theme colors ────────────────────────────────────
    const barData = {
        labels: questions.map((_, i) => `Q${i + 1}`),
        datasets: [{
            label: 'Technical Score',
            // green if score > 70, amber if lower
            data: questions.map(q => q.technicalScore || 0),
            backgroundColor: questions.map(q => (q.technicalScore || 0) > 70 ? '#34d399' : '#fbbf24'),
            borderRadius: 8,
        }],
    };

    const chartOptions = {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                // dark grid lines matching our theme
                grid: { color: 'rgba(139,92,246,0.1)' },
                ticks: { color: '#94a3b8' },
            },
            x: {
                grid: { display: false },
                ticks: { color: '#94a3b8' },
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-violet-700/30 pb-8">
                <div>
                    <span className="text-violet-400 font-black uppercase tracking-widest text-[10px]">
                        Assessment Complete
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2 uppercase">
                        {role}{' '}
                        <span className="text-slate-500 font-medium lowercase text-2xl">({level})</span>
                    </h1>
                </div>
                <Link
                    to="/"
                    className="text-xs font-bold text-violet-400 border border-violet-700/40 px-4 py-2 rounded-xl no-underline hover:border-violet-500 hover:text-violet-300 transition-all"
                >
                    ← Dashboard
                </Link>
            </div>

            {/* ── Summary Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Overall Result', value: `${overallScore}%`, highlight: true },
                    { label: 'Avg Technical',  value: `${finalMetrics.avgTechnical ?? '--'}%` },
                    { label: 'Avg Confidence', value: `${finalMetrics.avgConfidence ?? '--'}%` },
                    { label: 'Session Time',   value: formatDuration(startTime, endTime) },
                ].map((stat, i) => (
                    <div
                        key={i}
                        className={`p-6 rounded-2xl border-l-4 ${
                            stat.highlight
                                ? 'bg-violet-900/30 border-violet-500'
                                : 'bg-[#120f2a] border-violet-800/40'
                        } border border-violet-700/30`}
                    >
                        <p className="text-[10px] font-bold text-violet-300 uppercase tracking-widest">
                            {stat.label}
                        </p>
                        <p className={`text-3xl font-black mt-2 leading-none ${stat.highlight ? 'text-violet-300' : 'text-white'}`}>
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── Performance Chart ── */}
            <div className="bg-[#120f2a] border border-violet-700/30 rounded-2xl p-6 sm:p-8">
                <h3 className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-6">
                    Per-Question Performance
                </h3>
                <div className="h-64 sm:h-72">
                    <Bar data={barData} options={chartOptions} />
                </div>
            </div>

            {/* ── Detailed Question Review ── */}
            <div className="space-y-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                    <span className="w-10 h-10 bg-violet-900/40 border border-violet-600/30 text-violet-300 rounded-xl flex items-center justify-center text-base">
                        ✓
                    </span>
                    Answer Intelligence
                </h3>

                {questions.map((q, index) => (
                    <div
                        key={index}
                        className="bg-[#120f2a] border border-violet-700/30 rounded-2xl overflow-hidden hover:border-violet-500/50 transition-all duration-300"
                    >
                        <div className="p-6 sm:p-8 space-y-6">

                            {/* Question + Score badges */}
                            <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                                <h4 className="text-base sm:text-lg font-bold text-white flex-1 leading-snug">
                                    <span className="text-violet-400 mr-2 font-black">Q{index + 1}.</span>
                                    {sanitizeQuestionText(q.questionText)}
                                </h4>
                                <div className="flex gap-2 shrink-0">
                                    {/* Technical score badge */}
                                    <div className="px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Tech</span>
                                        <span className="text-sm font-black text-emerald-400">{q.technicalScore}%</span>
                                    </div>
                                    {/* Confidence score badge */}
                                    <div className="px-3 py-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Conf</span>
                                        <span className="text-sm font-black text-blue-400">{q.confidenceScore}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* User Submission */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-violet-300 uppercase tracking-widest block">
                                    Your Submission
                                </label>
                                <div className="bg-[#0d0d1f] border border-violet-800/30 rounded-xl overflow-hidden">

                                    {/* Code submission */}
                                    {q.userSubmittedCode && q.userSubmittedCode !== 'undefined' && (
                                        <div className="p-4 border-b border-violet-800/20">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Code</span>
                                            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto">
                                                {q.userSubmittedCode}
                                            </pre>
                                        </div>
                                    )}

                                    {/* Transcript */}
                                    {q.userAnswerText && (
                                        <div className="p-4">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Transcript</span>
                                            <p className="text-sm text-slate-400 italic leading-relaxed">
                                                "{q.userAnswerText}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Nothing submitted */}
                                    {(!q.userSubmittedCode || q.userSubmittedCode === 'undefined') && !q.userAnswerText && (
                                        <div className="p-6 text-center text-slate-500 text-xs italic">
                                            No answer recorded.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* AI Feedback + Ideal Answer */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-violet-800/20">

                                {/* AI Feedback */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-violet-300 uppercase tracking-widest block">
                                        AI Analytical Feedback
                                    </label>
                                    <div className="bg-violet-900/20 border-l-4 border-violet-500 p-4 rounded-xl text-sm text-slate-300 italic leading-relaxed">
                                        "{q.aiFeedback}"
                                    </div>
                                </div>

                                {/* Ideal Answer */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-violet-300 uppercase tracking-widest block">
                                        Ideal Implementation
                                    </label>
                                    <pre className="bg-[#0d0d1f] border border-violet-800/30 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                                        {formatIdealAnswer(q.idealAnswer)}
                                    </pre>
                                </div>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SessionReview;