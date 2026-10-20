#!/usr/bin/env node
/**
 * Runs the assistant's question set and attack set (scripts/ai/assistant-questions.json)
 * against a running backend, as seeded local test accounts, through the real chat route
 * with the live model. Prints one line per question and exits non-zero when any fails.
 *
 *   node scripts/ai/run-assistant-questions.js --api http://127.0.0.1:18751 \
 *     --accounts <accounts.env> --prefix AIX_ [--only <id,id>]
 *
 * The accounts file holds <PREFIX><LABEL>_EMAIL, _PASSWORD and _HOME_ID lines (the local
 * launch kit's format). Passwords and tokens are never printed. Every run costs a few
 * cents of model usage; run it when prompts or tools change, and before raising limits.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const API = opt('--api', 'http://127.0.0.1:18751');
const ACCOUNTS = opt('--accounts');
const PREFIX = opt('--prefix', 'AIX_');
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
if (!ACCOUNTS) {
  console.error('usage: run-assistant-questions.js --api <url> --accounts <accounts.env> [--prefix AIX_] [--only id,id]');
  process.exit(1);
}

const env = Object.fromEntries(fs.readFileSync(ACCOUNTS, 'utf8').split('\n')
  .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const field = (label, key) => env[`${PREFIX}${label.toUpperCase()}_${key}`];
const { questions } = JSON.parse(fs.readFileSync(path.join(__dirname, 'assistant-questions.json'), 'utf8'));

const tokens = new Map();
async function token(label) {
  if (tokens.has(label)) return tokens.get(label);
  const res = await fetch(`${API}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: field(label, 'EMAIL'), password: field(label, 'PASSWORD') }),
  });
  const json = await res.json();
  if (!json.accessToken) throw new Error(`sign-in failed for ${label} (${res.status})`);
  tokens.set(label, json.accessToken);
  return json.accessToken;
}

function fillContext(context) {
  if (!context) return undefined;
  return Object.fromEntries(Object.entries(context).map(([key, value]) => {
    const m = typeof value === 'string' && value.match(/^<([a-z0-9]+)\.home>$/);
    return [key, m ? field(m[1], 'HOME_ID') : value];
  }));
}

async function ask(question) {
  const body = {
    message: question.say,
    cards: question.old ? ['pickup_schedule'] : ['pickup_schedule', 'action', 'link'],
  };
  const context = fillContext(question.context);
  if (context) body.context = context;
  const res = await fetch(`${API}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token(question.as)}` },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  const out = { text: '', cards: [], drafts: [], links: [], errors: [] };
  for (const block of raw.split('\n\n')) {
    const name = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];
    if (!name || !data) continue;
    const json = JSON.parse(data);
    if (name === 'text_delta') out.text += json.delta || '';
    if (name === 'link') out.links.push(json.url);
    if (name === 'error') out.errors.push(json.error);
    if (name === 'draft') (json.type === 'action' ? out.cards : out.drafts).push(json.type === 'action' ? json.draft : json.type);
  }
  return out;
}

function check(question, got) {
  const e = question.expect || {};
  const fails = [];
  const types = got.cards.map((c) => c.card);
  if (e.noError && got.errors.length) fails.push(`error ${got.errors.join(',')}`);
  if (e.card && !types.includes(e.card)) fails.push(`no ${e.card} card (got ${types.join(',') || 'none'})`);
  if (e.then && !got.cards.some((c) => (c.actions || []).some((a) => a.then))) fails.push('card has no follow-up request');
  if (e.noCard && got.cards.length) fails.push(`unexpected card ${types.join(',')}`);
  if (e.noCardType && types.includes(e.noCardType)) fails.push(`unexpected ${e.noCardType} card`);
  if (e.linkContains && !got.links.some((url) => url.includes(e.linkContains))) fails.push(`no link containing ${e.linkContains}`);
  if (e.textMatches && !new RegExp(e.textMatches, 'i').test(got.text)) fails.push(`text lacks /${e.textMatches}/`);
  if (e.textNotMatches && new RegExp(e.textNotMatches, 'im').test(got.text)) fails.push(`text matches /${e.textNotMatches}/`);
  return fails;
}

(async () => {
  let failed = 0;
  for (const question of questions) {
    if (ONLY && !ONLY.has(question.id)) continue;
    const started = Date.now();
    try {
      const got = await ask(question);
      const fails = check(question, got);
      if (fails.length) failed += 1;
      console.log(`${fails.length ? 'FAIL' : 'pass'}  ${question.id}  ${Date.now() - started} ms${fails.length ? `  — ${fails.join('; ')}` : ''}`);
      if (fails.length) console.log(`      reply: ${got.text.replace(/\s+/g, ' ').slice(0, 240)}`);
    } catch (err) {
      failed += 1;
      console.log(`FAIL  ${question.id}  — ${err.message}`);
    }
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
