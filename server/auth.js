const crypto = require('crypto');
const { generateSecret, generateURI, verifySync } = require('otplib');
const qrcode = require('qrcode');
const { execute } = require('./db');

const ISSUER_NAME = 'KKI Attendance & Payroll';
const ACCOUNT_LABEL = 'Admin';
const SESSION_COOKIE_NAME = 'kki_session';

// Permanent stable Base32 Secret & Emergency Backup Codes (Protects against Render ephemeral wipes)
const DEFAULT_PERMANENT_TOTP_SECRET = 'SLFRTE6JFYKYRJV3NFPSEN7576NKOHAF';
const DEFAULT_BACKUP_CODES = [
  '1942-8371',
  '5820-4916',
  '7301-6542',
  '8492-3105',
  '6219-5840',
  '3951-7284',
  '4816-9203',
  '9035-1678'
];

// Security Policy: Forced absolute logout after 30 minutes, idle logout after 5 minutes
const FORCED_LOGOUT_MINUTES = 30; // 30 minutes absolute session lifetime
const INACTIVITY_TIMEOUT_MINUTES = 5; // 5 minutes inactivity timeout
const SESSION_MAX_AGE_MS = FORCED_LOGOUT_MINUTES * 60 * 1000; // 1,800,000 ms
const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000; // 300,000 ms
const SESSION_EXPIRY_DAYS = FORCED_LOGOUT_MINUTES / (24 * 60); // backward-compatible alias

/**
 * Fetch authentication configuration from DB
 */
async function getAuthConfig() {
  const res = await execute(
    `SELECT key, value FROM settings WHERE key IN ('master_password', 'payroll_password', 'totp_enabled', 'totp_secret', 'emergency_backup_codes')`
  );
  const cfg = {
    master_password: 'kki123',
    totp_enabled: true,
    totp_secret: DEFAULT_PERMANENT_TOTP_SECRET,
    emergency_backup_codes: []
  };

  res.rows.forEach(r => {
    if (r.key === 'master_password') cfg.master_password = r.value || 'kki123';
    else if (r.key === 'payroll_password' && (!cfg.master_password || cfg.master_password === 'kki123')) {
      cfg.master_password = r.value || 'kki123';
    } else if (r.key === 'totp_enabled') {
      cfg.totp_enabled = r.value !== 'false';
    } else if (r.key === 'totp_secret') {
      if (r.value && r.value.trim()) cfg.totp_secret = r.value.trim();
    } else if (r.key === 'emergency_backup_codes') {
      try {
        const parsed = JSON.parse(r.value || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          cfg.emergency_backup_codes = parsed;
        }
      } catch (e) {
        cfg.emergency_backup_codes = [];
      }
    }
  });

  // Ensure emergency backup codes are populated
  if (!cfg.emergency_backup_codes || cfg.emergency_backup_codes.length === 0) {
    cfg.emergency_backup_codes = DEFAULT_BACKUP_CODES.map(hashBackupCode);
  }

  // Environment Variable Overrides (Guarantees persistence across Render ephemeral container redeployments)
  if (process.env.TOTP_SECRET && process.env.TOTP_SECRET.trim()) {
    cfg.totp_secret = process.env.TOTP_SECRET.trim();
    cfg.totp_enabled = true;
  }
  if (process.env.MASTER_PASSWORD && process.env.MASTER_PASSWORD.trim()) {
    cfg.master_password = process.env.MASTER_PASSWORD.trim();
  }

  return cfg;
}

/**
 * Generate TOTP secret & QR Code Data URL (Defaults to permanent secret)
 */
