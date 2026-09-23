# api-launch-port.py <backendDir> <port>: like api-launch.py but on another port with cron off (second, short-lived verification API on the same owned DB).
import os, json, pathlib, sys
run = pathlib.Path(__file__).parent
src = json.loads(pathlib.Path('/private/tmp/pantopus-stream3-20260920-r1/transient-private-api-launch.json').read_text())
keep = ['APP_ENV','APP_URL','APP_URLS','AWS_EC2_METADATA_DISABLED','CSRF_SECRET','EMAIL_DELIVERY_MODE','HOME','HOST','NODE_ENV','PATH','SMTP_HOST','SMTP_PASS','SMTP_PORT','SMTP_SECURE','SMTP_USER','STEP_UP_SECRET','STRIPE_SECRET_KEY','SUPABASE_ANON_KEY','SUPABASE_JWT_SECRET','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL']
env = {k: src['env'][k] for k in keep if k in src['env']}
env['PORT'] = sys.argv[2]
env['CRON_ENABLED'] = 'false'
env['PGBOSS_ENABLED'] = 'false'
os.chdir(sys.argv[1])
exe = src['executable']
os.execve(exe, [exe, 'app.js'], env)
