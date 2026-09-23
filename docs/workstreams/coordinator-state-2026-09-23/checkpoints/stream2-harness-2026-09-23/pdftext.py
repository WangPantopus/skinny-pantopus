# Minimal pdfkit text extraction: inflate FlateDecode streams and decode hex TJ strings (WinAnsi).
import re, sys, zlib
data = open(sys.argv[1], 'rb').read()
out = []
for m in re.finditer(rb'stream\r?\n(.*?)\r?\nendstream', data, re.S):
    raw = m.group(1)
    try: s = zlib.decompress(raw)
    except Exception: continue
    for line in s.split(b'\n'):
        if b'TJ' in line or b'Tj' in line:
            parts = re.findall(rb'<([0-9a-fA-F]+)>', line)
            txt = ''.join(bytes.fromhex(p.decode()).decode('latin-1') for p in parts)
            if txt.strip(): out.append(txt)
print('\n'.join(out))
