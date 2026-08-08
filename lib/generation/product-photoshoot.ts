import { z } from "zod";

/**
 * Parameter values mirror the JSON schema published by the Wiro model.
 * Source: https://wiro.ai/models/wiro/product-photoshoot (JSON schema tab)
 * Keep these in sync when the model is updated.
 */

export const PHOTOSHOOT_STYLE_VALUES = [
  "auto",
  "studio",
  "lifestyle",
  "minimalist",
  "luxury",
  "outdoor",
  "flat-lay",
  "editorial",
] as const;

export const PHOTOSHOOT_PLAN_VALUES = [
  "auto",
  "close-up",
  "hero-shot",
  "scale-context",
  "action-shot",
  "packaging",
] as const;

export const PHOTOSHOOT_RATIO_VALUES = ["16:9", "9:16", "1:1"] as const;

export const PHOTOSHOOT_OUTPUT_TYPE_VALUES = ["image", "both", "video"] as const;

export type PhotoshootStyle = (typeof PHOTOSHOOT_STYLE_VALUES)[number];
export type PhotoshootPlan = (typeof PHOTOSHOOT_PLAN_VALUES)[number];
export type PhotoshootRatio = (typeof PHOTOSHOOT_RATIO_VALUES)[number];
export type PhotoshootOutputType = (typeof PHOTOSHOOT_OUTPUT_TYPE_VALUES)[number];

export const PHOTOSHOOT_STYLE_LABELS: Record<PhotoshootStyle, string> = {
  "auto": "Auto (AI selects best style)",
  "studio": "Studio photography",
  "lifestyle": "Lifestyle setting",
  "minimalist": "Minimalist",
  "luxury": "Luxury",
  "outdoor": "Outdoor",
  "flat-lay": "Flat-lay",
  "editorial": "Editorial",
};

export const PHOTOSHOOT_PLAN_LABELS: Record<PhotoshootPlan, string> = {
  "auto": "Auto (AI selects best composition)",
  "close-up": "Close-up (detail shot)",
  "hero-shot": "Hero shot (main product)",
  "scale-context": "Scale context (with size reference)",
  "action-shot": "Action shot (product in use)",
  "packaging": "Packaging shot",
};

export const PHOTOSHOOT_RATIO_LABELS: Record<PhotoshootRatio, string> = {
  "16:9": "16:9 — Landscape",
  "9:16": "9:16 — Portrait",
  "1:1": "1:1 — Square",
};

export const PHOTOSHOOT_OUTPUT_TYPE_LABELS: Record<PhotoshootOutputType, string> = {
  "image": "Image only",
  "both": "Image & video",
  "video": "Video only",
};

/**
 * Credits charged per Product Photoshoot run. Placeholder until pricing is
 * settled — the Wiro model bills per task, so this should be derived from the
 * model cost plus margin before launch.
 */
export const PRODUCT_PHOTOSHOOT_CREDIT_COST = 1;

/** Accepted by the Wiro model: JPG, JPEG, PNG, GIF, WEBP, HEIC. */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
] as const;

export const ACCEPTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic"] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Model parameters, shared by the client form and the server action. */
export const photoshootParametersSchema = z.object({
  style: z.enum(PHOTOSHOOT_STYLE_VALUES),
  plan: z.enum(PHOTOSHOOT_PLAN_VALUES),
  ratio: z.enum(PHOTOSHOOT_RATIO_VALUES),
  outputType: z.enum(PHOTOSHOOT_OUTPUT_TYPE_VALUES),
});

export type PhotoshootParameters = z.infer<typeof photoshootParametersSchema>;

export const PHOTOSHOOT_DEFAULT_PARAMETERS: PhotoshootParameters = {
  style: "auto",
  plan: "auto",
  ratio: "9:16",
  outputType: "image",
};

export interface PhotoshootFieldConfig {
  name: keyof PhotoshootParameters;
  label: string;
  description?: string;
  options: { value: string; label: string }[];
}

function toOptions<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** Drives the parameter form — every field renders as the same select. */
export const PHOTOSHOOT_FIELDS: PhotoshootFieldConfig[] = [
  {
    name: "style",
    label: "Photography style",
    description: "Sets the environment and lighting.",
    options: toOptions(PHOTOSHOOT_STYLE_VALUES, PHOTOSHOOT_STYLE_LABELS),
  },
  {
    name: "plan",
    label: "Shot type",
    description: "Sets the composition and framing.",
    options: toOptions(PHOTOSHOOT_PLAN_VALUES, PHOTOSHOOT_PLAN_LABELS),
  },
  {
    name: "ratio",
    label: "Aspect ratio",
    options: toOptions(PHOTOSHOOT_RATIO_VALUES, PHOTOSHOOT_RATIO_LABELS),
  },
  {
    name: "outputType",
    label: "Output",
    description: "The model can also return a short video.",
    options: toOptions(PHOTOSHOOT_OUTPUT_TYPE_VALUES, PHOTOSHOOT_OUTPUT_TYPE_LABELS),
  },
];

/**
 * Server action input. The image is uploaded to Supabase Storage by the
 * browser before the action runs, so only its path travels through here.
 */
export const createProductPhotoshootSchema = photoshootParametersSchema.extend({
  generationId: z.uuid(),
  inputStoragePath: z.string().min(1),
});

export type CreateProductPhotoshootInput = z.infer<typeof createProductPhotoshootSchema>;

export function buildInputStoragePath(userId: string, generationId: string, extension: string) {
  return `${userId}/${generationId}/input.${extension}`;
}
