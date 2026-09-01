const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

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
  return createClient(url, key, withNodeRealtimeTransport(options));
}

module.exports = {
  createServerSupabaseClient,
  withNodeRealtimeTransport,
};
