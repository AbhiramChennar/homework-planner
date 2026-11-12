// Quick-add parser: turns "hist essay fri 45m" into a structured assignment.
//
// How it works: split the text into words, then pull out, in this order,
//   1. a duration  ("45m", "1h30m", "1.5h", "30 min")
//   2. a due date  ("today", "tomorrow", "fri", "11/14")
//   3. a class     (short name like "hist", or the start of a class name)
// Whatever words are left become the title, and a category is guessed from
// keywords in the title ("essay", "pset", "quiz"…).
//
// Durations and dates go first so their words can never be mistaken for a
// class. It's a pure function: `now` is passed in, so tests are repeatable.
// tests/parser.test.ts documents every rule with examples.
import type { Category, Class } from "@/lib/types";

export type QuickAddField = "class" | "title" | "dueAt" | "estimatedMinutes";

export interface ParsedQuickAdd {
  classId: string | null;
  title: string;
  dueAt: Date | null;
  estimatedMinutes: number | null;
  category: Category | null;
  /** Required fields the parser couldn't figure out, in a fixed order. */
  missing: QuickAddField[];
}

interface Word {
  original: string; // as typed, used for the title ("DBQ")
  clean: string; // lowercase, trailing punctuation removed, used for matching ("dbq")
  used: boolean; // already consumed as a duration/date/class
}

export function parseQuickAdd(input: string, classes: Class[], now: Date): ParsedQuickAdd {
  const words: Word[] = input
    .split(/\s+/)
    .map((w) => w.replace(/[,;:!?]+$/, "")) // "fri," → "fri"
    .filter((w) => w.length > 0)
    .map((w) => ({ original: w, clean: w.toLowerCase(), used: false }));

  const estimatedMinutes = takeDuration(words);
  const dueAt = takeDueDate(words, now);
  const classId = takeClass(words, classes);

  const titleWords = words.filter((w) => !w.used);
  const title = titleWords.map((w) => w.original).join(" ");
  const category = guessCategory(titleWords.map((w) => w.clean));

  const missing: QuickAddField[] = [];
  if (!classId) missing.push("class");
  if (!title) missing.push("title");
  if (!dueAt) missing.push("dueAt");
  if (!estimatedMinutes) missing.push("estimatedMinutes");

  return { classId, title, dueAt, estimatedMinutes, category, missing };
}

// ─── Durations ──────────────────────────────────────────────────────────────

const HOURS = "(?:h|hr|hrs|hour|hours)";
const MINUTES = "(?:m|min|mins|minute|minutes)";
// One word: "45m", "1.5h", "1h30m", "1h30"
const ONE_WORD_DURATION = new RegExp(
  `^(?:(\\d+(?:\\.\\d+)?)${HOURS}(?:(\\d+)${MINUTES}?)?|(\\d+)${MINUTES})$`,
);
// Two words: "30 min", "2 hours" (but not a bare "m"/"h", which are too likely to mean something else)
const UNIT_WORD = /^(?:min|mins|minute|minutes|hr|hrs|hour|hours)$/;
const MAX_MINUTES = 24 * 60; // anything longer is almost certainly a typo

function takeDuration(words: Word[]): number | null {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let minutes: number | null = null;
    let wordCount = 1;

    const m = ONE_WORD_DURATION.exec(w.clean);
    if (m) {
      const [, hours, extraMinutes, onlyMinutes] = m;
      minutes = hours
        ? Math.round(parseFloat(hours) * 60) + (extraMinutes ? parseInt(extraMinutes, 10) : 0)
        : parseInt(onlyMinutes, 10);
    } else if (/^\d+(\.\d+)?$/.test(w.clean) && i + 1 < words.length && UNIT_WORD.test(words[i + 1].clean)) {
      const value = parseFloat(w.clean);
      minutes = Math.round(words[i + 1].clean.startsWith("h") ? value * 60 : value);
      wordCount = 2;
    }

    if (minutes !== null && minutes > 0 && minutes <= MAX_MINUTES) {
      for (let k = 0; k < wordCount; k++) words[i + k].used = true;
      return minutes;
    }
  }
  return null;
}

