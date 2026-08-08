import type { Enums } from "@/types/database.types";

export type GenerationStatus = Enums<"generation_status">;

/** Statuses the client keeps polling. */
export const ACTIVE_GENERATION_STATUSES: GenerationStatus[] = ["pending", "processing"];

export function isActiveGeneration(status: GenerationStatus) {
  return ACTIVE_GENERATION_STATUSES.includes(status);
}

export interface GenerationOutput {
  url: string;
  isVideo: boolean;
}

/**
 * Shape handed to the browser. Storage paths never leave the server — the
 * bucket is private, so outputs travel as short-lived signed URLs.
 */
export interface GenerationView {
  id: string;
  status: GenerationStatus;
  createdAt: string;
  errorMessage: string | null;
  outputs: GenerationOutput[];
  parameters: Record<string, string>;
}
