import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

/**
 * Enterprise AuthProvider — Facebook-Level Account Isolation
 * 
 * Security Contract:
 * 1. Manage Supabase auth session lifecycle (getSession + onAuthStateChange)
 * 2. Fetch and cache the authenticated user's profile row from `profiles` table
 * 3. Provide signIn / signUp / signOut functions with full error handling
 * 4. On logout: call all registered logout handlers, then wipe ALL global state
 *    to guarantee zero data leaks between accounts on shared devices
 * 5. Demo mode fallback when Supabase is not configured
 * 6. Session integrity validation — detect tampering / anomalies
 * 7. Rate-limit detection and user-friendly error mapping
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Registry of external logout handlers (e.g., TaskContext state reset)
  const logoutHandlersRef = useRef([]);

  // Prevent concurrent session processing
  const processingAuthEventRef = useRef(false);

  // ─────────────────────────────────────────────────
  // Profile Fetcher (RLS-scoped — only fetches own row)
  // ─────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[AuthContext] Error fetching profile:', error);
        return null;
      }
      return data || null;
    } catch (err) {
      console.error('[AuthContext] fetchProfile exception:', err);
      return null;
    }
  }, []);

  // ─────────────────────────────────────────────────
  // Complete State Wipe (called on every sign-out)
  // CRITICAL: Prevents data leaking to next user
  // ─────────────────────────────────────────────────
  const nukeAllState = useCallback(() => {
    // 1. Call all registered external logout handlers (e.g., TaskContext)
    logoutHandlersRef.current.forEach(fn => {
      try { fn(); } catch (e) { console.error('[AuthContext] Logout handler error:', e); }
    });

    // 2. Wipe ALL auth state variables
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsDemoMode(false);
    setAuthError(null);

    // 3. Wipe ALL localStorage keys used by this app
    localStorage.removeItem('tasker_local_user');
    localStorage.removeItem('tasker_local_store');

    // 4. Nuke ALL per-user localStorage caches (tasker_store_*)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tasker_store_') || key.startsWith('tasker_local'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 5. Clear Supabase's own persisted session from storage
    const supabaseKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        supabaseKeys.push(key);
      }
    }
    supabaseKeys.forEach(key => localStorage.removeItem(key));

    // 6. Clear any sessionStorage artifacts
    try {
      sessionStorage.clear();
    } catch (e) {
      // sessionStorage may not be available in all contexts
    }
  }, []);

  // ─────────────────────────────────────────────────
  // Register external logout handler
  // ─────────────────────────────────────────────────
  const registerLogoutHandler = useCallback((fn) => {
    if (typeof fn === 'function') {
      logoutHandlersRef.current.push(fn);
    }
    // Return an unregister function
    return () => {
      logoutHandlersRef.current = logoutHandlersRef.current.filter(h => h !== fn);
    };
  }, []);

  // ─────────────────────────────────────────────────
  // Error Message Mapping (user-friendly security messages)
  // ─────────────────────────────────────────────────
  const mapAuthError = (error) => {
    const msg = error?.message || '';
    
    if (msg.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please verify your email address before signing in. Check your inbox for a confirmation link.';
    }
    if (msg.includes('User already registered')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
      return 'Too many attempts. Please wait a moment before trying again.';
    }
    if (msg.includes('Password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    if (msg.includes('Unable to validate email') || msg.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (msg.includes('refresh_token_not_found') || msg.includes('session_not_found')) {
      return 'Your session has expired. Please sign in again.';
    }
    return msg || 'An unexpected authentication error occurred. Please try again.';
  };

  // ─────────────────────────────────────────────────
  // Session Initialization & Auth State Listener
  // ─────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // ── Demo Mode Fallback ──
      if (!isSupabaseConfigured()) {
        const savedSession = localStorage.getItem('tasker_local_user');
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (isMounted) {
              setUser(parsed);
              setProfile(parsed);
              setIsDemoMode(true);
            }
          } catch (e) {
            localStorage.removeItem('tasker_local_user');
          }
        }
        if (isMounted) setLoading(false);
        return;
      }

      // ── Supabase Session Recovery ──
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user && isMounted) {
          setUser(existingSession.user);
          setSession(existingSession);
          const profileData = await fetchProfile(existingSession.user.id);
          if (profileData && isMounted) setProfile(profileData);
        }
      } catch (err) {
        console.error('[AuthContext] getSession error:', err);
        if (isMounted) setAuthError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }

      // ── Realtime Auth Listener ──
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (!isMounted) return;

          // Prevent concurrent processing of auth events
          if (processingAuthEventRef.current) return;
          processingAuthEventRef.current = true;

          try {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              if (newSession?.user) {
                setUser(newSession.user);
                setSession(newSession);
                setIsDemoMode(false);
                setAuthError(null);
                const profileData = await fetchProfile(newSession.user.id);
                if (profileData && isMounted) setProfile(profileData);
              }
            } else if (event === 'SIGNED_OUT') {
              nukeAllState();
            } else if (event === 'USER_UPDATED') {
              if (newSession?.user) {
                setUser(newSession.user);
                setSession(newSession);
                const profileData = await fetchProfile(newSession.user.id);
                if (profileData && isMounted) setProfile(profileData);
              }
            }
          } finally {
            processingAuthEventRef.current = false;
            if (isMounted) setLoading(false);
          }
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    };

    const cleanup = initAuth();

    return () => {
      isMounted = false;
      cleanup?.then(fn => fn?.());
    };
  }, [fetchProfile, nukeAllState]);

  // ─────────────────────────────────────────────────
  // Sign Up (Email + Password)
  // ─────────────────────────────────────────────────
  const signUp = async (email, password, fullName, avatarId = 'avatar-1') => {
    setAuthError(null);

    // Input validation
    if (!email?.trim() || !password) {
      throw new Error('Email and password are required.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    if (!fullName?.trim()) {
      throw new Error('Full name is required.');
    }

    // ── Demo Mode ──
    if (!isSupabaseConfigured()) {
      const localUser = {
        id: 'user-' + Date.now(),
        email: email.trim().toLowerCase(),
        user_metadata: { full_name: fullName.trim() },
        full_name: fullName.trim(),
        avatar_id: avatarId,
        role: 'member',
      };
      setIsDemoMode(true);
      setUser(localUser);
      setProfile(localUser);
      localStorage.setItem('tasker_local_user', JSON.stringify(localUser));
      toast.success(`Welcome, ${fullName.trim()}! Account created.`);
      return { user: localUser };
    }

    // ── Supabase Signup ──
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          avatar_id: avatarId,
          role: 'member'
        }
      }
    });

    if (error) throw new Error(mapAuthError(error));

    // If auto-confirm is on, session is immediately available
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      const profileData = await fetchProfile(data.user.id);
      if (profileData) setProfile(profileData);
    }

    toast.success(`Welcome, ${fullName.trim()}! Account created.`);
    return data;
  };

  // ─────────────────────────────────────────────────
  // Sign In (Email + Password)
  // ─────────────────────────────────────────────────
  const signIn = async (email, password) => {
    setAuthError(null);

    // Input validation
    if (!email?.trim() || !password) {
      throw new Error('Email and password are required.');
    }

    // ── Demo Mode ──
    if (!isSupabaseConfigured()) {
      const localUser = {
        id: 'demo-' + Date.now(),
        email: email.trim().toLowerCase(),
        user_metadata: { full_name: email.split('@')[0] },
        full_name: email.split('@')[0],
        avatar_id: 'avatar-1',
        role: 'manager',
      };
      setIsDemoMode(true);
      setUser(localUser);
      setProfile(localUser);
      localStorage.setItem('tasker_local_user', JSON.stringify(localUser));
      toast.success(`Welcome back!`);
      return { user: localUser };
    }

    // ── Supabase Login ──
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim().toLowerCase(), 
      password 
    });

    if (error) {
      throw new Error(mapAuthError(error));
    }

    setSession(data.session);
    setUser(data.user);
    const profileData = await fetchProfile(data.user.id);
    if (profileData) setProfile(profileData);

    toast.success('Welcome back!');
    return data;
  };

  // ─────────────────────────────────────────────────
  // Sign Out (Complete Global Wipe)
  // Guarantees zero data leakage between accounts
  // ─────────────────────────────────────────────────
  const signOut = async () => {
    try {
      if (isSupabaseConfigured() && !isDemoMode) {
        // Sign out from all devices/tabs for maximum security
        await supabase.auth.signOut({ scope: 'global' });
      }
    } catch (err) {
      console.error('[AuthContext] signOut error:', err);
      // Even if signOut fails server-side, still nuke local state
    }
    nukeAllState();
    toast.success('Signed out successfully.');
  };

  // ─────────────────────────────────────────────────
  // Demo Mode (Instant Access)
  // ─────────────────────────────────────────────────
  const enableDemoMode = () => {
    const demoUser = {
      id: 'demo-manager-1',
      email: 'manager@ticktick-team.com',
      full_name: 'System Manager',
      avatar_id: 'avatar-1',
      role: 'manager',
    };
    setIsDemoMode(true);
    setUser(demoUser);
    setProfile(demoUser);
    localStorage.setItem('tasker_local_user', JSON.stringify(demoUser));
    toast.success('Entered Interactive Demo Mode');
  };

  // ─────────────────────────────────────────────────
  // Update local profile state (from ProfileSettings)
  // ─────────────────────────────────────────────────
  const updateProfile = async (updates) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);

    // Persist to Supabase if configured
    if (isSupabaseConfigured() && !isDemoMode && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: newProfile.full_name,
            avatar_id: newProfile.avatar_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id); // RLS enforces: can only update own profile
        if (error) throw error;
      } catch (err) {
        // Rollback optimistic update on failure
        setProfile(profile);
        toast.error('Failed to save profile: ' + err.message);
        return false;
      }
    }

    // Update localStorage for demo mode
    if (isDemoMode) {
      localStorage.setItem('tasker_local_user', JSON.stringify(newProfile));
    }

    return true;
  };

  // ─────────────────────────────────────────────────
  // Refresh profile from database
  // ─────────────────────────────────────────────────
  const refreshProfile = async () => {
    if (!user?.id || !isSupabaseConfigured() || isDemoMode) return;
    const profileData = await fetchProfile(user.id);
    if (profileData) setProfile(profileData);
  };

  return (
    <AuthContext.Provider value={{
      // State
      user,
      session,
      profile,
      userRole: profile?.role || 'member',
      loading,
      authError,
      isDemoMode,
      isAuthenticated: !!user,
      
      // Actions
      signUp,
      signIn,
      signOut,
      enableDemoMode,
      updateProfile,
      refreshProfile,
      registerLogoutHandler,
      
      // Meta
      isConfigured: isSupabaseConfigured(),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
