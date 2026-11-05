#!/usr/bin/env python3
"""Regenerate the homepage's self-hosted Newsreader files in src/app/_components/fonts/.

The homepage's serif is Newsreader (Google Fonts; SIL Open Font License 1.1, no Reserved Font Name), with both
styles and every axis: weight 200-800 and optical size 6-72. Its headings, kickers and figures only need a small part
of Google's Latin file, so the page preloads a cut of that file holding CORE (every English letter and digit and the
punctuation headings use), and keeps Google's own files for every other character, fetched only when a serif text
uses one (unicode-range in home.module.css). Nothing draws differently: the cut keeps every table, axis, variation,
kerning pair, ligature and figure style of the glyphs it holds, so they render exactly as from Google's file.

This script:
  1. downloads Google's files exactly as next/font/google did (the same CSS URL and User-Agent): the latin,
     latin-ext and vietnamese file of each style;
  2. cuts newsreader-core.woff2 and newsreader-italic-core.woff2 from the two latin files;
  3. prints the unicode-range of the latin faces in home.module.css: Google's latin range minus CORE. Paste it there
     whenever CORE or the files change, so every character is in exactly one face.

Requires Python 3 with fontTools and brotli (pip install fonttools brotli). Run from frontend/apps/web:
    python3 scripts/newsreader-subset.py
"""

import os
import re
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'app', '_components', 'fonts')
CSS_URL = (
    'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800'
    '&display=swap'
)
# next/font/google's User-Agent (next/dist/compiled/@next/font/dist/google/fetch-resource.js): it decides which files
# Google serves (woff2, unhinted).
USER_AGENT = (
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/104.0.0.0 Safari/537.36'
)
# Every English letter and digit, the space and no-break space, and the punctuation headings and kickers use. A copy
# edit within these stays on the preloaded file; any other character still draws in Newsreader, from Google's file.
CORE = (
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    '  .,;:!?\'"-()&/‘’“”–—…'
)


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def parse_range(text):
    """'U+0000-00FF, U+0131, U+00??' -> set of code points."""
    points = set()
    for part in text.replace(' ', '').split(','):
        part = part.upper().removeprefix('U+')
        if '?' in part:
            low, high = int(part.replace('?', '0'), 16), int(part.replace('?', 'F'), 16)
        elif '-' in part:
            low, high = (int(x, 16) for x in part.split('-'))
        else:
            low = high = int(part, 16)
        points.update(range(low, high + 1))
    return points


def format_range(points):
    ranges, points = [], sorted(points)
    start = prev = points[0]
    for point in points[1:] + [None]:
        if point is not None and point == prev + 1:
            prev = point
            continue
        ranges.append(f'U+{start:04X}' if start == prev else f'U+{start:04X}-{prev:04X}')
        if point is not None:
            start = prev = point
    return ', '.join(ranges)


def cut(source, destination, unicodes):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']  # kerning, ligatures, tabular and proportional figures, rvrn: all of them
    options.layout_scripts = ['*']
    options.name_IDs = ['*']  # the copyright and license URL stay in the file
    options.name_languages = ['*']
    options.name_legacy = True
    options.notdef_outline = True
    options.glyph_names = True
    options.hinting = True
    options.legacy_kern = True
    options.drop_tables = []  # every table stays: fvar, avar, gvar, HVAR, STAT, GDEF, GPOS, GSUB, gasp ...
    options.passthrough_tables = True
    options.prune_unicode_ranges = False  # OS/2 stays exactly as Google's
    options.recalc_bounds = False
    options.recalc_timestamp = False
    font = TTFont(source)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(destination)
    return set(TTFont(destination).getBestCmap())


def main():
    css = fetch(CSS_URL).decode('utf-8')
    faces = re.findall(r'/\*\s*([\w-]+)\s*\*/\s*@font-face\s*{([^}]*)}', css)
    ranges = {}
    for subset_name, body in faces:
        style = re.search(r'font-style:\s*(\w+)', body).group(1)
        url = re.search(r'src:\s*url\(([^)]+)\)', body).group(1)
        unicode_range = re.search(r'unicode-range:\s*([^;]+);', body).group(1)
        if subset_name not in ('latin', 'latin-ext', 'vietnamese'):
            continue
        name = f"newsreader{'-italic' if style == 'italic' else ''}-{subset_name}.woff2"
        with open(os.path.join(OUT, name), 'wb') as handle:
            handle.write(fetch(url))
        ranges[(style, subset_name)] = unicode_range
        print(f'{name}: {url}', file=sys.stderr)

    core = {ord(c) for c in CORE}
    for style in ('normal', 'italic'):
        italic = '-italic' if style == 'italic' else ''
        latin = parse_range(ranges[(style, 'latin')])
        assert core <= latin, 'CORE must be inside Google\'s latin range'
        covered = cut(os.path.join(OUT, f'newsreader{italic}-latin.woff2'),
                      os.path.join(OUT, f'newsreader{italic}-core.woff2'), core)
        assert covered == core, f'the {style} core holds {len(covered)} characters, CORE has {len(core)}'
        print(f'{style} latin unicode-range (Google\'s latin minus CORE): {format_range(latin - core)}')
        for name in ('latin-ext', 'vietnamese'):
            print(f'{style} {name} unicode-range (Google\'s): {ranges[(style, name)]}')


if __name__ == '__main__':
    main()
