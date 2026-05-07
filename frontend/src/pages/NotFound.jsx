import React from 'react'
import { Link } from 'react-router-dom'

const NotFound = () => {
  return (
     <div className="text-center py-20 bg-[#120f2a] rounded-2xl border border-violet-700/30 max-w-2xl mx-auto mt-10">
      <h1 className="text-9xl font-black text-violet-900">404</h1>
      <h2 className="text-2xl font-bold text-white mt-4 uppercase tracking-tighter">Page Not Found</h2>
      <p className="text-slate-400 mt-2 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="inline-block text-white text-xs font-black uppercase tracking-widest px-8 py-3 rounded-xl no-underline hover:opacity-90 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Back to Dashboard
      </Link>
    </div>

  )
}

export default NotFound