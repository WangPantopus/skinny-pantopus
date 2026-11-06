import struct, sys, subprocess
# List a remote ZIP's members (name, local header offset, compressed and full size) from its central directory,
# using HTTP range requests. Feed an offset and compressed size to zipmember.py to read one member's start.
url = sys.argv[1]
def rng(a, b):
    return subprocess.run(["curl", "-sS", "-L", "--max-time", "120", "-r", "%d-%d" % (a, b), url], capture_output=True).stdout
head = subprocess.run(["curl", "-sSIL", "--max-time", "60", url], capture_output=True).stdout.decode("latin-1")
size = int([l for l in head.splitlines() if l.lower().startswith("content-length")][-1].split(":")[1])
tail = rng(max(0, size - 65558), size - 1)
i = tail.rfind(b"PK\x05\x06")
n, cdsize, cdoff = struct.unpack("<HII", tail[i + 10:i + 20])
j = tail.rfind(b"PK\x06\x06")
if j >= 0:
    n, cdsize, cdoff = struct.unpack("<QQQ", tail[j + 32:j + 56])
cd = rng(cdoff, cdoff + cdsize - 1)
p = 0
print("zip size %d, %d members" % (size, n))
while p < len(cd) and cd[p:p + 4] == b"PK\x01\x02":
    comp, = struct.unpack("<H", cd[p + 10:p + 12])
    csize, usize, nlen, xlen, clen = struct.unpack("<IIHHH", cd[p + 20:p + 34])
    off, = struct.unpack("<I", cd[p + 42:p + 46])
    name = cd[p + 46:p + 46 + nlen].decode("utf-8", "replace")
    extra = cd[p + 46 + nlen:p + 46 + nlen + xlen]
    q = 0
    while q + 4 <= len(extra):
        hid, hlen = struct.unpack("<HH", extra[q:q + 4])
        if hid == 1:
            vals = list(struct.unpack("<%dQ" % (hlen // 8), extra[q + 4:q + 4 + (hlen // 8) * 8]))
            if usize == 0xFFFFFFFF: usize = vals.pop(0)
            if csize == 0xFFFFFFFF: csize = vals.pop(0)
            if off == 0xFFFFFFFF: off = vals.pop(0)
        q += 4 + hlen
    print("%12d %12d %12d m%d %s" % (off, csize, usize, comp, name))
    p += 46 + nlen + xlen + clen