// ─── Due dates ──────────────────────────────────────────────────────────────

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** Homework is due by the end of the day unless we know better. */
function endOfDay(date: Date, daysToAdd = 0): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + daysToAdd, 23, 59, 0, 0);
  return d;
}

// A month/day more than this many days in the past is taken to mean next year
// ("1/5" typed in November means January 5th next year). Anything more recent is
// treated as overdue work from this year.
const PAST_DATE_LIMIT_DAYS = 60;

function parseDateWord(word: string, now: Date): Date | null {
  if (word === "today" || word === "tonight") return endOfDay(now);
  if (word === "tomorrow" || word === "tmrw" || word === "tmr") return endOfDay(now, 1);

  if (word in WEEKDAYS) {
    // Days until the next time this weekday comes around; 0 means today, which
    // counts because an 11:59pm deadline today hasn't passed yet.
    const daysAhead = (WEEKDAYS[word] - now.getDay() + 7) % 7;
    return endOfDay(now, daysAhead);
  }

  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word);
  if (m) {
    const month = parseInt(m[1], 10) - 1;
    const day = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    let date = new Date(year, month, day, 23, 59, 0, 0);
    // new Date() quietly rolls 13/45 over into a later month; reject that.
    if (date.getMonth() !== month || date.getDate() !== day) return null;
    if (!m[3] && now.getTime() - date.getTime() > PAST_DATE_LIMIT_DAYS * 86_400_000) {
      date = new Date(year + 1, month, day, 23, 59, 0, 0);
    }
    return date;
  }
  return null;
}

function takeDueDate(words: Word[], now: Date): Date | null {
  for (let i = 0; i < words.length; i++) {
    if (words[i].used) continue;
    const date = parseDateWord(words[i].clean, now);
    if (date) {
      words[i].used = true;
      // "due fri" / "by fri": the filler word isn't part of the title.
      const prev = words[i - 1];
      if (prev && !prev.used && (prev.clean === "due" || prev.clean === "by")) prev.used = true;
      return date;
    }
  }
  return null;
}

// ─── Classes ────────────────────────────────────────────────────────────────

// Name prefixes must be at least this long: shorter words ("a", "ch") would
// match classes by accident ("ch 5" isn't Chemistry).
const MIN_PREFIX_LENGTH = 3;

function takeClass(words: Word[], classes: Class[]): string | null {
  // First choice: a word that exactly equals a class's short name.
  for (const w of words) {
    if (w.used) continue;
    const match = classes.find((c) => c.short_name && c.short_name.toLowerCase() === w.clean);
    if (match) {
      w.used = true;
      return match.id;
    }
  }
  // Otherwise: a word that's the start of exactly one class name.
  // If it starts several class names ("phys" → Physics, Physical Education) we
  // can't know which one was meant, so we don't guess.
  for (const w of words) {
    if (w.used || w.clean.length < MIN_PREFIX_LENGTH) continue;
    const matches = classes.filter((c) => c.name.toLowerCase().startsWith(w.clean));
    if (matches.length === 1) {
      w.used = true;
      return matches[0].id;
    }
  }
  return null;
}

// ─── Categories ─────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, Category> = {
  essay: "essay",
  read: "reading", reading: "reading", ch: "reading", chapter: "reading",
  pset: "problem_set", problems: "problem_set", problem: "problem_set", hw: "problem_set", worksheet: "problem_set",
  project: "project",
  quiz: "study", test: "study", study: "study", exam: "study", review: "study",
};

function guessCategory(titleWords: string[]): Category | null {
  for (const w of titleWords) {
    if (w in CATEGORY_KEYWORDS) return CATEGORY_KEYWORDS[w];
  }
  return null;
}
