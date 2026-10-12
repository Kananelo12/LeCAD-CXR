"use client";

import { ArrowCounterClockwise, Fingerprint, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/button";
import { Panel, PanelHeading } from "@/components/ui";
import type { Label, Prediction } from "@/lib/api/schemas";
import { formatTimestamp } from "@/lib/labels";
import { FindingsList } from "./findings-list";
import { XrayViewer } from "./xray-viewer";

type Props = {
  prediction: Prediction;
  imageUrl: string;
  onReset: () => void;
};

// Findings with a heatmap, strongest first: the order the viewer steps through.
function mappedLabels(p: Prediction): Label[] {
  return p.findings
    .filter((f) => f.label in p.heatmaps)
    .sort((a, b) => b.probability - a.probability)
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

      {/* Reading order is film, findings, record (phones stack it that way);
          from lg the findings take the right column beside both. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)] lg:grid-rows-[auto_1fr]">
        <div className="lg:col-start-1 lg:row-start-1">
          <XrayViewer
            src={imageUrl}
            mapped={mapped}
            selected={selected}
            heatmap={heatmap}
            onSelect={setSelected}
          />
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <FindingsList prediction={prediction} selected={selected} onSelect={setSelected} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <Panel aria-labelledby="record-heading" className="p-5 sm:p-6">
            <PanelHeading
              icon={<Fingerprint size={18} weight="bold" />}
              aside={
                <Button variant="secondary" onClick={onReset}>
                  <ArrowCounterClockwise aria-hidden size={16} weight="bold" />
                  Analyse another image
                </Button>
              }
            >
              <span id="record-heading">Analysis record</span>
            </PanelHeading>
            <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">Analysed</dt>
              <dd className="tabular-nums">{formatTimestamp(prediction.created_at)}</dd>
              <dt className="text-muted">Model</dt>
              <dd className="font-mono text-[13px]">{prediction.model.version}</dd>
              <dt className="text-muted">Image fingerprint</dt>
              <dd>
                <span className="font-mono text-[13px] break-all">{prediction.image_sha256}</span>
                <span className="mt-1 block text-muted">
                  The image itself was not stored. Only this SHA-256 fingerprint was logged.
                </span>
              </dd>
              <dt className="text-muted">Request</dt>
              <dd className="font-mono text-[13px] break-all">{prediction.request_id}</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
