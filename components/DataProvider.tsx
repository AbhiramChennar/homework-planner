"use client";

// Loads the user's classes and assignments once and shares them with every
// page, so switching pages is instant and every page sees the same data.
// Writes go to the DataStore first, then update this shared copy.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AssignmentPatch, DataStore, NewAssignment, NewClass } from "@/lib/data/store";
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
  addAssignment: (input: NewAssignment) => Promise<Assignment>;
  editAssignment: (id: string, patch: AssignmentPatch) => Promise<Assignment>;
  removeAssignment: (id: string) => Promise<void>;
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

  const value = useMemo<DataContextValue>(
    () => ({
      store,
      loading,
      error,
      classes,
      assignments,
      reload,
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
        const row = await store.createAssignment(input);
        setAssignments((prev) => [...prev, row]);
        return row;
      },
      async editAssignment(id, patch) {
        const row = await store.updateAssignment(id, patch);
        setAssignments((prev) => prev.map((a) => (a.id === id ? row : a)));
        return row;
      },
      async removeAssignment(id) {
        await store.deleteAssignment(id);
        setAssignments((prev) => prev.filter((a) => a.id !== id));
      },
    }),
    [store, loading, error, classes, assignments, reload],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
