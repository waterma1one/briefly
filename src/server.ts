import { withStreamDedupe } from "./ai-binding";
import { createWorkersAI } from "workers-ai-provider";
import { callable, routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool
} from "ai";
import { z } from "zod";
import { MODEL } from "./model";
import type { ResearchProgress, ResearchState } from "./research";
import { addFact, factsPrompt, removeFacts } from "./memory";

export type BrieflyState = {
  facts: string[];
  research: ResearchState | null;
};

export class ChatAgent extends AIChatAgent<Env, BrieflyState> {
  initialState: BrieflyState = { facts: [], research: null };
  maxPersistedMessages = 100;
  chatRecovery = true;
  // Wait for MCP connections to be re-established after hibernation before
  // processing a message, so MCP tools aren't intermittently missing.
  waitForMcpConnections = true;

  onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({
      binding: withStreamDedupe(this.env.AI)
    });

    const result = streamText({
      model: workersai(MODEL, { sessionAffinity: this.sessionAffinity }),
      system: `You are Briefly, a concise research assistant. Answer directly and ask a short question when a request is ambiguous.

${factsPrompt(this.state.facts)}

When the user shares a lasting preference, goal or personal detail, call the remember tool once, unless it is already remembered below. When they ask you to forget something, call forget.

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.`,
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message"
      }),
      tools: {
        ...mcpTools,

        remember: tool({
          description:
            "Save a lasting fact about the user (preference, goal, role) as one short sentence.",
          inputSchema: z.object({
            fact: z.string().describe("One short sentence")
          }),
          execute: async ({ fact }) => {
            const facts = addFact(this.state.facts, fact);
            this.setState({ ...this.state, facts });
            return { saved: fact, total: facts.length };
          }
        }),

        forget: tool({
          description: "Delete saved facts that contain the given text.",
          inputSchema: z.object({
            text: z.string().describe("Text matching the fact(s) to delete")
          }),
          execute: async ({ text }) => {
            const facts = removeFacts(this.state.facts, text);
            const removed = this.state.facts.length - facts.length;
            this.setState({ ...this.state, facts });
            return { removed };
          }
        }),

        startResearch: tool({
          description:
            "Run a background multi-step research workflow on a topic and produce a written brief. Use when the user asks to research, investigate or brief them on something.",
          inputSchema: z.object({
            topic: z.string().describe("The topic to research")
          }),
          execute: async ({ topic }) => {
            const instanceId = await this.runWorkflow("RESEARCH_WORKFLOW", {
              topic
            });
            this.setState({
              ...this.state,
              research: { instanceId, topic, status: "running" }
            });
            return `Research started on "${topic}". The brief will appear in the side panel when ready.`;
          }
        }),

        scheduleTask: tool({
          description:
            "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") {
              return "Not a valid schedule input";
            }
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) return "Invalid schedule type";
            try {
              this.schedule(input, "executeTask", description, {
                idempotent: true
              });
              return `Task scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling task: ${error}`;
            }
          }
        })
      },
      stopWhen: stepCountIs(10),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  async onWorkflowProgress(
    _workflowName: string,
    instanceId: string,
    progress: unknown
  ) {
    const research = this.state.research;
    if (research?.instanceId !== instanceId) return;
    this.setState({
      ...this.state,
      research: { ...research, progress: progress as ResearchProgress }
    });
  }

  async onWorkflowComplete(
    _workflowName: string,
    instanceId: string,
    result?: unknown
  ) {
    const research = this.state.research;
    if (research?.instanceId !== instanceId) return;
    this.setState({
      ...this.state,
      research: { ...research, status: "complete", brief: String(result) }
    });
  }

  async onWorkflowError(
    _workflowName: string,
    instanceId: string,
    error: string
  ) {
    const research = this.state.research;
    if (research?.instanceId !== instanceId) return;
    this.setState({
      ...this.state,
      research: { ...research, status: "error", error }
    });
  }

  async executeTask(description: string, _task: Schedule<string>) {
    // Do the actual work here (send email, call API, etc.)
    console.log(`Executing scheduled task: ${description}`);

    // Notify connected clients via a broadcast event.
    // We use broadcast() instead of saveMessages() to avoid injecting
    // into chat history — that would cause the AI to see the notification
    // as new context and potentially loop.
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString()
      })
    );
  }
}

export { ResearchWorkflow } from "./workflow";

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
