// DataStore for demo mode: everything lives in this browser's localStorage.
// Nothing is sent anywhere, so the demo needs no account and collects no data.
//
// It mimics the database's rules (user_id filled in, a class with assignments
// can't be deleted) so the demo behaves like the real app.
import type { Assignment, Class, Plan } from "@/lib/types";
import { ClassInUseError, type DataStore } from "./store";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";
const KEY = "hp-demo-data-v1";

export interface DemoData {
  classes: Class[];
  assignments: Assignment[];
  plans: Plan[];
  feedback: { message: string; created_at: string }[];
}

const empty = (): DemoData => ({ classes: [], assignments: [], plans: [], feedback: [] });

/** The subset of the browser's Storage API we use (lets tests pass a fake). */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createLocalStore(storage: KeyValueStorage, now: () => Date = () => new Date()): DataStore {
  const load = (): DemoData => {
    try {
      const raw = storage.getItem(KEY);
      return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<DemoData>) } : empty();
    } catch {
      return empty(); // corrupted or blocked storage: start fresh rather than crash
    }
  };
  const save = (data: DemoData) => storage.setItem(KEY, JSON.stringify(data));
  const stamp = () => now().toISOString();

  return {
    async listClasses() {
      return load().classes.sort((a, b) => a.name.localeCompare(b.name));
    },
    async createClass(input) {
      const data = load();
      const row: Class = { id: crypto.randomUUID(), user_id: DEMO_USER_ID, created_at: stamp(), ...input };
      data.classes.push(row);
      save(data);
      return row;
    },
    async updateClass(id, patch) {
      const data = load();
      const row = data.classes.find((c) => c.id === id);
      if (!row) throw new Error("Class not found");
      Object.assign(row, patch);
      save(data);
      return row;
    },
    async deleteClass(id) {
      const data = load();
      if (data.assignments.some((a) => a.class_id === id)) throw new ClassInUseError();
      data.classes = data.classes.filter((c) => c.id !== id);
      save(data);
    },

    async listAssignments() {
      return load().assignments.sort((a, b) => a.due_at.localeCompare(b.due_at));
    },
    async createAssignment(input) {
      const data = load();
      const row: Assignment = {
        id: crypto.randomUUID(),
        user_id: DEMO_USER_ID,
        created_at: stamp(),
        actual_minutes: null,
        status: "todo",
        completed_at: null,
        ...input,
      };
      data.assignments.push(row);
      save(data);
      return row;
    },
    async updateAssignment(id, patch) {
      const data = load();
      const row = data.assignments.find((a) => a.id === id);
      if (!row) throw new Error("Assignment not found");
      Object.assign(row, patch);
      save(data);
      return row;
    },
    async deleteAssignment(id) {
      const data = load();
      data.assignments = data.assignments.filter((a) => a.id !== id);
      save(data);
    },

    async savePlan(plan) {
      const data = load();
      data.plans.push({ id: crypto.randomUUID(), user_id: DEMO_USER_ID, created_at: stamp(), ...plan });
      save(data);
    },
    async submitFeedback(message) {
      const data = load();
      data.feedback.push({ message, created_at: stamp() });
      save(data);
    },
    async deleteAccount() {
      storage.removeItem(KEY);
    },
  };
}

/** Replace all demo data (used to load the sample data set). */
export function writeDemoData(storage: KeyValueStorage, data: DemoData) {
  storage.setItem(KEY, JSON.stringify(data));
}

export function hasDemoData(storage: KeyValueStorage): boolean {
  return storage.getItem(KEY) !== null;
}
