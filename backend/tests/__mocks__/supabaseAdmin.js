// ============================================================
// MOCK: supabaseAdmin
// In-memory mock of supabase admin client for tests.
// Stores data in plain objects; supports chained query builders.
// ============================================================

const tables = {};
const UUID_KEYED_TABLES = new Set(['ChatRoom', 'ChatMessage']);
let _rpcMock = null;
let _authMocks = {
  signUp: async () => ({
    data: {
      user: {
        id: 'mock-auth-user-id',
        email: 'mock@example.com',
        email_confirmed_at: null,
        user_metadata: {},
      },
    },
    error: null,
  }),
  signInWithPassword: async () => ({
    data: {
      user: {
        id: 'mock-user-id',
        email: 'mock@example.com',
      },
      session: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      },
    },
    error: null,
  }),
  resend: async () => ({ data: {}, error: null }),
  verifyOtp: async () => ({ data: { user: null, session: null }, error: null }),
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  signInWithOAuth: async () => ({ data: { url: 'https://example.com/oauth' }, error: null }),
  exchangeCodeForSession: async () => ({
    data: {
      session: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      user: {
        id: 'mock-user-id',
        email: 'mock@example.com',
        user_metadata: {},
      },
    },
    error: null,
  }),
  getUser: async () => ({
    data: {
      user: {
        id: 'mock-user-id',
        email: 'mock@example.com',
        user_metadata: {},
      },
    },
    error: null,
  }),
  adminGenerateLink: async () => ({
    data: {
      user: {
        id: 'mock-auth-user-id',
        email: 'mock@example.com',
        email_confirmed_at: null,
        user_metadata: {},
      },
      properties: {
        action_link: 'https://example.com/verify?token=mock',
        hashed_token: 'mock-hashed-token',
        email_otp: '123456',
        redirect_to: 'https://example.com/verify-email',
        verification_type: 'signup',
      },
    },
    error: null,
  }),
  adminSignOut: async () => ({ data: null, error: null }),
  adminGetUserById: async (id) => ({
    data: { user: { id, email: 'mock@example.com', app_metadata: { provider: 'email', providers: ['email'] }, identities: [], last_sign_in_at: new Date().toISOString() } },
    error: null,
  }),
  adminUpdateUserById: async (id, attrs) => ({ data: { user: { id, ...attrs } }, error: null }),
};

