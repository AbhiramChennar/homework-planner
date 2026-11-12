// The DataStore interface: every read and write the UI does goes through it.
//
// Two implementations:
// * supabaseStore.ts: the real thing, backed by Supabase (signed-in users).
// * localStore.ts:    a demo that keeps data in this browser's localStorage, so
//                     anyone can try the app without an account (and so the UI
//                     can be tested without a real login).
// Pages never import Supabase directly, which keeps them simple and lets both
// modes share all UI code.
import type { PilotDataset } from "@/lib/pilot";
import type { Assignment, Category, Class, PlanItem } from "@/lib/types";

export interface NewClass {
  name: string;
  short_name: string | null;
  color: string | null;
}

export interface NewAssignment {
  class_id: string;
  title: string;
  description: string | null;
  category: Category | null;
  due_at: string; // ISO timestamp
  estimated_minutes: number;
  predicted_minutes: number | null;
}

export type AssignmentPatch = Partial<
  Pick<
    Assignment,
    | "class_id"
    | "title"
    | "description"
    | "category"
    | "due_at"
    | "estimated_minutes"
    | "predicted_minutes"
    | "actual_minutes"
    | "status"
    | "completed_at"
  >
>;

export interface NewPlan {
  available_minutes: number;
  items: PlanItem[];
  model_version: string;
}

/** Thrown when deleting a class that still has assignments. */
export class ClassInUseError extends Error {
  constructor() {
    super("This class still has assignments. Delete or move them first.");
    this.name = "ClassInUseError";
  }
}

export interface DataStore {
  listClasses(): Promise<Class[]>;
  createClass(input: NewClass): Promise<Class>;
  updateClass(id: string, patch: Partial<NewClass>): Promise<Class>;
  /** Throws ClassInUseError if the class has assignments. */
  deleteClass(id: string): Promise<void>;

  /** All of the user's assignments, todo and done. */
  listAssignments(): Promise<Assignment[]>;
  createAssignment(input: NewAssignment): Promise<Assignment>;
  updateAssignment(id: string, patch: AssignmentPatch): Promise<Assignment>;
  deleteAssignment(id: string): Promise<void>;

  savePlan(plan: NewPlan): Promise<void>;
  submitFeedback(message: string): Promise<void>;
  /** Deletes the account and every row that belongs to it. */
  deleteAccount(): Promise<void>;

  /** Whether this user may see the pilot dashboard. */
  isAdmin(): Promise<boolean>;
  /** Anonymized data for the pilot dashboard (admins only; throws otherwise). */
  adminDataset(): Promise<PilotDataset>;
}
