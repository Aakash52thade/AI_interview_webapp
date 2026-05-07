const SessionCard = ({ session, onClick, onDelete }) => {
  const isDeletable = session.status !== 'pending';

  const getIcon = () => {
    const r = session.role;
    if (r.includes('Python')) return '🐍';
    if (r.includes('MERN') || r.includes('MEAN') || r.includes('React') || r.includes('Frontend')) return '⚛️';
    if (r.includes('Data') || r.includes('Machine') || r.includes('AI')) return '📊';
    if (r.includes('DevOps') || r.includes('Cloud')) return '☁️';
    if (r.includes('Security') || r.includes('Cyber')) return '🛡️';
    if (r.includes('Blockchain') || r.includes('Web3')) return '⛓️';
    if (r.includes('Mobile') || r.includes('iOS') || r.includes('Android')) return '📱';
    if (r.includes('Game')) return '🎮';
    if (r.includes('UI') || r.includes('UX') || r.includes('Designer')) return '🎨';
    if (r.includes('QA') || r.includes('Test')) return '🧪';
    if (r.includes('Product') || r.includes('Manager')) return '📝';
    if (r.includes('Java') || r.includes('Backend')) return '☕';
    return '💻';
  };

  const statusClass = {
    completed:     'bg-emerald-400/10 text-emerald-400',
    'in-progress': 'bg-amber-400/10 text-amber-400',
    pending:       'bg-violet-400/10 text-violet-400',
    failed:        'bg-red-400/10 text-red-400',
    ending:        'bg-amber-400/10 text-amber-400',
  }[session.status] || 'bg-violet-400/10 text-violet-400';

  // fixed: was text-white/10 which was nearly invisible — now text-slate-600
  const scoreColor = session.status === 'completed'
    ? (session.overallScore > 75 ? 'text-emerald-400' : 'text-orange-400')
    : 'text-slate-600';

  const actionLabel = session.status === 'completed' ? 'Results' : 'Resume';

  return (
    <div
      onClick={() => onClick(session)}
      className="group flex flex-wrap md:flex-nowrap items-center gap-4 p-5 rounded-2xl border border-violet-800/20 bg-white/[0.02] hover:border-violet-600/40 hover:bg-violet-900/10 transition-all cursor-pointer active:scale-[0.99]"
    >
      {/* Role icon */}
      <div className="w-12 h-12 shrink-0 rounded-xl bg-violet-900/30 border border-violet-700/20 flex items-center justify-center text-2xl">
        {getIcon()}
      </div>

      {/* Role + date + level */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-bold text-base truncate group-hover:text-violet-300 transition-colors">
          {session.role}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-white/30 font-semibold">
            {new Date(session.createdAt).toLocaleDateString()}
          </span>
          <span className="text-white/15">·</span>
          <span className="text-[10px] font-bold text-violet-400 bg-violet-900/30 px-2 py-0.5 rounded-md uppercase tracking-wide">
            {session.level}
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="text-center min-w-[56px]">
        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Score</p>
        <p className={`text-2xl font-black ${scoreColor}`}>
          {session.status === 'completed' ? session.overallScore : '--'}
        </p>
      </div>

      {/* Divider */}
      <div className="hidden md:block w-px h-10 bg-violet-800/30" />

      {/* Status + action */}
      <div className="flex flex-col items-end gap-1.5">
        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${statusClass}`}>
          {session.status}
        </span>
        <span className="text-violet-400 font-bold text-xs flex items-center gap-1">
          {actionLabel}
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/>
          </svg>
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); if (isDeletable) onDelete(e, session._id); }}
        title={isDeletable ? 'Delete' : 'Cannot delete a pending session'}
        className={`p-2.5 rounded-xl border border-transparent transition-all
          ${isDeletable
            ? 'text-white/20 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 cursor-pointer'
            : 'text-white/10 cursor-not-allowed'}`}
      >
        <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  );
};

export default SessionCard;
