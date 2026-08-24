import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  MessageSquare,
  X
} from 'lucide-react';

export default function AiAssistantBar({ onRefreshData }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');

  const handleExecute = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const response = await fetch('/api/ai-assistant/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const contentType = response.headers.get('content-type') || '';
      let res;
      if (contentType.includes('application/json')) {
        res = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Server error (${response.status})`);
      }

      if (res.success) {
        setResponse(res);
        setPrompt('');
        if (onRefreshData) {
          onRefreshData(); // Automatically update all app tables & metrics!
        }
      } else {
        setError(res.error || 'Failed to execute command.');
      }
    } catch (err) {
      setError(err.message || 'Failed to communicate with AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <div className="bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900/90 border border-purple-500/30 rounded-2xl p-4 shadow-xl shadow-purple-950/30 relative overflow-hidden backdrop-blur-md">
        
        <form onSubmit={handleExecute} className="flex flex-col md:flex-row items-center gap-3">
          {/* Label */}
          <div className="flex items-center space-x-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white font-display">KKI Attendance Assistant</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  <Zap className="w-3 h-3 inline mr-0.5" /> AI Active
                </span>
              </div>
            </div>
          </div>

          {/* Input Box */}
          <div className="flex-1 w-full relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder=""
              className="w-full bg-slate-950/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 transition-all pr-10"
            />
            {prompt && (
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-2 transition-all flex-shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{loading ? 'Executing...' : 'Run Command'}</span>
          </button>
        </form>

        {/* Error Output */}
        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* AI Response Output */}
        {response && (
          <div className="mt-3 bg-slate-900/90 border border-purple-500/40 rounded-xl p-3 text-xs text-purple-200 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start space-x-2.5 flex-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="font-semibold text-white leading-relaxed">{response.reply}</p>
                {response.executionSummary && (
                  <p className="text-[10px] text-purple-300/80 font-mono">
                    Action executed: {response.executionSummary}
                  </p>
                )}
                {response.downloadUrl && (
                  <a
                    href={response.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Excel Report
                  </a>
                )}
              </div>
            </div>

            <button onClick={() => setResponse(null)} className="text-slate-400 hover:text-white flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
