# next-launch-s3.py: Next dev for the owned Stream 3 web runtime on stream3-auth.localhost:18131,
# NEXT_PUBLIC_API_URL pinned to the owned API :18130 and a separate NEXT_DIST_DIR (main's safety note).
import os, json, pathlib
src = json.loads(pathlib.Path('/private/tmp/pantopus-stream3-20260920-r1/next-hostname-private-launch.json').read_text())
env = dict(src['env'])
env['NEXT_PUBLIC_API_URL'] = 'http://127.0.0.1:18130'
env['NEXT_DIST_DIR'] = '.next-stream3'
argv = list(src['argv'])
argv[argv.index('--hostname') + 1] = 'stream3-auth.localhost'
os.chdir('/private/tmp/pantopus-stream3-work/frontend/apps/web')
os.execve(src['executable'], argv, env)
