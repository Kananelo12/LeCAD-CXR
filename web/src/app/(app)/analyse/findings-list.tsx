"use client";

import { useEffect, useRef } from "react";
import type { Band, Finding, Label, Prediction } from "@/lib/api/schemas";
import { BAND_TEXT, labelName } from "@/lib/labels";

const BAND_STYLE: Record<Band, { icon: string; className: string }> = {
  above: { icon: "▲", className: "bg-flag-bg text-flag" },
  near: { icon: "◆", className: "bg-near-bg text-near" },
  below: { icon: "–", className: "bg-clear-bg text-clear" },
};

export function BandBadge({ band }: { band: Band }) {
  const { icon, className } = BAND_STYLE[band];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      <span aria-hidden>{icon}</span>
      {BAND_TEXT[band]}
    </span>
  );
}

type Props = {
  prediction: Prediction;
  selected: Label | null;
  onSelect: (label: Label) => void;
};

export function FindingsList({ prediction, selected, onSelect }: Props) {
  // The upload form (and its focused button) is gone once results show;
  // move focus here so keyboard and screen-reader users land on the result.
  const summary = useRef<HTMLHeadingElement>(null);
  useEffect(() => summary.current?.focus(), []);

  const byScore = [...prediction.findings].sort((a, b) => b.probability - a.probability);
  const group = (band: Band) => byScore.filter((f) => f.band === band);
  const flagged = group("above");
  const near = group("near");
  const below = group("below");

  const row = (f: Finding) => (
    <FindingRow
      key={f.label}
      finding={f}
      hasHeatmap={f.label in prediction.heatmaps}
      selected={selected === f.label}
      onSelect={() => onSelect(f.label)}
    />
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 ref={summary} tabIndex={-1} className="text-lg font-semibold">
          {flagged.length === 0
            ? "No findings flagged for review"
            : `${flagged.length} ${flagged.length === 1 ? "finding" : "findings"} flagged for review`}
        </h2>
        <p className="mt-1 text-sm text-muted">
          The model checks for 14 findings only. &ldquo;Not flagged&rdquo; does not mean
          the image is normal.
        </p>
      </div>

      {flagged.length > 0 && <ul className="space-y-2">{flagged.map(row)}</ul>}

      {near.length > 0 && (
        <section aria-labelledby="near-heading">
          <h3 id="near-heading" className="mb-2 text-sm font-medium text-muted">
            Borderline: below the flagging threshold, but within half of it
          </h3>
          <ul className="space-y-2">{near.map(row)}</ul>
        </section>
      )}

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted">
          Not flagged ({below.length})
        </summary>
        <ul className="mt-2 space-y-2">{below.map(row)}</ul>
      </details>
    </div>
  );
}

function FindingRow({
  finding,
  hasHeatmap,
  selected,
  onSelect,
}: {
  finding: Finding;
  hasHeatmap: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = labelName(finding.label);
  return (
    <li
      className={`rounded-lg border bg-surface p-3 ${selected ? "border-accent" : "border-line"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{name}</span>
        <BandBadge band={finding.band} />
        {finding.sparse && (
          <span
            className="rounded border border-line px-2 py-0.5 text-xs text-muted"
            title="Few examples of this finding in the training data, so this estimate is less reliable."
          >
            Low-confidence estimate
          </span>
        )}
        {hasHeatmap && (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`ml-auto rounded-md px-2 py-1 text-xs font-medium ${
              selected ? "bg-accent text-accent-text" : "border border-line hover:bg-surface-2"
            }`}
          >
            {selected ? "Heatmap shown" : "Show heatmap"}
          </button>
        )}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-muted">Model score</summary>
        <p className="mt-1 text-sm">
          Score <span className="font-mono">{finding.probability.toFixed(3)}</span>, flagging
          threshold <span className="font-mono">{finding.threshold.toFixed(3)}</span>.
        </p>
        <p className="mt-1 text-xs text-muted">
          An uncalibrated model output, not the probability that disease is present. The
          threshold was chosen on validation data.
          {finding.sparse && " Few training examples of this finding: treat with extra caution."}
        </p>
      </details>
    </li>
  );
}
