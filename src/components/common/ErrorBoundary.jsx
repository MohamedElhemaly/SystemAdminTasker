import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught React ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-100 dark:bg-[#18181c] p-6 text-slate-900 dark:text-slate-100 select-none">
          <div className="max-w-md w-full p-6 bg-white dark:bg-[#1f1f23] border border-red-200 dark:border-red-500/40 rounded-2xl shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/40 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h2>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1 font-mono bg-red-50/50 dark:bg-slate-900/80 p-2 rounded-lg text-left overflow-x-auto max-h-28 border border-red-100 dark:border-transparent">
                {this.state.error?.toString() || 'Unexpected application error'}
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
