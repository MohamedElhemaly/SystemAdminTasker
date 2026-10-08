import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BUILTIN_AVATARS, getAvatarUrl } from '../../lib/avatars';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  User, Shield, Check, Mail, ArrowLeft, Save, 
  Lock, Fingerprint, LogOut, Clock, Trash2,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * ProfileSettingsPage — /settings/profile
 * 
 * Isolated profile management page.
 * - Pre-fills from the authenticated user's own profile
 * - Allows updating full_name and avatar_id
 * - Email and role are read-only (managed by Supabase Auth and admin)
 * - All mutations go through AuthContext.updateProfile() → Supabase RLS
 * - Shows account isolation security notice
 */
export const ProfileSettingsPage = () => {
  const { user, profile, isDemoMode, updateProfile, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('avatar-1');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Pre-fill with current profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || user?.user_metadata?.full_name || '');
      setSelectedAvatarId(profile.avatar_id || 'avatar-1');
    }
  }, [profile, user]);

  // Track changes
  useEffect(() => {
    if (!profile) return;
    const nameChanged = fullName !== (profile.full_name || '');
    const avatarChanged = selectedAvatarId !== (profile.avatar_id || 'avatar-1');
    setHasChanges(nameChanged || avatarChanged);
    setSaveSuccess(false);
  }, [fullName, selectedAvatarId, profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setSaving(true);
    try {
      const success = await updateProfile({
        full_name: fullName.trim(),
        avatar_id: selectedAvatarId,
      });
      if (success) {
        toast.success('Profile updated successfully!');
        setSaveSuccess(true);
        setHasChanges(false);
      }
    } catch (err) {
      toast.error('Error saving profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteMyAccount = async () => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete your account? All your data will be erased and this cannot be undone.")) return;
    try {
      if (!isDemoMode) {
        const { error } = await supabase.rpc('delete_user_account', { target_user_id: user.id });
        if (error) throw error;
      }
      toast.success("Account permanently deleted.");
      await signOut();
      navigate('/login');
    } catch (err) {
      toast.error("Failed to delete account: " + err.message);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'manager': return { label: 'Manager (المراجع)', color: 'purple', bg: 'rgb(168 85 247 / 0.2)', text: 'rgb(216 180 254)', border: 'rgb(168 85 247 / 0.4)' };
      case 'sub_manager': return { label: 'Sub-Manager (نائب المدير)', color: 'indigo', bg: 'rgb(99 102 241 / 0.2)', text: 'rgb(165 180 252)', border: 'rgb(99 102 241 / 0.4)' };
      case 'deputy_manager': return { label: 'Deputy Manager (نائب)', color: 'cyan', bg: 'rgb(6 182 212 / 0.2)', text: 'rgb(103 232 249)', border: 'rgb(6 182 212 / 0.4)' };
      default: return { label: 'Member (عضو)', color: 'blue', bg: 'rgb(59 130 246 / 0.2)', text: 'rgb(147 197 253)', border: 'rgb(59 130 246 / 0.4)' };
    }
  };

  const badge = getRoleBadge(userRole);

  // Account creation date
  const accountCreated = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      })
    : null;

  return (
    <div className="min-h-screen w-screen bg-[#141418] text-slate-100 flex flex-col items-center p-4 sm:p-8 selection:bg-blue-600 selection:text-white">
      
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-3xl" />
        <div className="w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-3xl -translate-y-24" />
      </div>

      <div className="w-full max-w-2xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              id="profile-back-btn"
              onClick={() => navigate('/')}
              className="p-2 rounded-xl bg-[#1f1f23] border border-slate-800 text-slate-400 hover:text-white hover:bg-[#28292f] transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Profile Settings</h1>
              <p className="text-xs text-slate-400 mt-0.5">Manage your account details & avatar</p>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            id="profile-signout-btn"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-[#1f1f23] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          
          {/* Current Profile Preview */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#28292f] border border-slate-700/60">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-xl shadow-blue-500/20 shrink-0">
              <img 
                src={getAvatarUrl(selectedAvatarId, fullName)} 
                alt="Avatar" 
                className="w-full h-full rounded-[14px] object-cover bg-slate-800" 
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white truncate">{fullName || 'Your Name'}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400 truncate">{user?.email || 'email@team.com'}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span 
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`,
                  }}
                >
                  {badge.label}
                </span>
                {isDemoMode && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Demo Mode
                  </span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                <span className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-blue-400" />
                  Select Built-in Avatar
                </span>
              </label>
              <div className="grid grid-cols-5 gap-3 p-4 rounded-2xl bg-[#28292f] border border-slate-700/60">
                {BUILTIN_AVATARS.map((av) => {
                  const isSelected = selectedAvatarId === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatarId(av.id)}
                      className={`relative p-2 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-blue-600/25 ring-2 ring-blue-500 scale-105 shadow-lg shadow-blue-500/20'
                          : 'hover:bg-slate-800 hover:scale-102'
                      }`}
                    >
                      <img src={av.url} alt={av.name} className="w-12 h-12 rounded-full object-cover" />
                      <span className="text-[9px] text-slate-400 font-medium truncate w-full text-center">{av.name.split(' ')[0]}</span>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Name Input */}
            <div>
              <label htmlFor="profile-fullname" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  Full Name
                </span>
              </label>
              <input
                id="profile-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  Email Address (Read-only)
                </span>
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-[#18181c] border border-slate-800 rounded-xl text-sm text-slate-400">
                <Lock className="w-4 h-4 text-slate-600" />
                <span>{user?.email || 'email@team.com'}</span>
              </div>
            </div>

            {/* Role (Read-only info) */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  System Role (Managed by Admin)
                </span>
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-[#18181c] border border-slate-800 rounded-xl text-sm text-slate-400">
                <Lock className="w-4 h-4 text-slate-600" />
                <span>{badge.label}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 ml-1">
                Roles are assigned by System Managers. Contact your admin to change your role.
              </p>
            </div>

            {/* Account Info */}
            {accountCreated && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Account Created
                  </span>
                </label>
                <div className="flex items-center gap-3 px-4 py-3 bg-[#18181c] border border-slate-800 rounded-xl text-sm text-slate-400">
                  <span>{accountCreated}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                id="profile-cancel-btn"
                type="button"
                onClick={() => navigate('/')}
                className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                id="profile-save-btn"
                type="submit"
                disabled={saving || !hasChanges}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  saveSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security Info */}
        <div className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
            <Shield className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white">Account Isolation Notice</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Your profile is strictly isolated via Row Level Security (RLS). No other user can view or modify 
              your private settings. The <code className="px-1 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300">profiles</code> UPDATE 
              policy enforces <code className="px-1 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300">auth.uid() = id</code> — 
              only you can write to your own row.
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0 mt-0.5">
            <LogOut className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-red-300">Danger Zone</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed mb-3">
              Signing out will terminate your session globally. Deleting your account will permanently erase your profile and all associated data.
            </p>
            <div className="flex items-center gap-3">
              <button
                id="profile-signout-global-btn"
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all flex items-center gap-2"
              >
                Sign Out & Clear All Data
              </button>
              
              <button
                id="profile-delete-account-btn"
                onClick={handleDeleteMyAccount}
                className="px-4 py-2 rounded-xl bg-red-900/40 border border-red-500/50 text-red-300 text-xs font-semibold hover:bg-red-800/60 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
