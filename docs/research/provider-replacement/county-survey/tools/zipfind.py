import struct, sys, zlib, subprocess
url, offset, csize, key = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
keep = sys.argv[5].split(",") if len(sys.argv) > 5 else None
hdr = subprocess.run(["curl", "-sS", "--max-time", "60", "-r", "%d-%d" % (offset, offset + 29 + 512), url], capture_output=True).stdout
nlen, xlen = struct.unpack("<HH", hdr[26:30])
start = offset + 30 + nlen + xlen
raw = subprocess.run(["curl", "-sS", "--max-time", "300", "-r", "%d-%d" % (start, start + csize - 1), url], capture_output=True).stdout
text = zlib.decompressobj(-15).decompress(raw).decode("latin-1", "replace")
lines = text.split("\n")
cols = [c.strip() for c in lines[0].split("|")]
for ln in lines[1:]:
    parts = [p.strip() for p in ln.split("|")]
    if parts and key in parts[:3]:
        row = dict(zip(cols, parts))
        shown = {k: v for k, v in row.items() if keep is None or k in keep}
        print(shown)