function resetTables() {
  Object.keys(tables).forEach((k) => delete tables[k]);
  _rpcMock = null;
  _authMocks = {
    signUp: async () => ({
      data: {
        user: {
          id: 'mock-auth-user-id',
          email: 'mock@example.com',
          email_confirmed_at: null,
          user_metadata: {},
        },
      },
      error: null,
    }),
    signInWithPassword: async () => ({
      data: {
        user: {
          id: 'mock-user-id',
          email: 'mock@example.com',
        },
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        },
      },
      error: null,
    }),
    resend: async () => ({ data: {}, error: null }),
    verifyOtp: async () => ({ data: { user: null, session: null }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    signInWithOAuth: async () => ({ data: { url: 'https://example.com/oauth' }, error: null }),
    exchangeCodeForSession: async () => ({
      data: {
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
        user: {
          id: 'mock-user-id',
          email: 'mock@example.com',
          user_metadata: {},
        },
      },
      error: null,
    }),
    getUser: async () => ({
      data: {
        user: {
          id: 'mock-user-id',
          email: 'mock@example.com',
          user_metadata: {},
        },
      },
      error: null,
    }),
    adminGenerateLink: async () => ({
      data: {
        user: {
          id: 'mock-auth-user-id',
          email: 'mock@example.com',
          email_confirmed_at: null,
          user_metadata: {},
        },
        properties: {
          action_link: 'https://example.com/verify?token=mock',
          hashed_token: 'mock-hashed-token',
          email_otp: '123456',
          redirect_to: 'https://example.com/verify-email',
          verification_type: 'signup',
        },
      },
      error: null,
    }),
    adminSignOut: async () => ({ data: null, error: null }),
    adminGetUserById: async (id) => ({
      data: { user: { id, email: 'mock@example.com', app_metadata: { provider: 'email', providers: ['email'] }, identities: [], last_sign_in_at: new Date().toISOString() } },
      error: null,
    }),
    adminUpdateUserById: async (id, attrs) => ({ data: { user: { id, ...attrs } }, error: null }),
  };
}

// ---------------------------------------------------------------------------
// PersonaFollow → PersonaMembership view aliasing
//
// After P0.1 (collapse migration) PersonaFollow is a SQL view over
// PersonaMembership: rows live in PersonaMembership; the view exposes the
// legacy column shape (most importantly user_id → follower_user_id). After
// migration 136 it includes rank-1 free Follower memberships only; paid
// memberships are checked explicitly through PersonaMembership.
//
// In tests we keep the same fiction: any reference to 'PersonaFollow' is
// internally redirected to 'PersonaMembership' with column projection so
// existing tests that seed/inspect 'PersonaFollow' keep working unchanged.
// ---------------------------------------------------------------------------
// Persistent-login registry tables (backend/database/migrations/160): the
// unique keys the code depends on for single-use semantics.
const AUTH_UNIQUE_KEYS = {
  AuthDpopJti: [['jti']],
  AuthChallenge: [['id']],
  AuthResumeGrant: [['id'], ['grant_hash']],
  AuthSession: [['id']],
  AuthDevice: [['id'], ['user_id', 'device_id']],
  // Financial retries depend on the canonical baseline's provider ID keys.
  PaymentMethod: [['id'], ['stripe_payment_method_id']],
  StripeWebhookEvent: [['id'], ['stripe_event_id']],
};

const PERSONA_FOLLOW_VIEW = 'PersonaFollow';
const PERSONA_MEMBERSHIP_TABLE = 'PersonaMembership';
const PERSONA_FOLLOW_COLUMN_MAP = { follower_user_id: 'user_id' };

function isPersonaFollowView(name) {
  return name === PERSONA_FOLLOW_VIEW;
}

function projectMembershipAsFollow(row) {
  if (!row) return row;
  return { ...row, follower_user_id: row.user_id };
}

function membershipVisibleInPersonaFollow(row) {
  if (!row) return false;
  if (row.tier_id == null) return true;
  const tier = (tables.PersonaTier || []).find((candidate) => candidate.id === row.tier_id);
  return Number(tier?.rank || 0) === 1;
}

function fanHandleFromId(id) {
  // Match the production generator (crypto.randomBytes(4).toString('hex')):
  // 8 hex chars. When seeding from an existing id, hash it through to hex so
  // fan_handles look the same whether they came from the generator or a test
  // fixture.
  const raw = String(id || '');
  const hexish = raw.replace(/[^a-f0-9]/gi, '').toLowerCase();
  if (hexish.length >= 8) return `fan_${hexish.slice(0, 8)}`;
  // Fallback: generate fresh random hex.
  return `fan_${require('crypto').randomBytes(4).toString('hex')}`;
}

function reverseProjectFollowAsMembership(row) {
  if (!row) return row;
  const out = { ...row };
  if ('follower_user_id' in out) {
    if (out.user_id === undefined) out.user_id = out.follower_user_id;
    delete out.follower_user_id;
  }
  if (out.tier_id === undefined) out.tier_id = null;
  if (out.fan_handle === undefined) out.fan_handle = fanHandleFromId(out.id);
  if (out.fan_handle_normalized === undefined) {
    out.fan_handle_normalized = String(out.fan_handle).toLowerCase();
  }
  return out;
}

function getTable(name) {
  if (isPersonaFollowView(name)) {
    if (!tables[PERSONA_MEMBERSHIP_TABLE]) tables[PERSONA_MEMBERSHIP_TABLE] = [];
    return tables[PERSONA_MEMBERSHIP_TABLE]
      .filter(membershipVisibleInPersonaFollow)
      .map(projectMembershipAsFollow);
  }
  if (!tables[name]) tables[name] = [];
  return tables[name];
}

// The message revision triggers (migrations 20261023140000 and 20261023234000): every ChatMessage write, and every
// MessageReaction write on its message, gives the message the room's next message_revision as its sync_version, and a
// new message without a timestamp gets the server's. Realtime delivery and incremental sync order changes by these.
// Revisions keep rising across resetTables: the realtime service remembers what it delivered for the life of the
// module, so a test's change must never look older than one an earlier test made to the same seeded message.
let chatRevisionClock = 0;
function advanceChatRevision(message) {
  if (!message) return;
  const room = getTable('ChatRoom').find((r) => r.id === message.room_id);
  const revision = Math.max(Number(room?.message_revision) || 0, Number(message.sync_version) || 0, chatRevisionClock) + 1;
  chatRevisionClock = revision;
  if (room) room.message_revision = revision;
  message.sync_version = revision;
}

function advanceReactedMessage(reaction) {
  advanceChatRevision(getTable('ChatMessage').find((m) => m.id === reaction?.message_id));
}

function seedTable(name, rows) {
  if (name === 'AddressVerificationToken') {
    // This nullable database column defaults to SQL NULL, not undefined.
    tables[name] = rows.map((row) => ({ used_at: null, ...row }));
    return;
  }
  if (isPersonaFollowView(name)) {
    tables[PERSONA_MEMBERSHIP_TABLE] = rows.map(reverseProjectFollowAsMembership);
    return;
  }
  tables[name] = [...rows];
}

function setRpcMock(fn) {
  _rpcMock = fn;
}
function resetRpc() {
  _rpcMock = null;
}
function setAuthMocks(overrides = {}) {
  _authMocks = { ..._authMocks, ...overrides };
}

/**
 * Chainable query builder that mimics supabaseAdmin.from(table)
 */
function createQueryBuilder(tableName) {
  // 'PersonaFollow' is a SQL view over PersonaMembership; redirect storage to
  // PersonaMembership and translate column names on the way in/out.
  const viewAlias = isPersonaFollowView(tableName);
  const storageTable = viewAlias ? PERSONA_MEMBERSHIP_TABLE : tableName;
  const fieldFor = (field) => (viewAlias && PERSONA_FOLLOW_COLUMN_MAP[field]) || field;
  const projectOut = viewAlias ? projectMembershipAsFollow : (r) => r;

  let rows = () => getTable(storageTable);
  let filters = viewAlias ? [membershipVisibleInPersonaFollow] : [];
  let selectFields = '*';
  let updatePayload = null;
  let insertPayload = null;
  let isSingle = false;
  // `.single()` and `.maybeSingle()` differ in ONE way that production
  // code branches on: real PostgREST reports zero rows from `.single()`
  // as an ERROR (code PGRST116), while `.maybeSingle()` puts null in
  // `data` and leaves `error` null. Collapsing them here meant a test
  // could not tell the two apart — which is exactly why swapping a
  // route's `maybeSingle` for `single` did not fail the suite, even
  // though in production it turns "no such home" into a 500.
  let isStrictSingle = false;
  let isUpsert = false;
  let ignoreUpsertDuplicates = false;
  let upsertOnConflict = null;
  let isCountMode = false;
  let isHeadMode = false;
  let rangeStart = null;
  let rangeEnd = null;

  const builder = {
    select(fields = '*', options) {
      selectFields = fields;
      if (options?.count) isCountMode = true;
      if (options?.head) isHeadMode = true;
      return builder;
    },
    eq(field, value) {
      const f = fieldFor(field);
      const [column, jsonKey] = f.split('->>');
      // This JSONB column is filtered by its serialized PostgREST value. PostgreSQL
      // compares JSON content (including legacy JSON strings), not JS references.
      if (column === 'urgent_details' && !jsonKey && typeof value === 'string') {
        const expected = JSON.parse(value);
        filters.push(row => require('node:util').isDeepStrictEqual(row[column], expected));
      } else {
        filters.push((row) => (jsonKey ? row[column]?.[jsonKey] : row[column]) === value);
      }
      return builder;
    },
    ilike(field, pattern) {
      const raw = String(pattern || '').toLowerCase();
      const escaped = raw
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      const re = new RegExp(`^${escaped}$`, 'i');
      const f = fieldFor(field);
      filters.push((row) => re.test(String(row[f] || '')));
      return builder;
    },
    neq(field, value) {
      const f = fieldFor(field);
      filters.push((row) => row[f] !== value);
      return builder;
    },
    in(field, values) {
      const f = fieldFor(field);
      filters.push((row) => values.includes(row[f]));
      return builder;
    },
    not(field, operator, value) {
      const f = fieldFor(field);
      if (operator === 'in') {
        // value like '("a","b")' — parse it
        const vals = value
          .replace(/[()]/g, '')
          .split(',')
          .map((s) => s.replace(/"/g, '').trim());
        filters.push((row) => !vals.includes(row[f]));
      } else if (operator === 'eq') {
        filters.push((row) => row[f] !== value);
      } else if (operator === 'is') {
        filters.push((row) => row[f] !== value);
      }
      return builder;
    },
    lte(field, value) {
      const f = fieldFor(field);
      filters.push((row) => row[f] <= value);
      return builder;
    },
    gte(field, value) {
      const f = fieldFor(field);
      filters.push((row) => row[f] >= value);
      return builder;
    },
    lt(field, value) {
      const f = fieldFor(field);
      filters.push((row) => row[f] < value);
      return builder;
    },
    gt(field, value) {
      const f = fieldFor(field);
      filters.push((row) => row[f] > value);
      return builder;
    },
    is(field, value) {
      const f = fieldFor(field);
      filters.push((row) => row[f] === value);
      return builder;
    },
    contains(field, values) {
      const f = fieldFor(field);
      // Supabase .contains() — array column must include ALL of the given
      // values; JSON/object columns must contain every provided key/value.
      filters.push((row) => {
        const col = row[f];
        if (Array.isArray(values)) {
          if (!Array.isArray(col)) return false;
          return values.every((v) => col.includes(v));
        }
        if (values && typeof values === 'object') {
          if (!col || typeof col !== 'object' || Array.isArray(col)) return false;
          return Object.entries(values).every(([key, value]) => col[key] === value);
        }
        return false;
      });
      return builder;
    },
    overlaps(field, values) {
      const f = fieldFor(field);
      // Supabase .overlaps() — array column shares at least one element
      filters.push((row) => {
        const col = row[f];
        if (!Array.isArray(col)) return false;
        return values.some((v) => col.includes(v));
      });
      return builder;
    },
    or(filterString) {
      // Parse Supabase .or() filter strings.
      // Supports patterns like:
      //   "and(requester_id.eq.a,addressee_id.eq.b),and(requester_id.eq.b,addressee_id.eq.a)"
      //   "field.eq.value,field.eq.value"
      const splitGroups = (input) => {
        const groups = [];
        let depth = 0;
        let quoted = false;
        let start = 0;
        for (let i = 0; i < input.length; i++) {
          const ch = input[i];
          if (ch === '"') quoted = !quoted;
          if (quoted) continue;
          if (ch === '(' || ch === '{') depth++;
          if (ch === ')' || ch === '}') depth--;
          if (ch === ',' && depth === 0) {
            groups.push(input.slice(start, i).trim());
            start = i + 1;
          }
        }
        groups.push(input.slice(start).trim());
        return groups;
      };
      const parseCondition = (cond) => {
        const logic = cond.match(/^(and|or)\((.*)\)$/);
        if (logic) {
          const children = splitGroups(logic[2]).map(parseCondition);
          return logic[1] === 'and'
            ? (row) => children.every((fn) => fn(row))
            : (row) => children.some((fn) => fn(row));
        }
        const match = cond.match(/^(\w+(?:->>\w+)?)\.(eq|neq|gt|gte|lt|lte|is|cs)\.(.+)$/);
        if (!match) return () => true; // Other operators remain legacy no-ops.
        const [, field, op, val] = match;
        const [column, jsonKey] = field.split('->>');
        let value = val;
        if (value === 'null') value = null;
        else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        return (row) => {
          const actual = (jsonKey ? row[column]?.[jsonKey] : row[column]) ?? null;
          if (op === 'is') return actual === value;
          // SQL comparison with NULL is unknown, including neq.
          if (actual == null || value == null) return false;
          const compared = typeof actual === 'number' ? Number(value) : value;
          switch (op) {
            case 'eq': return actual === compared;
            case 'neq': return actual !== compared;
            case 'gt': return actual > compared;
            case 'gte': return actual >= compared;
            case 'lt': return actual < compared;
            case 'lte': return actual <= compared;
            case 'cs': return Array.isArray(actual)
              && splitGroups(value.slice(1, -1)).every((item) => actual.includes(item));
            default: return true;
          }
        };
      };
      const groupFns = splitGroups(filterString).map(parseCondition);
      filters.push((row) => groupFns.some((fn) => fn(row)));
      return builder;
    },
    textSearch(_field, _query, _opts) {
      // No-op in mock — accept all rows (text search is integration-level)
      return builder;
    },
    filter(field, operator, value) {
      const f = fieldFor(field);
      if (operator === 'is') {
        filters.push((row) => row[f] === (value === 'null' ? null : value));
      }
      return builder;
    },
    order(field, opts = {}) {
      return builder;
    },
    limit(n) {
      return builder;
    },
    range(from, to) {
      rangeStart = from;
      rangeEnd = to;
      return builder;
    },
    single() {
      isSingle = true;
      isStrictSingle = true;
      return builder;
    },
    maybeSingle() {
      isSingle = true;
      isStrictSingle = false;
      return builder;
    },
    // INSERT
    insert(payload) {
      insertPayload = Array.isArray(payload) ? payload : [payload];
      return builder;
    },
    upsert(payload, options) {
      insertPayload = Array.isArray(payload) ? payload : [payload];
      isUpsert = true;
      ignoreUpsertDuplicates = options?.ignoreDuplicates === true;
      // Capture the onConflict key so the executor can do conflict
      // resolution by composite columns (e.g. 'persona_id,user_id'),
      // matching real Postgres ON CONFLICT semantics.
      upsertOnConflict = options && typeof options.onConflict === 'string'
        ? options.onConflict.split(',').map((s) => s.trim()).filter(Boolean)
        : null;
      return builder;
    },
    // UPDATE
    update(payload) {
      updatePayload = payload;
      return builder;
    },
    // DELETE
    delete() {
      updatePayload = '__DELETE__';
      return builder;
    },
    // Execute — returns a real Promise so .then().catch() chains work
    then(resolve, reject) {
      return new Promise((res) => {
        try {
          res(builder._execute());
        } catch (err) {
          res({ data: null, error: { message: err.message } });
        }
      }).then(resolve, reject);
    },
    catch(handler) {
      return builder.then(undefined, handler);
    },
    _execute() {
      const table = (() => {
        if (!tables[storageTable]) tables[storageTable] = [];
        return tables[storageTable];
      })();

      // INSERT
      if (insertPayload) {
        // Persona-scoped fan_handle uniqueness: real Postgres has
        // UNIQUE (persona_id, fan_handle_normalized) on PersonaMembership.
        // The check is applied for both inserts and upserts whose
        // resolved-write target lands on a row that doesn't own the
        // conflicting handle.
        const findFanHandleCollision = (row) => {
          if (storageTable !== 'PersonaMembership') return null;
          if (!row.persona_id || !row.fan_handle_normalized) return null;
          return table.find((existing) =>
            existing.persona_id === row.persona_id
            && existing.user_id !== row.user_id
            && String(existing.fan_handle_normalized || '').toLowerCase()
              === String(row.fan_handle_normalized).toLowerCase());
        };
        const findAudienceIdentityCollision = (row) => {
          if (storageTable !== 'AudienceIdentity') return null;
          const normalized = String(row.handle_normalized || '').toLowerCase();
          return table.find((existing) =>
            existing.id !== row.id
            && (
              existing.user_id === row.user_id
              || (normalized && String(existing.handle_normalized || '').toLowerCase() === normalized)
            ));
        };
        // BookingPage has a UNIQUE index on lower(slug) (migration 159:
        // BookingPage_slug_unique); (owner_type, owner_id) is only indexed, not
        // unique — mirror that so ensurePage's slug-collision retry is testable.
        const findBookingPageSlugCollision = (row) => {
          if (storageTable !== 'BookingPage') return null;
          if (!row.slug) return null;
          const slug = String(row.slug).toLowerCase();
          return table.find((existing) =>
            existing.id !== row.id
            && String(existing.slug || '').toLowerCase() === slug);
        };

        const inserted = [];
        for (const rawRow of insertPayload) {
          const row = viewAlias ? reverseProjectFollowAsMembership({ ...rawRow }) : { ...rawRow };
          if (!row.id) {
            // Chat rooms and messages get uuid keys as in Postgres: realtime delivery announces only uuid ids.
            row.id = UUID_KEYED_TABLES.has(storageTable) ? require('crypto').randomUUID()
              : `mock-${storageTable.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          }
          if (viewAlias) {
            if (!rawRow.fan_handle) row.fan_handle = fanHandleFromId(row.id);
            if (!rawRow.fan_handle_normalized) {
              row.fan_handle_normalized = String(row.fan_handle).toLowerCase();
            }
          }

          if (isUpsert) {
            // ON CONFLICT (cols...) DO UPDATE — match by the composite
            // key first, falling back to id for legacy callers.
            let idx = -1;
            if (Array.isArray(upsertOnConflict) && upsertOnConflict.length > 0) {
              idx = table.findIndex((r) =>
                upsertOnConflict.every((col) => r[col] === row[col]));
            }
            if (idx < 0 && row.id) {
              idx = table.findIndex((r) => r.id === row.id);
            }
            if (idx >= 0) {
              // PostgREST resolution=ignore-duplicates maps to DO NOTHING;
              // no existing columns or timestamps change, and no row returns.
              if (ignoreUpsertDuplicates) continue;
              table[idx] = { ...table[idx], ...row };
              inserted.push(table[idx]);
              continue;
            }
          }

          // Persistent-login tables (migration 160) rely on PK / UNIQUE
          // conflicts for single-use semantics (DPoP jti replay cache,
          // one-shot step-up jtis, resume-grant hashes). Mirror those
          // constraints so the 23505 branches are exercised in tests.
          const authUnique = AUTH_UNIQUE_KEYS[storageTable];
          if (authUnique) {
            const collision = table.find((existing) =>
              authUnique.some((cols) => cols.every((col) => existing[col] !== undefined && existing[col] === row[col])));
            if (collision) {
              return { data: null, error: {
                code: '23505',
                message: `duplicate key value violates unique constraint "${storageTable}_key"`,
              } };
            }
          }

          // Both fresh inserts AND upserts that resolved as inserts
          // (no matching conflict row) must respect the persona-scoped
          // fan_handle uniqueness constraint.
          if (findFanHandleCollision(row)) {
            return { data: null, error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "PersonaMembership_persona_handle_key"',
            } };
          }
          if (findAudienceIdentityCollision(row)) {
            return { data: null, error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "AudienceIdentity_handle_normalized_key"',
            } };
          }
          if (findBookingPageSlugCollision(row)) {
            return { data: null, error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "BookingPage_slug_unique"',
            } };
          }

          if (storageTable === 'ChatMessage') {
            if (!row.created_at) row.created_at = new Date().toISOString();
            advanceChatRevision(row);
          }
          table.push({ ...row });
          inserted.push(row);
          if (storageTable === 'MessageReaction') advanceReactedMessage(row);
        }

        const projected = inserted.map(projectOut);
        return { data: isSingle ? projected[0] : projected, error: null };
      }

      // FILTER
      let matched = table.filter((row) => filters.every((fn) => fn(row)));
      const matchedCount = matched.length;

      if (rangeStart != null || rangeEnd != null) {
        const start = Math.max(0, rangeStart || 0);
        const endExclusive = rangeEnd == null ? matched.length : rangeEnd + 1;
        matched = matched.slice(start, endExclusive);
      }

      // UPDATE
      if (updatePayload && updatePayload !== '__DELETE__') {
        const payload = viewAlias
          ? reverseProjectFollowAsMembership({ ...updatePayload })
          : updatePayload;
        matched.forEach((row) => {
          const idx = table.indexOf(row);
          table[idx] = { ...row, ...payload };
          if (storageTable === 'ChatMessage') advanceChatRevision(table[idx]);
          if (storageTable === 'MessageReaction') advanceReactedMessage(table[idx]);
        });
        const updated = matched.map((row) => {
          const idx = table.findIndex((r) => r.id === row.id);
          return table[idx];
        });
        const projected = updated.map(projectOut);
        return { data: isSingle ? projected[0] || null : projected, error: null };
      }

      // DELETE
      if (updatePayload === '__DELETE__') {
        matched.forEach((row) => {
          const idx = table.indexOf(row);
          if (idx >= 0) table.splice(idx, 1);
          if (storageTable === 'MessageReaction') advanceReactedMessage(row);
        });
        return { data: matched.map(projectOut), error: null };
      }

      // SELECT
      const projectedMatched = matched.map(projectOut);
      let result;
      if (isSingle) {
        const only = projectedMatched[0] || null;
        result = only === null && isStrictSingle
          // What real PostgREST returns for `.single()` with no rows.
          ? { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows' } }
          : { data: only, error: null };
      } else {
        result = { data: isHeadMode ? null : projectedMatched, error: null };
      }
      if (isCountMode) {
        result.count = matchedCount;
      }
      return result;
    },
  };

  return builder;
}

// Chat readers and the read boundary, answered from the tables the way their SQL does: get_user_chat_rooms
// (20261023233000), get_room_previews (20261023180000) and mark_chat_read_boundaries (20261023235000). A task room's
// business-owner permission branch isn't modelled: a leftover member of an assigned business task sees the room only
// as its owner or worker, as when that permission is absent.
const byNewest = (a, b) => (Date.parse(b.created_at) - Date.parse(a.created_at)) || String(b.id).localeCompare(String(a.id));
function latestVisibleMessage(roomId) {
  return getTable('ChatMessage').filter((m) => m.room_id === roomId && !m.deleted).sort(byNewest)[0] || null;
}

function chatRoomsPage({ p_user_id: userId, p_actor_id: actorId, p_limit: limit, p_before_at: beforeAt, p_before_id: beforeId, p_type: type }) {
  const eligible = [];
  for (const cp of getTable('ChatParticipant')) {
    if (cp.user_id !== userId || !cp.is_active) continue;
    const r = getTable('ChatRoom').find((room) => room.id === cp.room_id);
    if (!r || (type != null && r.type !== type)) continue;
    const gig = r.type === 'gig' ? getTable('Gig').find((g) => g.id === r.gig_id) : null;
    if (gig?.accepted_by && ![gig.user_id, gig.accepted_by].some((id) => id === userId || id === actorId)) continue;
    const sortAt = latestVisibleMessage(r.id)?.created_at || r.updated_at || r.created_at || '1970-01-01T00:00:00Z';
    eligible.push({ id: r.id, sort_at: sortAt, unread: Number(cp.unread_count) || 0, membership: {
      room_id: r.id, unread_count: cp.unread_count, last_read_at: cp.last_read_at, notifications_enabled: cp.notifications_enabled,
      preferences_updated_at: cp.preferences_updated_at, role: cp.role, is_active: cp.is_active,
      room: { id: r.id, type: r.type, name: r.name, description: r.description, gig_id: r.gig_id, home_id: r.home_id,
        is_active: r.is_active, created_at: r.created_at, updated_at: r.updated_at } } });
  }
  eligible.sort((a, b) => (Date.parse(b.sort_at) - Date.parse(a.sort_at)) || String(b.id).localeCompare(String(a.id)));
  const cap = Math.min(Math.max(Number(limit) || 1, 1), 500);
  const matching = eligible.filter((e) => !beforeAt || Date.parse(e.sort_at) < Date.parse(beforeAt)
    || (Date.parse(e.sort_at) === Date.parse(beforeAt) && String(e.id) < String(beforeId)));
  return { data: { entries: matching.slice(0, cap).map(({ id, sort_at: sortAt, membership }) => ({ id, sort_at: sortAt, membership })),
    total: eligible.length, totalUnread: eligible.reduce((sum, e) => sum + e.unread, 0), hasMore: matching.length > cap }, error: null };
}

function roomPreviews({ p_room_ids: roomIds }) {
  return { data: [...new Set(roomIds || [])].map(latestVisibleMessage).filter(Boolean)
    .map(({ room_id: roomId, message, created_at: createdAt, deleted, type, attachments }) =>
      ({ room_id: roomId, message, created_at: createdAt, deleted, type, attachments }))
    .sort((a, b) => String(a.room_id).localeCompare(String(b.room_id))), error: null };
}

function markReadBoundaries({ p_user_id: userId, p_room_ids: roomIds, p_boundaries: boundaries, p_through_message_id: through, p_request_at: requestAt }) {
  const members = getTable('ChatParticipant');
  if ((roomIds || []).some((roomId) => !members.some((p) => p.room_id === roomId && p.user_id === userId && p.is_active))) {
    return { data: null, error: { code: '42501', message: 'Access denied' } };
  }
  const messages = getTable('ChatMessage');
  let cursors = boundaries;
  if (!cursors && through) {
    const target = messages.find((m) => m.id === through && roomIds.includes(m.room_id));
    if (!target) return { data: null, error: { code: '22023', message: 'Invalid read cursor' } };
    cursors = { [target.room_id]: through };
  }
  cursors = cursors || Object.fromEntries(roomIds.map((id) => [id, null]));
  const rows = [];
  for (const [roomId, messageId] of Object.entries(cursors).sort(([a], [b]) => a.localeCompare(b))) {
    const participant = members.find((p) => p.room_id === roomId && p.user_id === userId && p.is_active);
    // Without a cursor, read up to the request time; never move a boundary backwards.
    const boundary = messageId ? messages.find((m) => m.id === messageId && m.room_id === roomId)
      : messages.filter((m) => m.room_id === roomId && !m.deleted && Date.parse(m.created_at) <= Date.parse(requestAt)).sort(byNewest)[0];
    const current = messages.find((m) => m.id === participant.last_read_message_id);
    const advance = boundary && (!current || byNewest(boundary, current) < 0);
    if (advance) Object.assign(participant, { last_read_message_id: boundary.id, last_read_message_at: boundary.created_at, last_read_at: requestAt });
    const readThrough = messages.find((m) => m.id === participant.last_read_message_id);
    participant.unread_count = messages.filter((m) => m.room_id === roomId && !m.deleted && m.user_id !== userId
      && (!readThrough || byNewest(m, readThrough) < 0)).length;
    rows.push({ room_id: roomId, user_id: userId, unread_count: participant.unread_count,
      through_message_id: advance ? boundary.id : null, last_read_at: participant.last_read_at });
  }
  const unreadCount = members.filter((p) => p.user_id === userId && p.is_active && roomIds.includes(p.room_id))
    .reduce((sum, p) => sum + (Number(p.unread_count) || 0), 0);
  return { data: { data: rows, unreadCount }, error: null };
}

const CHAT_RPCS = { get_user_chat_rooms: chatRoomsPage, get_room_previews: roomPreviews, mark_chat_read_boundaries: markReadBoundaries };

const supabaseAdmin = {
  from: (tableName) => createQueryBuilder(tableName),
  rpc: async (...args) => {
    if (_rpcMock) return _rpcMock(...args);
    if (CHAT_RPCS[args[0]]) return CHAT_RPCS[args[0]](args[1] || {});
    if (args[0] === 'reconcile_payment_wallet_release') return require('./walletRelease')(args[1], getTable);
    // Read-only capability defaults closed in unrelated Home route fixtures.
    // Deletion/authority behavior itself is covered by real SQL contracts.
    if (args[0] === 'home_delete_eligibility') return { data: { allowed: false, deleted: false, code: 'HOME_DELETE_ACCESS_DENIED' }, error: null };
    // Account deletion's dry run: route fixtures hold no retained records.
    // The real function replays the delete in a rolled-back transaction and is
    // verified against a live stack.
    if (args[0] === 'account_deletion_dry_run') return { data: { ok: true }, error: null };
    if (args[0] === 'admit_mail_verification') return require('./mailAdmission')(args[1], getTable);
    if (args[0] === 'confirm_mail_verification') return require('./mailConfirmation')(args[1], getTable);
    if (['claim_mail_verification_dispatch', 'record_mail_verification_webhook'].includes(args[0])) {
      return require('./mailMetadata')(args[0], args[1], getTable);
    }
    if (['bind_payment_customer', 'save_payment_method', 'set_default_payment_method', 'begin_payment_method_removal', 'complete_payment_method_removal'].includes(args[0])) {
      return require('./paymentMethods')(args[0], args[1], getTable);
    }
    return { data: null, error: { message: 'No RPC mock configured' } };
  },
  auth: {
    signUp: (...args) => _authMocks.signUp(...args),
    signInWithPassword: (...args) => _authMocks.signInWithPassword(...args),
    resend: (...args) => _authMocks.resend(...args),
    verifyOtp: (...args) => _authMocks.verifyOtp(...args),
    resetPasswordForEmail: (...args) => _authMocks.resetPasswordForEmail(...args),
    signInWithOAuth: (...args) => _authMocks.signInWithOAuth(...args),
    exchangeCodeForSession: (...args) => _authMocks.exchangeCodeForSession(...args),
    getUser: (...args) => _authMocks.getUser(...args),
    admin: {
      deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
      generateLink: (...args) => _authMocks.adminGenerateLink(...args),
      signOut: (...args) => _authMocks.adminSignOut(...args),
      // Activity lookups read auth.users, not the public User table.
      // Default: a recently-active user, so callers that fail closed on
      // uncertainty take the "active" branch unless a test says otherwise.
      getUserById: (...args) => _authMocks.adminGetUserById(...args),
      updateUserById: (...args) => _authMocks.adminUpdateUserById(...args),
    },
  },
};

module.exports = supabaseAdmin;
module.exports.resetTables = resetTables;
module.exports.seedTable = seedTable;
module.exports.getTable = getTable;
module.exports.setRpcMock = setRpcMock;
module.exports.chatRpc = (name, params) => CHAT_RPCS[name](params || {});
module.exports.resetRpc = resetRpc;
module.exports.setAuthMocks = setAuthMocks;
