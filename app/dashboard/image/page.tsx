import { redirect } from "next/navigation";
import { Suspense } from "react";

import { GenerationList } from "@/components/image-studio/generation-list";
import { ProductPhotoshootForm } from "@/components/image-studio/product-photoshoot-form";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_PHOTOSHOOT_CREDIT_COST } from "@/lib/generation/product-photoshoot";
import { GENERATIONS_BUCKET, isVideoStoragePath, OUTPUT_SIGNED_URL_TTL_SECONDS } from "@/lib/generation/storage";
import type { GenerationView } from "@/lib/generation/types";
import { createClient } from "@/lib/supabase/server";

const RECENT_GENERATIONS_LIMIT = 12;

/** Only the model parameters are shown as badges. */
const DISPLAYED_PARAMETER_KEYS = ["style", "plan", "ratio", "outputType"];

async function requireUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/auth/login");
  }

  return { supabase, userId: data.claims.sub as string };
}

async function ProductPhotoshootSection() {
  const { supabase, userId } = await requireUserId();

  const { data: creditBalance } = await supabase
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .single();

  return (
    <ProductPhotoshootForm
      userId={userId}
      creditBalance={creditBalance?.balance ?? 0}
      creditCost={PRODUCT_PHOTOSHOOT_CREDIT_COST}
    />
  );
}

async function RecentGenerations() {
  const { supabase } = await requireUserId();

  const { data: rows } = await supabase
    .from("generations")
    .select("id,status,created_at,error_message,output_storage_paths,parameters")
    .eq("model", "product-photoshoot")
    .order("created_at", { ascending: false })
    .limit(RECENT_GENERATIONS_LIMIT);

  const storagePaths = (rows ?? []).flatMap((row) => row.output_storage_paths);

  const signedUrlByPath = new Map<string, string>();

  if (storagePaths.length) {
    const { data: signed } = await supabase.storage
      .from(GENERATIONS_BUCKET)
      .createSignedUrls(storagePaths, OUTPUT_SIGNED_URL_TTL_SECONDS);

    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) {
        signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

  const generations: GenerationView[] = (rows ?? []).map((row) => {
    const parameters = (row.parameters ?? {}) as Record<string, unknown>;

    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      errorMessage: row.error_message,
      outputs: row.output_storage_paths.flatMap((path) => {
        const url = signedUrlByPath.get(path);

        return url ? [{ url, isVideo: isVideoStoragePath(path) }] : [];
      }),
      parameters: Object.fromEntries(
        DISPLAYED_PARAMETER_KEYS.flatMap((key) =>
          typeof parameters[key] === "string" ? [[key, parameters[key]]] : [],
        ),
      ),
    };
  });

  return <GenerationList generations={generations} />;
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-6 rounded-xl border p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

function GenerationsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="aspect-square w-full rounded-xl" />
    </div>
  );
}

export default function ImageStudioPage() {
  return (
    <div className="flex w-full flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Image Studio</h1>
        <p className="text-sm text-muted-foreground">
          Turn a plain product photo into a professional product shot.
        </p>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <ProductPhotoshootSection />
      </Suspense>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Recent generations</h2>
        <Suspense fallback={<GenerationsSkeleton />}>
          <RecentGenerations />
        </Suspense>
      </div>
    </div>
  );
}
