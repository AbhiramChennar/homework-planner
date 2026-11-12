import { describe, expect, it } from "vitest";
import { createLocalStore, type KeyValueStorage } from "@/lib/data/localStore";
import { ClassInUseError } from "@/lib/data/store";
import { createSampleData } from "@/lib/demoData";

function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const NOW = new Date("2026-11-11T18:00:00");

describe("localStore (demo mode)", () => {
  it("creates, lists and updates classes", async () => {
    const store = createLocalStore(memoryStorage(), () => NOW);
    await store.createClass({ name: "Physics", short_name: "phys", color: null });
    const hist = await store.createClass({ name: "History", short_name: "hist", color: "#f00" });
    await store.updateClass(hist.id, { name: "AP History" });
    const names = (await store.listClasses()).map((c) => c.name);
    expect(names).toEqual(["AP History", "Physics"]); // sorted by name
  });

  it("refuses to delete a class that has assignments, like the database", async () => {
    const store = createLocalStore(memoryStorage(), () => NOW);
    const c = await store.createClass({ name: "Math", short_name: null, color: null });
    const a = await store.createAssignment({
      class_id: c.id, title: "pset", description: null, category: "problem_set",
      due_at: NOW.toISOString(), estimated_minutes: 30, predicted_minutes: null,
    });
    await expect(store.deleteClass(c.id)).rejects.toBeInstanceOf(ClassInUseError);
    await store.deleteAssignment(a.id);
    await store.deleteClass(c.id);
    expect(await store.listClasses()).toEqual([]);
  });

  it("new assignments start as todo with no actual time", async () => {
    const store = createLocalStore(memoryStorage(), () => NOW);
    const c = await store.createClass({ name: "Math", short_name: null, color: null });
    const a = await store.createAssignment({
      class_id: c.id, title: "pset", description: null, category: null,
      due_at: NOW.toISOString(), estimated_minutes: 30, predicted_minutes: 36,
    });
    expect(a).toMatchObject({ status: "todo", actual_minutes: null, completed_at: null, predicted_minutes: 36 });
  });

  it("survives corrupted storage by starting fresh", async () => {
    const storage = memoryStorage();
    storage.setItem("hp-demo-data-v1", "{not json");
    const store = createLocalStore(storage, () => NOW);
    expect(await store.listClasses()).toEqual([]);
  });

  it("deleteAccount wipes the demo data", async () => {
    const storage = memoryStorage();
    const store = createLocalStore(storage, () => NOW);
    await store.createClass({ name: "Math", short_name: null, color: null });
    await store.deleteAccount();
    expect(await store.listClasses()).toEqual([]);
  });
});

describe("sample data", () => {
  it("is valid: every assignment points at a class, done ones have actual times", () => {
    const data = createSampleData(NOW);
    const classIds = new Set(data.classes.map((c) => c.id));
    expect(data.classes).toHaveLength(5);
    for (const a of data.assignments) {
      expect(classIds.has(a.class_id)).toBe(true);
      expect(a.estimated_minutes).toBeGreaterThan(0);
      if (a.status === "done") {
        expect(a.actual_minutes).toBeGreaterThan(0);
        expect(a.completed_at).not.toBeNull();
      } else {
        expect(a.actual_minutes).toBeNull();
      }
    }
  });

  it("is the same every time (seeded randomness)", () => {
    expect(createSampleData(NOW)).toEqual(createSampleData(NOW));
  });
});

describe("sample data predictions", () => {
  it("learn each class's bias: upcoming History work is predicted longer, Calculus shorter", () => {
    const data = createSampleData(NOW);
    const upcoming = (classId: string) => data.assignments.filter((a) => a.class_id === classId && a.status === "todo");
    for (const a of upcoming("demo-class-1")) expect(a.predicted_minutes!).toBeGreaterThan(a.estimated_minutes); // History, bias 1.5
    for (const a of upcoming("demo-class-2")) expect(a.predicted_minutes!).toBeLessThan(a.estimated_minutes); // Calculus, bias 0.8
  });

  it("only uses history from before each assignment was created (no peeking at the future)", () => {
    const data = createSampleData(NOW);
    const first = [...data.assignments].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    expect(first.predicted_minutes).toBe(first.estimated_minutes); // nothing to learn from yet
  });
});
