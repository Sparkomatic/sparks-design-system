// Local development log server for the Sparks Design System
// Run with: npm run logs
// Writes Storybook browser errors to storybook.log

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 7777;
const LOG_FILE = path.join(__dirname, 'storybook.log');

// Clear log file on startup
fs.writeFileSync(LOG_FILE, `=== Storybook log started ${new Date().toISOString()} ===\n`);

const server = http.createServer((req, res) => {
  // CORS headers so the Storybook browser can reach us
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { level, message } = JSON.parse(body);
        const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
        fs.appendFileSync(LOG_FILE, line);
        process.stdout.write(line);
      } catch {
        // ignore malformed
      }
      res.writeHead(200);
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Log server running on http://localhost:${PORT}`);
  console.log(`Writing to: ${LOG_FILE}`);
});
