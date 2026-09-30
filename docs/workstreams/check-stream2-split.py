#!/usr/bin/env python3
"""Re-prove the 2026-09-30 split of the former Stream 2 into Streams 3 and 4.
Each of the former 40 inventory rows (H01-H08, R01-R06, I01-I07, D01-D10, F01-F05, M01-M04) and each of the 24 S2-xx UX
items must appear in exactly one of 03-home-access-residency.md and 04-place-records-money-mail.md. Row statuses change
over time; the ownership must not. Run after editing either file:  python3 docs/workstreams/check-stream2-split.py"""
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
print('OK: Streams 3 and 4 together own exactly the former Stream 2 checklist' if ok else 'FAILED')
sys.exit(0 if ok else 1)
