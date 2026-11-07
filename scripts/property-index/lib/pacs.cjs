'use strict';
// The appraisal export many Texas districts publish: True Automation's PACS layout, one fixed-width text file per table,
// in a ZIP. Only the columns named here are ever cut out of a line, so owner names (past the protected-person check),
// mailing addresses, exemptions and mortgage companies never leave the reader. Positions are the layout's own, from 1.

const { spawn, execFileSync } = require('node:child_process');
const { streamLines } = require('./tables.cjs');

const LONG_NAMES = { APPR_HDR: 'APPRAISAL_HEADER', PROP: 'APPRAISAL_INFO', IMP_INFO: 'APPRAISAL_IMPROVEMENT_INFO', IMP_DET: 'APPRAISAL_IMPROVEMENT_DETAIL', IMP_ATR: 'APPRAISAL_IMPROVEMENT_DETAIL_ATTR', ABS_SUBD: 'APPRAISAL_ABSTRACT_SUBDV', STATE_CD: 'APPRAISAL_STATE_CODE' };
const PROTECTED = /CONFIDENTIAL|PROTECTED|WITHHELD|SUPPRESS|NOT DISPLAYED|25\.025/i;
const cut = (line, start, end) => line.slice(start - 1, end).trim();
const amount = (text) => Number(text) || 0;
const accountOf = (line) => cut(line, 1, 12).replace(/^0+/, '');

async function* lines(zip, table) {
  const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n');
  const member = names.find((name) => new RegExp(`(^|/|_)(${table}|${LONG_NAMES[table]})\\.TXT$`, 'i').test(name));
  if (!member) throw new Error(`The export has no ${table} file`);
  const child = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'ignore'] });
  child.stdout.setEncoding('latin1');
  yield* streamLines(child.stdout);
}

/** Real property and mobile homes, without a protected person's account. Stops at a file that doesn't fit the layout. */
async function* properties(zip, stats = {}) {
  for await (const line of lines(zip, 'PROP')) {
    const type = cut(line, 13, 17);
    if (line.length < 4860 || !/^0?\d{4}$/.test(cut(line, 18, 22)) || !/^(R|P|MH|MN|A)$/.test(type)) throw new Error(`A property line doesn't fit the layout (${line.length} characters)`);
    if (type !== 'R' && type !== 'MH') continue;
    if (line[989] === 'T' || line[2568] === 'T' || line[4858] === 'T' || PROTECTED.test(cut(line, 609, 678))) {
      stats.protected = (stats.protected || 0) + 1;
      continue;
    }
    yield {
      id: accountOf(line), year: Number(cut(line, 18, 22)), geo: cut(line, 547, 596), partial: line[678] === 'T', group: cut(line, 680, 691).replace(/^0+/, ''),
      number: cut(line, 4460, 4474), pre: cut(line, 1040, 1049), street: cut(line, 1050, 1099), suffix: cut(line, 1100, 1109), unit: cut(line, 4475, 4479), city: cut(line, 1110, 1139), zip: cut(line, 1140, 1149),
      legal: [cut(line, 1150, 1404), cut(line, 1405, 1659)].filter(Boolean).join(' '), subdivision: cut(line, 1676, 1685),
      acres: amount(cut(line, 2772, 2791)) / 10000 || amount(cut(line, 1660, 1675)) / 10000,
      state: cut(line, 2732, 2741) || cut(line, 2742, 2751),
      market: amount(cut(line, 4214, 4227)),
      land: amount(cut(line, 1796, 1810)) + amount(cut(line, 1811, 1825)) + amount(cut(line, 1871, 1885)),
      building: amount(cut(line, 1826, 1840)) + amount(cut(line, 1841, 1855)),
    };
  }
}

/** The largest improvement on each wanted account: what's on it, in a district's own words (`classify` names each detail). */
async function mainImprovements(zip, wanted, classify, attributes = []) {
  const byAccount = new Map();
  for await (const line of lines(zip, 'IMP_DET')) {
    const id = accountOf(line);
    if (!wanted.has(id)) continue;
    const kind = classify(cut(line, 41, 50).toUpperCase(), cut(line, 51, 75).toUpperCase());
    if (!kind) continue;
    const imp = cut(line, 17, 28);
    let account = byAccount.get(id);
    if (!account) byAccount.set(id, account = new Map());
    let held = account.get(imp);
    if (!held) account.set(imp, held = { id: imp, area: 0, floors: new Set() });
    const size = amount(cut(line, 94, 108));
    if (kind.startsWith('floor')) {
      held.area += size;
      held.floors.add(kind.slice(5));
      const built = Number(cut(line, 86, 89));
      if (built > 1000 && (!held.built || built < held.built)) held.built = built;
    } else held[kind] = (held[kind] || 0) + size;
  }
  const main = new Map();
  for (const [id, account] of byAccount) {
    const biggest = [...account.values()].sort((a, b) => b.area - a.area)[0];
    if (biggest) main.set(id, biggest);
  }
  byAccount.clear();
  for await (const line of lines(zip, 'IMP_INFO')) {
    const held = main.get(accountOf(line));
    if (held && held.id === cut(line, 17, 28)) held.type = cut(line, 39, 63).toUpperCase();
  }
  if (attributes.length) {
    for await (const line of lines(zip, 'IMP_ATR')) {
      const held = main.get(accountOf(line));
      if (!held || held.id !== cut(line, 17, 28)) continue;
      const name = cut(line, 53, 77);
      if (attributes.includes(name) && !held[name]) held[name] = cut(line, 78, 87).toUpperCase();
    }
  }
  return main;
}

/** A code table: code to words. `table` is ABS_SUBD (subdivisions) or STATE_CD (the district's state categories). */
async function codes(zip, table) {
  const words = new Map();
  const end = table === 'ABS_SUBD' ? 50 : 60;
  for await (const line of lines(zip, table)) words.set(cut(line, 1, 10), cut(line, 11, end));
  return words;
}

/** When the export was run, from its header file. */
async function exportDate(zip) {
  for await (const line of lines(zip, 'APPR_HDR')) {
    const stamp = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(cut(line, 1, 16));
    if (stamp) return `${stamp[3]}-${stamp[1]}-${stamp[2]}`;
  }
  throw new Error('The export no longer says when it was run');
}

module.exports = { properties, mainImprovements, codes, exportDate, lines, cut };
