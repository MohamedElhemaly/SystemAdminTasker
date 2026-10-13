import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { getAvatarUrl } from '../../lib/avatars';
import { WORK_STATUSES } from '../../lib/timeTrackingHelper';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Calendar, RefreshCw, Download, 
  CheckCircle2, Clock, Users, Award, ShieldAlert, AlertCircle, TrendingUp
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfDay, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export const TeamProductivityReport = () => {
  const { isDemoMode, profile } = useAuth();
  const { allUsers = [], allTasks = [], timeLogs = [] } = useTasks();

  // Date Range State (default to last 7 days)
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Quick Preset Handlers
  const handleSetPreset = (preset) => {
    const today = new Date();
    if (preset === 'today') {
      const formatted = format(today, 'yyyy-MM-dd');
      setStartDate(formatted);
      setEndDate(formatted);
    } else if (preset === '7days') {
      setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === '30days') {
      setStartDate(format(subDays(today, 30), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    }
  };

  /**
   * Format seconds into HH:MM:SS
   */
  const formatSecondsToHMS = (totalSeconds = 0) => {
    const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remainingSecs = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(remainingSecs)}`;
  };

  /**
   * Client-side calculation fallback when in Demo mode or before SQL RPC is run
   */
  const calculateLocalProductivity = (startIso, endIso) => {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    return allUsers.map((u) => {
      // 1. Calculate Completed Tasks in Range for this user
      const completedTasks = allTasks.filter((t) => {
        if (!t.is_completed) return false;
        
        // Task date check
        const taskDate = t.updated_at || t.created_at || t.due_date;
        if (taskDate) {
          const tMs = new Date(taskDate).getTime();
          if (tMs < startMs || tMs > endMs) return false;
        }

        // Assigned check
        const isAssigned = 
          (Array.isArray(t.assigned_users) && t.assigned_users.includes(u.id)) ||
          t.assigned_to === u.id ||
          (t.task_acknowledgements || []).some(ack => ack.user_id === u.id && ack.is_acknowledged);

        return isAssigned;
      });

      // 2. Calculate Total Time Logs in Range for this user
      const userLogs = timeLogs.filter((log) => {
        if (log.user_id !== u.id && log.user_email !== u.email) return false;
        const logStart = new Date(log.start_time).getTime();
        return logStart >= startMs && logStart <= endMs;
      });

      const totalDuration = userLogs.reduce((sum, log) => sum + (Number(log.duration_seconds) || 0), 0);

      return {
        user_id: u.id,
        full_name: u.full_name || u.email?.split('@')[0] || 'Team Member',
        email: u.email,
        role: u.role || 'member',
        avatar_id: u.avatar_id,
        work_status: u.work_status || 'offline',
        completed_tasks_count: completedTasks.length,
        total_duration_seconds: totalDuration
      };
    }).sort((a, b) => b.completed_tasks_count - a.completed_tasks_count || b.total_duration_seconds - a.total_duration_seconds);
  };

  /**
   * Fetch Productivity Report from Supabase RPC with automatic fallback
   */
  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both a Start Date and an End Date.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start Date cannot be after End Date.');
      return;
    }

    setLoading(true);
    const startIso = new Date(startDate + 'T00:00:00.000Z').toISOString();
    const endIso = new Date(endDate + 'T23:59:59.999Z').toISOString();

    try {
      if (!isDemoMode && isSupabaseConfigured()) {
        const { data, error } = await supabase.rpc('get_team_productivity', {
          start_date: startIso,
          end_date: endIso
        });

        if (error) {
          console.warn('[ProductivityReport] RPC failed, using local memory fallback:', error.message);
          const fallbackData = calculateLocalProductivity(startIso, endIso);
          setReportData(fallbackData);
        } else if (data && data.length > 0) {
          // Merge avatar_id and work_status from allUsers for rich presentation
          const enrichedData = data.map((row) => {
            const userMatch = allUsers.find(u => u.id === row.user_id);
            return {
              ...row,
              avatar_id: userMatch?.avatar_id,
              email: userMatch?.email,
              work_status: userMatch?.work_status || 'offline'
            };
          });
          setReportData(enrichedData);
        } else {
          setReportData([]);
        }
      } else {
        const localData = calculateLocalProductivity(startIso, endIso);
        setReportData(localData);
      }

      setHasGenerated(true);
      toast.success('Productivity report generated successfully!');
    } catch (err) {
      console.error('Error generating report:', err);
      const fallbackData = calculateLocalProductivity(startIso, endIso);
      setReportData(fallbackData);
      setHasGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export Report to Excel (.xlsx) using xlsx library
   */
  const handleExportToExcel = () => {
    if (!reportData || reportData.length === 0) {
      toast.error('No report data available to export. Click "Generate Report" first.');
      return;
    }

    try {
      // 1. Format the data for Excel sheet
      const formattedData = reportData.map((row) => {
        const totalSecs = Number(row.total_duration_seconds) || 0;
        const totalHours = (totalSecs / 3600).toFixed(2);
        const hms = formatSecondsToHMS(totalSecs);

        return {
          'Team Member': row.full_name || 'Team Member',
          'Email': row.email || 'N/A',
          'Role': (row.role || 'member').toUpperCase(),
          'Current Status': row.work_status ? row.work_status.toUpperCase() : 'OFFLINE',
          'Completed Tasks': Number(row.completed_tasks_count) || 0,
          'Total Time (HH:MM:SS)': hms,
          'Total Time (Hours)': Number(totalHours),
          'Reporting Period': `${startDate} to ${endDate}`
        };
      });

      // 2. Create Worksheet
      const worksheet = XLSX.utils.json_to_sheet(formattedData);

      // Set column widths for clean readability
      worksheet['!cols'] = [
        { wch: 24 }, // Team Member
        { wch: 28 }, // Email
        { wch: 14 }, // Role
        { wch: 16 }, // Current Status
        { wch: 18 }, // Completed Tasks
        { wch: 22 }, // Total Time (HH:MM:SS)
        { wch: 20 }, // Total Time (Hours)
        { wch: 26 }, // Reporting Period
      ];

      // 3. Create Workbook & Append Sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Team Productivity');

      // 4. Download file
      const fileName = `Team_Productivity_${startDate}_to_${endDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`📊 Excel report exported: ${fileName}`, {
        duration: 4000
      });
    } catch (err) {
      toast.error('Failed to export Excel file: ' + err.message);
    }
  };

  // Summary Metrics
  const totalCompletedTasks = (reportData || []).reduce((sum, r) => sum + (Number(r.completed_tasks_count) || 0), 0);
  const totalSecondsLogged = (reportData || []).reduce((sum, r) => sum + (Number(r.total_duration_seconds) || 0), 0);
  const topPerformer = reportData && reportData.length > 0 ? reportData[0] : null;

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      
      {/* ── Top Header & Filter Controls ── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1f1f23] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Team Productivity & Time-Tracking Report</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aggregate completed tasks and work duration by team member for any date range, and export to Excel (.xlsx).
            </p>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleSetPreset('today')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('7days')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('month')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('30days')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Date Inputs & Action Buttons Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Start Date */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#18181c] border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* End Date */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#18181c] border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-6 flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={loading}
              className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Calculating...' : 'Generate Report'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={!hasGenerated || !reportData || reportData.length === 0}
              className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              title={hasGenerated ? 'Export to Excel (.xlsx)' : 'Generate report first'}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary KPI Cards (When Generated) ── */}
      {hasGenerated && reportData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1f1f23] border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" /> Active Members
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {reportData.length}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1f1f23] border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Completed Tasks
            </span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {totalCompletedTasks}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1f1f23] border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-500" /> Total Time Logged
            </span>
            <div className="text-xl font-mono font-extrabold text-slate-900 dark:text-white mt-1">
              {formatSecondsToHMS(totalSecondsLogged)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1f1f23] border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" /> Top Performer
            </span>
            <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
              {topPerformer && topPerformer.completed_tasks_count > 0
                ? `${topPerformer.full_name} (${topPerformer.completed_tasks_count} tasks)`
                : 'No tasks completed'}
            </div>
          </div>
        </div>
      )}

      {/* ── Data Table Preview ── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1f1f23] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <span>Productivity Preview Table</span>
            {hasGenerated && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                Period: {startDate} to {endDate}
              </span>
            )}
          </h4>

          {hasGenerated && reportData && reportData.length > 0 && (
            <button
              type="button"
              onClick={handleExportToExcel}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Download .xlsx</span>
            </button>
          )}
        </div>

        {!hasGenerated ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <Calendar className="w-8 h-8 mx-auto opacity-40 text-blue-500" />
            <p className="text-xs">Select a date range above and click <strong>"Generate Report"</strong> to calculate team productivity metrics.</p>
          </div>
        ) : reportData && reportData.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#25262e] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-bold">Team Member</th>
                  <th className="py-3 px-4 font-bold">Role</th>
                  <th className="py-3 px-4 font-bold">Current Presence</th>
                  <th className="py-3 px-4 font-bold text-center">Completed Tasks</th>
                  <th className="py-3 px-4 font-bold text-right">Time Spent (HH:MM:SS)</th>
                  <th className="py-3 px-4 font-bold text-right">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {reportData.map((row) => {
                  const totalSecs = Number(row.total_duration_seconds) || 0;
                  const hoursDecimal = (totalSecs / 3600).toFixed(2);
                  const statusObj = WORK_STATUSES[row.work_status] || WORK_STATUSES.offline;
                  const avatarUrl = getAvatarUrl(row.avatar_id, row.full_name);

                  return (
                    <tr 
                      key={row.user_id} 
                      className="hover:bg-slate-50/70 dark:hover:bg-[#25262e]/50 transition-colors"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={avatarUrl} 
                            alt={row.full_name} 
                            className="w-7 h-7 rounded-full object-cover bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" 
                          />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {row.full_name}
                            </span>
                            {row.email && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                {row.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          row.role === 'manager'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30'
                            : row.role === 'sub_manager' || row.role === 'deputy_manager'
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30'
                            : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30'
                        }`}>
                          {row.role === 'manager' ? 'Manager' : row.role === 'sub_manager' || row.role === 'deputy_manager' ? 'Sub-Mgr' : 'Member'}
                        </span>
                      </td>

                      {/* Presence Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusObj.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusObj.dotClass}`} />
                          <span>{statusObj.label}</span>
                        </span>
                      </td>

                      {/* Completed Tasks Count */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-7 px-2 py-0.5 rounded-full text-xs font-bold ${
                          row.completed_tasks_count > 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {row.completed_tasks_count}
                        </span>
                      </td>

                      {/* Total Time HMS */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatSecondsToHMS(totalSecs)}
                      </td>

                      {/* Total Hours */}
                      <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 font-mono">
                        {hoursDecimal} hrs
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs">
            No productivity data found for the selected date range.
          </div>
        )}
      </div>

    </div>
  );
};
