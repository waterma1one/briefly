export const MAX_FACTS = 30;

const normalize = (fact: string) => fact.trim().replace(/\s+/g, " ");

/** Adds a fact unless an equivalent one exists; drops the oldest past MAX_FACTS. */
export function addFact(facts: string[], fact: string): string[] {
  const clean = normalize(fact);
  if (!clean) return facts;
  if (facts.some((f) => f.toLowerCase() === clean.toLowerCase())) return facts;
  return [...facts, clean].slice(-MAX_FACTS);
}

/** Removes facts containing the query (case-insensitive). */
export function removeFacts(facts: string[], query: string): string[] {
  const q = normalize(query).toLowerCase();
  if (!q) return facts;
  return facts.filter((f) => !f.toLowerCase().includes(q));
}

export function factsPrompt(facts: string[]): string {
  if (facts.length === 0) return "You know nothing about the user yet.";
  return `What you remember about the user:\n${facts.map((f) => `- ${f}`).join("\n")}`;
}
