/** Private bucket holding generation inputs and outputs. */
export const GENERATIONS_BUCKET = "generations";

/** Long enough for Wiro to queue and download the input, short enough to expire. */
export const INPUT_SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Outputs are re-signed on every page load, so this only has to outlive a session. */
export const OUTPUT_SIGNED_URL_TTL_SECONDS = 60 * 60;

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];

/**
 * Signed URLs carry an opaque token, so the media kind is derived from the
 * storage path while it is still on the server. The Product Photoshoot model
 * returns a video when outputType is "video" or "both".
 */
export function isVideoStoragePath(storagePath: string) {
  return VIDEO_EXTENSIONS.includes(storagePath.split(".").pop()?.toLowerCase() ?? "");
}
