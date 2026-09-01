// ============================================================
// MOCK: supabaseAdmin
// In-memory mock of supabase admin client for tests.
// Stores data in plain objects; supports chained query builders.
// ============================================================

const tables = {};
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

function seedTable(name, rows) {
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
  let isUpsert = false;
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
      filters.push((row) => row[f] === value);
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
      const parseCondition = (cond) => {
        // Match field.operator.value patterns
        const match = cond.match(/^(\w+)\.(eq|neq|gt|gte|lt|lte|is)\.(.+)$/);
        if (!match) return () => true;
        const [, field, op, val] = match;
        // Coerce value types
        let value = val;
        if (value === 'null') value = null;
        else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        switch (op) {
          case 'eq':
            return (row) => row[field] === value;
          case 'neq':
            return (row) => row[field] !== value;
          case 'gt':
            return (row) => row[field] > value;
          case 'gte':
            return (row) => row[field] >= value;
          case 'lt':
            return (row) => row[field] < value;
          case 'lte':
            return (row) => row[field] <= value;
          case 'is':
            return (row) => row[field] === value;
          default:
            return () => true;
        }
      };

      // Split into top-level groups (either "and(...)" blocks or bare conditions)
      const groups = [];
      let depth = 0;
      let current = '';
      for (let i = 0; i < filterString.length; i++) {
        const ch = filterString[i];
        if (ch === '(') {
          depth++;
          current += ch;
        } else if (ch === ')') {
          depth--;
          current += ch;
        } else if (ch === ',' && depth === 0) {
          groups.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      if (current.trim()) groups.push(current.trim());

      const groupFns = groups.map((g) => {
        const andMatch = g.match(/^and\((.+)\)$/);
        if (andMatch) {
          // Inner conditions are comma-separated inside and(...)
          const innerParts = andMatch[1].split(',').map((s) => s.trim());
          const fns = innerParts.map(parseCondition);
          return (row) => fns.every((fn) => fn(row));
        }
        // Bare condition
        return parseCondition(g);
      });

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
      return builder;
    },
    maybeSingle() {
      isSingle = true;
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
            row.id = `mock-${storageTable.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
              table[idx] = { ...table[idx], ...row };
              inserted.push(table[idx]);
              continue;
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

          table.push({ ...row });
          inserted.push(row);
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
        });
        return { data: matched.map(projectOut), error: null };
      }

      // SELECT
      const projectedMatched = matched.map(projectOut);
      let result;
      if (isSingle) {
        result = { data: projectedMatched[0] || null, error: null };
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

const supabaseAdmin = {
  from: (tableName) => createQueryBuilder(tableName),
  rpc: async (...args) => {
    if (_rpcMock) return _rpcMock(...args);
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
    },
  },
};

module.exports = supabaseAdmin;
module.exports.resetTables = resetTables;
module.exports.seedTable = seedTable;
module.exports.getTable = getTable;
module.exports.setRpcMock = setRpcMock;
module.exports.resetRpc = resetRpc;
module.exports.setAuthMocks = setAuthMocks;
