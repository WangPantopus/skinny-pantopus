#!/usr/bin/env node
// Checks that this environment's Supabase sign-in settings accept the apps this commit ships.
// Read-only: one GET of the project's Auth settings through Supabase's Management API. It prints Apple app IDs
// only, which are public (the apps' association files carry them); never the provider secret or the project.
//
// Why: an Apple identity token names the app it was issued to, and Supabase Auth refuses it unless that ID is in
// the Apple provider's Client IDs. The iPhone app's bundle ID changed on October 23, 2026 and the hosted list
// didn't, so Continue with Apple failed in production until November 10. deploy-backend.yml runs this at every
// backend release: a changed ID or setting turns that run red before a store build carries it.
//
// Exit codes: 0 the settings match, 1 they don't, 3 the settings couldn't be read (nothing is known).
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

const PROJECT_YML = path.join(__dirname, '../../frontend/apps/ios/project.yml');
const APPLE_ENTITLEMENT = 'com.apple.developer.applesignin';
const APP_ID = /^[A-Za-z0-9][A-Za-z0-9.-]{0,254}$/;
const WHERE = 'Supabase > Authentication > Sign In / Providers > Apple';

// Bundle IDs of the targets that carry the Sign in with Apple entitlement: the IDs Apple puts in their tokens.
function appleAppIds(projectYml) {
  // From "targets:" to the next top-level key, one block per target name (two spaces in).
  const targets = /^targets:\n([\s\S]*?)(?=^[A-Za-z_]|(?![\s\S]))/m.exec(projectYml);
  if (!targets) throw new Error('frontend/apps/ios/project.yml has no targets section');
  const ids = [];
  for (const block of targets[1].split(/^(?= {2}[A-Za-z_][\w-]*:\s*$)/m)) {
    if (!new RegExp(`^\\s+${APPLE_ENTITLEMENT.replaceAll('.', '\\.')}:`, 'm').test(block)) continue;
    const id = /^\s+PRODUCT_BUNDLE_IDENTIFIER:\s*(\S+)\s*$/m.exec(block);
    if (!id || !APP_ID.test(id[1])) throw new Error('A target with Sign in with Apple has no plain PRODUCT_BUNDLE_IDENTIFIER');
    ids.push(id[1]);
  }
  if (!ids.length) throw new Error('No target in frontend/apps/ios/project.yml has the Sign in with Apple entitlement');
  return ids;
}

const listed = (value) => String(value || '').split(',').map((id) => id.trim()).filter((id) => APP_ID.test(id));

// What is wrong, in words the person fixing it can act on. Empty when the settings match.
function findProblems({ settings, appIds }) {
  if (settings.external_apple_enabled !== true) {
    return [`The Apple provider is switched off (${WHERE}), so Continue with Apple fails in every app.`];
  }
  const accepted = [...listed(settings.external_apple_client_id), ...listed(settings.external_apple_additional_client_ids)];
  return appIds.filter((id) => !accepted.includes(id)).map((id) =>
    `The iPhone app's ID ${id} isn't in the Apple provider's Client IDs (${WHERE}; it lists ` +
    `${accepted.join(', ') || 'none'}), so Continue with Apple fails in the iPhone app. Add ${id} and keep the others.`);
}

class Unreadable extends Error {}

// 401/403/404 mean the token or project is wrong: reading again won't help. A dropped connection, 429 or 5xx is
// read again twice.
async function readAuthSettings({ ref, token, fetchImpl = fetch, waitsMs = [2000, 5000] }) {
  for (let attempt = 0; ; attempt += 1) {
    let failure;
    try {
      const response = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) return await response.json();
      failure = `Supabase answered ${response.status}`;
      if (response.status !== 429 && response.status < 500) throw new Unreadable(failure);
    } catch (error) {
      if (error instanceof Unreadable) throw error;
      failure = failure || `no answer from Supabase (${error.name})`;
    }
    if (attempt >= waitsMs.length) throw new Unreadable(failure);
    await sleep(waitsMs[attempt]);
  }
}

// A project file this can't read an app ID from is a mismatch, not "unreadable": it is the repository's to fix,
// and a quiet pass would switch the check off.
async function check({ env = process.env, projectYml, fetchImpl } = {}) {
  let appIds;
  try {
    appIds = appleAppIds(projectYml ?? fs.readFileSync(PROJECT_YML, 'utf8'));
  } catch (error) {
    return { result: 'mismatch', appIds: [], message: `scripts/deploy/check-signin-settings.cjs couldn't find the iPhone app's ID: ${error.message}.` };
  }
  const ref = String(env.SUPABASE_PROJECT_ID || '');
  const token = String(env.SUPABASE_ACCESS_TOKEN || '');
  if (!/^[a-z]{20}$/.test(ref) || !token) {
    return { result: 'unreadable', appIds, message: 'SUPABASE_PROJECT_ID or SUPABASE_ACCESS_TOKEN is missing for this environment.' };
  }
  let settings;
  try {
    settings = await readAuthSettings({ ref, token, fetchImpl });
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { result: 'unreadable', appIds, message: `The sign-in settings couldn't be read: ${error.message}.` };
  }
  if (!settings || typeof settings !== 'object') {
    return { result: 'unreadable', appIds, message: "The sign-in settings couldn't be read: Supabase's answer wasn't a settings object." };
  }
  const problems = findProblems({ settings, appIds });
  return problems.length
    ? { result: 'mismatch', appIds, message: problems.join(' ') }
    : { result: 'ok', appIds, message: `Apple sign-in accepts ${appIds.join(', ')}.` };
}

async function main() {
  // Anything unexpected is reported as "couldn't be read" rather than ending without a result, which the
  // reporting job would take for "not run".
  const outcome = await check().catch((error) => ({ result: 'unreadable', message: `The check stopped early (${error.name}).` }));
  // One line each: deploy-backend.yml hands them to the job that reports the result.
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `result=${outcome.result}\nmessage=${outcome.message.replace(/\s+/g, ' ')}\n`);
  }
  console.log(outcome.message);
  process.exitCode = { ok: 0, mismatch: 1, unreadable: 3 }[outcome.result];
}

if (require.main === module) main();

module.exports = { appleAppIds, findProblems, readAuthSettings, check };
