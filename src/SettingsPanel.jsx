import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Key, Check, Shield } from 'lucide-react';

const safeLocalStorage = {
  getItem: (key, defaultValue = "") => {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // absorb browser sandbox storage blocks
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // absorb
    }
  }
};

// ─── Encrypted Storage (mirrors App.jsx crypto helpers) ───────────────────────
const CRYPTO_SALT = 'cadence-reading-assistant-v1';

async function deriveEncryptionKey() {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    CRYPTO_SALT
  ].join('|');
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(fingerprint), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode(CRYPTO_SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptValue(plaintext) {
  try {
    const key = await deriveEncryptionKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, encoder.encode(plaintext)
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    return null;
  }
}

async function decryptValue(cipherBase64) {
  try {
    const key = await deriveEncryptionKey();
    const combined = Uint8Array.from(atob(cipherBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, data
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return null;
  }
}

// Mask API key: show only last 4 characters
function maskKey(key) {
  if (!key || key.length <= 4) return key;
  return '•'.repeat(key.length - 4) + key.slice(-4);
}

export default function SettingsPanel({ isOpen, onClose, onSaveKey }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load the decrypted key when the panel opens
  useEffect(() => {
    if (!isOpen) return;
    setShowKey(false);
    setIsSaved(false);
    (async () => {
      setIsLoading(true);
      // Try encrypted key first
      const encrypted = safeLocalStorage.getItem('sarvam_api_key_enc');
      if (encrypted) {
        const decrypted = await decryptValue(encrypted);
        if (decrypted) { setApiKey(decrypted); setIsLoading(false); return; }
      }
      // Fallback to legacy plain-text key
      const legacy = safeLocalStorage.getItem('sarvam_api_key') || safeLocalStorage.getItem('pra-sarvam-key');
      if (legacy) setApiKey(legacy);
      setIsLoading(false);
    })();
  }, [isOpen]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    // Encrypt and store
    const enc = await encryptValue(apiKey.trim());
    if (enc) {
      safeLocalStorage.setItem('sarvam_api_key_enc', enc);
      // Clear any legacy plain-text keys
      safeLocalStorage.removeItem('sarvam_api_key');
      safeLocalStorage.removeItem('pra-sarvam-key');
    }
    onSaveKey(apiKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm transition-all animate-fade-in">
      <div className="bg-[#fdfbf9] dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl border border-gray-200/60 dark:border-slate-700/60 p-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Preferences</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sarvam AI API Key</label>
            <div className="flex items-center gap-1.5 mb-3">
              <Shield size={12} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Encrypted with AES-256 before storage. Never visible in plain text.
              </p>
            </div>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-gray-400"><Key size={16} /></div>
              <input
                type={showKey ? 'text' : 'password'}
                value={isLoading ? '' : apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isLoading ? 'Decrypting...' : 'Paste your API key here...'}
                disabled={isLoading}
                className="w-full pl-10 pr-12 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-800/20 dark:focus:ring-slate-400/30 focus:border-slate-800 dark:focus:border-slate-400 transition-all disabled:opacity-50"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 p-1 text-gray-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {apiKey && !showKey && (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 font-mono tracking-wider">
                Stored as: {maskKey(apiKey)}
              </p>
            )}
          </div>
          <button 
            onClick={handleSave} 
            disabled={isLoading || !apiKey.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-500 hover:scale-[1.02] transition-all duration-300 shadow-sm disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSaved ? <Check size={16} /> : <Shield size={16} />}
            {isSaved ? "Encrypted & Saved" : "Encrypt & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
