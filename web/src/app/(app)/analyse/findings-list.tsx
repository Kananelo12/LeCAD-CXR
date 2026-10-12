"use client";

import { CaretRight, CircleHalf, Eye, Flag, ListMagnifyingGlass, Minus, Warning } from "@phosphor-icons/react";
import { useEffect, useRef, type ComponentType } from "react";
import { Panel, PanelHeading } from "@/components/ui";
import type { Band, Finding, Label, Prediction } from "@/lib/api/schemas";
import { BAND_TEXT, FINDING_NOTE, joinNames, labelName, relativeScore, signalStrength } from "@/lib/labels";

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

// The summary names what to look at, like a report's impression line.
const NAMED_IN_SUMMARY = 3;

function summaryText(suggested: Finding[]): string {
  if (suggested.length === 0) return "No finding detected for review";
  const names = suggested.slice(0, NAMED_IN_SUMMARY).map((f) => labelName(f.label));
  const more = suggested.length - names.length;
  return more > 0
    ? `Review suggested for ${names.join(", ")} and ${more} more`
    : `Review suggested for ${joinNames(names)}`;
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

  const byStrength = [...prediction.findings].sort((a, b) => relativeScore(b) - relativeScore(a));
  const group = (band: Band) => byStrength.filter((f) => f.band === band);
  const suggested = group("above");
  const weaker = group("near");
  const notDetected = group("below");

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
          className="text-2xl font-medium tracking-[-0.02em] text-balance"
        >
          {summaryText(suggested)}
        </h3>
        <p className="mt-1.5 text-sm text-muted">
          This tool looks for 14 findings only. What it does not detect still needs your own
          read.
        </p>
      </div>

      {suggested.length > 0 && (
        <section aria-labelledby="suggested-heading" className="mt-5">
          <h4 id="suggested-heading" className="sr-only">{BAND_TEXT.above}</h4>
          <ul className="space-y-2">{suggested.map(row)}</ul>
        </section>
      )}

      {weaker.length > 0 && (
        <section aria-labelledby="weaker-heading" className="mt-6">
          <h4 id="weaker-heading" className="mb-2 text-sm font-medium text-muted">
            Weaker signals, worth a glance
          </h4>
          <ul className="space-y-2">{weaker.map(row)}</ul>
        </section>
      )}

      <details className="group mt-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[10px] text-sm font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <CaretRight aria-hidden size={14} weight="bold" className="transition-transform duration-150 group-open:rotate-90" />
          {BAND_TEXT.below} ({notDetected.length})
        </summary>
        <ul className="mt-2 space-y-2">{notDetected.map(row)}</ul>
      </details>

      {suggested.length > 0 && (
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Signal strength shows how far each finding&apos;s score sits above its review level
          (strong: at least twice the level). It orders the findings; it is not the chance
          that disease is present.
        </p>
      )}
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
  const note = FINDING_NOTE[finding.label];
  const head = (
    <>
      <span className="font-medium">{name}</span>
      <BandBadge band={finding.band} />
      {finding.band === "above" && (
        <span className="text-xs text-muted">
          {signalStrength(finding.probability, finding.threshold)} signal
        </span>
      )}
      {finding.sparse && (
        <span
          className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-line"
          title="Few examples of this finding in the training data, so this result is less reliable."
        >
          Less reliable
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
        // Selecting a row shows its highlight on the film beside it; the
        // eye (not a caret) says "shown here", not "opens somewhere else".
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex w-full flex-wrap items-center gap-2 rounded-md text-left"
        >
          {head}
          <span
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
              selected ? "bg-accent-soft text-accent" : "text-muted"
            }`}
          >
            <Eye aria-hidden size={15} weight={selected ? "fill" : "regular"} />
            {selected ? "On film" : "View on film"}
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {head}
          {finding.band === "above" && (
            <span
              className="ml-auto text-xs text-muted"
              title="Highlights are drawn for the five strongest findings."
            >
              No highlight
            </span>
          )}
        </div>
      )}
      {note && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-flag">
          <Warning aria-hidden size={13} weight="fill" className="mt-px shrink-0" />
          {note}
        </p>
      )}
    </li>
  );
}
