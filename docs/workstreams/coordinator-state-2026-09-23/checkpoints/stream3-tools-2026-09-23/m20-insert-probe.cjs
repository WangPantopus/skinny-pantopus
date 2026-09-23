// Replays the invoice_received insert shape (with `data`) and prints only the PostgREST error.
const fs = require('fs');
const src = JSON.parse(fs.readFileSync('/private/tmp/pantopus-stream3-20260920-r1/transient-private-api-launch.json', 'utf8'));
for (const [k, v] of Object.entries(src.env || {})) if (!(k in process.env)) process.env[k] = v;
process.chdir('/private/tmp/pantopus-stream3-work/backend');
const supabaseAdmin = require('/private/tmp/pantopus-stream3-work/backend/config/supabaseAdmin');
(async () => {
  const { data, error } = await supabaseAdmin.from('Notification').insert({
    user_id: 'd3671605-b8cc-4e92-8c82-99aa5041ff48', type: 'invoice_received', title: 'probe', body: 'probe',
    data: { invoice_id: 'probe' },
  });
  console.log(JSON.stringify({ inserted: !!data, code: error && error.code, message: error && error.message }));
  process.exit(0);
})();
