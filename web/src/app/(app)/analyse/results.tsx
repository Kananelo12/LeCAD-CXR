"use client";

import { ArrowCounterClockwise, CaretRight, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/button";
import type { Label, Prediction } from "@/lib/api/schemas";
import { formatTimestamp, labelName, relativeScore } from "@/lib/labels";
import { FindingsList } from "./findings-list";
import { XrayViewer } from "./xray-viewer";

type Props = {
  prediction: Prediction;
  imageUrl: string;
  onReset: () => void;
};

// Findings with a heatmap, strongest (relative to their review level) first:
// the order the viewer steps through, matching the findings list.
function mappedLabels(p: Prediction): Label[] {
  return p.findings
    .filter((f) => f.label in p.heatmaps)
    .sort((a, b) => relativeScore(b) - relativeScore(a))
    .map((f) => f.label);
}

export function Results({ prediction, imageUrl, onReset }: Props) {
  const mapped = mappedLabels(prediction);
  const [selected, setSelected] = useState<Label | null>(mapped[0] ?? null);
  const heatmap = selected ? (prediction.heatmaps[selected] ?? null) : null;

  return (
    <div className="space-y-6">
      {/* From the payload, never hardcoded (docs/api-contract.md). */}
      <div role="note" className="flex gap-3 rounded-2xl bg-caution-bg px-5 py-4 text-sm leading-relaxed text-caution">
        <Warning aria-hidden size={20} weight="fill" className="mt-px shrink-0" />
        <p className="max-w-[90ch]">{prediction.disclaimer}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-sm text-muted">
          Analysed <span className="tabular-nums">{formatTimestamp(prediction.created_at)}</span>.
          The image was not saved.
        </p>
        <Button variant="secondary" className="ml-auto" onClick={onReset}>
          <ArrowCounterClockwise aria-hidden size={16} weight="bold" />
          Analyse another image
        </Button>
      </div>

      {/* Reading order is film, then findings (phones stack it that way);
          from lg the findings take the right column beside the film. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]">
        {/* The film stays in view beside a long findings list. */}
        <div className="lg:sticky lg:top-6">
          <XrayViewer
            src={imageUrl}
            mapped={mapped}
            selected={selected}
            heatmap={heatmap}
            onSelect={setSelected}
          />
        </div>
        <FindingsList prediction={prediction} selected={selected} onSelect={setSelected} />
      </div>

      <AuditDetails prediction={prediction} />
    </div>
  );
}

// For audit and evaluation, not for reading the film: what the audit log
// recorded, and the raw scores behind the bands. Closed by default.
function AuditDetails({ prediction }: { prediction: Prediction }) {
  const byLabelOrder = prediction.findings;
  return (
    <details className="group rounded-2xl px-1">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[10px] text-sm font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <CaretRight aria-hidden size={14} weight="bold" className="transition-transform duration-150 group-open:rotate-90" />
        Audit details
      </summary>
      <div className="mt-4 grid gap-8 rounded-2xl bg-surface p-5 shadow-panel sm:p-6 lg:grid-cols-2">
        <dl className="grid content-start gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Model version</dt>
          <dd className="font-mono text-[13px]">{prediction.model.version}</dd>
          <dt className="text-muted">Image fingerprint</dt>
          <dd>
            <span className="font-mono text-[13px] break-all">{prediction.image_sha256}</span>
            <span className="mt-1 block text-muted">
              A SHA-256 of the uploaded file. The audit log keeps this, never the image.
            </span>
          </dd>
          <dt className="text-muted">Request</dt>
          <dd className="font-mono text-[13px] break-all">{prediction.request_id}</dd>
        </dl>
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left text-muted">
            Model scores and review levels (uncalibrated outputs, not probabilities of disease)
          </caption>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1.5 font-medium">Finding</th>
              <th scope="col" className="py-1.5 text-right font-medium">Score</th>
              <th scope="col" className="py-1.5 text-right font-medium">Review level</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px] tabular-nums">
            {byLabelOrder.map((f) => (
              <tr key={f.label}>
                <th scope="row" className="py-1 font-sans font-normal">{labelName(f.label)}</th>
                <td className="py-1 text-right">{f.probability.toFixed(3)}</td>
                <td className="py-1 text-right text-muted">{f.threshold.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
