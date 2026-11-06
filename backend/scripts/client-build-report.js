#!/usr/bin/env node
// Counts which builds are asking, from the server's request log, so the founder can decide when old store builds get
// the new record words (provider replacement, decision D11). Reads log lines on stdin and prints counts only.
//   docker logs <api container> 2>&1 | node backend/scripts/client-build-report.js
// Add Home's share is POST /api/homes/property-suggestions, asked once when the details step opens. A bare "android" and
// "(none)" are old builds (web has sent its build since November 2026; iOS has always sent its version).
const readline = require('readline');

const ADD_HOME = 'POST /api/homes/property-suggestions';
const all = new Map();
const addHome = new Map();
const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

function print(title, counts) {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  console.log(`${title}: ${total}`);
  for (const [build, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${build.padEnd(28)} ${String(n).padStart(8)}  ${((100 * n) / total).toFixed(1)}%`);
  }
}

const lines = readline.createInterface({ input: process.stdin });
lines.on('line', (line) => {
  const match = /\[info\]: (GET|POST|PUT|PATCH|DELETE|HEAD) (\S+)/.exec(line);
  if (!match) return;
  const build = /"client":"([^"]+)"/.exec(line)?.[1] || '(none)';
  bump(all, build);
  if (`${match[1]} ${match[2]}` === ADD_HOME) bump(addHome, build);
});
lines.on('close', () => {
  print('All requests', all);
  print('Add Home details', addHome);
});
