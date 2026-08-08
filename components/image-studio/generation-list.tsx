"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { syncGenerations } from "@/app/dashboard/image/actions";
import { GenerationCard } from "@/components/image-studio/generation-card";
import { isActiveGeneration, type GenerationView } from "@/lib/generation/types";

const POLL_INTERVAL_MS = 4_000;

/** ~10 minutes at the interval above; Wiro runs finish in seconds. */
const MAX_POLL_ROUNDS = 150;

interface GenerationListProps {
  generations: GenerationView[];
}

export function GenerationList({ generations: initialGenerations }: GenerationListProps) {
  const [generations, setGenerations] = useState(initialGenerations);

  // Server-rendered list wins whenever the page revalidates.
  useEffect(() => {
    setGenerations(initialGenerations);
  }, [initialGenerations]);

  // Keyed on the ids being polled, so the loop restarts only when that set
  // changes — not on every state update.
  const activeIds = generations
    .filter((generation) => isActiveGeneration(generation.status))
    .map((generation) => generation.id)
    .join(",");

  useEffect(() => {
    if (!activeIds) {
      return;
    }

    let cancelled = false;
    let rounds = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      rounds += 1;

      // One action call for the whole batch — Next.js serialises Server Action
      // dispatches per client, so a call per generation would queue up.
      const { results } = await syncGenerations(activeIds.split(","));

      if (cancelled || !results) {
        return;
      }

      setGenerations((previous) =>
        previous.map((generation) => {
          const result = results[generation.id];

          return result?.status
            ? {
              ...generation,
              status: result.status,
              outputs: result.outputs ?? generation.outputs,
              errorMessage: result.errorMessage ?? generation.errorMessage,
            }
            : generation;
        }),
      );

      // Only terminal transitions are announced; the ids leave the polled set
      // straight after, so each generation can only toast once.
      for (const result of Object.values(results)) {
        if (result.status === "completed") {
          toast.success("Your product photo is ready.");
        }

        if (result.status === "failed" || result.status === "cancelled") {
          toast.error(result.errorMessage ?? "The generation did not finish.");
        }
      }

      if (!cancelled && rounds < MAX_POLL_ROUNDS) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeIds]);

  if (!generations.length) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <p className="text-sm font-medium">No generations yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your product photos will show up here once you run one.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {generations.map((generation) => (
        <GenerationCard key={generation.id} generation={generation} />
      ))}
    </div>
  );
}
