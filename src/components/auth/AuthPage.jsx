import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BUILTIN_AVATARS } from '../../lib/avatars';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  CheckCircle2, Mail, Lock, User, Sparkles, Shield, 
  ArrowRight, Check, Eye, EyeOff, AlertTriangle, KeyRound 
} from 'lucide-react';

/**
 * AuthPage — Enterprise Authentication Interface
 * 
 * Features:
 * - Login / Signup toggle with animated tab switching
 * - Full Name + Avatar selection on signup
 * - Password visibility toggle
 * - Confirm password field on signup
 * - Password strength indicator
 * - Error display with semantic icons
 * - Demo mode fast-access button
 * - Redirect to original location after login
 */
export const AuthPage = ({ initialMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('avatar-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signIn, signUp, enableDemoMode, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Password strength calculator
  const getPasswordStrength = useCallback((pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
    if (score <= 2) return { score: 2, label: 'Fair', color: '#f97316' };
    if (score <= 3) return { score: 3, label: 'Good', color: '#eab308' };
    if (score <= 4) return { score: 4, label: 'Strong', color: '#22c55e' };
    return { score: 5, label: 'Excellent', color: '#10b981' };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!isLogin) {
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (!fullName.trim()) {
        setError('Full name is required.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName, selectedAvatarId);
      }
      // Route guard (PublicRoute) will auto-redirect to dashboard or original path
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (loginMode) => {
    setIsLogin(loginMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const passwordStrength = !isLogin ? getPasswordStrength(password) : null;

  return (
    <div className="min-h-screen w-screen bg-[#141418] text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      
      {/* Background Glow Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-purple-600/6 rounded-full blur-[80px]" />
      </div>

      <div className="w-full max-w-md bg-[#1f1f23]/95 backdrop-blur-xl text-slate-100 border border-slate-700/60 rounded-3xl p-8 shadow-2xl shadow-black/40 relative z-10">
        
        {/* Branding Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4 relative">
            <CheckCircle2 className="w-9 h-9 text-white" />
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-500 blur-md opacity-40 -z-10" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Enterprise TaskManager</h1>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
            Secure closed-team workspace with role-based access control & task delegation
          </p>
        </div>

        {/* View Toggle Tabs (/login vs /signup) */}
        <div className="flex bg-[#28292f] p-1 rounded-2xl mb-6 border border-slate-700/60">
          <button
            id="auth-tab-signin"
            type="button"
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              isLogin 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => handleModeSwitch(true)}
          >
            Sign In
          </button>
          <button
            id="auth-tab-signup"
            type="button"
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              !isLogin 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => handleModeSwitch(false)}
          >
            Create Account
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <Shield className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Full Name */}
              <div>
                <label htmlFor="auth-fullname" className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    placeholder="e.g. Ahmed Hassan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Built-in Avatar Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Choose Your Avatar</label>
                <div className="grid grid-cols-5 gap-2 p-3 rounded-xl bg-[#28292f] border border-slate-700/60">
                  {BUILTIN_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatarId(av.id)}
                      className={`relative p-1.5 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        selectedAvatarId === av.id 
                          ? 'ring-2 ring-blue-500 bg-blue-600/20 scale-110 shadow-lg shadow-blue-500/20' 
                          : 'hover:bg-slate-800 hover:scale-105'
                      }`}
                    >
                      <img src={av.url} alt={av.name} className="w-9 h-9 rounded-full" />
                      {selectedAvatarId === av.id && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="auth-email"
                type="email"
                required
                placeholder="name@team.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Meter (signup only) */}
            {!isLogin && password.length > 0 && passwordStrength && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div 
                      key={level}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: level <= passwordStrength.score 
                          ? passwordStrength.color 
                          : '#334155'
                      }}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-medium" style={{ color: passwordStrength.color }}>
                  <KeyRound className="w-3 h-3 inline mr-1" />
                  {passwordStrength.label}
                </p>
              </div>
            )}

            {!isLogin && !password && (
              <p className="text-[10px] text-slate-500 mt-1 ml-1">Minimum 6 characters</p>
            )}
          </div>

          {/* Confirm Password (signup only) */}
          {!isLogin && (
            <div>
              <label htmlFor="auth-confirm-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-12 py-2.5 bg-[#28292f] border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-all ${
                    confirmPassword && confirmPassword !== password 
                      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30' 
                      : confirmPassword && confirmPassword === password
                        ? 'border-emerald-500/60 focus:border-emerald-500 focus:ring-emerald-500/30'
                        : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/30'
                  }`}
                  autoComplete="new-password"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[10px] text-red-400 mt-1 ml-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Passwords do not match
                </p>
              )}
              {confirmPassword && confirmPassword === password && password.length >= 6 && (
                <p className="text-[10px] text-emerald-400 mt-1 ml-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Passwords match
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading || (!isLogin && confirmPassword !== password)}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2 relative overflow-hidden group"
          >
            <span className="relative z-10">
              {loading ? 'Authenticating...' : (isLogin ? 'Sign In to Workspace' : 'Create Account')}
            </span>
            {!loading && <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
            {loading && (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
          </button>
        </form>

        {/* Toggle Link */}
        <p className="text-center text-xs text-slate-400 mt-5">
          {isLogin ? (
            <>Don't have an account?{' '}
              <button 
                type="button"
                onClick={() => handleModeSwitch(false)}
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                Create one
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button 
                type="button"
                onClick={() => handleModeSwitch(true)}
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        {/* Demo Fast Access Entry */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <button
            id="auth-demo-btn"
            type="button"
            onClick={enableDemoMode}
            className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 group"
          >
            <Sparkles className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span>Try Interactive Demo (No Account Needed)</span>
          </button>
          {!isConfigured && (
            <p className="text-[10px] text-amber-500/70 text-center mt-2">
              ⚠ Supabase not configured. Using local demo mode.
            </p>
          )}
        </div>

        {/* Security Footer Badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <Shield className="w-3 h-3" />
          <span>Protected by Row Level Security (RLS)</span>
        </div>

      </div>

      {/* Footer */}
      <p className="text-[11px] text-slate-600 mt-6 relative z-10">
        Enterprise TaskManager &bull; Strict Account Isolation
      </p>
    </div>
  );
};
