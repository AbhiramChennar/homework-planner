// Test helper: runs our real SQL migrations inside PGlite (Postgres compiled to
// WebAssembly, running in memory), so we can test the schema and RLS policies
// without a Supabase account or Docker.
//
// Supabase provides a few things our migrations rely on: the `auth` schema,
// `auth.users`, `auth.uid()`, and the `anon` / `authenticated` roles. We create
// small stand-ins for them here that behave the same way for our purposes.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
  -- Supabase's auth.uid() reads the signed-in user's id from the request's JWT.
  -- We read it from a setting that the tests change with asUser().
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  -- Supabase's JWT also carries the user's email; admin checks use it.
  create function auth.email() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.email', true), '')
  $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
`;

// Supabase sets up *default* privileges so every new table and function in
// `public` is accessible to these roles; RLS policies then narrow it down.
// Because they're defaults, a `revoke` inside a migration still wins.
const SUPABASE_GRANTS = `
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(SUPABASE_GRANTS);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

export async function addUser(db: PGlite, id: string, email = `${id.slice(0, 4)}@example.com`) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}

/** Run the following queries as a signed-in user (like a request with their JWT). */
export async function asUser(db: PGlite, id: string, email = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.query("select set_config('request.jwt.claim.email', $1, false)", [email]);
  await db.exec("set role authenticated");
}

/** Run the following queries as a signed-out visitor. */
export async function asAnon(db: PGlite) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role anon");
}

/** Back to the database owner (bypasses RLS), for test setup and checks. */
export async function asOwner(db: PGlite) {
  await db.exec("reset role");
}
