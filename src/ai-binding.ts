/**
 * Workers AI streams text and tool-call arguments in `choices[0].delta`, and
 * repeats them in top-level `response` and `tool_calls` fields on each chunk.
 * workers-ai-provider handles both, so every token is applied twice: doubled
 * words, and tool-call JSON that fails to parse. The `choices` copy is the
 * OpenAI-standard one, so the top-level duplicates are dropped.
 */
export function stripDuplicateFields(line: string): string {
  if (!line.startsWith("data: ") || line === "data: [DONE]") return line;
  try {
    const chunk = JSON.parse(line.slice(6));
    if (
      Array.isArray(chunk.choices) &&
      ("tool_calls" in chunk || "response" in chunk)
    ) {
      delete chunk.tool_calls;
      delete chunk.response;
      return `data: ${JSON.stringify(chunk)}`;
    }
  } catch {
    // not a complete JSON line; pass through untouched
  }
  return line;
}

function dedupeStream(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          controller.enqueue(encoder.encode(`${stripDuplicateFields(line)}\n`));
        }
      },
      flush(controller) {
        if (buffer)
          controller.enqueue(encoder.encode(stripDuplicateFields(buffer)));
      }
    })
  );
}

/** Wraps an AI binding so streamed responses no longer repeat tool calls. */
export function withStreamDedupe(ai: Ai): Ai {
  return new Proxy(ai, {
    get(target, prop, receiver) {
      if (prop !== "run") return Reflect.get(target, prop, receiver);
      return async (...args: unknown[]) => {
        const out = await (
          target.run as (...a: unknown[]) => Promise<unknown>
        ).apply(target, args);
        return out instanceof ReadableStream ? dedupeStream(out) : out;
      };
    }
  });
}
