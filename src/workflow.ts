import { AgentWorkflow } from "agents/workflows";
import type { AgentWorkflowEvent, AgentWorkflowStep } from "agents/workflows";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { ChatAgent } from "./server";
import { MODEL } from "./model";
import {
  parseQuestions,
  type ResearchParams,
  type ResearchProgress
} from "./research";

export class ResearchWorkflow extends AgentWorkflow<
  ChatAgent,
  ResearchParams,
  ResearchProgress
> {
  async run(
    event: AgentWorkflowEvent<ResearchParams>,
    step: AgentWorkflowStep
  ) {
    const { topic } = event.payload;
    const ai = createWorkersAI({ binding: this.env.AI });
    const ask = async (system: string, prompt: string) =>
      (await generateText({ model: ai(MODEL), system, prompt })).text;

    await this.reportProgress({
      step: "plan",
      message: "Planning questions",
      percent: 0.1
    });
    const questions = await step.do("plan", async () => {
      const reply = await ask(
        "Break the topic into 3 or 4 focused research questions. Reply with only a JSON array of strings.",
        topic
      );
      const parsed = parseQuestions(reply);
      return parsed.length > 0 ? parsed : [topic];
    });

    const findings: { question: string; answer: string }[] = [];
    for (const [i, question] of questions.entries()) {
      await this.reportProgress({
        step: "research",
        message: question,
        percent: 0.1 + (0.7 * i) / questions.length
      });
      const answer = await step.do(`research-${i}`, async () =>
        ask(
          "Answer in 3 to 5 sentences. Be factual and say when you are unsure.",
          question
        )
      );
      findings.push({ question, answer });
    }

    await this.reportProgress({
      step: "synthesize",
      message: "Writing the brief",
      percent: 0.85
    });
    const brief = await step.do("synthesize", async () =>
      ask(
        "Write a short markdown brief: a one-paragraph summary, then bullet key points. Use only the findings given.",
        `Topic: ${topic}\n\n${findings.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}`
      )
    );

    await step.reportComplete(brief);
    return brief;
  }
}
