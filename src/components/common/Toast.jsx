import React from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export const Toast = ({ toast, onClose }) => {
  if (!toast) return null;

  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border bg-[#1f1f23] text-white border-slate-700/80 animate-in slide-in-from-bottom-5 duration-200">
      {isError ? (
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
      ) : isWarning ? (
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
      ) : (
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
      )}

      <div className="text-sm font-medium text-slate-200 max-w-sm">
        {toast.message}
      </div>

      <button
        onClick={onClose}
        className="ml-2 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
