"""Check a Claude Design screen export against its prompt's ARTBOARDS list (HANDOFF §5, steps 1-2).
Usage: python3 tools/export-render/verify_export.py <prompt-id> [pagesDir]

Reads docs/design/exports/<id>/<id>.html (or index.html). Three shapes:
- bundle: a __bundler/manifest of gzip+base64 pages plus __bundler/page_order, one page per artboard. Each page is
  decoded to <pagesDir> (default docs/design/exports/<id>/pages/, gitignored).
- package: the check index Claude Design writes plus the standalone per-artboard .html files it links, saved beside it.
- index-only: that index without the linked files; reported, since nothing can be rendered.
Bundle and package both write <pagesDir>/pages.json (plus each page's visible text) for render-frames.mjs.

Names: a page matches when its canvas title or its visible label equals a manifest name. When the counts agree,
pages.json names every page by manifest order, so PNGs carry the exact names the journeys attach even if the
canvas titles are descriptive. Writes docs/design/exports/<id>/verify.json."""
import base64, gzip, html, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PID = sys.argv[1]
EXPORT = os.path.join(ROOT, 'docs/design/exports', PID, f'{PID}.html')
if not os.path.exists(EXPORT): EXPORT = os.path.join(os.path.dirname(EXPORT), 'index.html')
PAGES = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(ROOT, 'docs/design/exports', PID, 'pages')


def manifest_names(pid):
    t = open(os.path.join(ROOT, 'docs/notes/prompts-final', f'{pid}.md')).read()
    sec = re.search(r'\nARTBOARDS[^\n]*\n(.*?)\nBATCH PLAN', t, re.S).group(1)
    names = []
    for line in sec.split('\n'):
        m = re.match(r'\s*\d+\.\s+(.*)$', line)
        if m and m.group(1).startswith(pid + ' ·'):
            names.append(re.split(r'\s+[—–](?:\s|$)|:\s|:$|\s+\(', m.group(1))[0].strip())
        elif m and m.group(1).startswith('Notes'):  # 13 prompts end with a bare "NN. Notes — …" line
            names.append(pid + ' · Notes')
    return names


def block(s, kind):
    m = re.search(r'<script type="__bundler/%s"[^>]*>(.*?)</script>' % kind, s, re.S)
    return m.group(1) if m else None


def visible_text(markup):
    t = re.sub(r'<(style|script)\b.*?</\1>', '', markup, flags=re.S)
    t = re.sub(r'<(br|/div|/p|/li|/h\d|/tr|/span)[^>]*>', '\n', t)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t))
    return '\n'.join(x for x in (re.sub(r'\s+', ' ', l).strip() for l in t.split('\n')) if x)


def decode(e):
    raw = base64.b64decode(e['data'])
    return gzip.decompress(raw) if str(e.get('compressed')).lower() == 'true' else raw


src = open(EXPORT).read()
names = manifest_names(PID)
if os.path.isdir(PAGES):  # drop the pages a previous export decoded, so a re-export never mixes with them
    for f in os.listdir(PAGES):
        if re.match(r'\d\d(-[0-9a-f-]+)?\.(html|txt)$', f) or f == 'pages.json': os.remove(os.path.join(PAGES, f))
report = {'id': PID, 'export': os.path.relpath(EXPORT, ROOT), 'manifest': len(names)}
links = re.findall(r'<li><a href="([^"]+)">(.*?)</a>\s*(?:<span>(\d+)×(\d+)</span>)?', src)
local = [os.path.join(os.path.dirname(EXPORT), html.unescape(h)) for h, *_ in links]
if block(src, 'manifest') is None and links and all(os.path.exists(f) for f in local):
    os.makedirs(PAGES, exist_ok=True)
    pages = []
    for i, ((h, label, w, hgt), f) in enumerate(zip(links, local), 1):
        label, text = html.unescape(label), visible_text(open(f).read())
        open(os.path.join(PAGES, f'{i:02d}.txt'), 'w').write(text)
        pages.append({'i': i, 'file': os.path.relpath(f, PAGES), 'title': label, 'label': label,
                      'w': int(w) if w else None, 'h': int(hgt) if hgt else None, 'exact': label if label in names else None})
    for p in pages:
        p['name'] = names[p['i'] - 1] if len(pages) == len(names) else (p['exact'] or p['title'])
        p['order_ok'] = p['exact'] is None or p['exact'] == p['name']
    exact = {p['exact'] for p in pages if p['exact']}
    report.update(mode='package', pages=len(pages), exact=len(exact), labelled=len(pages),
                  named_by_order=len(pages) == len(names), order_conflicts=[p['i'] for p in pages if not p['order_ok']],
                  missing=[n for n in names if n not in exact], extra=[p['title'] for p in pages if not p['exact']],
                  pagesDir=os.path.relpath(PAGES, ROOT))
    json.dump(pages, open(os.path.join(PAGES, 'pages.json'), 'w'), indent=1)
