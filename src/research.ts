export const MAX_QUESTIONS = 4;

export type ResearchParams = { topic: string };

export type ResearchProgress = {
  step: "plan" | "research" | "synthesize";
  message: string;
  percent: number;
};

export type ResearchState = {
  instanceId: string;
  topic: string;
  status: "running" | "complete" | "error";
  progress?: ResearchProgress;
  brief?: string;
  error?: string;
};

/**
 * Pulls sub-questions out of a model reply. Accepts a JSON array (optionally in
 * a code fence) and falls back to one question per list line.
 */
export function parseQuestions(reply: string): string[] {
  const array = reply.match(/\[[\s\S]*\]/);
  if (array) {
    try {
      const parsed: unknown = JSON.parse(array[0]);
      if (Array.isArray(parsed)) {
        return clean(parsed.filter((q): q is string => typeof q === "string"));
      }
    } catch {
      // fall through to line parsing
    }
  }
  return clean(
    reply.split("\n").map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, ""))
  );
}

function clean(questions: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of questions) {
    const text = q.trim();
    if (text.length < 5 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out.slice(0, MAX_QUESTIONS);
}
