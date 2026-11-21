#!/usr/bin/env node
// The states' outlines for the travelling card's journey map (docs/product/travelling-card-2026-11-21, Part 5), made
// as sample/gen.cjs makes them: us-atlas's states, already projected with d3's Albers USA to 975 x 610, each ring
// rounded to whole points with repeats dropped. Writes src/components/mailbox/cards/usStates.json:
// { "WA": "M…Z", ... } (the 50 states; DC left out, as in the sample). No map service and no token.
//
// usage, in a folder outside the repository:
//   npm install us-atlas@3.0.1 topojson-client@3.1.0
//   node <repo>/frontend/apps/web/scripts/build-us-states.cjs <that folder>/node_modules
const fs = require('fs');
const path = require('path');

const modules = process.argv[2];
if (!modules) { console.error('usage: node build-us-states.cjs <node_modules with us-atlas and topojson-client>'); process.exit(2); }
const topojson = require(path.join(modules, 'topojson-client'));
const us = require(path.join(modules, 'us-atlas/states-albers-10m.json'));

const CODES = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT',
  Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI',
  Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
  Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV',
  Wisconsin: 'WI', Wyoming: 'WY',
};

const ring = (pts) => {
  let out = ''; let px; let py;
  pts.forEach(([x, y], i) => {
    const rx = Math.round(x); const ry = Math.round(y);
    if (i && rx === px && ry === py) return;
    out += `${i ? 'L' : 'M'}${rx},${ry}`; px = rx; py = ry;
  });
  return `${out}Z`;
};
const toPath = (geom) => {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.map((poly) => poly.map(ring).join('')).join('');
};
const states = {};
for (const f of topojson.feature(us, us.objects.states).features) {
  const code = CODES[f.properties.name];
  if (code) states[code] = toPath(f.geometry);
}
const out = path.join(__dirname, '../src/components/mailbox/cards/usStates.json');
fs.writeFileSync(out, `${JSON.stringify(states)}\n`);
console.log(`usStates.json: ${Object.keys(states).length} states, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
