// ============================================================
// Provider response bodies, read within a deadline and up to a byte ceiling.
//
// Node's fetch has no size limit, and its own body timeout is 300 s between
// chunks: a provider that stalls mid-body, or sends far more than an answer
// ever holds, keeps the request (and its memory) that long. Callers keep their
// AbortController's timer running until the body is read, so one deadline
// covers the connection, the headers and the whole body; this reads the body
// up to `maxBytes` and cancels the rest.
//
// The reader watches the signal itself: an abort passed to fetch doesn't
// reliably end a body read already waiting (a stalled NOAA answer stayed open
// 148 s past its 5 s deadline), so it cancels the read on its own.
// ============================================================

function tooLarge(maxBytes) {
  return Object.assign(new Error(`Response body over ${maxBytes} bytes`), { code: 'RESPONSE_TOO_LARGE' });
}

async function readCappedText(response, maxBytes, signal) {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw tooLarge(maxBytes);
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  // Cancelling closes the connection and ends a read that's waiting on it.
  const cancel = (reason) => { reader.cancel(reason).catch(() => {}); };
  const onAbort = () => cancel(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      if (signal?.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (signal?.aborted) throw signal.reason;
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw tooLarge(maxBytes);
      chunks.push(value);
    }
  } catch (err) {
    cancel(err);
    throw err;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  // TextDecoder drops a leading BOM, as Response.text() does.
  return new TextDecoder().decode(Buffer.concat(chunks, size));
}

async function readCappedJson(response, maxBytes, signal) {
  return JSON.parse(await readCappedText(response, maxBytes, signal));
}

module.exports = { readCappedText, readCappedJson };
