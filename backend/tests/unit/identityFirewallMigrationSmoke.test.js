const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  REQUIRED_COLUMNS,
  REQUIRED_ENUM_VALUES,
  REVOKED_LEGACY_FEED_RPCS,
  REQUIRED_RLS_TABLES,
  REQUIRED_SAFE_VIEWS,
  REQUIRED_TABLES,
  getSslConfig,
  loadEnvFile,
  parseArgs,
  resolveDatabaseConfig,
} = require('../../scripts/identity-firewall-migration-smoke');

describe('identity firewall migration smoke script', () => {
  test('defaults to post-migration mode and supports explicit modes', () => {
    expect(parseArgs([])).toMatchObject({ mode: 'post', json: false, help: false });
    expect(parseArgs(['--preflight'])).toMatchObject({ mode: 'preflight' });
    expect(parseArgs(['--both', '--json'])).toMatchObject({ mode: 'both', json: true });
    expect(parseArgs(['--help'])).toMatchObject({ help: true });
  });

  test('declares all required Identity Firewall tables and schema checks', () => {
    // Migration 132 (P0.1) replaces PersonaFollow with PersonaMembership as
    // the canonical RLS-protected base table; PersonaFollow is asserted to
    // exist as a SQL view via REQUIRED_SAFE_VIEWS below.
    expect(REQUIRED_TABLES).toEqual(expect.arrayContaining([
      'LocalProfile',
      'PublicPersona',
      'AudienceIdentity',
      'PersonaMembership',
      'IdentityBridgeSetting',
      'BroadcastChannel',
      'BroadcastMessage',
      'IdentityAuditLog',
      // P0.7 audit follow-up: smoke script now also covers the P0.8
      // FeatureFlag table and the P0.2 display-name migration snapshot.
      'FeatureFlag',
      'LocalProfileDisplayNameMigrationP02',
    ]));
    expect(REQUIRED_TABLES).not.toContain('PersonaFollow');
    expect(REQUIRED_COLUMNS.Post).toEqual(expect.arrayContaining([
      'author_user_id',
      'identity_context_type',
      'identity_context_id',
      'broadcast_channel_id',
      'target_tier_rank',
      'delivered_count',
      'read_count',
    ]));
    expect(REQUIRED_COLUMNS.PersonaMembership).toEqual(expect.arrayContaining([
      'persona_id',
      'user_id',
      'tier_id',
      'audience_identity_id',
      'fan_handle',
      'fan_handle_normalized',
      'status',
      'relationship_type',
      'source',
      'notification_level',
    ]));
    // PersonaFollow keeps its column shape so existing read paths continue to
    // work transparently against the new view.
    expect(REQUIRED_COLUMNS.PersonaFollow).toEqual(expect.arrayContaining([
      'follower_user_id',
      'relationship_type',
      'status',
      'source',
      'notification_level',
    ]));
    expect(REQUIRED_COLUMNS.IdentityAuditLog).toEqual(expect.arrayContaining([
      'actor_user_id',
      'target_user_id',
      'persona_id',
      'action',
      'metadata',
    ]));
    expect(REQUIRED_COLUMNS.BroadcastMessage).toEqual(expect.arrayContaining([
      'delivered_count',
      'read_count',
    ]));
    expect(REQUIRED_COLUMNS.UserPrivacySettings).toEqual(expect.arrayContaining([
      'findable_by_name',
    ]));
    expect(REQUIRED_RLS_TABLES).toEqual(expect.arrayContaining([
      'LocalProfile',
      'PublicPersona',
      'AudienceIdentity',
      'PersonaMembership',
      'IdentityBridgeSetting',
      'BroadcastChannel',
      'BroadcastMessage',
      'IdentityAuditLog',
    ]));
    // RLS attaches to the underlying table, not to the PersonaFollow view.
    expect(REQUIRED_RLS_TABLES).not.toContain('PersonaFollow');
    expect(REQUIRED_SAFE_VIEWS).toEqual(expect.arrayContaining([
      'PublicLocalProfileView',
      'PublicAudienceProfileView',
      'PublicBroadcastMessageView',
      'PersonaFollow',
    ]));
    expect(REVOKED_LEGACY_FEED_RPCS).toEqual(expect.arrayContaining([
      'public.get_neighborhood_feed(uuid,integer,integer,text,integer)',
      'public.get_neighborhood_feed_at(uuid,double precision,double precision,integer,integer,text,integer)',
      'public.get_posts_in_bounds(uuid,double precision,double precision,double precision,double precision,integer,text)',
    ]));
    expect(REQUIRED_ENUM_VALUES).toEqual({
      post_as_type: ['persona'],
      post_audience: ['public'],
    });
  });

  test('resolves database config from URL env before PG env', () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/pantopus',
      PGHOST: 'ignored-host',
      PGDATABASE: 'ignored-db',
      PGUSER: 'ignored-user',
    });
    expect(config).toEqual({ connectionString: 'postgres://user:pass@localhost:5432/pantopus' });
  });

  test('resolves database config from PG env when no URL is present', () => {
    const config = resolveDatabaseConfig({
      PGHOST: 'localhost',
      PGPORT: '5433',
      PGDATABASE: 'pantopus',
      PGUSER: 'postgres',
      PGPASSWORD: 'secret',
    });
    expect(config).toMatchObject({
      host: 'localhost',
      port: 5433,
      database: 'pantopus',
      user: 'postgres',
      password: 'secret',
    });
  });

  test('uses SSL for Supabase URLs and explicit sslmode=require', () => {
    expect(getSslConfig({}, 'postgres://u:p@db.project.supabase.co:5432/postgres')).toEqual({ rejectUnauthorized: false });
    expect(getSslConfig({}, 'postgres://u:p@localhost:5432/postgres?sslmode=require')).toEqual({ rejectUnauthorized: false });
    expect(getSslConfig({ PGSSLMODE: 'disable' }, 'postgres://u:p@db.project.supabase.co:5432/postgres')).toBe(false);
  });

  test('loads simple env files without overwriting existing values', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-firewall-env-'));
    const file = path.join(dir, '.env');
    fs.writeFileSync(file, [
      '# comment',
      'DATABASE_URL="postgres://from-file"',
      'PGUSER=from_file',
      '',
    ].join('\n'));
    const env = { PGUSER: 'already-set' };

    loadEnvFile(file, env);

    expect(env.DATABASE_URL).toBe('postgres://from-file');
    expect(env.PGUSER).toBe('already-set');
  });
});