async function generateTotpSetup(customSecret = null) {
  const cfg = await getAuthConfig();
  const secret = customSecret || cfg.totp_secret || DEFAULT_PERMANENT_TOTP_SECRET;
  const uri = generateURI({
    issuer: ISSUER_NAME,
    label: ACCOUNT_LABEL,
    secret: secret
  });

  const qrCodeUrl = await qrcode.toDataURL(uri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  return { secret, uri, qrCodeUrl };
}

/**
 * Verify a 6-digit TOTP token against a secret
 * window: 1 allows +/- 30s clock drift
 */
function verifyTotpToken(token, secret) {
  if (!token || !secret) return false;
  try {
    const cleanToken = String(token).replace(/\s+/g, '').trim();
    const result = verifySync({ token: cleanToken, secret, window: 1 });
    return !!(result && result.valid);
  } catch (err) {
    console.error('TOTP Verify Error:', err.message);
    return false;
  }
}

/**
 * Generate 8 human-readable emergency backup codes
 * e.g. "4921-8302"
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const part1 = Math.floor(1000 + Math.random() * 9000);
    const part2 = Math.floor(1000 + Math.random() * 9000);
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

/**
 * Hash a backup code for secure storage
 */
function hashBackupCode(code) {
  const normalized = String(code).replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verify and consume a one-time backup code
 */
async function verifyAndConsumeBackupCode(rawCode, hashedCodesList) {
  if (!rawCode || !Array.isArray(hashedCodesList)) return { valid: false, remainingCodes: hashedCodesList };
  const incomingHash = hashBackupCode(rawCode);
  const index = hashedCodesList.indexOf(incomingHash);

  if (index !== -1) {
    const remaining = [...hashedCodesList];
    remaining.splice(index, 1);
    await execute(
      `INSERT INTO settings (key, value, description) VALUES ('emergency_backup_codes', ?, 'One-time emergency backup recovery codes')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [JSON.stringify(remaining)]
    );
    return { valid: true, remainingCodes: remaining };
  }
  return { valid: false, remainingCodes: hashedCodesList };
}

/**
 * Create a new user session in SQLite with 30-min absolute expiry and inactivity tracking
 */
async function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS).toISOString();
  const lastActivityAt = createdAt;

  await execute(
    `INSERT INTO user_sessions (token, created_at, expires_at, last_activity_at) VALUES (?, ?, ?, ?)`,
    [token, createdAt, expiresAt, lastActivityAt]
  );

  return { token, createdAt, expiresAt, lastActivityAt };
}

/**
 * Validate session token checking both 30-min forced ceiling and 5-min inactivity timeout.
 * Returns { valid: boolean, reason?: 'invalid' | 'session_timeout' | 'inactivity', remainingSessionMs?: number, remainingIdleMs?: number }
 */
async function validateSession(token) {
  if (!token) return { valid: false, reason: 'invalid' };
  try {
    const res = await execute(
      `SELECT token, created_at, expires_at, last_activity_at FROM user_sessions WHERE token = ?`,
      [token]
    );
    if (!res.rows || res.rows.length === 0) {
      return { valid: false, reason: 'invalid' };
    }

    const session = res.rows[0];
    const now = Date.now();

    const parseDbDate = (val) => {
      if (!val) return null;
      if (typeof val === 'number') return val;
      const str = String(val).trim();
      if (str.includes('Z') || /[+-]\d{2}:\d{2}$/.test(str)) {
        return new Date(str).getTime();
      }
      return new Date(str.replace(' ', 'T') + 'Z').getTime();
    };

    const expiresTime = parseDbDate(session.expires_at) || (now + SESSION_MAX_AGE_MS);
    const createdAtTime = parseDbDate(session.created_at) || now;
    const lastActivityTime = parseDbDate(session.last_activity_at) || createdAtTime;

    // Check 1: 30-minute absolute forced session ceiling
    if (now >= expiresTime) {
      await destroySession(token);
      return { valid: false, reason: 'session_timeout' };
    }

    // Check 2: 5-minute idle inactivity timeout
    const idleElapsedMs = now - lastActivityTime;
    if (idleElapsedMs >= INACTIVITY_TIMEOUT_MS) {
      await destroySession(token);
      return { valid: false, reason: 'inactivity' };
    }

    // Touch last_activity_at if > 5 seconds have elapsed since last write
    if (idleElapsedMs > 5000) {
      try {
        const currentIso = new Date().toISOString();
        await execute(
          `UPDATE user_sessions SET last_activity_at = ? WHERE token = ?`,
          [currentIso, token]
        );
      } catch (err) {
        console.error('Failed to update session activity:', err.message);
      }
    }

    const remainingSessionMs = Math.max(0, expiresTime - now);
    const remainingIdleMs = Math.max(0, INACTIVITY_TIMEOUT_MS - idleElapsedMs);

    return {
      valid: true,
      remainingSessionMs,
      remainingIdleMs
    };
  } catch (err) {
    console.error('Validate session error:', err.message);
    return { valid: false, reason: 'invalid' };
  }
}

/**
 * Destroy a session (Logout)
 */
async function destroySession(token) {
  if (!token) return;
  try {
    await execute(`DELETE FROM user_sessions WHERE token = ?`, [token]);
  } catch (err) {
    console.error('Destroy session error:', err.message);
  }
}

/**
 * Extract token from request (cookies or Authorization header)
 */
function extractTokenFromReq(req) {
  // Check cookie
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }
  // Check raw cookie header if cookie-parser is not active
  if (req.headers && req.headers.cookie) {
    const match = req.headers.cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) return decodeURIComponent(match[1]);
  }
  // Check Authorization Bearer header
  const authHeader = req.headers && (req.headers.authorization || req.headers['x-auth-token']);
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) return authHeader.substring(7).trim();
    return authHeader.trim();
  }
  return null;
}

module.exports = {
  SESSION_COOKIE_NAME,
  FORCED_LOGOUT_MINUTES,
  INACTIVITY_TIMEOUT_MINUTES,
  SESSION_MAX_AGE_MS,
  INACTIVITY_TIMEOUT_MS,
  SESSION_EXPIRY_DAYS,
  DEFAULT_PERMANENT_TOTP_SECRET,
  DEFAULT_BACKUP_CODES,
  getAuthConfig,
  generateTotpSetup,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  verifyAndConsumeBackupCode,
  createSession,
  validateSession,
  destroySession,
  extractTokenFromReq
};
