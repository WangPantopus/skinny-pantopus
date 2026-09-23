// Replays the master insert shape (payload in `data`) against the local PostgREST and prints only the error code/message.
const src = require('/private/tmp/pantopus-stream3-20260920-r1/transient-private-api-launch.json');
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET']) process.env[k] = src.env[k];
process.chdir('/private/tmp/pantopus-stream3-api/backend');
const supabaseAdmin = require('/private/tmp/pantopus-stream3-api/backend/config/supabaseAdmin');
(async () => {
  const { data, error } = await supabaseAdmin.from('Notification').insert({
    user_id: 'd3671605-b8cc-4e92-8c82-99aa5041ff48', type: 'invoice_received', title: 'Invoice Received',
    body: 'probe (not delivered)', data: { invoice_id: '53186836-0ac8-43a1-8e77-6c59455cb7dd' },
  });
  console.log(JSON.stringify({ inserted: data, errorCode: error?.code ?? null, errorMessage: error?.message ?? null }));
})();
