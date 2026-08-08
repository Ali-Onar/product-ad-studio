"use server";

import { revalidatePath } from "next/cache";

import { createProductPhotoshootSchema, PRODUCT_PHOTOSHOOT_CREDIT_COST } from "@/lib/generation/product-photoshoot";
import { GENERATIONS_BUCKET, INPUT_SIGNED_URL_TTL_SECONDS, isVideoStoragePath, OUTPUT_SIGNED_URL_TTL_SECONDS } from "@/lib/generation/storage";
import type { GenerationOutput, GenerationStatus } from "@/lib/generation/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getWiroTask, runProductPhotoshoot, WiroApiError } from "@/lib/wiro/client";
import { isSuccessfulWiroTask, isTerminalWiroStatus, type WiroTaskOutput } from "@/lib/wiro/types";
import type { TablesInsert } from "@/types/database.types";

export interface CreateProductPhotoshootResult {
  success?: boolean;
  generationId?: string;
  error?: string;
}

export async function createProductPhotoshoot(
  input: unknown,
): Promise<CreateProductPhotoshootResult> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return { error: "You must be signed in to generate images." };
  }

  const parsed = createProductPhotoshootSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Some of the generation settings are invalid. Please review the form." };
  }

  const {
    generationId, inputStoragePath, style, plan, ratio, outputType
  } = parsed.data;

  // The storage policy already scopes writes to the user's folder, but the
  // path arrives from the browser, so pin it to this user and generation.
  if (!inputStoragePath.startsWith(`${userId}/${generationId}/`)) {
    return { error: "The uploaded image does not belong to this generation." };
  }

  // Wiro fetches the image over HTTP and the bucket is private, so hand it a
  // short-lived signed URL. This doubles as an existence check on the upload.
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .createSignedUrl(inputStoragePath, INPUT_SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error("Failed to sign generation input:", signedUrlError);

    return { error: "We could not read the uploaded image. Please upload it again." };
  }

  const generation: TablesInsert<"generations"> = {
    id: generationId,
    user_id: userId,
    type: "photo",
    model: "product-photoshoot",
    status: "pending",
    input_storage_path: inputStoragePath,
    parameters: {
      style, plan, ratio, outputType
    },
    credits_used: PRODUCT_PHOTOSHOOT_CREDIT_COST,
  };

  const { error: insertError } = await supabase.from("generations").insert(generation);

  if (insertError) {
    console.error("Failed to create generation:", insertError);

    return { error: "We could not start the generation. Please try again." };
  }

  // Credit functions are service-role only; the session was verified above.
  const admin = createAdminClient();

  const { data: deducted, error: deductError } = await admin.rpc("check_and_deduct_credits", {
    p_user_id: userId,
    p_amount: PRODUCT_PHOTOSHOOT_CREDIT_COST,
    p_generation_id: generationId,
    p_description: "Product photoshoot generation",
  });

  if (deductError || !deducted) {
    if (deductError) {
      console.error("Failed to deduct credits:", deductError);
    }

    await admin.from("generations").delete().eq("id", generationId);

    return {
      error: deductError
        ? "We could not process your credits. Please try again."
        : "You do not have enough credits for this generation.",
    };
  }

  try {
    const { taskId, socketAccessToken } = await runProductPhotoshoot({
      inputImageUrl: signedUrlData.signedUrl,
      style,
      plan,
      ratio,
      outputType,
    });

    const { error: updateError } = await admin
      .from("generations")
      .update({
        status: "processing",
        wiro_task_id: taskId,
        parameters: {
          style, plan, ratio, outputType, socketAccessToken
        },
        started_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    if (updateError) {
      // The run is already charged and in flight upstream, so keep the row and
      // let the polling step reconcile it rather than refunding here.
      console.error("Failed to attach Wiro task to generation:", updateError);
    }
  } catch (error: unknown) {
    const message =
      error instanceof WiroApiError ? error.message : "The generation service is unavailable.";

    console.error("Wiro run failed:", error);

    await admin.rpc("add_credits", {
      p_user_id: userId,
      p_amount: PRODUCT_PHOTOSHOOT_CREDIT_COST,
      p_type: "refund",
      p_reference_id: generationId,
      p_description: "Refund for failed product photoshoot",
    });

    await admin
      .from("generations")
      .update({
        status: "failed",
        error_message: message,
        credits_used: 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    return { error: `${message} Your credits have been refunded.` };
  }

  revalidatePath("/dashboard/image");
  revalidatePath("/dashboard");

  return { success: true, generationId };
}

export interface SyncGenerationResult {
  status?: GenerationStatus;
  outputs?: GenerationOutput[];
  errorMessage?: string | null;
  error?: string;
}

/**
 * Copies Wiro's CDN files into our own bucket. The CDN URLs are unguessable
 * but unauthenticated and outside our retention control, so the files are
 * re-hosted rather than linked.
 */
async function storeWiroOutputs(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  generationId: string,
  outputs: WiroTaskOutput[],
) {
  const storagePaths: string[] = [];

  for (const [index, output] of outputs.entries()) {
    const response = await fetch(output.url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Could not download output ${output.name} (HTTP ${response.status})`);
    }

    const extension = output.name.split(".").pop()?.toLowerCase() ?? "png";
    const storagePath = `${userId}/${generationId}/output-${index + 1}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(GENERATIONS_BUCKET)
      .upload(storagePath, await response.arrayBuffer(), {
        contentType: output.contenttype,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Could not store output ${output.name}: ${uploadError.message}`);
    }

    storagePaths.push(storagePath);
  }

  return storagePaths;
}

async function signOutputs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePaths: string[],
): Promise<GenerationOutput[]> {
  if (!storagePaths.length) {
    return [];
  }

  const { data, error } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .createSignedUrls(storagePaths, OUTPUT_SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("Failed to sign generation outputs:", error);

    return [];
  }

  return data.flatMap((entry) =>
    entry.signedUrl && entry.path
      ? [{ url: entry.signedUrl, isVideo: isVideoStoragePath(entry.path) }]
      : [],
  );
}

/**
 * Polls one generation against Wiro and settles it if the task finished.
 * Safe to call repeatedly — rows in a terminal state short-circuit.
 */
async function syncOne(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  generationId: string,
): Promise<SyncGenerationResult> {
  // RLS restricts this select to the caller's own rows.
  const { data: generation, error: loadError } = await supabase
    .from("generations")
    .select("id,status,wiro_task_id,output_storage_paths,error_message,credits_used")
    .eq("id", generationId)
    .single();

  if (loadError || !generation) {
    return { error: "Generation not found." };
  }

  if (generation.status !== "pending" && generation.status !== "processing") {
    return {
      status: generation.status,
      outputs: await signOutputs(supabase, generation.output_storage_paths),
      errorMessage: generation.error_message,
    };
  }

  if (!generation.wiro_task_id) {
    return { status: generation.status };
  }

  let task;

  try {
    task = await getWiroTask(generation.wiro_task_id);
  } catch (error: unknown) {
    // A transient upstream hiccup must not settle the row — keep polling.
    console.error("Failed to read Wiro task:", error);

    return { status: generation.status };
  }

  if (!task || !isTerminalWiroStatus(task.status)) {
    return { status: "processing" };
  }

  const admin = createAdminClient();

  if (isSuccessfulWiroTask(task)) {
    try {
      const storagePaths = await storeWiroOutputs(admin, userId, generationId, task.outputs ?? []);

      const { error: updateError } = await admin
        .from("generations")
        .update({
          status: "completed",
          output_storage_paths: storagePaths,
          completed_at: new Date().toISOString(),
        })
        .eq("id", generationId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      revalidatePath("/dashboard/image");

      return {
        status: "completed",
        outputs: await signOutputs(supabase, storagePaths),
        errorMessage: null,
      };
    } catch (error: unknown) {
      // The image exists upstream but we could not keep it. Leave the row
      // active so the next poll retries instead of burning the credit.
      console.error("Failed to store Wiro outputs:", error);

      return { status: generation.status };
    }
  }

  // Terminal but unsuccessful: cancelled, non-zero exit, or no output files.
  const failureMessage =
    task.status === "task_cancel"
      ? "The generation was cancelled."
      : "The generation failed. Please try again.";

  if (generation.credits_used > 0) {
    await admin.rpc("add_credits", {
      p_user_id: userId,
      p_amount: generation.credits_used,
      p_type: "refund",
      p_reference_id: generationId,
      p_description: "Refund for failed product photoshoot",
    });
  }

  await admin
    .from("generations")
    .update({
      status: task.status === "task_cancel" ? "cancelled" : "failed",
      error_message: failureMessage,
      credits_used: 0,
      completed_at: new Date().toISOString(),
    })
    .eq("id", generationId);

  revalidatePath("/dashboard/image");

  return {
    status: task.status === "task_cancel" ? "cancelled" : "failed",
    errorMessage: `${failureMessage} Your credits have been refunded.`,
  };
}

/** Guards against a client asking us to fan out to an unbounded number of tasks. */
const MAX_SYNC_BATCH = 20;

export interface SyncGenerationsResult {
  error?: string;
  results?: Record<string, SyncGenerationResult>;
}

/**
 * Polls a batch of generations in one round trip.
 *
 * Deliberately batched: Next.js dispatches Server Actions one at a time per
 * client, so calling a per-generation action in a `Promise.all` would serialise
 * on the wire. Fanning out here keeps the Wiro calls genuinely parallel and
 * costs a single auth check.
 */
export async function syncGenerations(generationIds: string[]): Promise<SyncGenerationsResult> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return { error: "You must be signed in." };
  }

  const ids = [...new Set(generationIds)].slice(0, MAX_SYNC_BATCH);

  const entries = await Promise.all(
    ids.map(async (id) => [id, await syncOne(supabase, userId, id)] as const),
  );

  return { results: Object.fromEntries(entries) };
}
