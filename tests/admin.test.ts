// The admin dashboard's database side: only admins get data, and the data
// they get is anonymized.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { classCategory } from "@/lib/classCategory";
import { addUser, asAnon, asOwner, asUser, createTestDb } from "./helpers/db";

const ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STUDENT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await addUser(db, ADMIN, "Teacher@School.org"); // mixed case on purpose
  await addUser(db, STUDENT, "student@school.org");
  await db.query("insert into public.admins (email) values ('teacher@school.org')");

  await asUser(db, STUDENT);
  const c = await db.query<{ id: string }>(
    "insert into public.classes (name) values ('AP US History') returning id",
  );
  await db.query(
    `insert into public.assignments (class_id, title, description, category, due_at, estimated_minutes,
       predicted_minutes, actual_minutes, status, completed_at)
     values ($1, 'Secret essay title', 'my private notes', 'essay', now(), 40, 48, 60, 'done', now())`,
    [c.rows[0].id],
  );
}, 30_000);

describe("admin access", () => {
  it("is_admin() is true only for emails in the admins table (case-insensitive)", async () => {
    await asUser(db, ADMIN);
    expect((await db.query<{ ok: boolean }>("select public.is_admin() as ok")).rows[0].ok).toBe(true);
    await asUser(db, STUDENT);
    expect((await db.query<{ ok: boolean }>("select public.is_admin() as ok")).rows[0].ok).toBe(false);
  });

  it("refuses the dataset to non-admins", async () => {
    await asUser(db, STUDENT);
    await expect(db.query("select public.admin_dataset()")).rejects.toThrow(/not authorized/);
  });

  it("refuses signed-out visitors entirely", async () => {
    await asAnon(db);
    await expect(db.query("select public.admin_dataset()")).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.is_admin()")).rejects.toThrow(/permission denied/);
  });

  it("hides the admins table from everyone using the API", async () => {
    await asUser(db, ADMIN);
    await expect(db.query("select * from public.admins")).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into public.admins values ('me@x.org')")).rejects.toThrow(/permission denied/);
  });
});

describe("admin_dataset", () => {
  it("returns users and assignments for admins", async () => {
    await asUser(db, ADMIN);
    const { rows } = await db.query<{ d: { users: unknown[]; assignments: Record<string, unknown>[] } }>(
      "select public.admin_dataset() as d",
    );
    const d = rows[0].d;
    expect(d.users).toHaveLength(2);
    expect(d.assignments).toHaveLength(1);
    expect(d.assignments[0]).toMatchObject({
      class_category: "social_studies",
      category: "essay",
      description_length: 16,
      estimated_minutes: 40,
      predicted_minutes: 48,
      actual_minutes: 60,
      status: "done",
    });
  });

  it("contains no titles, descriptions, class names, emails or real user ids", async () => {
    await asUser(db, ADMIN);
    const { rows } = await db.query<{ d: unknown }>("select public.admin_dataset() as d");
    const text = JSON.stringify(rows[0].d);
    for (const secret of ["Secret essay title", "my private notes", "AP US History", "school.org", STUDENT, ADMIN]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toMatch(/"u":"u[12]"/);
  });
});

describe("class_category", () => {
  it.each([
    ["AP Calculus BC", "math"],
    ["Honors Chemistry", "science"],
    ["AP Computer Science A", "computer_science"],
    ["English 11", "english"],
    ["AP US History", "social_studies"],
    ["Spanish III", "world_language"],
    ["Concert Band", "arts"],
    ["Study Hall", "other"],
  ])("%s → %s", async (name, category) => {
    await asOwner(db);
    const { rows } = await db.query<{ c: string }>("select public.class_category($1) as c", [name]);
    expect(rows[0].c).toBe(category);
  });
});

describe("classCategory (TypeScript) matches the SQL version", () => {
  const names = [
    "AP Calculus BC", "Algebra 2", "Statistics", "Honors Chemistry", "Biology", "AP Physics 1",
    "AP Computer Science A", "Intro to CS", "English 11", "AP Lit", "Creative Writing",
    "AP US History", "Government", "Economics", "AP Psychology", "Human Geography",
    "Spanish III", "French 2", "Mandarin", "ASL 1", "Concert Band", "Studio Art", "Theatre",
    "Study Hall", "PE", "Health",
  ];
  it.each(names)("%s", async (name) => {
    await asOwner(db);
    const { rows } = await db.query<{ c: string }>("select public.class_category($1) as c", [name]);
    expect(classCategory(name)).toBe(rows[0].c);
  });
});
