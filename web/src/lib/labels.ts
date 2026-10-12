import type { Band, Label } from "./api/schemas";

// "Pleural_Thickening" -> "Pleural thickening". The dataset's own finding
// names are kept: they are the terms clinicians already read (decision
// 2026-10-12); only the underscore and capitalisation change.
export function labelName(label: Label): string {
  const words = label.replace(/_/g, " ").toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

// Band wording (decision 2026-10-12, supersedes ADR 0002's original). A band
// is a prompt to look, never a finding: "not detected by this tool" says
// what the tool did, not what the film shows.
export const BAND_TEXT: Record<Band, string> = {
  above: "Review suggested",
  near: "Weaker signal",
  below: "Not detected by this tool",
};

// A finding's score relative to its own review level. Raw scores are not
// comparable across findings (each has its own level), so this is the order
// findings are read in, highlighted in (the API uses the same measure) and
// labelled by.
export function relativeScore(f: { probability: number; threshold: number }): number {
  return f.threshold > 0 ? f.probability / f.threshold : Infinity;
}

export type Strength = "Strong" | "Moderate" | "Slight";

// How far a suggested finding's score sits above its review level. A display
// grouping for reading order, not a validated measure and not a probability:
// at least twice the level is "Strong", at least 1.4 times "Moderate".
export function signalStrength(probability: number, threshold: number): Strength {
  const ratio = relativeScore({ probability, threshold });
  if (ratio >= 2) return "Strong";
  if (ratio >= 1.4) return "Moderate";
  return "Slight";
}

// Per-finding cautions shown on the row itself. Hernia's review level caught
// only 63% of cases on the held-out test set (docs/model-card.md, a known
// limitation), so its absence must not reassure.
export const FINDING_NOTE: Partial<Record<Label, string>> = {
  Hernia: "Often missed by this tool. Do not rely on its absence.",
};

// Names in reading order: "A", "A and B", "A, B and C".
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}
