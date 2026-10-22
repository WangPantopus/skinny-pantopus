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
 * A question's `attach` files (in scripts/ai/fixtures) are uploaded through
 * POST /api/upload/ai-media first and sent as the message's images, as the apps do.
 * Phase 3: `cards` replaces the list the app sends; `reset: ["memory"]` forgets the account's
 * saved items first (DELETE /api/ai/memory), so a run can be repeated; `tap` runs the named
 * action of the first card that has it, as the person's tap would (e.g. "remember").
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
  // A busy local stack answers 503 now and then; try a few times before failing the question.
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`${API}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: field(label, 'EMAIL'), password: field(label, 'PASSWORD') }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.accessToken) {
      tokens.set(label, json.accessToken);
      return json.accessToken;
    }
    if (res.status !== 503 || attempt === 3) throw new Error(`sign-in failed for ${label} (${res.status})`);
    await new Promise((resolve) => { setTimeout(resolve, 5000 * attempt); });
  }
}

// "<owner.home>" is OWNER_HOME_ID in the accounts file, and "<guest.event>" GUEST_EVENT_ID.
function fillContext(context) {
  if (!context) return undefined;
  return Object.fromEntries(Object.entries(context).map(([key, value]) => {
    const m = typeof value === 'string' && value.match(/^<([a-z0-9]+)\.([a-z]+)>$/);
    return [key, m ? field(m[1], `${m[2].toUpperCase()}_ID`) : value];
  }));
}

const MEDIA_TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/** Upload a question's fixtures the way the apps do; their references go in the message's images. */
async function upload(question) {
  const form = new FormData();
  for (const name of question.attach) {
    const file = path.join(__dirname, 'fixtures', name);
    form.append('files', new Blob([fs.readFileSync(file)], { type: MEDIA_TYPES[path.extname(name).toLowerCase()] }), name);
  }
  const res = await fetch(`${API}/api/upload/ai-media`, {
    method: 'POST', headers: { Authorization: `Bearer ${await token(question.as)}` }, body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload failed (${res.status} ${json.code || json.error || ''})`);
  return json.images.map((image) => image.url);
}

async function call(question, method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${await token(question.as)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${urlPath} failed (${res.status})`);
}

/** The person's tap on a card's action: its own request, as the app sends it. */
async function tap(question, got) {
  const action = got.cards.flatMap((c) => c.actions || []).find((a) => a.id === question.tap);
  if (!action) return `no ${question.tap} action to tap`;
  await call(question, action.request.method, action.request.path, action.request.body || {});
  return null;
}

async function ask(question) {
  if ((question.reset || []).includes('memory')) await call(question, 'DELETE', '/api/ai/memory');
  const body = {
    message: question.say,
    cards: question.cards || (question.old ? ['pickup_schedule'] : ['pickup_schedule', 'action', 'link']),
  };
  if (question.attach) body.images = await upload(question);
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

/** True when `whole` has every key of `part` with the same value, nested objects compared the same way. */
function includes(whole, part) {
  if (part && typeof part === 'object') {
    return Boolean(whole) && typeof whole === 'object' && Object.entries(part).every(([key, value]) => includes(whole[key], value));
  }
  return whole === part;
}

function check(question, got) {
  const e = question.expect || {};
  const fails = [];
  const types = got.cards.map((c) => c.card);
  const bodies = got.cards.flatMap((c) => [...(c.actions || []), ...(c.items || []).flatMap((item) => item.actions || [])])
    .map((a) => a.request?.body);
  if (e.noError && got.errors.length) fails.push(`error ${got.errors.join(',')}`);
  if (e.card && !types.includes(e.card)) fails.push(`no ${e.card} card (got ${types.join(',') || 'none'})`);
  if (e.cardKind && !got.cards.some((c) => (c.actions || []).some((a) => a.request?.body?.kind === e.cardKind))) fails.push(`no ${e.cardKind} plan card`);
  if (e.then && !got.cards.some((c) => (c.actions || []).some((a) => a.then))) fails.push('card has no follow-up request');
  if (e.cardBodyHas && !got.cards.some((c) => (c.actions || []).some((a) => Object.entries(e.cardBodyHas)
    .every(([key, value]) => a.request?.body?.[key] === value)))) fails.push(`no card request with ${JSON.stringify(e.cardBodyHas)}`);
  if (e.noCard && got.cards.length) fails.push(`unexpected card ${types.join(',')}`);
  if (e.noCardType && types.includes(e.noCardType)) fails.push(`unexpected ${e.noCardType} card`);
  for (const type of e.noCardTypes || []) if (types.includes(type)) fails.push(`unexpected ${type} card`);
  for (const type of e.cards || []) if (!types.includes(type)) fails.push(`no ${type} card (got ${types.join(',') || 'none'})`);
  if (e.bodyIncludes && !bodies.some((body) => includes(body, e.bodyIncludes))) fails.push(`no card request with ${JSON.stringify(e.bodyIncludes)}`);
  if (e.linkContains && !got.links.some((url) => url.includes(e.linkContains))) fails.push(`no link containing ${e.linkContains}`);
  // A memory_save card's saved fields (phase 3): { "sensitive": true } or { "kind": "plan_alert" }.
  if (e.memory && !got.cards.some((c) => c.card === 'memory_save' && includes(c.memory, e.memory))) fails.push(`no memory_save card with ${JSON.stringify(e.memory)}`);
  if (e.textMatches && !new RegExp(e.textMatches, 'i').test(got.text)) fails.push(`text lacks /${e.textMatches}/`);
  if (e.textNotMatches && new RegExp(e.textNotMatches, 'im').test(got.text)) fails.push(`text matches /${e.textNotMatches}/`);
  // What everyone nearby would read: the title and about a card would post.
  if (e.publicNotMatches && bodies.some((body) => body && new RegExp(e.publicNotMatches, 'i').test(`${body.title || ''}\n${body.about || ''}`))) {
    fails.push(`public title or about matches /${e.publicNotMatches}/`);
  }
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
      if (!fails.length && question.tap) {
        const missing = await tap(question, got);
        if (missing) fails.push(missing);
      }
      if (fails.length) failed += 1;
      console.log(`${fails.length ? 'FAIL' : 'pass'}  ${question.id}  ${Date.now() - started} ms${fails.length ? `  — ${fails.join('; ')}` : ''}`);
      if (fails.length) console.log(`      reply: ${got.text.replace(/\s+/g, ' ').slice(0, 240)}${got.errors.length ? `  (errors: ${got.errors.join(', ')})` : ''}`);
    } catch (err) {
      failed += 1;
      console.log(`FAIL  ${question.id}  — ${err.message}`);
    }
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
