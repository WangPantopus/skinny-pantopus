#!/usr/bin/env python3
"""Read only. Inventory the two published indexes without printing addresses or credentials."""
import argparse
import csv
import io
import json
import os
import subprocess
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', type=Path, required=True)
parser.add_argument('--ref', default='origin/master')
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--as-of', type=date.fromisoformat, default=date.today())
parser.add_argument('--reader-env', type=Path, help='Optional existing private Pantopus reader env file')
parser.add_argument('--verify-objects', action='store_true',
                    help='Check the four nonempty files of every current property, registry and estimate release')
args = parser.parse_args()
env = dict(os.environ, AWS_PAGER='', AWS_DEFAULT_REGION='us-west-2', AWS_DEFAULT_OUTPUT='json')
if args.reader_env:
    settings = {}
    for line in args.reader_env.read_text().splitlines():
        if line.startswith('PROPERTY_INDEX_AWS_') and '=' in line:
            k, v = line.split('=', 1)
            settings[k] = v.strip().strip('"').strip("'")
    env.pop('AWS_PROFILE', None)
    env.pop('AWS_SESSION_TOKEN', None)
    env.update(AWS_ACCESS_KEY_ID=settings['PROPERTY_INDEX_AWS_ACCESS_KEY_ID'],
               AWS_SECRET_ACCESS_KEY=settings['PROPERTY_INDEX_AWS_SECRET_ACCESS_KEY'])
    if settings.get('PROPERTY_INDEX_AWS_SESSION_TOKEN'):
        env['AWS_SESSION_TOKEN'] = settings['PROPERTY_INDEX_AWS_SESSION_TOKEN']

def aws(*params):
    return subprocess.run(['aws', 's3api', *params], env=env, capture_output=True, check=True).stdout

def inventory(prefix):
    directory = 'index/' + prefix + 'states/'
    keys = json.loads(aws('list-objects-v2', '--bucket', 'pantopus-property-index', '--prefix', directory))['Contents']
    return sorted(o['Key'] for o in keys if o['Key'].endswith('.json'))

def read(key):
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / 'object'
        aws('get-object', '--bucket', 'pantopus-property-index', '--key', key, str(target))
        return json.loads(target.read_bytes())

def table(name):
    path = 'docs/research/provider-replacement/evidence/' + name + '.csv'
    raw = subprocess.check_output(['git', '-C', str(args.repo), 'show', args.ref + ':' + path]).decode('utf-8-sig')
    return list(csv.DictReader(io.StringIO(raw)))

def state_entries(prefix):
    keys = inventory(prefix)
    with ThreadPoolExecutor(max_workers=8) as pool:
        manifests = list(pool.map(read, keys))
    items = {}
    for m in manifests:
        for fips, entry in m['jurisdictions'].items():
            if fips in items:
                raise ValueError('duplicate county identifier ' + fips)
            items[fips] = entry
    return items

def verify_objects(prefix, entries):
    directory = 'index/' + prefix + 'releases/'
    listed = json.loads(aws('list-objects-v2', '--bucket', 'pantopus-property-index',
                            '--prefix', directory, '--query', 'Contents[].[Key,Size]'))
    present = {key for key, size in (listed or []) if size > 0}
    components = ('data.bin', 'manifest.json.gz', 'report.json', 'ids.json.gz')
    missing = []
    for fips, entry in sorted(entries.items()):
        release = entry['release']
        for component in components:
            if f'{directory}{fips}/{release}/{component}' not in present:
                missing.append({'fips': fips, 'release': release, 'component': component})
    return {'counties': len(entries), 'records': sum(e['records'] for e in entries.values()),
            'expected_objects': len(components) * len(entries), 'absent_or_empty': missing}

routes = {r['fips']: r for r in table('national-routes-by-county')}
universe = {r['County/equivalent FIPS (text)']: r for r in table('national-jurisdictions')}
locator = {'property': state_entries(''), 'registry': state_entries('registry/')}
switch = read('index/switches/production.json')
staging = read('index/switches/staging.json')
def switch_mode(s, f):
    row = s.get('counties', {}).get(f, {})
    return row.get('mode', 'off')

