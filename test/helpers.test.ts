import { describe, expect, it } from "vitest";
import { MAX_FACTS, addFact, factsPrompt, removeFacts } from "../src/memory";
import { MAX_QUESTIONS, parseQuestions } from "../src/research";

describe("memory", () => {
  it("ignores duplicates regardless of case and spacing", () => {
    const facts = addFact(["Likes tea"], "  likes   TEA ");
    expect(facts).toEqual(["Likes tea"]);
  });

  it("ignores empty facts", () => {
    expect(addFact([], "   ")).toEqual([]);
  });

  it("drops the oldest fact past the cap", () => {
    let facts: string[] = [];
    for (let i = 0; i < MAX_FACTS + 1; i++) facts = addFact(facts, `fact ${i}`);
    expect(facts).toHaveLength(MAX_FACTS);
    expect(facts[0]).toBe("fact 1");
  });

  it("removes facts by substring and leaves others", () => {
    expect(removeFacts(["Lives in Pune", "Likes tea"], "pune")).toEqual([
      "Likes tea"
    ]);
  });

  it("says so when nothing is remembered", () => {
    expect(factsPrompt([])).toMatch(/nothing/);
  });
});

describe("parseQuestions", () => {
  it("reads a JSON array inside a code fence", () => {
    const reply = '```json\n["What is X?", "Why does X matter?"]\n```';
    expect(parseQuestions(reply)).toEqual(["What is X?", "Why does X matter?"]);
  });

  it("falls back to list lines", () => {
    expect(
      parseQuestions("1. What is X?\n2) Who uses X?\n- How is X built?")
    ).toEqual(["What is X?", "Who uses X?", "How is X built?"]);
  });

  it("caps, dedupes and drops junk", () => {
    const reply = JSON.stringify([
      "Q one?",
      "q one?",
      "ok",
      5,
      "Q two?",
      "Q three?",
      "Q four?",
      "Q five?"
    ]);
    const out = parseQuestions(reply);
    expect(out).toHaveLength(MAX_QUESTIONS);
    expect(out[0]).toBe("Q one?");
  });

  it("returns empty for unusable output", () => {
    expect(parseQuestions("")).toEqual([]);
  });
});
