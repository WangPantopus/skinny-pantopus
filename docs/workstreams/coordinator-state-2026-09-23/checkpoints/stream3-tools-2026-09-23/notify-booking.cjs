// notify-booking.cjs <backendDir> <bookingId> <kind>: fire the real bookingNotifyService for one owned fixture booking (env from the private launch file; nothing secret printed).
const [backendDir, bookingId, kind] = process.argv.slice(2);
const src = require('/private/tmp/pantopus-stream3-20260920-r1/transient-private-api-launch.json');
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET', 'APP_URL', 'EMAIL_DELIVERY_MODE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'NODE_ENV', 'APP_ENV']) if (src.env[k] !== undefined) process.env[k] = src.env[k];
process.chdir(backendDir);
const supabaseAdmin = require(`${backendDir}/config/supabaseAdmin`);
const { notifyBookingEvent } = require(`${backendDir}/services/scheduling/bookingNotifyService`);
(async () => {
  const { data: booking } = await supabaseAdmin.from('Booking').select('*').eq('id', bookingId).single();
  const { data: eventType } = await supabaseAdmin.from('EventType').select('*').eq('id', booking.event_type_id).single();
  const { data: page } = await supabaseAdmin.from('BookingPage').select('*').eq('id', booking.page_id).single();
  await notifyBookingEvent({ booking, eventType, page, kind });
  console.log(JSON.stringify({ notified: bookingId, kind, at: new Date().toISOString() }));
  setTimeout(() => process.exit(0), 1500);
})().catch((e) => { console.log(JSON.stringify({ error: e.message })); process.exit(1); });
