import "server-only";

import { createHmac } from "node:crypto";

import type { PhotoshootOutputType, PhotoshootPlan, PhotoshootRatio, PhotoshootStyle } from "@/lib/generation/product-photoshoot";
import type { WiroError, WiroResponse, WiroRunResponse, WiroTask, WiroTaskDetailResponse } from "./types";

const WIRO_API_BASE_URL = "https://api.wiro.ai/v1";

/** Confirmed by the model's llms-full.txt: POST /Run/wiro/product-photoshoot */
const PRODUCT_PHOTOSHOOT_PATH = "/Run/wiro/product-photoshoot";

const REQUEST_TIMEOUT_MS = 30_000;

/** Wiro reports failures as HTTP 200 with `result: false`, so surface both. */
export class WiroApiError extends Error {
  // Not `readonly`: the project's naming-convention rule reserves public
  // readonly class properties for PascalCase/UPPER_CASE names.
  status: number;
  errors: WiroError[];

  constructor(message: string, status: number, errors: WiroError[] = []) {
    super(message);
    this.name = "WiroApiError";
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Signature auth, as documented by the model:
 *
 *   SIGNATURE = HMAC-SHA256(message = API_SECRET + NONCE, key = API_KEY)
 *
 * Note the unusual pairing — the API *key* is the HMAC key and the *secret*
 * is part of the message, not the other way round. The nonce is a unix
 * timestamp, so headers are built per request rather than cached.
 */
function buildAuthHeaders(): Record<string, string> {
  const apiKey = process.env.WIRO_API_KEY;
  const apiSecret = process.env.WIRO_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new WiroApiError("WIRO_API_KEY and WIRO_API_SECRET must be configured", 500);
  }

  const nonce = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", apiKey).update(`${apiSecret}${nonce}`).digest("hex");

  return {
    "x-api-key": apiKey,
    "x-nonce": nonce,
    "x-signature": signature,
  };
}

function firstErrorMessage(errors: WiroError[], fallback: string) {
  return errors[0]?.message ?? fallback;
}

/** Authenticated POST to the Wiro API, with both failure modes normalised. */
async function wiroPost<T extends WiroResponse>(path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${WIRO_API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error: unknown) {
    if (error instanceof WiroApiError) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : "Unknown network error";

    throw new WiroApiError(`Could not reach the Wiro API: ${reason}`, 503);
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new WiroApiError(
      firstErrorMessage(payload?.errors ?? [], `Wiro API returned ${response.status}`),
      response.status,
      payload?.errors ?? [],
    );
  }

  if (!payload?.result) {
    throw new WiroApiError(
      firstErrorMessage(payload?.errors ?? [], "Wiro API rejected the request"),
      response.status,
      payload?.errors ?? [],
    );
  }

  return payload;
}

export interface RunProductPhotoshootParams {
  /** Publicly reachable URL — Wiro downloads the image itself. */
  inputImageUrl: string;
  style: PhotoshootStyle;
  plan: PhotoshootPlan;
  ratio: PhotoshootRatio;
  outputType: PhotoshootOutputType;
  callbackUrl?: string;
}

export interface WiroRunHandle {
  taskId: string;
  socketAccessToken: string;
}

/**
 * Starts a Product Photoshoot run and returns the handle used to track it.
 * Does not wait for the result — the task is polled separately.
 */
export async function runProductPhotoshoot(params: RunProductPhotoshootParams): Promise<WiroRunHandle> {
  const {
    inputImageUrl, style, plan, ratio, outputType, callbackUrl
  } = params;

  const payload = await wiroPost<WiroRunResponse>(PRODUCT_PHOTOSHOOT_PATH, {
    // `inputImage` is a combinefileinput param: the URL goes in directly,
    // with no `Url` suffix variant.
    inputImage: inputImageUrl,
    style,
    plan,
    ratio,
    outputType,
    ...(callbackUrl ? { callbackUrl } : {}),
  });

  if (!payload.taskid || !payload.socketaccesstoken) {
    throw new WiroApiError("Wiro API response is missing the task identifiers", 200);
  }

  return { taskId: payload.taskid, socketAccessToken: payload.socketaccesstoken };
}

/** Current state of a task. Returns null when Wiro reports no such task. */
export async function getWiroTask(taskId: string): Promise<WiroTask | null> {
  const payload = await wiroPost<WiroTaskDetailResponse>("/Task/Detail", { taskid: taskId });

  return payload.tasklist?.[0] ?? null;
}
