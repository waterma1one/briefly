import { Streamdown } from "streamdown";
import { Text } from "@cloudflare/kumo";
import type { BrieflyState } from "./server";

export function BrieflyPanel({ state }: { state: BrieflyState }) {
  const { facts, research } = state;

  return (
    <aside className="hidden lg:flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l border-kumo-line bg-kumo-base p-5">
      <section aria-label="Research">
        <Text variant="heading3" as="h2">
          Research
        </Text>
        {!research && (
          <p className="mt-2 text-sm text-kumo-inactive">
            Ask me to research a topic and the brief shows up here.
          </p>
        )}
        {research && (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium text-kumo-default">
              {research.topic}
            </p>
            {research.status === "running" && (
              <div>
                <progress
                  className="h-1.5 w-full"
                  max={100}
                  value={Math.round((research.progress?.percent ?? 0.05) * 100)}
                />
                <p className="mt-1 text-xs text-kumo-inactive">
                  {research.progress?.message ?? "Starting"}
                </p>
              </div>
            )}
            {research.status === "error" && (
              <p className="text-sm text-red-500">
                Research failed: {research.error}
              </p>
            )}
            {research.status === "complete" && research.brief && (
              <div className="text-sm">
                <Streamdown>{research.brief}</Streamdown>
              </div>
            )}
          </div>
        )}
      </section>

      <section aria-label="Memory">
        <Text variant="heading3" as="h2">
          What I remember
        </Text>
        {facts.length === 0 ? (
          <p className="mt-2 text-sm text-kumo-inactive">
            Nothing yet. Tell me about your goals or preferences.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-kumo-default">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
