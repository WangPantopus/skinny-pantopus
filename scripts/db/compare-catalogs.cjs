#!/usr/bin/env node
// Offline, read-only comparison. Report paths, never private catalog values.
const fs = require('node:fs');
const sections = ['tables', 'indexes', 'routines', 'triggers', 'policies', 'types',
  'views', 'sequences', 'defaultPrivileges', 'schemas', 'extensions'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escapePointer = value => value.replaceAll('~', '~0').replaceAll('/', '~1');

function validate(catalog) {
  if (!object(catalog) || catalog.formatVersion !== 1 || typeof catalog.scope !== 'string') {
    throw new Error('Expected a version 1 catalog inventory');
  }
  for (const section of sections) {
    if (!object(catalog[section])) throw new Error(`Missing catalog section: ${section}`);
  }
  if (Object.keys(catalog).some(key => !['formatVersion', 'scope', ...sections].includes(key))) {
    throw new Error('Unrecognized catalog section; update the inventory format explicitly');
  }
  if (Object.keys(catalog.tables).length === 0) throw new Error('Empty application table inventory');
}

function compare(before, after) {
  validate(before);
  validate(after);
  if (before.scope !== after.scope) throw new Error('Catalog scopes differ');
  const changes = [];
  function walk(left, right, path) {
    if (Object.is(left, right)) return;
    if (object(left) && object(right)) {
      for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
        const next = `${path}/${escapePointer(key)}`;
        if (!Object.hasOwn(left, key)) changes.push({ kind: 'added', path: next });
        else if (!Object.hasOwn(right, key)) changes.push({ kind: 'removed', path: next });
        else walk(left[key], right[key], next);
      }
    } else if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) changes.push({ kind: 'changed', path });
      else left.forEach((value, index) => walk(value, right[index], `${path}/${index}`));
    } else changes.push({ kind: 'changed', path });
  }
  for (const section of sections) walk(before[section], after[section], `/${section}`);
  return {
    equal: changes.length === 0,
    counts: Object.fromEntries(sections.map(section => [section, {
      before: Object.keys(before[section]).length, after: Object.keys(after[section]).length,
    }])),
    changes,
  };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/db/compare-catalogs.cjs BEFORE.json AFTER.json');
    const report = compare(...process.argv.slice(2).map(file => JSON.parse(fs.readFileSync(file, 'utf8'))));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.equal ? 0 : 1;
  } catch {
    // Parsing and file-system errors can quote private values/paths. Keep the
    // command-line diagnostic generic; callers of compare receive validation errors.
    console.error('Catalog comparison failed: check the two private version 1 inventory files.');
    process.exitCode = 2;
  }
}
module.exports = { compare, validate };
