import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { FileSpreadsheet, Upload, Download, Trash2, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export const TaskAttachmentsSection = ({ task }) => {
  const { addAttachment } = useTasks();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['xlsx', 'xls', 'csv'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    // Strict Client-side Excel & CSV Validation
    if (!allowedExtensions.includes(fileExt)) {
      toast.error(`Security Violation: "${file.name}" rejected! Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed.`);
      return;
    }

    setUploading(true);
    await addAttachment(task.id, file);
    setUploading(false);
  };

  const attachments = task.task_attachments || [];

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Excel Task Attachments ({attachments.length})</span>
        </div>

        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium cursor-pointer transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50">
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'Uploading...' : 'Attach Excel'}</span>
          <input
            type="file"
            accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Storage Restriction: Only Excel spreadsheets (.xlsx, .xls) and CSV files are accepted.</span>
      </div>

      {/* Attachments List */}
      <div className="space-y-1.5">
        {attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#28292f] border border-slate-700/60 hover:border-emerald-500/40 transition-all text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-medium text-slate-200 block truncate">{att.file_name}</span>
                <span className="text-[10px] text-slate-400">
                  {att.file_size ? `${Math.round(att.file_size / 1024)} KB` : 'Spreadsheet'}
                </span>
              </div>
            </div>

            <a
              href={att.file_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Download Excel File"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
