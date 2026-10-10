import type { Band, Label } from "./api/schemas";

// "Pleural_Thickening" -> "Pleural thickening"
export function labelName(label: Label): string {
  const words = label.replace(/_/g, " ").toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

// Wording agreed in ADR 0002. "Flagged" is a prompt to look, not a finding.
export const BAND_TEXT: Record<Band, string> = {
  above: "Flagged for review",
  near: "Borderline",
  below: "Not flagged",
};

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}
