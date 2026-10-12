import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, RefreshCw, CheckCircle2, AlertCircle, 
  ExternalLink, LogIn, Key, ShieldCheck, ArrowDownToLine,
  ArrowUpFromLine, Unlink, Sparkles 
} from 'lucide-react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { 
  signInWithGoogleCalendar, 
  getGoogleCalendarToken, 
  setStoredGoogleToken,
  disconnectGoogleCalendar,
  getSyncMetadata,
  performTwoWaySync,
  pullEventsFromGoogleCalendar,
  pushTaskToGoogleCalendar,
  GOOGLE_CALENDAR_SCOPES
} from '../../lib/googleCalendarSync';
import toast from 'react-hot-toast';

export const GoogleSyncModal = ({ isOpen, onClose }) => {
  const { allTasks, addTask, updateTask } = useTasks();
  const { session, isDemoMode } = useAuth();

  const [token, setToken] = useState('');
  const [inputToken, setInputToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncType, setSyncType] = useState(''); // 'two-way' | 'pull' | 'push'
  const [syncMeta, setSyncMeta] = useState(null);
  const [syncErrors, setSyncErrors] = useState([]);

  // Check token on mount and open
  useEffect(() => {
    if (isOpen) {
      checkTokenStatus();
    }
  }, [isOpen]);

  const checkTokenStatus = async () => {
    const activeToken = await getGoogleCalendarToken();
    setToken(activeToken || '');
    setInputToken(activeToken || '');
    setSyncMeta(getSyncMetadata());
    setSyncErrors([]);
  };

  if (!isOpen) return null;

  const isConnected = Boolean(token);

  // 1. Google OAuth Flow via Supabase
  const handleConnectOAuth = async () => {
    try {
      await signInWithGoogleCalendar();
    } catch (err) {
      toast.error('Google OAuth failed: ' + err.message);
    }
  };

  // 2. Save Custom/Manual Token
  const handleSaveManualToken = () => {
    if (!inputToken.trim()) {
      toast.error('Please enter a valid Google OAuth token.');
      return;
    }
    setStoredGoogleToken(inputToken.trim());
    setToken(inputToken.trim());
    setShowTokenInput(false);
  };

  // 3. Disconnect
  const handleDisconnect = () => {
    disconnectGoogleCalendar();
    setToken('');
    setInputToken('');
    setSyncMeta(null);
  };

  // 4. Perform 2-Way Sync
  const handleTwoWaySync = async () => {
    if (!token) {
      toast.error('Please connect your Google account or enter a valid OAuth token first.');
      return;
    }
    setSyncing(true);
    setSyncType('two-way');
    setSyncErrors([]);

    try {
      const result = await performTwoWaySync({
        tasks: allTasks,
        addTask,
        updateTask,
        token
      });

      setSyncMeta(result);
      if (result.errors && result.errors.length > 0) {
        setSyncErrors(result.errors);
        toast(`Sync finished with ${result.errors.length} notice(s). Pulled: ${result.pulled}, Pushed: ${result.pushed}`);
      } else {
        toast.success(`🎉 2-Way Sync complete! Pulled: ${result.pulled}, Pushed: ${result.pushed}`);
      }
    } catch (err) {
      console.error('[GoogleSyncModal] Sync error:', err);
      toast.error('Sync failed: ' + err.message);
      setSyncErrors([err.message]);
    } finally {
      setSyncing(false);
      setSyncType('');
    }
  };

  // 5. Pull from Google Only
  const handlePullOnly = async () => {
    if (!token) {
      toast.error('Please connect your Google account or enter a valid OAuth token first.');
      return;
    }
    setSyncing(true);
    setSyncType('pull');
    setSyncErrors([]);

    try {
      const googleEvents = await pullEventsFromGoogleCalendar(token);
      let pulledCount = 0;

      for (const gEvent of googleEvents) {
        const existing = allTasks.find(
          t => (t.google_event_id && t.google_event_id === gEvent.google_event_id) ||
               (gEvent.linked_task_id && t.id === gEvent.linked_task_id)
        );

        if (existing) {
          await updateTask(existing.id, {
            due_date: gEvent.due_date,
            title: gEvent.title,
            google_event_id: gEvent.google_event_id
          });
          pulledCount++;
        } else {
          await addTask({
            title: gEvent.title,
            description: gEvent.description ? `${gEvent.description}\n(From Google Calendar)` : 'From Google Calendar',
            due_date: gEvent.due_date,
            google_event_id: gEvent.google_event_id
          });
          pulledCount++;
        }
      }

      toast.success(`Fetched ${googleEvents.length} events from Google Calendar (${pulledCount} imported/updated).`);
      checkTokenStatus();
    } catch (err) {
      console.error('[GoogleSyncModal] Pull error:', err);
      toast.error('Pull failed: ' + err.message);
      setSyncErrors([err.message]);
    } finally {
      setSyncing(false);
      setSyncType('');
    }
  };

  // 6. Push to Google Only
  const handlePushOnly = async () => {
    if (!token) {
      toast.error('Please connect your Google account or enter a valid OAuth token first.');
      return;
    }
    setSyncing(true);
    setSyncType('push');
    setSyncErrors([]);

    try {
      const tasksWithDate = allTasks.filter(t => Boolean(t.due_date));
      let pushedCount = 0;
      const errors = [];

      for (const t of tasksWithDate) {
        try {
          const res = await pushTaskToGoogleCalendar(t, token);
          if (res.success && res.eventId && res.eventId !== t.google_event_id) {
            await updateTask(t.id, { google_event_id: res.eventId });
          }
          pushedCount++;
        } catch (pushErr) {
          errors.push(`Error for "${t.title}": ${pushErr.message}`);
        }
      }

      if (errors.length > 0) {
        setSyncErrors(errors);
        toast(`Pushed ${pushedCount} tasks with ${errors.length} warnings.`);
      } else {
        toast.success(`Successfully pushed ${pushedCount} tasks to Google Calendar!`);
      }
      checkTokenStatus();
    } catch (err) {
      console.error('[GoogleSyncModal] Push error:', err);
      toast.error('Push failed: ' + err.message);
      setSyncErrors([err.message]);
    } finally {
      setSyncing(false);
      setSyncType('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#18181c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Google Calendar 2-Way Sync</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                  isConnected 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Synchronize your scheduled tasks with Google Calendar in real time
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          
          {/* Connection Status Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#18181c]/60 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">OAuth Scopes & Permissions</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Requires <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">calendar.events</code> and <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">calendar.readonly</code>
                </p>
              </div>

              {isConnected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 text-xs font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              )}
            </div>

            {/* OAuth Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConnectOAuth}
                className="flex-1 min-w-[180px] py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isConnected ? 'Re-authenticate with Google' : 'Sign in with Google OAuth'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="py-2 px-3 bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Enter OAuth Access Token directly"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{showTokenInput ? 'Hide Token Input' : 'Direct Token'}</span>
              </button>
            </div>

            {/* Manual Token Input (for testing / direct tokens) */}
            {showTokenInput && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                  Paste Google OAuth Bearer Token (Optional / Testing):
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="ya29.a0AfH6SM..."
                    className="flex-1 bg-white dark:bg-[#141416] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveManualToken}
                    className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sync Operations */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Synchronization Actions
            </span>

            {/* Main 2-Way Sync Button */}
            <button
              type="button"
              onClick={handleTwoWaySync}
              disabled={syncing || !isConnected}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 shadow-md transition-all ${
                isConnected
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white cursor-pointer active:scale-[0.99]'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${syncing && syncType === 'two-way' ? 'animate-spin' : ''}`} />
              <span>
                {syncing && syncType === 'two-way' ? 'Syncing with Google Calendar...' : 'Full 2-Way Sync (Push & Pull)'}
              </span>
            </button>

            {/* Separate Push / Pull Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handlePullOnly}
                disabled={syncing || !isConnected}
                className="py-2.5 px-3 bg-white dark:bg-[#18181c] border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownToLine className={`w-3.5 h-3.5 text-blue-500 ${syncing && syncType === 'pull' ? 'animate-bounce' : ''}`} />
                <span>Pull from Google</span>
              </button>

              <button
                type="button"
                onClick={handlePushOnly}
                disabled={syncing || !isConnected}
                className="py-2.5 px-3 bg-white dark:bg-[#18181c] border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 dark:hover:border-purple-500/50 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpFromLine className={`w-3.5 h-3.5 text-purple-500 ${syncing && syncType === 'push' ? 'animate-bounce' : ''}`} />
                <span>Push to Google</span>
              </button>
            </div>
          </div>

          {/* Sync Stats / Metadata */}
          {syncMeta && (
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-[#141417] border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Last Synced:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {syncMeta.lastSyncTime ? new Date(syncMeta.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Pulled from Google:</span>
                <span className="font-semibold text-blue-500">{syncMeta.pulled || 0} events</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Pushed to Google:</span>
                <span className="font-semibold text-purple-500">{syncMeta.pushed || 0} tasks</span>
              </div>
            </div>
          )}

          {/* Sync Warnings / Errors */}
          {syncErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Sync Notifications</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 opacity-90 max-h-24 overflow-y-auto">
                {syncErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#18181c] flex items-center justify-between">
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-medium text-slate-500 hover:text-blue-500 flex items-center gap-1 transition-colors"
          >
            <span>Open Google Calendar</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
