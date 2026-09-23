#!/usr/bin/env python3
"""Shared adb UI helper (Pantopus streams). Requires ANDROID_SERIAL=<your stream emulator>. Usage:
  aui.py dump                -> list visible text/desc nodes with bounds
  aui.py tap <text> [n]      -> tap the n-th (default 0) node whose text/desc contains <text>
  aui.py has <text>          -> exit 0 if present
  aui.py shot <path>         -> screenshot to path
"""
import subprocess,sys,re,xml.etree.ElementTree as ET,time
import os
ADB=['/Users/yingpengwang/Library/Android/sdk/platform-tools/adb','-s',os.environ.get('ANDROID_SERIAL') or sys.exit('set ANDROID_SERIAL (your stream emulator, e.g. emulator-5556)')]
def sh(args,**kw): return subprocess.run(ADB+args,capture_output=True,**kw)
def dump():
    for _ in range(3):
        r=sh(['exec-out','uiautomator','dump','/dev/tty'])
        out=r.stdout.decode('utf-8','replace')
        i=out.find('<?xml'); j=out.rfind('</hierarchy>')
        if i>=0 and j>0:
            return ET.fromstring(out[i:j+len('</hierarchy>')])
        time.sleep(1)
    raise SystemExit('dump failed: '+out[:200])
def nodes(root):
    for n in root.iter('node'):
        t=n.get('text') or ''; d=n.get('content-desc') or ''
        b=n.get('bounds'); m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',b or '')
        if not m: continue
        x1,y1,x2,y2=map(int,m.groups())
        yield t,d,(x1,y1,x2,y2),n.get('clickable')=='true',n.get('enabled')!='false',n.get('class')
def main():
    cmd=sys.argv[1]
    if cmd=='dump':
        for t,d,b,c,e,cl in nodes(dump()):
            if t or d: print(f"{b} click={int(c)} en={int(e)} text={t!r} desc={d!r}")
    elif cmd in('tap','has'):
        want=sys.argv[2]; idx=int(sys.argv[3]) if len(sys.argv)>3 else 0
        hits=[(t,d,b) for t,d,b,c,e,cl in nodes(dump()) if want in t or want in d]
        if cmd=='has': sys.exit(0 if hits else 1)
        if len(hits)<=idx: raise SystemExit(f'not found: {want!r}')
        t,d,(x1,y1,x2,y2)=hits[idx]; x,y=(x1+x2)//2,(y1+y2)//2
        sh(['shell','input','tap',str(x),str(y)]); print(f'tapped {want!r} at {x},{y} ({t or d!r})')
    elif cmd=='shot':
        r=sh(['exec-out','screencap','-p']); open(sys.argv[2],'wb').write(r.stdout); print(sys.argv[2],len(r.stdout))
main()
