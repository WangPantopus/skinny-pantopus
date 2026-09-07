const fs = require('node:fs');
try {
  const age = Date.now() - fs.statSync('/tmp/pantopus-worker-ready').mtimeMs;
  process.exitCode = age < 30000 ? 0 : 1;
} catch {
  process.exitCode = 1;
}
