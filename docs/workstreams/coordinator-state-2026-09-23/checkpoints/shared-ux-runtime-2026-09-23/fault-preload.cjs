// Shared UX test harness (not app code). Preloaded with `node -r` into my own backend on 18138.
// When /private/tmp/pantopus-shared-ux-runtime/fault.json exists (one fault or an array), requests whose method+path match get
// the configured status/body before any app route runs. Delete the file to turn the fault off.
const fs = require('fs');
const Module = require('module');
const CONTROL = '/private/tmp/pantopus-shared-ux-runtime/fault.json';
const origLoad = Module._load;
let wrappedExpress = null;
Module._load = function load(request, parent, isMain) {
  const exp = origLoad.apply(this, arguments);
  if (request !== 'express' || typeof exp !== 'function') return exp;
  if (wrappedExpress) return wrappedExpress;
  let first = true;
  wrappedExpress = Object.assign(function faultExpress(...args) {
    const app = exp(...args);
    if (first) {
      first = false;
      app.use((req, res, next) => {
        let faults = null;
        try { faults = JSON.parse(fs.readFileSync(CONTROL, 'utf8')); } catch { return next(); }
        // One fault object, or an array of them.
        const list = Array.isArray(faults) ? faults : [faults];
        const f = list.find((x) => x && req.path === x.path && (!x.method || req.method === x.method));
        if (f) {
          // { delayMs } without a status slows the real route instead of replacing it.
          if (f.delayMs && !f.status) {
            console.log(`[fault] ${req.method} ${req.originalUrl} delayed ${f.delayMs}ms`);
            return setTimeout(next, f.delayMs);
          }
          console.log(`[fault] ${req.method} ${req.path} -> ${f.status}`);
          return res.status(f.status).type(f.type || 'application/json').send(f.body);
        }
        return next();
      });
    }
    return app;
  }, exp);
  return wrappedExpress;
};
