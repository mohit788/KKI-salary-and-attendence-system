import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Smartphone,
  KeyRound,
  Lock,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Building2,
  ArrowRight,
  HelpCircle,
  FileText,
  Clock,
  Timer,
  X
} from 'lucide-react';

export default function LoginGate({ onLoginSuccess, logoutReason, onClearLogoutReason }) {
  // Mode: 'login' | 'setup-password' | 'setup-qr' | 'setup-backup' | 'backup-login'
  const [mode, setMode] = useState('login');
  const [totpConfigured, setTotpConfigured] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [activeLogoutReason, setActiveLogoutReason] = useState(
    () => logoutReason || sessionStorage.getItem('kki_logout_reason') || null
  );

  useEffect(() => {
    if (logoutReason) {
      setActiveLogoutReason(logoutReason);
    }
  }, [logoutReason]);

  const handleDismissNotice = () => {
    setActiveLogoutReason(null);
    sessionStorage.removeItem('kki_logout_reason');
    if (onClearLogoutReason) onClearLogoutReason();
  };

  // Form Fields
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');

  // Setup State
  const [setupSecret, setSetupSecret] = useState('');
  const [setupQrUrl, setSetupQrUrl] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check initial server auth status
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setInitialChecking(true);
      const res = await fetch('/api/auth/status').then(r => r.json());
      if (res && res.success) {
        if (res.isAuthenticated) {
          // Already logged in
          if (onLoginSuccess) onLoginSuccess();
          return;
        }
        setTotpConfigured(!!res.totpConfigured);
        if (!res.totpConfigured) {
          setMode('setup-password');
        } else {
          setMode('login');
        }
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    } finally {
      setInitialChecking(false);
    }
  };

  // 1. Handle Standard Login (Password + TOTP 6-digit code)
  const handleStandardLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your Master Admin Password.');
      return;
    }
    if (!totpCode.trim()) {
      setError('Please enter the 6-digit code from Google Authenticator.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password.trim(),
          totpToken: totpCode.trim(),
        })
      }).then(r => r.json());

      if (res.success) {
        if (res.requireSetup) {
          setMode('setup-qr');
          initSetup(password.trim());
        } else {
          setSuccessMsg('Authentication successful! Loading dashboard...');
          if (res.token) {
            sessionStorage.setItem('kki_auth_token', res.token);
          }
          const now = Date.now();
          sessionStorage.setItem('kki_session_start_time', String(now));
          sessionStorage.setItem('kki_session_expires_at', String(now + 30 * 60 * 1000));
          localStorage.setItem('kki_last_activity', String(now));
          sessionStorage.removeItem('kki_logout_reason');
          setTimeout(() => {
            if (onLoginSuccess) onLoginSuccess();
          }, 400);
        }
      } else {
        setError(res.error || 'Invalid password or Authenticator code.');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Emergency Backup Code Login
  const handleBackupLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your Master Admin Password.');
      return;
    }
    if (!backupCode.trim()) {
      setError('Please enter an emergency backup code (e.g. 1234-5678).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password.trim(),
          backupCode: backupCode.trim(),
        })
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(res.message || 'Logged in using recovery code!');
        if (res.token) {
          sessionStorage.setItem('kki_auth_token', res.token);
        }
        const now = Date.now();
        sessionStorage.setItem('kki_session_start_time', String(now));
        sessionStorage.setItem('kki_session_expires_at', String(now + 30 * 60 * 1000));
        localStorage.setItem('kki_last_activity', String(now));
        sessionStorage.removeItem('kki_logout_reason');
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess();
        }, 600);
      } else {
        setError(res.error || 'Invalid recovery code.');
      }
    } catch (err) {
      setError('Failed to login: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Initiate First-Time Setup
  const initSetup = async (pwd) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      }).then(r => r.json());

      if (res.success) {
        setSetupSecret(res.secret);
        setSetupQrUrl(res.qrCodeUrl);
        setMode('setup-qr');
      } else {
        setError(res.error || 'Failed to initialize 2FA setup.');
      }
    } catch (err) {
      setError('Setup failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPasswordSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the Admin Master Password.');
      return;
    }
    initSetup(password.trim());
  };

  // 4. Confirm First-Time Setup with First 6-digit Code
  const handleConfirmSetup = async (e) => {
    e.preventDefault();
    if (!setupToken.trim()) {
      setError('Please enter the 6-digit code shown in your Google Authenticator app.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/setup/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password.trim(),
          secret: setupSecret,
          token: setupToken.trim()
        })
      }).then(r => r.json());

      if (res.success) {
        setGeneratedBackupCodes(res.backupCodes || []);
        if (res.token) {
          sessionStorage.setItem('kki_auth_token', res.token);
        }
        setMode('setup-backup');
      } else {
        setError(res.error || 'Invalid 6-digit code. Please check your app and time sync.');
      }
    } catch (err) {
      setError('Failed to activate 2FA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Copy Secret Key
  const handleCopyKey = () => {
    if (!setupSecret) return;
    navigator.clipboard.writeText(setupSecret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Helper: Copy All Backup Codes
  const handleCopyBackupCodes = () => {
    const text = "KKI Attendance & Payroll System - Emergency Backup Codes:\n" +
      generatedBackupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      "\n\nEach code can be used once if you ever lose your phone.";
    navigator.clipboard.writeText(text);
    setCopiedBackupCodes(true);
    setTimeout(() => setCopiedBackupCodes(false), 2000);
  };

  // Helper: Download Backup Codes
  const handleDownloadBackupCodes = () => {
    const text = "KKI Attendance & Payroll System - Emergency Backup Codes\n" +
      "Generated on: " + new Date().toLocaleString() + "\n" +
      "---------------------------------------------------\n" +
      generatedBackupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      "\n---------------------------------------------------\n" +
      "Keep these codes in a secure location. Each code is one-time use.";
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kki-emergency-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (initialChecking) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium tracking-wide">Checking Security Status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] relative flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white overflow-hidden">
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-blue-400/40 shadow-2xl shadow-blue-500/30 mb-3 group hover:scale-105 transition-transform">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight font-display">
            KKI Management
          </h1>
          <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px] font-bold text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enterprise 2FA Protection</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Biometric Attendance, Overtime & Payroll System
          </p>
        </div>

        {/* Main Card Container */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative">

          {/* Session Expiry or Inactivity Timeout Notification Banner */}
          {activeLogoutReason && (
            <div className={`mb-6 p-4 rounded-2xl border text-left flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
              activeLogoutReason === 'inactivity'
                ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
                : activeLogoutReason === 'session_timeout'
                ? 'bg-blue-950/70 border-blue-500/60 text-blue-200'
                : 'bg-slate-800/80 border-slate-600 text-slate-300'
            }`}>
              <div className="p-2 rounded-xl bg-black/30 shrink-0 mt-0.5">
                {activeLogoutReason === 'inactivity' ? (
                  <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                ) : activeLogoutReason === 'session_timeout' ? (
                  <Timer className="w-5 h-5 text-blue-400" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>
                    {activeLogoutReason === 'inactivity'
                      ? 'Inactivity Timeout (5 Minutes)'
                      : activeLogoutReason === 'session_timeout'
                      ? 'Session Expired (30-Minute Maximum)'
                      : 'Logged Out'}
                  </span>
                </h3>
                <p className="text-xs opacity-90 leading-relaxed">
                  {activeLogoutReason === 'inactivity'
                    ? 'Your session was automatically locked after 5 minutes of no user activity to protect company records.'
                    : activeLogoutReason === 'session_timeout'
                    ? 'Your 30-minute maximum security session has ended. Please authenticate again to resume work.'
                    : 'You have been safely signed out.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismissNotice}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 text-xs shrink-0 transition-colors"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 1: Standard Login (Master Password + Google Auth OTP) */}
          {/* ========================================================= */}
          {mode === 'login' && (
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Admin Portal Login</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Enter password & 6-digit Authenticator code</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-indigo-400" />
                </div>
              </div>

              <form onSubmit={handleStandardLogin} className="space-y-4">
                {/* Master Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Admin Master Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Enter master password..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Google Authenticator 6-Digit OTP */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Google Authenticator Code
                    </label>
                    <span className="text-[11px] text-cyan-400 font-medium flex items-center gap-1">
                      <Smartphone className="w-3 h-3" /> 6-digit rolling code
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTotpCode(val);
                      setError('');
                    }}
                    placeholder="000 000"
                    className="w-full bg-slate-950 border border-indigo-500/60 rounded-xl px-4 py-2.5 text-center text-xl tracking-[0.35em] font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all font-bold"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-slate-500" />
                    Open Google Authenticator on your phone to copy code.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-medium flex items-start gap-2 animate-in shake">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Success Banner */}
                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !password || totpCode.length < 6}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Verifying Credentials...' : 'Sign In with 2FA'}</span>
                </button>

                {/* Footer Switcher */}
                <div className="pt-3 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('backup-login'); setError(''); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                  >
                    Lost access to your phone? Enter Emergency Backup Code →
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2A: First-Time Setup - Password Prompt */}
          {/* ========================================================= */}
          {mode === 'setup-password' && (
            <div>
              <div className="text-center pb-4 mb-4 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-2">
                  <QrCode className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-white">Set Up Google Authenticator</h2>
                <p className="text-xs text-slate-300 mt-1">
                  2FA is not yet active. Enter the Master Admin Password to configure your device.
                </p>
              </div>

              <form onSubmit={handleSetupPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Master Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Enter admin password (default: kki123)..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Default Initial Password: <strong className="text-amber-400 font-mono">kki123</strong>
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-600/30 border border-amber-400/50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{loading ? 'Verifying...' : 'Begin 2FA Setup'}</span>
                </button>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2B: First-Time Setup - Scan QR Code & Enter Code */}
          {/* ========================================================= */}
          {mode === 'setup-qr' && (
            <div>
              <div className="text-center pb-3 mb-3 border-b border-slate-800">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Step 1 of 2</span>
                <h2 className="text-base font-bold text-white mt-0.5">Scan QR with Google Authenticator</h2>
              </div>

              <div className="space-y-4">
                {/* QR Code Canvas */}
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-xl w-48 h-48 mx-auto border-4 border-slate-800">
                  {setupQrUrl ? (
                    <img src={setupQrUrl} alt="Google Authenticator QR Code" className="w-full h-full object-contain" />
                  ) : (
                    <RefreshCw className="w-8 h-8 text-slate-800 animate-spin" />
                  )}
                </div>

                {/* Instructions */}
                <div className="text-xs text-slate-300 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <p className="font-semibold text-white">Instructions:</p>
                  <ol className="list-decimal pl-4 space-y-0.5 text-slate-400 text-[11px]">
                    <li>Open <strong>Google Authenticator</strong> on your phone.</li>
                    <li>Tap the <strong>+</strong> button and select <strong>Scan a QR code</strong>.</li>
                    <li>Enter the 6-digit code displayed in the app below.</li>
                  </ol>
                </div>

                {/* Manual Secret Key Fallback */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="overflow-hidden mr-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Manual Secret Key</p>
                    <p className="text-xs text-amber-300 font-mono font-bold truncate select-all">{setupSecret}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1 shrink-0"
                    title="Copy Secret Key"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Form to Confirm Code */}
                <form onSubmit={handleConfirmSetup} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Enter 6-Digit Code from App
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={setupToken}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setSetupToken(val);
                        setError('');
                      }}
                      placeholder="000 000"
                      className="w-full bg-slate-950 border border-indigo-500 rounded-xl px-4 py-2.5 text-center text-xl tracking-[0.35em] font-mono text-cyan-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      autoFocus
                      required
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || setupToken.length < 6}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 border border-emerald-400/50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{loading ? 'Verifying...' : 'Activate Google Authenticator'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2C: First-Time Setup - Display Emergency Backup Codes */}
          {/* ========================================================= */}
          {mode === 'setup-backup' && (
            <div>
              <div className="text-center pb-3 mb-3 border-b border-slate-800">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Step 2 of 2</span>
                <h2 className="text-base font-bold text-white mt-0.5">Emergency Recovery Codes</h2>
                <p className="text-xs text-slate-300 mt-1">
                  Save these one-time codes in a safe place. If you ever lose your phone, use one to log in.
                </p>
              </div>

              {/* Codes Grid */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 my-3">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm text-cyan-300 font-bold">
                  {generatedBackupCodes.map((code, idx) => (
                    <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-lg py-1.5 px-3 text-center tracking-wider">
                      <span className="text-slate-500 text-[10px] mr-1.5">{idx + 1}.</span>
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Copy & Download Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={handleCopyBackupCodes}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                >
                  {copiedBackupCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBackupCodes ? 'Copied to Clipboard!' : 'Copy All Codes'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBackupCodes}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download .TXT</span>
                </button>
              </div>

              {/* Proceed Button */}
              <button
                type="button"
                onClick={() => {
                  if (onLoginSuccess) onLoginSuccess();
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/50 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>I Have Saved My Codes → Open Dashboard</span>
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 3: Emergency Backup Code Login */}
          {/* ========================================================= */}
          {mode === 'backup-login' && (
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                    <span>Emergency Recovery Login</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Use one of your 8-digit backup codes</p>
                </div>
              </div>

              <form onSubmit={handleBackupLogin} className="space-y-4">
                {/* Master Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Admin Master Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Enter master password..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Backup Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Emergency Backup Code (e.g. 1234-5678)
                  </label>
                  <input
                    type="text"
                    value={backupCode}
                    onChange={(e) => { setBackupCode(e.target.value); setError(''); }}
                    placeholder="e.g. 8421-9304"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-mono text-amber-300 tracking-widest placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-all font-bold"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Each backup code can only be used once.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !backupCode}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-600/30 border border-amber-400/50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>{loading ? 'Verifying Code...' : 'Log In with Recovery Code'}</span>
                </button>

                <div className="pt-3 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                  >
                    ← Back to Google Authenticator Login
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 mt-4">
          KKI Enterprise Payroll System &bull; Secured with RFC 6238 TOTP Two-Factor Authentication
        </p>

      </div>
    </div>
  );
}
