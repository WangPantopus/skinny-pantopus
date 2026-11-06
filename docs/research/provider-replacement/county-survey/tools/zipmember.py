import struct, sys, zlib, subprocess
url, offset, want_bytes, mode = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
hdr = subprocess.run(["curl", "-sS", "--max-time", "60", "-r", "%d-%d" % (offset, offset + 29 + 512), url], capture_output=True).stdout
sig, ver, flag, comp, t, d, crc, csize, usize, nlen, xlen = struct.unpack("<4sHHHHHIIIHH", hdr[:30])
start = offset + 30 + nlen + xlen
raw = subprocess.run(["curl", "-sS", "--max-time", "120", "-r", "%d-%d" % (start, start + want_bytes - 1), url], capture_output=True).stdout
out = zlib.decompressobj(-15).decompress(raw)
text = out.decode("latin-1", "replace")
lines = text.split("\n")
if mode == "header":
    print(lines[0].strip()[:1500])
elif mode == "readme":
    print(text[:1200])
else:
    # mode = column index (0-based) whose distinct values to count, with the delimiter guessed from the header
    head = lines[0]
    delim = "|" if head.count("|") > head.count("\t") and head.count("|") > head.count(",") else ("\t" if head.count("\t") >= head.count(",") else ",")
    cols = [c.strip().strip('"') for c in head.split(delim)]
    idx = int(mode)
    print("columns:", cols)
    print("counting column", idx, "=", cols[idx] if idx < len(cols) else "?")
    from collections import Counter
    c = Counter()
    for ln in lines[1:-1]:
        parts = ln.split(delim)
        if len(parts) > idx:
            c[parts[idx].strip().strip('"')] += 1
    for k, v in c.most_common(60):
        print("  %6d  %s" % (v, k))
