#!/usr/bin/env python3
"""Copies a synthetic account's email or password to the Stream 2 simulator's pasteboard (6F914A30) for pasting
into the iOS login form. Reads the private env files; never prints the value. Usage: ios-pbcopy-cred.py <ACCOUNT_KEY> <email|password>"""
import os, re, subprocess, sys
def env(p):
    out = {}
    if os.path.exists(p):
        for line in open(p):
            m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line.rstrip('\n'))
            if m: out[m.group(1)] = m.group(2).strip('\'"')
    return out
key, field = sys.argv[1].upper(), sys.argv[2]
acc = env('/private/tmp/pantopus-workstream-home/.stream2-verification/native/accounts.env')
extra = env('/private/tmp/pantopus-stream2-r06-runtime/extra-accounts.env')
if acc.get(key + '_EMAIL'): email, pw = acc[key + '_EMAIL'], acc['PASSWORD']
elif extra.get(key + '_EMAIL'): email, pw = extra[key + '_EMAIL'], extra.get(key + '_PASSWORD') or extra['PASSWORD']
else: sys.exit('unknown account key')
value = email if field == 'email' else pw
subprocess.run(['xcrun', 'simctl', 'pbcopy', '6F914A30-8585-4B05-9E05-94441675F10A'], input=value.encode(), check=True)
print(f'copied {field} for {key.lower()} to the simulator pasteboard (value not shown)')