rows = []
for f in sorted(set(universe) | set(routes) | set(locator['property']) | set(locator['registry']) | set(switch['counties'])):
    p = locator['property'].get(f, {})
    r = locator['registry'].get(f, {})
    census = routes.get(f, {})
    extra = universe.get(f, {})
    mode = switch_mode(switch, f)
    categories = ['countywide' if mode == 'live' else mode] if mode != 'off' else []
    row = {'fips': f, 'state': p.get('state') or r.get('state') or census.get('state') or extra.get('State/territory'),
           'name': p.get('name') or r.get('name') or census.get('county') or extra.get('Census name'),
           'housing_units_reference': int(census['housing_units']) if census.get('housing_units') else None,
           'property_scope': categories[0] if categories else ('stored-off' if p else 'no-property-release'),
           'municipality': switch['counties'].get(f, {}).get('municipality'),
           'staging_mode': switch_mode(staging, f),
           'property_release': p.get('release'), 'property_status': p.get('status'), 'source': p.get('source'),
           'property_records': p.get('records', 0), 'as_of': p.get('as_of'), 'stale_after': p.get('stale_after'),
           'registry_release': r.get('release'), 'registry_records': r.get('records', 0), 'registry_counts': r.get('counts') or {},
           'research_route': census.get('route_kind') or None}
    rows.append(row)
stats = Counter(r['property_scope'] for r in rows)
reg_counts = Counter()
for row in rows:
    reg_counts.update(row['registry_counts'])
summary = {
    'audited_utc': datetime.now(timezone.utc).isoformat(), 'age_as_of': args.as_of.isoformat(),
    'production_switch_updated': switch.get('updated_at'), 'staging_switch_updated': staging.get('updated_at'),
    'universe_rows': len(rows), 'route_inventory_rows': len(routes), 'property_manifests': len(locator['property']),
    'property_state_jurisdictions': len({r['state'] for r in rows if r['property_release']}),
    'property_scopes': dict(stats), 'property_records': sum(r['property_records'] for r in rows),
    'records_in_countywide_releases': sum(r['property_records'] for r in rows if r['property_scope']=='countywide'),
    'registry_counties': len(locator['registry']), 'registry_state_jurisdictions': len({r['state'] for r in rows if r['registry_release']}),
    'registry_records': sum(r['registry_records'] for r in rows), 'registry_counts': dict(reg_counts),
    'past_stale_after': dict(Counter(r['property_scope'] for r in rows if r['stale_after'] and r['stale_after'] < args.as_of.isoformat())),
    'scope_housing_reference': {s: sum(r['housing_units_reference'] or 0 for r in rows if r['property_scope']==s) for s in stats},
    'named_production_settings': {k:len(v) for k,v in switch.items() if isinstance(v,(dict,list))},
    'registry_serving': 'Not measured by these storage manifests. Add Home state switches are runtime configuration.',
    'census_note': 'Reference housing units are county estimates for the route inventory. Municipal releases cannot claim the whole county.'}
args.out.mkdir(parents=True, exist_ok=True)
(args.out/'nationwide.json').write_text(json.dumps({'summary':summary,'counties':rows}, indent=2)+'\n')
print(json.dumps(summary, indent=2))
if args.verify_objects:
    checks = {'property': verify_objects('', locator['property']),
              'registry': verify_objects('registry/', locator['registry']),
              'estimates': verify_objects('estimates/', state_entries('estimates/'))}
    receipt = {'checked_utc': datetime.now(timezone.utc).isoformat(), 'indexes': checks}
    (args.out/'storage-check.json').write_text(json.dumps(receipt, indent=2)+'\n')
    if any(not check['counties'] or check['absent_or_empty'] for check in checks.values()):
        raise SystemExit('The storage check found an empty index or incomplete release. See storage-check.json.')
    print(f"Verified {sum(c['expected_objects'] for c in checks.values()):,} nonempty release files.")
