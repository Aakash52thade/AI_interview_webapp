import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useUser } from '@clerk/clerk-react'
import { toast } from 'react-toastify'
import { updateProfile, reset } from '../features/auth/authSlice'

const ROLES = [
  "MERN Stack Developer", "MEAN Stack Developer", "Full Stack Python",
  "Full Stack Java", "Frontend Developer", "Backend Developer",
  "Data Scientist", "Data Analyst", "Machine Learning Engineer",
  "DevOps Engineer", "Cloud Engineer (AWS/Azure/GCP)", "Cybersecurity Engineer",
  "Blockchain Developer", "Mobile Developer (iOS/Android)", "Game Developer",
  "UI/UX Designer", "QA Automation Engineer", "Product Manager"
];

// ── Shared input style ────────────────────────────────────────────────────────
const inputClass = "w-full bg-[#1e1535] border-2 border-violet-700/30 rounded-xl p-3.5 font-semibold text-white text-sm transition-all focus:border-violet-500 focus:outline-none placeholder-slate-500";

const Profile = () => {
  const dispatch = useDispatch();

  // Clerk gives us the email — we can't change it here
  const { user: clerkUser } = useUser();

  // MongoDB profile from Redux
  const { user, isSuccess, isError, message, isProfileLoading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    preferredRole: ROLES[0],
  });

  // ── When MongoDB profile loads, fill the form ─────────────────────────────
  useEffect(() => {
    if (user) {
      setFormData({
        name: user?.name || clerkUser?.firstName || '',
        // Email always comes from Clerk — it's the source of truth
        email: clerkUser?.emailAddresses[0]?.emailAddress || '',
        preferredRole: user?.preferredRole || ROLES[0],
      });
    }
  }, [user, clerkUser]);

  // ── Show toast on success or error ───────────────────────────────────────
  useEffect(() => {
    if (!isError && !isSuccess) return;
    if (isError) toast.error(message);
    if (isSuccess) toast.success('Profile updated successfully!');
    dispatch(reset());
  }, [isError, isSuccess, message, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Don't save if nothing changed
    if (formData.name === user?.name && formData.preferredRole === user?.preferredRole) {
      toast.info('No changes to save.');
      return;
    }
    dispatch(updateProfile({ name: formData.name, preferredRole: formData.preferredRole }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
      <div className="rounded-2xl border border-violet-700/30 bg-[#120f2a] overflow-hidden">

        {/* ── Card Header ── */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-violet-700/30 bg-[#1a1035]">
          <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-violet-400 to-blue-400" />
          <div>
            <h1 className="text-white font-black text-lg">Edit Profile</h1>
            <p className="text-slate-400 text-xs mt-0.5">Update your professional details and preferences</p>
          </div>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Full Name */}
          <FormField label="Full Name">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              className={inputClass}
            />
          </FormField>

          {/* Email — disabled, managed by Clerk */}
          <FormField label="Email Address (Managed by Clerk)" muted>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full bg-[#0d0d1f] border-2 border-violet-900/30 rounded-xl p-3.5 font-semibold text-slate-500 text-sm cursor-not-allowed"
            />
          </FormField>

          {/* Target Role */}
          <FormField label="Target Role">
            <div className="relative">
              <select
                name="preferredRole"
                value={formData.preferredRole}
                onChange={handleChange}
                className={`${inputClass} appearance-none cursor-pointer`}
              >
                {ROLES.map(role => (
                  <option key={role} value={role} className="bg-[#1e1535]">{role}</option>
                ))}
              </select>
              {/* Dropdown arrow */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-violet-400">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </div>
          </FormField>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isProfileLoading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] border-none
                ${isProfileLoading
                  ? 'bg-violet-900/30 text-violet-500 cursor-wait'
                  : 'text-white cursor-pointer hover:opacity-90'}`}
              style={!isProfileLoading ? {
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                boxShadow: '0 4px 14px rgba(124,58,237,0.4)'
              } : {}}
            >
              {isProfileLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-violet-400 border-t-transparent animate-spin rounded-full" />
                  Saving...
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;

// ── Reusable FormField wrapper ────────────────────────────────────────────────
function FormField({ label, children, muted }) {
  return (
    <div className={`space-y-1.5 ${muted ? 'opacity-50' : ''}`}>
      <label className="block text-xs font-bold text-violet-300 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}