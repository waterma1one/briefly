# Briefly

A chat agent on Cloudflare that remembers you and writes research briefs.

| Requirement             | Implementation                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| LLM                     | Llama 3.3 70B (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) on Workers AI                                                    |
| Workflow / coordination | Cloudflare Workflows: plan, research each question, synthesize, with durable steps and live progress                        |
| User input              | React chat UI served from the Worker, streamed over WebSocket                                                               |
| Memory / state          | One Durable Object per user (`ChatAgent`): chat history, remembered facts and research status persist in its SQLite storage |

## How it works

- `src/server.ts`: `ChatAgent` (Agents SDK `AIChatAgent`). Tools: `remember`, `forget`, `startResearch`, `scheduleTask`. Remembered facts are injected into the system prompt on every turn.
- `src/workflow.ts`: `ResearchWorkflow`. Each LLM call is its own `step.do`, so a failed call retries without redoing earlier steps. Progress goes back to the agent, which pushes it to the browser through synced agent state.
- `src/briefly-panel.tsx`: side panel showing research progress, the finished brief and what the agent remembers.

Try: "I'm a backend engineer learning Rust", then "Research how Durable Objects handle hibernation".

## Run

```sh
npm install
npx wrangler login   # Workers AI runs remotely, even in dev
npm run dev
```

## Deploy

```sh
npm run deploy
```

## Check

```sh
npm run check   # format, lint, typecheck
npm test        # helper unit tests
```
