const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const dbTiming = require('../utils/dbTiming');

function withNodeRealtimeTransport(options = {}) {
  const realtime = options.realtime || {};
  return {
    ...options,
    realtime: {
      ...realtime,
      transport: realtime.transport || WebSocket,
    },
  };
}

function createServerSupabaseClient(url, key, options = {}) {
  const fetchRequest = options.global?.fetch || globalThis.fetch;
  dbTiming.trackConnections(url);
  return createClient(url, key, withNodeRealtimeTransport({
    ...options,
    global: {
      ...options.global,
      fetch: async (input, init = {}) => {
        const requestUrl = new URL(input instanceof Request ? input.url : input);
        // Database/auth operations must finish before the apps' normal 20s
        // request timeout. Attachments can be up to 25 MB and get more time.
        // This signal stays active while the SDK consumes the response body.
        const deadline = AbortSignal.timeout(requestUrl.pathname.includes('/storage/v1/') ? 60_000 : 10_000);
        const callerSignal = init.signal || (input instanceof Request ? input.signal : null);
        const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
        // Counted toward the request (or job) that made the call, for its log line (utils/dbTiming.js).
        const call = dbTiming.startCall(requestUrl, init.method || (input instanceof Request ? input.method : 'GET'),
          init.headers || (input instanceof Request ? input.headers : null));
        try {
          const response = await fetchRequest(input, { ...init, signal });
          dbTiming.endCall(call, response);
          return response;
        } catch (error) {
          dbTiming.endCall(call, null);
          if (deadline.aborted && !callerSignal?.aborted) {
            // PostgREST retries network errors on reads. Mark deadline expiry
            // as cancellation so it cannot start another full timeout window.
            throw new DOMException('Supabase request timed out. Please try again.', 'AbortError');
          }
          throw error;
        }
      },
    },
  }));
}

module.exports = {
  createServerSupabaseClient,
  withNodeRealtimeTransport,
};
