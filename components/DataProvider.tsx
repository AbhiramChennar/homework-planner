"use client";

// Loads the user's classes and assignments once and shares them with every
// page, so switching pages is instant and every page sees the same data.
// Writes go to the DataStore first, then update this shared copy.
//
// It's also where the estimator runs: every new assignment gets a prediction
// (stored in predicted_minutes) based on this user's history at that moment.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AssignmentPatch, DataStore, NewAssignment, NewClass } from "@/lib/data/store";
import { predictMinutes } from "@/lib/estimator";
import type { Assignment, Class } from "@/lib/types";

interface DataContextValue {
  store: DataStore;
  loading: boolean;
  error: string | null;
  classes: Class[];
  assignments: Assignment[];
  reload: () => Promise<void>;
  addClass: (input: NewClass) => Promise<Class>;
  editClass: (id: string, patch: Partial<NewClass>) => Promise<void>;
  removeClass: (id: string) => Promise<void>;
  /** Saves a new assignment with the estimator's prediction filled in. */
  addAssignment: (input: Omit<NewAssignment, "predicted_minutes">) => Promise<Assignment>;
  editAssignment: (id: string, patch: AssignmentPatch) => Promise<Assignment>;
  removeAssignment: (id: string) => Promise<void>;
  /** "You usually take ~30% longer than you guess on History", per class id. */
  explanations: Map<string, string>;
}

const DataContext = createContext<DataContextValue | null>(null);

const byName = (a: Class, b: Class) => a.name.localeCompare(b.name);

export function DataProvider({ store, children }: { store: DataStore; children: React.ReactNode }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([store.listClasses(), store.listAssignments()]);
      setClasses(c);
      setAssignments(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your data.");
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // One explanation per class, from the current history. Uses a 60-minute
  // dummy estimate: only the class's ratio matters for the sentence.
  const explanations = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      const e = predictMinutes({ class_id: c.id, estimated_minutes: 60 }, assignments, c.name).explanation;
      if (e) map.set(c.id, e);
    }
    return map;
  }, [classes, assignments]);

  const value = useMemo<DataContextValue>(
    () => ({
      store,
      loading,
      error,
      classes,
      assignments,
      reload,
      explanations,
      async addClass(input) {
        const row = await store.createClass(input);
        setClasses((prev) => [...prev, row].sort(byName));
        return row;
      },
      async editClass(id, patch) {
        const row = await store.updateClass(id, patch);
        setClasses((prev) => prev.map((c) => (c.id === id ? row : c)).sort(byName));
      },
      async removeClass(id) {
        await store.deleteClass(id);
        setClasses((prev) => prev.filter((c) => c.id !== id));
      },
      async addAssignment(input) {
        const className = classes.find((c) => c.id === input.class_id)?.name;
        const predicted = predictMinutes(input, assignments, className).minutes;
        const row = await store.createAssignment({ ...input, predicted_minutes: predicted });
        setAssignments((prev) => [...prev, row]);
        return row;
      },
      async editAssignment(id, patch) {
        // A new estimate or class means a new prediction (from the history
        // without this assignment itself, in case it's already done).
        const current = assignments.find((a) => a.id === id);
        if (current && (patch.estimated_minutes !== undefined || patch.class_id !== undefined)) {
          const next = { ...current, ...patch };
          const className = classes.find((c) => c.id === next.class_id)?.name;
          const history = assignments.filter((a) => a.id !== id);
          patch = { ...patch, predicted_minutes: predictMinutes(next, history, className).minutes };
        }
        const row = await store.updateAssignment(id, patch);
        setAssignments((prev) => prev.map((a) => (a.id === id ? row : a)));
        return row;
      },
      async removeAssignment(id) {
        await store.deleteAssignment(id);
        setAssignments((prev) => prev.filter((a) => a.id !== id));
      },
    }),
    [store, loading, error, classes, assignments, reload, explanations],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
