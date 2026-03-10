import '../registry/tokens/global.css';
import '../registry/tokens/semantic.css';
import type { Preview } from '@storybook/react';

// ─── Dev logger ───────────────────────────────────────────────────────────────
// POSTs to log-server.js (npm run logs). Silently no-ops if server isn't running.

function sendLog(level: 'info' | 'error' | 'warn', message: string) {
  fetch('http://localhost:7777/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message }),
  }).catch(() => { /* server not running — ignore */ });
}

// Capture uncaught JS errors
window.onerror = (message, source, lineno, colno, error) => {
  sendLog('error', `Uncaught error: ${message} (${source}:${lineno}:${colno})\n${error?.stack ?? ''}`);
};

// Capture unhandled promise rejections
window.onunhandledrejection = (event) => {
  const reason = event.reason instanceof Error
    ? `${event.reason.message}\n${event.reason.stack}`
    : String(event.reason);
  sendLog('error', `Unhandled rejection: ${reason}`);
};

// Forward console.error to the log server
const _consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  _consoleError(...args);
  sendLog('error', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};

// Forward console.warn to the log server
const _consoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  _consoleWarn(...args);
  sendLog('warn', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};

// ─── Storybook preview config ─────────────────────────────────────────────────

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'surface', value: '#f9fafb' },
        { name: 'dark', value: '#111827' },
      ],
    },
  },
};

export default preview;
