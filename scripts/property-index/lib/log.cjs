'use strict';
// This repository is public, and so are its workflow logs: builds print counts through this and nothing else. A
// failure prints what kind of error it was, never the row it was reading (run() in build.cjs).

const log = (line) => console.log(`${new Date().toISOString()} ${line}`);

module.exports = { log };
