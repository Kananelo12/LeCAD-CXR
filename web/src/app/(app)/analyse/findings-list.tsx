"use client";

import { CaretRight, CircleHalf, Flag, ListMagnifyingGlass, Minus } from "@phosphor-icons/react";
import { useEffect, useRef, type ComponentType } from "react";
import { Panel, PanelHeading } from "@/components/ui";
import type { Band, Finding, Label, Prediction } from "@/lib/api/schemas";
import { BAND_TEXT, labelName } from "@/lib/labels";

type IconType = ComponentType<{ size?: number; weight?: "regular" | "bold" | "fill"; "aria-hidden"?: boolean }>;

const BAND_STYLE: Record<Band, { Icon: IconType; className: string }> = {
  above: { Icon: Flag, className: "bg-flag-bg text-flag" },
  near: { Icon: CircleHalf, className: "bg-near-bg text-near" },
  below: { Icon: Minus, className: "bg-clear-bg text-clear" },
};

export function BandBadge({ band }: { band: Band }) {
  const { Icon, className } = BAND_STYLE[band];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon aria-hidden size={13} weight="fill" />
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
    <Panel aria-labelledby="findings-summary" className="p-5 sm:p-6">
      <PanelHeading icon={<ListMagnifyingGlass size={18} weight="bold" />}>Findings</PanelHeading>

      <div className="mt-5">
        <h3
          id="findings-summary"
          ref={summary}
          tabIndex={-1}
          className="text-2xl font-medium tracking-[-0.02em]"
        >
          {flagged.length === 0
            ? "No findings flagged for review"
            : `${flagged.length} ${flagged.length === 1 ? "finding" : "findings"} flagged for review`}
        </h3>
        <p className="mt-1.5 text-sm text-muted">
          The model checks for 14 findings only. &ldquo;Not flagged&rdquo; does not mean the
          image is normal.
        </p>
      </div>

      {flagged.length > 0 && <ul className="mt-5 space-y-2">{flagged.map(row)}</ul>}

      {near.length > 0 && (
        <section aria-labelledby="near-heading" className="mt-6">
          <h4 id="near-heading" className="mb-2 text-sm font-medium text-muted">
            Borderline: below the flagging threshold, but within half of it
          </h4>
          <ul className="space-y-2">{near.map(row)}</ul>
        </section>
      )}

      <details className="group mt-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[10px] text-sm font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <CaretRight aria-hidden size={14} weight="bold" className="transition-transform duration-150 group-open:rotate-90" />
          Not flagged ({below.length})
        </summary>
        <ul className="mt-2 space-y-2">{below.map(row)}</ul>
      </details>
    </Panel>
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
  const head = (
    <>
      <span className="font-medium">{name}</span>
      <BandBadge band={finding.band} />
      {finding.sparse && (
        <span
          className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-line"
          title="Few examples of this finding in the training data, so this estimate is less reliable."
        >
          Low-confidence estimate
        </span>
      )}
    </>
  );

  return (
    <li
      className={`rounded-[10px] px-3.5 py-3 transition duration-200 ease-out ${
        selected ? "-translate-y-px bg-surface shadow-raised" : "bg-surface-2"
      }`}
    >
      {hasHeatmap ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex w-full flex-wrap items-center gap-2 rounded-md text-left"
        >
          {head}
          <span
            className={`ml-auto flex items-center gap-1 text-xs font-medium ${selected ? "text-accent" : "text-muted"}`}
          >
            {selected ? "Heatmap shown" : "Show heatmap"}
            <CaretRight aria-hidden size={13} weight="bold" />
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">{head}</div>
      )}
      <details className="group/score mt-1.5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <CaretRight aria-hidden size={11} weight="bold" className="transition-transform duration-150 group-open/score:rotate-90" />
          Model score
        </summary>
        <p className="mt-1.5 text-sm tabular-nums">
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
