import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function AuthForm({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setEmailSentNotice(false);

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase credentials not configured yet. Add your URL and anon key to .env');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const trimmedName = name.trim().slice(0, 30);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: trimmedName ? { display_name: trimmedName } : {}
          }
        });
        if (error) throw error;

        // Amendment 6: Handle signUp returning no session (email confirmation on)
        if (!data.session) {
          setEmailSentNotice(true);
        } else {
          onAuthSuccess(data.session);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        onAuthSuccess(data.session);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto px-4 py-8">
      {/* Decorative tape on top of index card */}
      <div className="relative">
        <div className="w-28 h-7 mx-auto -mb-3 bg-tape-mustard torn-tape tape-shadow transform -rotate-1 z-10 relative flex items-center justify-center">
          <span className="font-hand text-sm font-bold text-kraft-dark/80 tracking-wide">
            TaskTape
          </span>
        </div>

        {/* Index card container */}
        <div className="bg-kraft-card/90 rounded-xl p-6 shadow-md border border-kraft-border/60">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold font-sans text-kraft-dark">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-kraft-dark/70 font-sans mt-1">
              {isSignUp ? 'Stick your tasks anywhere' : 'Sign in to access your taped tasks'}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-4 p-3 rounded-lg bg-amber-100 border border-amber-300 text-xs text-amber-900 font-sans">
              <strong>Local Setup Note:</strong> Set your real <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> to connect your database.
            </div>
          )}

          {emailSentNotice ? (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-300 text-center font-sans space-y-2">
              <div className="text-emerald-800 font-bold text-sm">Check your email</div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                We sent a confirmation link to <strong>{email}</strong>. Once confirmed, you can sign in to your board!
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmailSentNotice(false);
                  setIsSignUp(false);
                }}
                className="mt-2 text-xs font-semibold text-emerald-900 underline underline-offset-2 hover:text-emerald-950"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 font-sans">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold text-kraft-dark uppercase tracking-wider mb-1">
                    Name <span className="text-[11px] font-normal text-kraft-dark/60">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Taylor"
                    autoComplete="name"
                    className="w-full text-[16px] px-3.5 py-2.5 rounded-lg bg-white/90 border border-kraft-border/70 text-kraft-dark placeholder:text-kraft-dark/40 focus:outline-none focus:ring-2 focus:ring-kraft-dark/40 shadow-inner"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-kraft-dark uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full text-[16px] px-3.5 py-2.5 rounded-lg bg-white/90 border border-kraft-border/70 text-kraft-dark placeholder:text-kraft-dark/40 focus:outline-none focus:ring-2 focus:ring-kraft-dark/40 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-kraft-dark uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="w-full text-[16px] px-3.5 py-2.5 rounded-lg bg-white/90 border border-kraft-border/70 text-kraft-dark placeholder:text-kraft-dark/40 focus:outline-none focus:ring-2 focus:ring-kraft-dark/40 shadow-inner"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-md bg-tape-red/80 border border-red-300 text-xs font-semibold text-red-950">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-kraft-dark text-tape-cream font-bold text-sm rounded-lg shadow-sm hover:bg-kraft-dark/90 active:scale-98 transition-all disabled:opacity-50"
              >
                {loading
                  ? 'Please wait...'
                  : isSignUp
                  ? 'Sign Up with Email'
                  : 'Sign In'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg('');
                    setEmailSentNotice(false);
                    setName('');
                  }}
                  className="text-xs text-kraft-dark/75 hover:text-kraft-dark font-medium underline underline-offset-2"
                >
                  {isSignUp
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
