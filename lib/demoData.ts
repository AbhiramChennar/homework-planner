// Sample data for demo mode: five classes, a few weeks of completed homework
// with logged times, and some upcoming work. Each class has a built-in
// "estimation bias" (e.g. History takes ~1.5x the estimate) so the estimator
// and insights have a realistic pattern to find.
import type { Assignment, Category, Class } from "@/lib/types";
import { DEMO_USER_ID, type DemoData } from "@/lib/data/localStore";
import { predictMinutes } from "@/lib/estimator";

interface SampleClass {
  name: string;
  short: string;
  color: string;
  bias: number; // actual ÷ estimate, on average
  work: [title: string, category: Category, estimate: number][];
}

const SAMPLE_CLASSES: SampleClass[] = [
  {
    name: "AP US History", short: "hist", color: "#dc2626", bias: 1.5,
    work: [["Ch 12 reading notes", "reading", 30], ["DBQ practice essay", "essay", 60], ["Unit 4 study guide", "study", 45]],
  },
  {
    name: "Calculus", short: "calc", color: "#2563eb", bias: 0.8,
    work: [["Problem set 3.2", "problem_set", 40], ["Problem set 3.3", "problem_set", 45], ["Quiz review", "study", 30]],
  },
  {
    name: "English", short: "eng", color: "#16a34a", bias: 1.25,
    work: [["Gatsby ch 4-5", "reading", 40], ["Response paragraph", "essay", 25], ["Vocab worksheet", "problem_set", 15]],
  },
  {
    name: "Chemistry", short: "chem", color: "#9333ea", bias: 1.0,
    work: [["Lab report", "project", 60], ["Stoichiometry worksheet", "problem_set", 30], ["Ch 6 reading", "reading", 25]],
  },
  {
    name: "Spanish", short: "span", color: "#ea580c", bias: 0.9,
    work: [["Vocab flashcards", "study", 20], ["Workbook p. 40-42", "problem_set", 25], ["Oral presentation prep", "project", 45]],
  },
];

// A tiny seeded random number generator so the sample data is the same every
// time (Math.random would make the demo, and any screenshots of it, change).
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Local 11:59pm, `daysFromNow` days from `now`. */
function dueDate(now: Date, daysFromNow: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 0, 0);
  return d;
}

export function createSampleData(now: Date): DemoData {
  const rand = seededRandom(42);
  const created = new Date(now.getTime() - 35 * 86_400_000).toISOString();

  const classes: Class[] = SAMPLE_CLASSES.map((c, i) => ({
    id: `demo-class-${i + 1}`,
    user_id: DEMO_USER_ID,
    name: c.name,
    short_name: c.short,
    color: c.color,
    created_at: created,
  }));

  const assignments: Assignment[] = [];
  let n = 0;
  const add = (classIndex: number, workIndex: number, daysFromNow: number, done: boolean) => {
    const c = SAMPLE_CLASSES[classIndex];
    const [title, category, estimate] = c.work[workIndex];
    const due = dueDate(now, daysFromNow);
    // Actual time = estimate × class bias × noise between 0.8 and 1.2, rounded to 5 minutes.
    const actual = Math.max(5, Math.round((estimate * c.bias * (0.8 + rand() * 0.4)) / 5) * 5);
    const completed = new Date(due.getTime() - (1 + Math.floor(rand() * 2)) * 86_400_000);
    completed.setHours(20, 30, 0, 0);
    n += 1;
    assignments.push({
      id: `demo-assignment-${n}`,
      user_id: DEMO_USER_ID,
      class_id: classes[classIndex].id,
      title,
      description: null,
      category,
      due_at: due.toISOString(),
      estimated_minutes: estimate,
      predicted_minutes: null,
      actual_minutes: done ? actual : null,
      status: done ? "done" : "todo",
      created_at: new Date(due.getTime() - 4 * 86_400_000).toISOString(),
      completed_at: done ? completed.toISOString() : null,
    });
  };

  // Four weeks of finished work: every class gets several completions.
  for (let week = 4; week >= 1; week--) {
    for (let c = 0; c < SAMPLE_CLASSES.length; c++) {
      add(c, (week + c) % 3, -week * 7 + c, true);
    }
  }
  // Upcoming work, from overdue to next week.
  add(0, 1, 2, false); // History essay, due in 2 days
  add(1, 0, 1, false); // Calc pset, due tomorrow
  add(2, 0, 0, false); // English reading, due today
  add(3, 0, 5, false); // Chem lab report, due in 5 days
  add(4, 0, 1, false); // Spanish flashcards, due tomorrow
  add(0, 0, 3, false); // History reading, due in 3 days
  add(1, 2, -1, false); // Calc quiz review, overdue

  // Fill in predicted_minutes the way the app would have at the time each
  // assignment was created: using only work completed before then. This gives
  // the Insights page an honest estimate-vs-prediction comparison.
  for (const a of assignments) {
    const history = assignments.filter((h) => h.completed_at !== null && h.completed_at < a.created_at);
    a.predicted_minutes = predictMinutes(a, history).minutes;
  }

  return { classes, assignments, plans: [], feedback: [] };
}
