#!/usr/bin/env python3
"""Re-prove the 2026-09-30 split of the former Stream 2 into Streams 3 and 4.
Each of the former 40 inventory rows (H01-H08, R01-R06, I01-I07, D01-D10, F01-F05, M01-M04) and each of the 24 S2-xx UX
items must appear in exactly one of 03-home-access-residency.md and 04-place-records-money-mail.md. Row statuses change
over time; the ownership must not.
Added 2026-09-30T04:36:26Z: the cross-cutting rows of REMAINING_WORK section 10 that the hub's records give the former Stream 2. U01
(Home and unit identity) must appear only in Stream 3's file, and each of U02-U05 exactly once in each file, because each
stream owns its own screens' cells.
Run after editing either file:  python3 docs/workstreams/check-stream2-split.py"""
import pathlib, re, sys

WS = pathlib.Path(__file__).resolve().parent
FILES = ('03-home-access-residency.md', '04-place-records-money-mail.md')
ALL_ROWS = ([f'H0{i}' for i in range(1, 9)] + [f'R0{i}' for i in range(1, 7)] + [f'I0{i}' for i in range(1, 8)]
            + [f'D{i:02d}' for i in range(1, 11)] + [f'F0{i}' for i in range(1, 6)] + [f'M0{i}' for i in range(1, 5)])
ALL_UX = [f'S2-{i:02d}' for i in range(1, 25)]


def ids(name, pattern):
    return re.findall(pattern, (WS / name).read_text(), flags=re.M)


ok = True
for label, expected, pattern in (('inventory rows', ALL_ROWS, r'^\| ([HRIDFM]\d\d) \|'),
                                 ('S2-xx UX items', ALL_UX, r'^\| (S2-\d\d) \|')):
    s3, s4 = ids(FILES[0], pattern), ids(FILES[1], pattern)
    both = sorted(set(s3) & set(s4))
    repeated = sorted({x for x in s3 if s3.count(x) > 1} | {x for x in s4 if s4.count(x) > 1})
    missing = sorted(set(expected) - set(s3) - set(s4))
    unknown = sorted(set(s3 + s4) - set(expected))
    print(f'{label}: Stream 3 owns {len(set(s3))}, Stream 4 owns {len(set(s4))} (expected {len(expected)} in all); '
          f'in both: {both or "none"}; repeated: {repeated or "none"}; missing: {missing or "none"}; unknown: {unknown or "none"}')
    ok = ok and not (both or repeated or missing or unknown)
u3, u4 = (ids(f, r'^\| (U0[1-5]) \|') for f in FILES)
u_ok = (u3.count('U01') == 1 and 'U01' not in u4 and set(u3 + u4) <= {'U01', 'U02', 'U03', 'U04', 'U05'}
        and all(u3.count(u) == 1 and u4.count(u) == 1 for u in ('U02', 'U03', 'U04', 'U05')))
print(f'U rows: Stream 3 has {sorted(u3)}, Stream 4 has {sorted(u4)} '
      '(expected U01 in Stream 3 only, and U02-U05 once in each)')
ok = ok and u_ok
print('OK: Streams 3 and 4 together own exactly the former Stream 2 checklist, plus U01 and their U02-U05 cells' if ok
      else 'FAILED')
sys.exit(0 if ok else 1)
