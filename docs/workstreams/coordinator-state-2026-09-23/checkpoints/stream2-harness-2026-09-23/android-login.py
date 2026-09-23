#!/usr/bin/env python3
"""Types a synthetic account's email and password into the Android login form on emulator-5556.
Reads the private env files; never prints the email or password. Usage: android-login.py <ACCOUNT_KEY>"""
import os, re, subprocess, sys, time
ADB = ['/Users/yingpengwang/Library/Android/sdk/platform-tools/adb', '-s', 'emulator-5556']
def env(p):
    out = {}
    if os.path.exists(p):
        for line in open(p):
            m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line.rstrip('\n'))
            if m: out[m.group(1)] = m.group(2).strip('\'"')
    return out
key = sys.argv[1].upper()
acc = env('/private/tmp/pantopus-workstream-home/.stream2-verification/native/accounts.env')
extra = env('/private/tmp/pantopus-stream2-r06-runtime/extra-accounts.env')
if acc.get(key + '_EMAIL'): email, pw = acc[key + '_EMAIL'], acc['PASSWORD']
elif extra.get(key + '_EMAIL'): email, pw = extra[key + '_EMAIL'], extra.get(key + '_PASSWORD') or extra['PASSWORD']
else: sys.exit('unknown account key')
def dump():
    r = subprocess.run(ADB + ['exec-out', 'uiautomator', 'dump', '/dev/tty'], capture_output=True)
    return r.stdout.decode('utf-8', 'replace')
def edit_fields():
    x = dump(); fields = []
    for m in re.finditer(r'<node [^>]*class="android.widget.EditText"[^>]*>', x):
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', m.group(0)).groups()
        pw_field = 'password="true"' in m.group(0)
        fields.append(((int(b[0]) + int(b[2])) // 2, (int(b[1]) + int(b[3])) // 2, pw_field))
    return fields
def type_text(t):
    # input text runs through the device shell; single-quote it and encode spaces.
    q = t.replace('%', '%%').replace(' ', '%s').replace("'", "'\\''")
    subprocess.run(ADB + ['shell', "input text '" + q + "'"], capture_output=True, check=True)
fields = edit_fields()
em = next((f for f in fields if not f[2]), None); pf = next((f for f in fields if f[2]), None)
if not em or not pf: sys.exit('login fields not found')
subprocess.run(ADB + ['shell', 'input', 'tap', str(em[0]), str(em[1])], check=True); time.sleep(0.6)
subprocess.run(ADB + ['shell', 'input', 'keyevent', 'KEYCODE_MOVE_END'], check=True)
for _ in range(3): subprocess.run(ADB + ['shell', 'input', 'keyevent', '--longpress', 'KEYCODE_DEL'], capture_output=True)
type_text(email); time.sleep(0.6)
subprocess.run(ADB + ['shell', 'input', 'tap', str(pf[0]), str(pf[1])], check=True); time.sleep(0.6)
type_text(pw); time.sleep(0.6)
subprocess.run(ADB + ['shell', 'input', 'keyevent', 'KEYCODE_BACK'], check=True)  # hide the keyboard
print('typed credentials for', key.lower(), '(values not shown)')
