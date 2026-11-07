// Runtime mirror of docs/api-contract.md. Change both together.
import { z } from "zod";

// Same order as ml/src/lecad/labels.py. Never retype it elsewhere.
export const LABELS = [
  "Atelectasis",
  "Cardiomegaly",
  "Effusion",
  "Infiltration",
  "Mass",
  "Nodule",
  "Pneumonia",
  "Pneumothorax",
  "Consolidation",
  "Edema",
  "Emphysema",
  "Fibrosis",
  "Pleural_Thickening",
  "Hernia",
] as const;

export const Label = z.enum(LABELS);
export type Label = z.infer<typeof Label>;

export const Band = z.enum(["above", "near", "below"]);
export type Band = z.infer<typeof Band>;

const Timestamp = z.iso.datetime({ offset: true });
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
// NaN metrics arrive as null (JSON has no NaN).
const Metric = z.number().nullable();

export const User = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  role: z.enum(["clinician", "admin"]),
});
export type User = z.infer<typeof User>;

export const UserResponse = z.object({ user: User });

export const Health = z.object({ status: z.literal("ok") });

export const Finding = z.object({
  label: Label,
  probability: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
  band: Band,
  sparse: z.boolean(),
});
export type Finding = z.infer<typeof Finding>;

// Row-major, top row first, values 0-1, covering the whole image.
export const Heatmap = z.array(z.array(z.number().min(0).max(1)).min(1)).min(1);
export type Heatmap = z.infer<typeof Heatmap>;

export const Prediction = z.object({
  request_id: z.string(),
  created_at: Timestamp,
  image_sha256: Sha256,
  model: z.object({ version: z.string(), architecture: z.string() }),
  disclaimer: z.string().min(1),
  findings: z
    .array(Finding)
    .length(LABELS.length)
    .refine((fs) => fs.every((f, i) => f.label === LABELS[i]), "findings must follow LABELS order"),
  heatmaps: z.partialRecord(Label, Heatmap),
});
export type Prediction = z.infer<typeof Prediction>;

export const HistoryItem = z.object({
  request_id: z.string(),
  created_at: Timestamp,
  image_sha256: Sha256,
  model_version: z.string(),
  flagged: z.array(Label),
});
export type HistoryItem = z.infer<typeof HistoryItem>;

export const HistoryPage = z.object({
  items: z.array(HistoryItem),
  next_cursor: z.string().nullable(),
});
export type HistoryPage = z.infer<typeof HistoryPage>;

export const ClassMetrics = z.object({
  n_pos: z.number().int(),
  auc: Metric,
  pr_auc: Metric,
  threshold: z.number(),
  sensitivity: Metric,
  specificity: Metric,
  sparse: z.boolean(),
});
export type ClassMetrics = z.infer<typeof ClassMetrics>;

export const ModelInfo = z.object({
  version: z.string(),
  architecture: z.string(),
  image_size: z.number().int(),
  validation: z.object({
    n_images: z.number().int().nullable(),
    macro_auc: Metric,
    per_class: z.record(Label, ClassMetrics),
  }),
});
export type ModelInfo = z.infer<typeof ModelInfo>;

export const ErrorBody = z.object({ detail: z.string() });

// Upload limits, enforced client-side for fast feedback and by the server for real.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;
