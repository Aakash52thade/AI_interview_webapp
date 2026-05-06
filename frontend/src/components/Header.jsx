import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useClerk, useUser } from "@clerk/clerk-react"

const Header = () => {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user, isSignedIn } = useUser();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const onLogout = () => signOut(() => navigate("/"));
  const isActive = (path) => location.pathname === path;

  const userName = user?.firstName || user?.emailAddresses[0]?.emailAddress.split('@')[0] || '';

  return (
    <header className="sticky top-0 z-50 border-b border-violet-900/40"
      style={{ background: 'linear-gradient(135deg, #0d0d1f 0%, #1a1035 50%, #0d1628 100%)' }}>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-2.5 no-underline shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 16px rgba(124,58,237,0.5)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3" stroke="white" strokeWidth="1.5"/>
              <circle cx="6" cy="16" r="2" stroke="#a78bfa" strokeWidth="1.5"/>
              <circle cx="18" cy="16" r="2" stroke="#a78bfa" strokeWidth="1.5"/>
              <circle cx="12" cy="18" r="2" stroke="#60a5fa" strokeWidth="1.5"/>
              <line x1="12" y1="11" x2="6" y2="14" stroke="white" strokeWidth="1" strokeDasharray="2 1.5"/>
              <line x1="12" y1="11" x2="18" y2="14" stroke="white" strokeWidth="1" strokeDasharray="2 1.5"/>
              <line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="1" strokeDasharray="2 1.5"/>
              <circle cx="12" cy="8" r="1" fill="#a78bfa"/>
            </svg>
          </div>
          <span className="text-lg font-black tracking-tight">
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Nexus</span>
            <span className="text-white">AI</span>
          </span>
        </Link>

        {/* ── Desktop Nav ── */}
        <nav className="hidden md:flex items-center gap-7">
          {isSignedIn ? (
            <>
              <Link to="/"
                className={`text-xs font-bold uppercase tracking-widest pb-0.5 border-b-2 transition-all no-underline
                  ${isActive('/') ? 'text-violet-400 border-violet-600' : 'text-white/40 border-transparent hover:text-white'}`}>
                Dashboard
              </Link>

              <Link to="/profile"
                className={`text-xs font-bold uppercase tracking-widest pb-0.5 border-b-2 transition-all no-underline
                  ${isActive('/profile') ? 'text-violet-400 border-violet-600' : 'text-white/40 border-transparent hover:text-white'}`}>
                Profile
              </Link>

              {/* User badge */}
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-700/40 bg-violet-900/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <span className="text-xs font-bold uppercase tracking-widest text-violet-300">{userName}</span>
              </div>

              <button onClick={onLogout}
                className="text-xs font-black uppercase tracking-widest text-white px-5 py-2.5 rounded-xl border-none cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
                Sign Out
              </button>
            </>
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest text-white/30">
              Sign in to continue
            </span>
          )}
        </nav>

        {/* ── Mobile menu toggle ── */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 rounded-lg border border-violet-700/40 bg-violet-900/20 text-violet-400 cursor-pointer">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>}
          </svg>
        </button>
      </div>

      {/* ── Mobile Menu ── */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-violet-900/30" style={{ background: '#110e24' }}>
          <div className="px-6 py-8 space-y-4">
            {isSignedIn ? (
              <>
                {/* User info */}
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-violet-800/30 bg-violet-900/20 mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-sm font-black uppercase tracking-wide text-violet-300">{userName}</span>
                </div>

                <Link to="/" onClick={() => setIsMenuOpen(false)}
                  className={`block py-4 text-xl font-black uppercase tracking-widest border-b border-violet-900/30 no-underline
                    ${isActive('/') ? 'text-violet-400' : 'text-white/40'}`}>
                  Dashboard
                </Link>

                <Link to="/profile" onClick={() => setIsMenuOpen(false)}
                  className={`block py-4 text-xl font-black uppercase tracking-widest border-b border-violet-900/30 no-underline
                    ${isActive('/profile') ? 'text-violet-400' : 'text-white/40'}`}>
                  Profile
                </Link>

                <button onClick={onLogout}
                  className="w-full mt-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white border-none cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 6px 20px rgba(124,58,237,0.4)' }}>
                  Sign Out
                </button>
              </>
            ) : (
              <p className="py-4 text-lg font-bold uppercase tracking-widest text-white/25">
                Sign in to continue
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;