elif block(src, 'manifest') is None:
    drawn = [html.unescape(x) for _, x, *_ in links]
    report.update(mode='index-only', pages=len(drawn), exact=sum(n in drawn for n in names),
                  missing=[n for n in names if n not in drawn], extra=[n for n in drawn if n not in names],
                  note='Per-artboard files were not downloaded: pull the full HTML package before substance checks.')
else:
    man, order = json.loads(block(src, 'manifest')), json.loads(block(src, 'page_order'))
    os.makedirs(PAGES, exist_ok=True)
    pages = []
    for i, key in enumerate(order, 1):
        page = decode(man[key]).decode('utf-8', 'replace')
        tpl = block(page, 'template')
        inner = json.loads(tpl) if tpl else page
        title = re.search(r'<title>(.*?)</title>', inner, re.S)
        size = re.search(r'\$preview&quot;:\{&quot;width&quot;:(\d+),&quot;height&quot;:(\d+)', inner)
        text = visible_text(re.sub(r'<title>.*?</title>', '', inner, flags=re.S))
        label = next((l for l in text.split('\n') if l.startswith(PID + ' ·')), None)
        fn = f'{i:02d}-{key}.html'
        open(os.path.join(PAGES, fn), 'w').write(page)
        open(os.path.join(PAGES, fn[:-5] + '.txt'), 'w').write(text)
        t = html.unescape(title.group(1)).strip() if title else None
        pages.append({'i': i, 'file': fn, 'title': t, 'label': label,
                      'w': int(size.group(1)) if size else None, 'h': int(size.group(2)) if size else None,
                      'exact': next((n for n in (t, label) if n in names), None)})
    by_order = len(pages) == len(names)
    for p in pages:
        p['name'] = names[p['i'] - 1] if by_order else (p['exact'] or p['title'])
        p['order_ok'] = p['exact'] is None or p['exact'] == p['name']
    exact = {p['exact'] for p in pages if p['exact']}
    report.update(mode='bundle', pages=len(pages), exact=len(exact), labelled=sum(bool(p['label']) for p in pages),
                  named_by_order=by_order, order_conflicts=[p['i'] for p in pages if not p['order_ok']],
                  missing=[n for n in names if n not in exact],
                  extra=[p['title'] for p in pages if not p['exact']], pagesDir=os.path.relpath(PAGES, ROOT))
    json.dump(pages, open(os.path.join(PAGES, 'pages.json'), 'w'), indent=1)
if report['mode'] != 'index-only':  # placeholder copy anywhere on a drawn page (Notes pages excepted)
    hits = []
    for p in pages:
        if 'notes' in p['name'].lower(): continue
        tf = os.path.join(PAGES, p['file'][:-5] + '.txt') if report['mode'] == 'bundle' else os.path.join(PAGES, f"{p['i']:02d}.txt")
        txt = open(tf).read()  # "placeholder" in lower case is a real concept (the hidden-preview placeholder)
        for m in list(re.finditer(r'\bPLACEHOLDER\b|\bTODO\b|\bTBD\b', txt)) + list(re.finditer(
                r'\blorem\b|\{\{[^}]*\}\}|host[^\n]{0,24}not drawn|capture not supplied', txt, re.I)):
            hits.append(f"page {p['i']}: {m.group(0)}")
    report['placeholders'] = sorted(set(hits))
json.dump(report, open(os.path.join(os.path.dirname(EXPORT), 'verify.json'), 'w'), indent=1)

print(f"{PID}: {report['mode']} · manifest {report['manifest']} · pages {report['pages']} · exact names {report['exact']}")
if report['mode'] != 'index-only':
    print(f"  visible labels {report['labelled']}/{report['pages']} · named by manifest order: {report['named_by_order']}"
          + (f" · ORDER CONFLICTS at pages {report['order_conflicts']}" if report['order_conflicts'] else ''))
if report['mode'] != 'index-only' and report['named_by_order'] and not report['order_conflicts']:
    for p in pages:  # counts agree: show which canvas title takes which manifest name
        if not p['exact']: print(f"  page {p['i']:2d} {p['title']!r} -> {p['name']}")
else:
    for n in report['missing']: print('  missing:', n)
    for n in report['extra']: print('  not a manifest name:', n)
if report.get('placeholders'): print('  PLACEHOLDER COPY:', '; '.join(report['placeholders']))
if report['mode'] == 'index-only': print(' ', report['note'])
