import { describe, expect, it } from "vitest";
import { MAX_FACTS, addFact, factsPrompt, removeFacts } from "../src/memory";
import { stripDuplicateFields } from "../src/ai-binding";
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

describe("stripDuplicateFields", () => {
  const usage = { choices: [], usage: { total_tokens: 0 } };

  it("drops the top-level copy next to a streamed delta", () => {
    const delta = { choices: [{ delta: { tool_calls: [{ index: 0 }] } }] };
    const line = `data: ${JSON.stringify({ ...delta, tool_calls: [{ index: 0 }] })}`;
    expect(JSON.parse(stripDuplicateFields(line).slice(6))).toEqual(delta);
  });

  it("drops the top-level text copy next to a streamed delta", () => {
    const delta = { choices: [{ delta: { content: "hi" } }] };
    const line = `data: ${JSON.stringify({ ...delta, response: "hi" })}`;
    expect(JSON.parse(stripDuplicateFields(line).slice(6))).toEqual(delta);
  });

  it("drops tool_calls from the final usage chunk", () => {
    const line = `data: ${JSON.stringify({ ...usage, tool_calls: [{ id: "a" }] })}`;
    expect(JSON.parse(stripDuplicateFields(line).slice(6))).toEqual(usage);
  });

  it("keeps streamed deltas untouched", () => {
    const line = `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0 }] } }] })}`;
    expect(stripDuplicateFields(line)).toBe(line);
  });

  it("passes through [DONE] and partial JSON", () => {
    expect(stripDuplicateFields("data: [DONE]")).toBe("data: [DONE]");
    expect(stripDuplicateFields('data: {"choices":[')).toBe(
      'data: {"choices":['
    );
  });
});
