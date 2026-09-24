"""Mechanical checks over a prompt pack directory (prompts-v2/*.md). Prints a report and writes check-report.json."""
import re, json, sys, os, glob, datetime as dt
D = sys.argv[1] if len(sys.argv) > 1 else 'prompts-v2'
MONTHS = {m: i for i, m in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], 1)}
WD = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
FIXTURE_ADDR = ['2418 NE Larkspur Loop', '1107 NE Birchfield Ct']
REQUIRED_SCREEN = ['SCREEN', 'TYPE', 'ATTACH', 'WHERE IT LIVES', 'THE ONE JOB', 'FIRST FIVE SECONDS', 'CONTENT',
                   'LAYOUT', 'INTERACTION', 'FOUNDATIONS COMPONENTS', 'ACCESSIBILITY', 'COPY', 'EDGE CASES',
                   'INSTEAD OF', 'DONE WHEN', 'ARTBOARDS', 'BATCH PLAN']
BANNED = [r'\bOops\b', r'Are you sure\?', r'\bCongratulations\b', r'100-year', r'\bconfetti\b(?! )', r'\blorem\b',
          r'\[name\]', r'Ollie knows', r'what we know', r'Open Pantopus to', r'\bFeatures/\*\*', r'\.tsx\b', r'\.swift\b', r'\.kt\b']
# words that are fine inside INSTEAD OF / explanatory lines; we only flag, a human/agent judges
def year_for(mon):  # fixtures span Sep 2026 - Mar 2027
    return 2027 if mon <= 6 else 2026
rep = {}
for f in sorted(glob.glob(os.path.join(D, '*.md'))):
    t = open(f).read(); pid = os.path.basename(f)[:-3]
    r = {'words': len(t.split()), 'weekday_errors': [], 'foreign_addresses': [], 'banned_hits': [], 'missing_sections': [], 'artboard_lines': 0, 'bad_artboard_names': []}
    for m in re.finditer(r'\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,? (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?(?:,? (20\d\d))?', t):
        wd, day, mon, yr = m.group(1), int(m.group(2)), MONTHS[m.group(3)], m.group(4)
        years = [int(yr)] if yr else [2026, 2027]
        ok = False; seen = []
        for y in years:
            try:
                real = WD[dt.date(y, mon, day).weekday()]; seen.append(f"{y}:{real}")
                if real == wd: ok = True
            except ValueError:
                seen.append(f"{y}:invalid")
        if not ok: r['weekday_errors'].append(f"{m.group(0)} -> {', '.join(seen)}")
    for m in re.finditer(r'\b\d{3,5} (?:NE|NW|SE|SW|N|S|E|W) [A-Z][\w]+(?: [A-Z][\w]+)? (?:St|Ave|Dr|Ct|Loop|Rd|Way|Pl|Ln|Blvd|Cir)\b', t):
        if not any(m.group(0).startswith(a) for a in FIXTURE_ADDR): r['foreign_addresses'].append(m.group(0))
    for b in BANNED:
        for m in re.finditer(b, t, re.I):
            ctx = t[max(0, m.start()-50):m.end()+30].replace('\n', ' ')
            r['banned_hits'].append(f"{m.group(0)} :: …{ctx}…")
    if not pid.startswith('00') and not pid.startswith('flow'):
        up = t.upper()
        r['missing_sections'] = [s for s in REQUIRED_SCREEN if s not in up]
    for line in t.splitlines():
        if re.search(r'·\s*(ios|android|web-390|web-1440)\s*·', line): 
            r['artboard_lines'] += 1
            if not re.search(r'·\s*(light|dark)\b', line) and 'Notes' not in line: r['bad_artboard_names'].append(line.strip()[:120])
    r['foreign_addresses'] = sorted(set(r['foreign_addresses']))
    rep[pid] = r
json.dump(rep, open('check-report.json', 'w'), indent=1)
tot = lambda k: sum(len(v[k]) for v in rep.values())
print(f"{len(rep)} prompts · words total {sum(v['words'] for v in rep.values())}")
for k in ['weekday_errors', 'foreign_addresses', 'banned_hits', 'missing_sections', 'bad_artboard_names']:
    print(f"{k}: {tot(k)} across {sum(1 for v in rep.values() if v[k])} prompts")
for pid, v in rep.items():
    flags = {k: v[k] for k in ['weekday_errors', 'foreign_addresses', 'banned_hits', 'missing_sections'] if v[k]}
    if flags: print(' ', pid, json.dumps(flags)[:400])
