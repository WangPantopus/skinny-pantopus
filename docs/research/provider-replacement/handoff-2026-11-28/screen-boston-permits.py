#!/usr/bin/env python3
"""Screen the City's entire public issued-permit file privately. Counts are discovery evidence, never release facts."""
import argparse
import csv
import json
import os
import re
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--permits', required=True, type=Path)
parser.add_argument('--roster', required=True, type=Path)
parser.add_argument('--private-candidates',required=True,type=Path)
args = parser.parse_args()
os.umask(0o077)
rows = [json.loads(s) for s in args.roster.open()]
parcels = {r['pid'] for r in rows}
def addr(line):
    s = re.sub(r'[^A-Z0-9 ]+', ' ', line.upper())
    words = s.split()
    aliases={'STREET':'ST','ROAD':'RD','AVENUE':'AVE','AV':'AVE','PLACE':'PL','TERRACE':'TER',
             'BOULEVARD':'BLVD','TURNPIKE':'TPKE','HIGHWAY':'HWY','PARKWAY':'PKWY',
             'COURT':'CT','CIRCLE':'CIR','DRIVE':'DR','LANE':'LN','SQUARE':'SQ'}
    return ' '.join(aliases.get(word,word) for word in words)
roster_sites = {addr(r['street_number']+' '+r['street']) for r in rows}
bed = re.compile(r'bed|\b(?:\d+\s*)?b\.?\s*r(?:s|\.)?\b',re.I)
bath = re.compile(r'bath|lavator|water\s*closet|\b(?:\d+\s*)?b\.?\s*a(?:s|\.)?\b|\bw\.?\s*c\b',re.I)
area = re.compile(r'sq(?:uare)?\.?\s*[- ]?(?:ft|feet|foot)|(?<![a-z])s\.?\s*f\.?(?![a-z])|feet\s*(?:squared|of\s+(?:living|interior))|floor\s*area|living\s*(?:area|space)|footage|ft[²2]|square\s*met',re.I)
counts = Counter()
with args.permits.open(encoding='utf-8-sig', newline='') as inp, args.private_candidates.open('w') as out:
    for r in csv.DictReader(inp):
        counts['all_rows'] += 1
        pid = r['parcel_id'].strip().zfill(10)
        permit_street = addr(re.split(r'\b(?:UNIT|APT|APARTMENT|SUITE)\b|#',r['address'],flags=re.I)[0])
        by_pid = pid in parcels
        by_site = permit_street in roster_sites
        if by_pid or by_site:
            counts['cohort_parcel_or_site_rows'] += 1
        if by_pid: counts['cohort_exact_parcel_rows'] += 1
        narrative = r['description']+' '+r['comments']
        if not (bed.search(narrative) and bath.search(narrative)):
            continue
        counts['city_bed_and_bath_language'] += 1
        if by_pid or by_site:counts['cohort_bed_and_bath_language'] += 1
        hint = bool(area.search(narrative))
        if hint:counts['city_three_language_leads'] += 1
        value = re.sub(r'[^0-9.]','',r['sq_feet'])
        try: structured = float(value or '0')>0
        except ValueError: structured=False
        if (by_pid or by_site) and structured:
            counts['cohort_bed_bath_with_positive_permit_sq_feet'] += 1
        if not hint: continue
        if by_pid or by_site:counts['cohort_three_language_leads'] += 1
        print(json.dumps({'cohort_pid':by_pid,'cohort_site':by_site,'status':r['status'],'work':r['worktype'],
                          'id':r['permitnumber'],'description':narrative,'street':r['address'],'pid':pid,
                          'date':r['issued_date'],'zip':r['zip']}),file=out)
print(json.dumps(dict(counts),indent=2))
