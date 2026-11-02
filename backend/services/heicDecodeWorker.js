// Decodes one HEIC photo for photoMetadata.js, in its own thread: the decoder (libheif, compiled to WebAssembly)
// blocks while it works and keeps its memory until the thread stops. Answers { width, height, data } (RGBA) or
// { error }.
const { parentPort, workerData } = require('node:worker_threads');
const decode = require('heic-decode');

decode({ buffer: workerData })
  .then(({ width, height, data }) => parentPort.postMessage({ width, height, data }, [data.buffer]))
  .catch((error) => parentPort.postMessage({ error: error.message }));
