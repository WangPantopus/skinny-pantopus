// Readiness includes the database; the root route is only a liveness response.
const http = require('node:http');
const request = http.get('http://127.0.0.1:8000/health', { timeout: 4000 }, (response) => {
  response.resume();
  process.exitCode = response.statusCode === 200 ? 0 : 1;
});
request.on('timeout', () => request.destroy(new Error('Readiness timed out')));
request.on('error', () => { process.exitCode = 1; });
