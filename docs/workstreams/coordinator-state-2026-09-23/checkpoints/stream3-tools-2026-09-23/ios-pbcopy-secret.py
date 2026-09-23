#!/usr/bin/env python3
"""Put a fixture password on the owned simulator's pasteboard (0AE16FA0 only); never printed.
usage: ios-pbcopy-secret.py "<Fixture Name>" | --clear"""
import json, subprocess, sys
UDID = '0AE16FA0-E244-414F-86C8-24893BDFD979'
if sys.argv[1] == '--clear':
    subprocess.run(['xcrun', 'simctl', 'pbcopy', UDID], input=b' ', check=True); print('pasteboard cleared'); sys.exit(0)
fx = json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))
u = [x for x in fx if x['name'] == sys.argv[1]][0]
subprocess.run(['xcrun', 'simctl', 'pbcopy', UDID], input=u['password'].encode(), check=True)
print('pasteboard set for', sys.argv[1], '(value not printed)')
