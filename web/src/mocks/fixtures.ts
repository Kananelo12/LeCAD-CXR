// Fake but contract-valid data for development and tests. Nothing here is a
// model output; predictions are seeded from the image hash so the same file
// always gives the same result.
import {
  LABELS,
  type Band,
  type Finding,
  type Heatmap,
  type HistoryItem,
  type Label,
  type ModelInfo,
  type Prediction,
  type User,
} from "@/lib/api/schemas";

export const MOCK_PASSWORD = "demo";

export const MOCK_USERS: User[] = [
  { id: "u_01", username: "clinician", display_name: "Dr T. Mokoena", role: "clinician" },
  { id: "u_02", username: "admin", display_name: "System Admin", role: "admin" },
];

export const MOCK_DISCLAIMER =
  "Decision support only, not a diagnosis. LeCAD-CXR is a research prototype, " +
  "not a registered medical device. It has not been validated on patients in " +
  "Lesotho. The clinical decision remains with the treating clinician.";

const MODEL_VERSION = "mock-densenet121-0000000";
const SPARSE: readonly Label[] = ["Hernia", "Pneumonia", "Fibrosis"];

// Plausible Youden thresholds: low, because most findings are rare.
const THRESHOLDS: Record<Label, number> = {
  Atelectasis: 0.11,
  Cardiomegaly: 0.06,
  Effusion: 0.13,
  Infiltration: 0.18,
  Mass: 0.05,
  Nodule: 0.06,
  Pneumonia: 0.015,
  Pneumothorax: 0.05,
  Consolidation: 0.04,
  Edema: 0.025,
  Emphysema: 0.03,
  Fibrosis: 0.02,
  Pleural_Thickening: 0.035,
  Hernia: 0.004,
};

const AUC: Record<Label, number> = {
  Atelectasis: 0.79,
  Cardiomegaly: 0.89,
  Effusion: 0.87,
  Infiltration: 0.7,
  Mass: 0.83,
  Nodule: 0.77,
  Pneumonia: 0.72,
  Pneumothorax: 0.86,
  Consolidation: 0.79,
  Edema: 0.88,
  Emphysema: 0.9,
  Fibrosis: 0.8,
  Pleural_Thickening: 0.77,
  Hernia: 0.87,
};

const N_POS: Record<Label, number> = {
  Atelectasis: 1650,
  Cardiomegaly: 410,
  Effusion: 1980,
  Infiltration: 2850,
  Mass: 820,
  Nodule: 950,
  Pneumonia: 143,
  Pneumothorax: 400,
  Consolidation: 450,
  Edema: 200,
  Emphysema: 280,
  Fibrosis: 240,
  Pleural_Thickening: 470,
  Hernia: 22,
};

export function bandFor(probability: number, threshold: number): Band {
  if (probability >= threshold) return "above";
  if (probability >= 0.5 * threshold) return "near";
  return "below";
}

export const MOCK_MODEL: ModelInfo = {
  version: MODEL_VERSION,
  architecture: "densenet121",
  image_size: 224,
  validation: {
    n_images: 17_210,
    macro_auc: 0.818,
    per_class: Object.fromEntries(
      LABELS.map((label) => [
        label,
        {
          n_pos: N_POS[label],
          auc: AUC[label],
          pr_auc: Math.round(AUC[label] * 0.3 * 1000) / 1000,
          threshold: THRESHOLDS[label],
          sensitivity: 0.74,
          specificity: 0.76,
          sparse: SPARSE.includes(label),
        },
      ]),
    ) as ModelInfo["validation"]["per_class"],
  },
};

function rng(seed: number) {
  // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A 7x7 grid (DenseNet-121's last block at 224 px) with one soft blob.
function heatmap(rand: () => number): Heatmap {
  const size = 7;
  const cy = 1.5 + rand() * 4;
  const cx = 1 + rand() * 5;
  const sigma = 0.9 + rand() * 0.8;
  const grid = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) =>
      Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma ** 2)),
    ),
  );
  const max = Math.max(...grid.flat());
  return grid.map((row) => row.map((v) => Math.round((v / max) * 1000) / 1000));
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function mockPrediction(sha256: string, now = new Date()): Prediction {
  const rand = rng(parseInt(sha256.slice(0, 8), 16));
  const nFlagged = Math.floor(rand() * 4); // 0-3 findings above threshold
  const flagged = new Set<Label>();
  while (flagged.size < nFlagged) flagged.add(LABELS[Math.floor(rand() * LABELS.length)]);

  const findings: Finding[] = LABELS.map((label) => {
    const t = THRESHOLDS[label];
    // Squared so most unflagged scores sit well below threshold, as with a real model.
    const p = flagged.has(label) ? t + rand() * (1 - t) * 0.6 : t * rand() ** 2 * 0.95;
    const probability = Math.round(p * 10_000) / 10_000;
    return {
      label,
      probability,
      threshold: t,
      band: bandFor(probability, t),
      sparse: SPARSE.includes(label),
    };
  });

  const heatmaps: Prediction["heatmaps"] = {};
  findings
    .filter((f) => f.band === "above")
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5)
    .forEach((f) => (heatmaps[f.label] = heatmap(rand)));

  return {
    request_id: crypto.randomUUID(),
    created_at: now.toISOString(),
    image_sha256: sha256,
    model: { version: MODEL_VERSION, architecture: "densenet121" },
    disclaimer: MOCK_DISCLAIMER,
    findings,
    heatmaps,
  };
}

export function toHistoryItem(p: Prediction): HistoryItem {
  return {
    request_id: p.request_id,
    created_at: p.created_at,
    image_sha256: p.image_sha256,
    model_version: p.model.version,
    flagged: p.findings
      .filter((f) => f.band === "above")
      .sort((a, b) => b.probability - a.probability)
      .map((f) => f.label),
  };
}
