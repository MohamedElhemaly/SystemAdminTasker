import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BUILTIN_AVATARS, getAvatarUrl } from '../../lib/avatars';
import { useNavigate } from 'react-router-dom';
import { User, Shield, X, Check, Mail, Settings, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export const ProfileSettingsModal = ({ isOpen, onClose }) => {
  const { user, profile, isDemoMode, updateProfile, userRole } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('avatar-1');
  const [saving, setSaving] = useState(false);

  // Pre-fill from current profile
  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.full_name || user?.user_metadata?.full_name || '');
      setSelectedAvatarId(profile.avatar_id || 'avatar-1');
    }
  }, [isOpen, profile, user]);

  if (!isOpen) return null;

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
        setTimeout(() => onClose(), 500);
      }
    } catch (err) {
      toast.error('Error saving profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'manager': return 'Manager (المراجع)';
      case 'sub_manager': return 'Sub-Manager (نائب المدير)';
      default: return 'Member (عضو)';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1f1f23] text-slate-100 border border-slate-700/60 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Quick Profile Edit</h2>
              <p className="text-xs text-slate-400">Update your name & avatar</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => { onClose(); navigate('/settings/profile'); }}
              className="text-slate-400 hover:text-blue-400 p-1.5 rounded-lg transition-colors" 
              title="Open full profile settings page"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Built-in 10 Avatars Selection Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Select Avatar
            </label>
            <div className="grid grid-cols-5 gap-3 p-3 rounded-2xl bg-[#28292f] border border-slate-700/60 max-h-48 overflow-y-auto">
              {BUILTIN_AVATARS.map((av) => {
                const isSelected = selectedAvatarId === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatarId(av.id)}
                    className={`relative p-1.5 rounded-2xl flex flex-col items-center transition-all ${
                      isSelected
                        ? 'bg-blue-600/30 ring-2 ring-blue-500 scale-105 shadow-lg'
                        : 'hover:bg-slate-800 hover:scale-100'
                    }`}
                  >
                    <img src={av.url} alt={av.name} className="w-10 h-10 rounded-full object-cover" />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#18181c] border border-slate-800 rounded-xl text-sm text-slate-400">
              <Mail className="w-4 h-4 text-slate-500" />
              <span>{user?.email || 'user@team.com'}</span>
            </div>
          </div>

          {/* Role (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              System Role (Managed by Admin)
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#18181c] border border-slate-800 rounded-xl text-sm text-slate-400">
              <Shield className="w-4 h-4 text-slate-500" />
              <span>{getRoleLabel(userRole)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
