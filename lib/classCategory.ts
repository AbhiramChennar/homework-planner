// TypeScript twin of the SQL function public.class_category() (see
// supabase/migrations/20261111000200_admin_dashboard.sql), used by demo mode.
// tests/admin.test.ts checks the two give the same answer for many names.
const RULES: [RegExp, string][] = [
  [/(computer|programming|coding|\bcs\b)/, "computer_science"],
  [/(calc|algebra|geometry|math|stat|trig)/, "math"],
  [/(bio|chem|physics|science|anatomy|environmental|earth)/, "science"],
  [/(english|lit|writing|language arts|composition|rhetoric)/, "english"],
  [/(history|gov|econ|psych|social|geography|civics|sociology)/, "social_studies"],
  [/(spanish|french|german|chinese|mandarin|latin|japanese|italian|korean|arabic|\basl\b)/, "world_language"],
  [/(art|music|band|choir|orchestra|theater|theatre|drama|design|photo)/, "arts"],
];

export function classCategory(name: string): string {
  const n = name.toLowerCase();
  return RULES.find(([re]) => re.test(n))?.[1] ?? "other";
}
