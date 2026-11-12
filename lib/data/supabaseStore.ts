// DataStore backed by Supabase. Each method is one small query; RLS in the
// database guarantees they only ever touch the signed-in user's rows, which is
// why there are no `.eq("user_id", ...)` filters here.
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { ClassInUseError, type DataStore } from "./store";

// Postgres error code for "foreign key violation": deleting a class that
// assignments still point at (the migration uses `on delete restrict`).
const FOREIGN_KEY_VIOLATION = "23503";

function check<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export function createSupabaseStore(supabase: SupabaseClient<Database>): DataStore {
  return {
    async listClasses() {
      return check(await supabase.from("classes").select("*").order("name"));
    },
    async createClass(input) {
      return check(await supabase.from("classes").insert(input).select().single());
    },
    async updateClass(id, patch) {
      return check(await supabase.from("classes").update(patch).eq("id", id).select().single());
    },
    async deleteClass(id) {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error?.code === FOREIGN_KEY_VIOLATION) throw new ClassInUseError();
      if (error) throw new Error(error.message);
    },

    async listAssignments() {
      return check(await supabase.from("assignments").select("*").order("due_at"));
    },
    async createAssignment(input) {
      return check(await supabase.from("assignments").insert(input).select().single());
    },
    async updateAssignment(id, patch) {
      return check(
        await supabase.from("assignments").update(patch).eq("id", id).select().single(),
      );
    },
    async deleteAssignment(id) {
      check(await supabase.from("assignments").delete().eq("id", id));
    },

    async savePlan(plan) {
      check(await supabase.from("plans").insert(plan));
    },
    async submitFeedback(message) {
      check(await supabase.from("feedback").insert({ message }));
    },
    async deleteAccount() {
      // A database function (see migrations) deletes the auth user; every table
      // cascades from auth.users, so all their rows go with it.
      check(await supabase.rpc("delete_my_account"));
      await supabase.auth.signOut();
    },
  };
}
