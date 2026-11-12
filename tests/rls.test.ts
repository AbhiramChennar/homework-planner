// Proves the migration's row-level security works: each student can only
// see and change their own rows, and signed-out visitors can't touch anything.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { addUser, asAnon, asOwner, asUser, createTestDb } from "./helpers/db";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

let db: PGlite;
let aliceClassId: string;

async function count(table: string) {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return r.rows[0].n;
}

beforeAll(async () => {
  db = await createTestDb();
  await addUser(db, ALICE);
  await addUser(db, BOB);

  // Alice adds a class, an assignment and a plan through RLS, like the app would.
  await asUser(db, ALICE);
  const c = await db.query<{ id: string }>(
    "insert into public.classes (name, short_name) values ('AP US History', 'hist') returning id",
  );
  aliceClassId = c.rows[0].id;
  await db.query(
    `insert into public.assignments (class_id, title, due_at, estimated_minutes)
     values ($1, 'Essay', now() + interval '2 days', 45)`,
    [aliceClassId],
  );
  await db.query(
    `insert into public.plans (available_minutes, items) values (60, '[]'::jsonb)`,
  );
}, 30_000);

describe("row-level security", () => {
  it("fills user_id automatically from the signed-in user", async () => {
    await asUser(db, ALICE);
    const r = await db.query<{ user_id: string }>("select user_id from public.classes");
    expect(r.rows).toEqual([{ user_id: ALICE }]);
  });

  it("lets a user see their own rows", async () => {
    await asUser(db, ALICE);
    expect(await count("classes")).toBe(1);
    expect(await count("assignments")).toBe(1);
    expect(await count("plans")).toBe(1);
  });

  it("hides other users' rows", async () => {
    await asUser(db, BOB);
    expect(await count("classes")).toBe(0);
    expect(await count("assignments")).toBe(0);
    expect(await count("plans")).toBe(0);
  });

  it("hides everything from signed-out visitors", async () => {
    await asAnon(db);
    expect(await count("classes")).toBe(0);
    expect(await count("assignments")).toBe(0);
    await expect(
      db.query("insert into public.classes (user_id, name) values ($1, 'x')", [ALICE]),
    ).rejects.toThrow(/row-level security/);
  });

  it("blocks inserting a row for another user", async () => {
    await asUser(db, BOB);
    await expect(
      db.query("insert into public.classes (user_id, name) values ($1, 'Sneaky')", [ALICE]),
    ).rejects.toThrow(/row-level security/);
  });

  it("blocks attaching an assignment to another user's class", async () => {
    await asUser(db, BOB);
    await expect(
      db.query(
        `insert into public.assignments (class_id, title, due_at, estimated_minutes)
         values ($1, 'Mine now', now(), 30)`,
        [aliceClassId],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("makes other users' rows impossible to update or delete", async () => {
    await asUser(db, BOB);
    const upd = await db.query("update public.classes set name = 'hacked'");
    const del = await db.query("delete from public.assignments");
    expect(upd.affectedRows).toBe(0);
    expect(del.affectedRows).toBe(0);

    await asOwner(db);
    const r = await db.query<{ name: string }>("select name from public.classes");
    expect(r.rows).toEqual([{ name: "AP US History" }]);
  });

  it("blocks giving your own row away to another user", async () => {
    await asUser(db, ALICE);
    await expect(
      db.query("update public.plans set user_id = $1", [BOB]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("constraints", () => {
  it("rejects zero or negative minutes", async () => {
    await asUser(db, ALICE);
    await expect(
      db.query(
        `insert into public.assignments (class_id, title, due_at, estimated_minutes)
         values ($1, 'Bad', now(), 0)`,
        [aliceClassId],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("rejects an unknown category", async () => {
    await asUser(db, ALICE);
    await expect(
      db.query(
        `insert into public.assignments (class_id, title, due_at, estimated_minutes, category)
         values ($1, 'Bad', now(), 30, 'homework')`,
        [aliceClassId],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("requires completed_at exactly when status is done", async () => {
    await asUser(db, ALICE);
    await expect(db.query("update public.assignments set status = 'done'")).rejects.toThrow(
      /completed_at_matches_status/,
    );
    await db.query("update public.assignments set status = 'done', completed_at = now(), actual_minutes = 50");
    // Undo must clear completed_at too.
    await db.query("update public.assignments set status = 'todo', completed_at = null, actual_minutes = null");
  });

  it("won't delete a class that still has assignments", async () => {
    await asUser(db, ALICE);
    await expect(db.query("delete from public.classes")).rejects.toThrow(/foreign key/);
  });

  it("deletes all of a user's data when their account is deleted", async () => {
    await asOwner(db);
    await db.query("delete from auth.users where id = $1", [ALICE]);
    expect(await count("classes")).toBe(0);
    expect(await count("assignments")).toBe(0);
    expect(await count("plans")).toBe(0);
  });
});
