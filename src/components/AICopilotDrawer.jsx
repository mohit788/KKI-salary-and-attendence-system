import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
  Zap,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Calendar,
  ExternalLink,
  RefreshCw,
  Clock,
  ShieldCheck,
  Users
} from 'lucide-react';

export default function AICopilotDrawer({
  isOpen,
  onClose,
  selectedMonth = '2026-07',
  onSelectWorker
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome_1',
      sender: 'ai',
      text: `### 👋 Namaste! Main aapka **Factory AI Copilot** hu.

Aap mujhse **attendance, worker salary breakdown, overtime rankings, factory shift rules** ya kisi bhi specific worker ke baare me pooch sakte hain.

Niche diye gaye **Quick Suggestions** me se select karein ya direct type karein:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      analysisType: 'welcome'
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Fetch smart suggestions on mount / month change
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const qMonth = selectedMonth && selectedMonth !== 'all' ? `?month=${selectedMonth}` : '';
        const res = await fetch(`/api/ai/suggestions${qMonth}`).then(r => r.json());
        if (res.success && res.suggestions) {
          setSuggestions(res.suggestions);
        }
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      }
    };
    fetchSuggestions();
  }, [selectedMonth]);

  const handleSendMessage = async (queryText = inputQuery) => {
    const query = (queryText || '').trim();
    if (!query || loading) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          month: selectedMonth || '2026-07',
          conversationHistory: messages.slice(-6)
        })
      }).then(r => r.json());

      if (res.success) {
        const aiMsg = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: res.answer,
          provider: res.provider,
          analysisType: res.analysisType,
          retrievedDocs: res.retrievedDocs,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: 'ai',
            text: `⚠️ **Error**: ${res.error || 'Unable to process query. Please try again.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'ai',
          text: `⚠️ **Network Error**: Server se connect nahi ho paya (${err.message}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'ai',
        text: `### 🔄 Chat cleared. Aap naya sawal pooch sakte hain.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Simple Markdown & Table Formatter
  const renderFormattedContent = (content) => {
    if (!content) return null;

    // Split lines to detect tables, headers, lists
    const lines = content.split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];
    let tableIndex = 0;

    const flushTable = () => {
      if (tableRows.length === 0) return;
      const header = tableRows[0];
      const rows = tableRows.slice(2); // skip separator

      elements.push(
        <div key={`table_${tableIndex++}`} className="overflow-x-auto my-3 rounded-xl border border-slate-800 bg-slate-900/90 shadow-md">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-800/80 text-amber-300 font-bold uppercase tracking-wider border-b border-slate-700">
              <tr>
                {header.map((col, idx) => (
                  <th key={idx} className="px-3 py-2 border-r border-slate-700/50 last:border-none">
                    {col.trim().replace(/\*\*/g, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-amber-500/5 transition-colors">
                  {row.map((cell, cIdx) => {
                    const val = cell.trim();
                    const workerIdMatch = val.match(/`(\d+)`/);
                    return (
                      <td key={cIdx} className="px-3 py-2 border-r border-slate-800/60 last:border-none font-mono">
                        {workerIdMatch && onSelectWorker ? (
                          <button
                            onClick={() => {
                              onSelectWorker(workerIdMatch[1]);
                              onClose();
                            }}
                            className="inline-flex items-center space-x-1 text-amber-400 hover:text-amber-300 font-bold underline decoration-amber-500/40 hover:decoration-amber-300 transition-all cursor-pointer"
                            title={`Click to view Worker #${workerIdMatch[1]} profile`}
                          >
                            <span>#{workerIdMatch[1]}</span>
                            <ExternalLink className="w-2.5 h-2.5 inline ml-0.5 opacity-70" />
                          </button>
                        ) : (
                          val.replace(/\*\*(.*?)\*\*/g, '$1')
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Check if table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cells = trimmed.split('|').slice(1, -1);
        tableRows.push(cells);
        return;
      } else if (inTable) {
        flushTable();
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-base font-extrabold text-amber-300 mt-3 mb-1.5 flex items-center space-x-1.5">
            <span>{trimmed.replace('### ', '')}</span>
          </h3>
        );
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4 key={idx} className="text-sm font-bold text-emerald-300 mt-2.5 mb-1">
            {trimmed.replace('#### ', '')}
          </h4>
        );
      } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        // Bullet point with worker clickable detection
        const rawBullet = trimmed.substring(2);
        const parts = rawBullet.split(/(\*\*.*?\*\*|`.*?`)/g);

        elements.push(
          <li key={idx} className="ml-4 list-disc text-xs text-slate-300 my-1 leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldText = part.slice(2, -2);
                const workerMatch = boldText.match(/(?:Worker|#)?\s*(\d{2,5})/i);
                if (workerMatch && onSelectWorker) {
                  return (
                    <strong
                      key={pIdx}
                      onClick={() => {
                        onSelectWorker(workerMatch[1]);
                        onClose();
                      }}
                      className="text-amber-300 cursor-pointer hover:underline font-extrabold inline-flex items-center space-x-0.5"
                      title="View Worker Profile"
                    >
                      <span>{boldText}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 inline ml-0.5" />
                    </strong>
                  );
                }
                return <strong key={pIdx} className="text-slate-100 font-bold">{boldText}</strong>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code key={pIdx} className="px-1.5 py-0.5 bg-slate-800 text-amber-300 rounded font-mono text-[11px] border border-slate-700 mx-0.5">
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </li>
        );
      } else if (trimmed === '') {
        elements.push(<div key={idx} className="h-1.5" />);
      } else {
        elements.push(
          <p key={idx} className="text-xs text-slate-300 leading-relaxed my-1">
            {trimmed}
          </p>
        );
      }
    });

    if (inTable) {
      flushTable();
    }

    return elements;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      {/* Slide-out Drawer */}
      <div className="relative w-full max-w-2xl bg-slate-950 border-l border-amber-500/20 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  Factory AI Copilot
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  RAG Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                <span>Month: <strong className="text-amber-300">{selectedMonth || '2026-07'}</strong></span>
                <span>•</span>
                <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono">Esc</kbd> to close</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearHistory}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
              title="Clear conversation history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Suggestion Chips Banner */}
        {suggestions.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center space-x-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Ask Quick:</span>
            </span>
            {suggestions.map(s => (
              <button
                key={s.id}
                onClick={() => handleSendMessage(s.query)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 border border-slate-700/80 hover:border-amber-500/40 transition-all shrink-0 cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                    isUser
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 backdrop-blur-md'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm font-medium">{msg.text}</p>
                  ) : (
                    <div>
                      {renderFormattedContent(msg.text)}

                      {/* Footer Info for AI Message */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-emerald-400/80">
                            ⚡ {msg.provider || 'Local Hybrid RAG'}
                          </span>
                          {msg.analysisType && (
                            <span className="px-1.5 py-0.2 bg-slate-800 rounded text-[10px] text-slate-400">
                              {msg.analysisType}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span>{msg.timestamp}</span>
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="p-1 hover:text-slate-300 rounded transition-colors cursor-pointer"
                            title="Copy answer"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start items-center animate-in fade-in">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-400 text-xs flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse delay-75" />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse delay-150" />
                <span className="text-slate-300 font-medium ml-1">Analyzing factory attendance & database...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 bg-slate-900/95 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask anything (e.g. Worker 415 ka salary breakdown, highest OT, CNC report)..."
              disabled={loading}
              className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 font-sans transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
            >
              <span>Ask</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
            <span>💡 Ask in <strong>Hindi, Hinglish, or English</strong></span>
            <span>Shortcut: <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">Ctrl + K</kbd></span>
          </div>
        </div>
      </div>
    </div>
  );
}
