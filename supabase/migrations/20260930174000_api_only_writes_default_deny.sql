-- Backwards compatible: yes. Revokes INSERT, UPDATE, DELETE and TRUNCATE on
-- every public table and view from anon and authenticated, and makes tables
-- created later start without them. SELECT, row-level-security policies,
-- functions and rows are unchanged, so reads stay exactly as they are.
--
-- The backend writes as service_role (its own privileges, unchanged here). Its
-- shared anon client has no user identity and writes nothing that works: no
-- write policy admits a writer without one, and the lowercase offers/gigs
-- tables its legacy route names don't exist. No app reaches PostgREST
-- directly (web, iOS and Android call the API; none ships a Supabase client or
-- the anon key). Some tables already work this way (HomeTask and the Home
-- authority tables refuse client writes by grant, and SQL contracts assert it).
--
-- Before this, 205 row-level-security policies on 96 tables still let a
-- signed-in person who has the anon key write their own rows straight through
-- PostgREST, around the API's validation, moderation, rate limits and side
-- effects: for example a Post, a Listing or privacy settings (reproduced on a
-- local stack: 201 each, rows removed). #977 and #978 dropped the account,
-- social and chat policies; this closes the rest at the grant level instead of
-- per policy, so a new or reintroduced policy can't reopen it either. SQL
-- contracts that assert client writes are refused keep passing (they expect
-- 42501 or insufficient_privilege, which a missing grant also raises).
SET LOCAL lock_timeout='5s';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
