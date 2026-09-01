#!/usr/bin/env node
'use strict';

/**
 * Live Identity Firewall raw-user leak audit.
 *
 * Example:
 *   IDENTITY_FIREWALL_AUDIT_BASE_URL=http://localhost:5001 \
 *   IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE=riverhome \
 *   IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE=mayabuilds \
 *   IDENTITY_FIREWALL_FORBIDDEN_VALUES=private@example.com,"Legal Secret",private-user-id \
 *   npm run audit:identity-firewall:raw-users
 */

const DEFAULT_FORBIDDEN_KEYS = new Set([
  'email',
  'phone',
  'phone_number',
  'legal_name',
  'first_name',
  'last_name',
  'address',
  'street_address',
  'location_address',
  'exact_address',
  'home_id',
  'author_user_id',
  'owner_id',
  'poster_id',
  'actor_user_id',
  'follower_user_id',
  'following_id',
  'beneficiary_user_id',
]);

function normalizeKey(key) {
  return String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function printHelp() {
  console.log(`Identity Firewall live raw-user audit

Required:
  Provide at least one endpoint via handles/ids or IDENTITY_FIREWALL_AUDIT_ENDPOINTS.

Common env:
  IDENTITY_FIREWALL_AUDIT_BASE_URL        API origin, default http://localhost:5001
  IDENTITY_FIREWALL_AUDIT_TOKEN           Optional bearer token
  IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE    Adds local profile, activity, gigs, listings
  IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE  Adds persona profile and posts
  IDENTITY_FIREWALL_AUDIT_POST_ID         Adds post detail
  IDENTITY_FIREWALL_AUDIT_GIG_ID          Adds gig detail
  IDENTITY_FIREWALL_AUDIT_LISTING_ID      Adds listing detail
  IDENTITY_FIREWALL_AUDIT_CHAT_ROOM_ID    Adds chat room messages
  IDENTITY_FIREWALL_AUDIT_ENDPOINTS       Extra comma-separated paths or URLs
  IDENTITY_FIREWALL_FORBIDDEN_VALUES      Comma-separated private values to reject
  IDENTITY_FIREWALL_ALLOWED_KEYS          Comma-separated response keys to allow
`);
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinUrl(baseUrl, endpoint) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base = baseUrl.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

function buildEndpoints(env) {
  const endpoints = [];
  const add = (value) => {
    if (value && !endpoints.includes(value)) endpoints.push(value);
  };

  const localHandle = env.IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE;
  if (localHandle) {
    const encoded = encodeURIComponent(localHandle);
    add(`/api/local-profiles/${encoded}`);
    add(`/api/local-profiles/${encoded}/activity`);
    add(`/api/local-profiles/${encoded}/gigs`);
    add(`/api/local-profiles/${encoded}/listings`);
  }

  const personaHandle = env.IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE;
  if (personaHandle) {
    const encoded = encodeURIComponent(personaHandle.replace(/^@/, ''));
    add(`/api/personas/${encoded}`);
    add(`/api/personas/${encoded}/posts`);
  }

  if (env.IDENTITY_FIREWALL_AUDIT_POST_ID) {
    add(`/api/posts/${encodeURIComponent(env.IDENTITY_FIREWALL_AUDIT_POST_ID)}`);
  }
  if (env.IDENTITY_FIREWALL_AUDIT_GIG_ID) {
    add(`/api/gigs/${encodeURIComponent(env.IDENTITY_FIREWALL_AUDIT_GIG_ID)}`);
  }
  if (env.IDENTITY_FIREWALL_AUDIT_LISTING_ID) {
    add(`/api/listings/${encodeURIComponent(env.IDENTITY_FIREWALL_AUDIT_LISTING_ID)}`);
  }
  if (env.IDENTITY_FIREWALL_AUDIT_CHAT_ROOM_ID) {
    add(`/api/chat/rooms/${encodeURIComponent(env.IDENTITY_FIREWALL_AUDIT_CHAT_ROOM_ID)}/messages`);
  }

  for (const endpoint of splitList(env.IDENTITY_FIREWALL_AUDIT_ENDPOINTS)) {
    add(endpoint);
  }

  return endpoints;
}

function scan(value, path, options, findings) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, `${path}[${index}]`, options, findings));
    return;
  }

  if (value && typeof value === 'object') {
    const allowedKeys = options.allowedKeys || new Set();
    for (const [key, child] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      const normalizedKey = normalizeKey(key);
      if (!allowedKeys.has(key) && !allowedKeys.has(normalizedKey) && (
        options.forbiddenKeys.has(key) || options.forbiddenKeys.has(normalizedKey)
      )) {
        findings.push({
          path: nextPath,
          type: 'forbidden_key',
          key,
          normalizedKey,
        });
      }
      scan(child, nextPath, options, findings);
    }
    return;
  }

  if (typeof value === 'string' && value) {
    for (const forbiddenValue of options.forbiddenValues) {
      if (value.includes(forbiddenValue)) {
        findings.push({
          path,
          type: 'forbidden_value',
          value: forbiddenValue,
        });
      }
    }
  }
}

async function fetchJson(url, token) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const baseUrl = process.env.IDENTITY_FIREWALL_AUDIT_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5001';
  const token = process.env.IDENTITY_FIREWALL_AUDIT_TOKEN || process.env.API_TOKEN || '';
  const endpoints = buildEndpoints(process.env);
  if (endpoints.length === 0) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const options = {
    forbiddenKeys: DEFAULT_FORBIDDEN_KEYS,
    allowedKeys: new Set(splitList(process.env.IDENTITY_FIREWALL_ALLOWED_KEYS).flatMap((key) => [key, normalizeKey(key)])),
    forbiddenValues: splitList(process.env.IDENTITY_FIREWALL_FORBIDDEN_VALUES),
  };

  const failures = [];
  console.log(`[INFO] auditing ${endpoints.length} endpoint(s) against ${baseUrl}`);

  for (const endpoint of endpoints) {
    const url = joinUrl(baseUrl, endpoint);
    try {
      const result = await fetchJson(url, token);
      if (!result.ok) {
        failures.push({ endpoint, status: result.status, findings: [{ type: 'http_error', path: '$' }] });
        console.log(`[FAIL] ${endpoint} status=${result.status}`);
        continue;
      }

      const findings = [];
      scan(result.data, '$', options, findings);
      if (findings.length > 0) {
        failures.push({ endpoint, status: result.status, findings });
        console.log(`[FAIL] ${endpoint} findings=${findings.length}`);
      } else {
        console.log(`[PASS] ${endpoint}`);
      }
    } catch (err) {
      failures.push({ endpoint, status: null, findings: [{ type: 'request_error', path: '$', error: err.message }] });
      console.log(`[FAIL] ${endpoint} request_error=${err.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log('[PASS] no raw-user leak findings');
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_FORBIDDEN_KEYS,
  buildEndpoints,
  joinUrl,
  normalizeKey,
  scan,
  splitList,
};
