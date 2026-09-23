import os, json, pathlib
src = json.loads(pathlib.Path('/private/tmp/pantopus-stream3-20260920-r1/next-hostname-private-launch.json').read_text())
env = dict(src['env'])
env.pop('NEXT_DIST_DIR', None)   # default dev dist dir .next-dev is gitignored
argv = list(src['argv'])
argv[argv.index('--hostname') + 1] = 'stream3-auth.localhost'
os.chdir('/private/tmp/pantopus-stream3-work/frontend/apps/web')
os.execve(src['executable'], argv, env)
