// Remembers tonight's plan on this device, so it's still there when you switch
// pages or come back later in the evening. (Every plan is also saved to the
// database for analysis; this copy is just for display.)
import type { BuiltPlan } from "@/lib/scheduler";

export interface CurrentPlan extends BuiltPlan {
  createdAt: string; // ISO timestamp
  availableMinutes: number;
}

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const key = (userId: string) => `hp-current-plan:${userId}`;

export function loadCurrentPlan(storage: KV, userId: string, now: Date): CurrentPlan | null {
  try {
    const raw = storage.getItem(key(userId));
    if (!raw) return null;
    const plan = JSON.parse(raw) as CurrentPlan;
    // A plan is for one evening: yesterday's plan isn't tonight's.
    const created = new Date(plan.createdAt);
    if (created.toDateString() !== now.toDateString()) return null;
    return plan;
  } catch {
    return null;
  }
}

export function saveCurrentPlan(storage: KV, userId: string, plan: CurrentPlan) {
  storage.setItem(key(userId), JSON.stringify(plan));
}

export function clearCurrentPlan(storage: KV, userId: string) {
  storage.removeItem(key(userId));
}

/** Plans start at the next 5-minute mark, so times read naturally (4:05pm, not 4:03pm). */
export function planStartTime(createdAt: Date): Date {
  const fiveMin = 5 * 60_000;
  return new Date(Math.ceil(createdAt.getTime() / fiveMin) * fiveMin);
}
