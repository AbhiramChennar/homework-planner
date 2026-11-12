// TypeScript types that mirror the database tables in
// supabase/migrations/20261111000000_initial_schema.sql.
//
// These are written by hand (rather than generated with `supabase gen types`)
// so they stay readable. If you change the migration, update these too.
// The `Database` type follows the shape supabase-js expects, so queries like
// supabase.from("classes").select() come back fully typed.

export const CATEGORIES = ["reading", "problem_set", "essay", "project", "study", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  reading: "Reading",
  problem_set: "Problem set",
  essay: "Essay",
  project: "Project",
  study: "Study",
  other: "Other",
};

export type Status = "todo" | "done";

// Which estimator produced the minutes in a plan.
export type ModelVersion = "baseline" | "v1-class-factor" | "v2-pooled";

export type Class = {
  id: string;
  user_id: string;
  name: string; // "AP US History"
  short_name: string | null; // "hist" (used by quick-add)
  color: string | null; // "#3b82f6"
  created_at: string; // ISO timestamp (Supabase returns timestamps as strings)
};

export type Assignment = {
  id: string;
  user_id: string;
  class_id: string;
  title: string;
  description: string | null;
  category: Category | null;
  due_at: string;
  estimated_minutes: number; // the student's guess
  predicted_minutes: number | null; // the model's guess at creation time
  actual_minutes: number | null; // logged on completion (optional)
  status: Status;
  created_at: string;
  completed_at: string | null;
};

/** One entry in a saved plan's `items` array. */
export type PlanItem = {
  assignment_id: string;
  minutes: number;
  order: number;
};

export type Plan = {
  id: string;
  user_id: string;
  available_minutes: number;
  items: PlanItem[];
  model_version: string;
  created_at: string;
};

export type Feedback = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
};

// Insert types: columns with database defaults (id, user_id, created_at, ...)
// are optional because Postgres fills them in.
export type ClassInsert = Pick<Class, "name"> &
  Partial<Pick<Class, "short_name" | "color" | "id" | "user_id" | "created_at">>;

export type AssignmentInsert = Pick<
  Assignment,
  "class_id" | "title" | "due_at" | "estimated_minutes"
> &
  Partial<Omit<Assignment, "class_id" | "title" | "due_at" | "estimated_minutes">>;

export type PlanInsert = Pick<Plan, "available_minutes" | "items"> &
  Partial<Pick<Plan, "model_version" | "id" | "user_id" | "created_at">>;

export interface Database {
  public: {
    Tables: {
      classes: {
        Row: Class;
        Insert: ClassInsert;
        Update: Partial<Class>;
        Relationships: [];
      };
      assignments: {
        Row: Assignment;
        Insert: AssignmentInsert;
        Update: Partial<Assignment>;
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: Plan;
        Insert: PlanInsert;
        Update: Partial<Plan>;
        Relationships: [];
      };
      feedback: {
        Row: Feedback;
        Insert: Pick<Feedback, "message"> & Partial<Omit<Feedback, "message">>;
        Update: Partial<Feedback>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      admin_dataset: { Args: Record<PropertyKey, never>; Returns: unknown };
      class_category: { Args: { class_name: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
