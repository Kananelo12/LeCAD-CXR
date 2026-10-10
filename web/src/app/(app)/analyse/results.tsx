"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import type { Label, Prediction } from "@/lib/api/schemas";
import { formatTimestamp, labelName } from "@/lib/labels";
import { FindingsList } from "./findings-list";
import { XrayViewer } from "./xray-viewer";

type Props = {
  prediction: Prediction;
  imageUrl: string;
  onReset: () => void;
};

function strongestWithHeatmap(p: Prediction): Label | null {
  const withMap = p.findings.filter((f) => f.label in p.heatmaps);
  withMap.sort((a, b) => b.probability - a.probability);
  return withMap[0]?.label ?? null;
}

export function Results({ prediction, imageUrl, onReset }: Props) {
  const [selected, setSelected] = useState<Label | null>(() => strongestWithHeatmap(prediction));
  const heatmap = selected ? (prediction.heatmaps[selected] ?? null) : null;

  return (
    <div className="space-y-6">
      {/* From the payload, never hardcoded (docs/api-contract.md). */}
      <p
        role="note"
        className="rounded-lg border border-notice-line bg-notice-bg p-4 text-sm text-notice"
      >
        {prediction.disclaimer}
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <XrayViewer
          src={imageUrl}
          heatmap={heatmap}
          heatmapLabel={selected ? labelName(selected) : null}
        />
        <FindingsList prediction={prediction} selected={selected} onSelect={setSelected} />
      </div>

      <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-line bg-surface p-4 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Analysed</dt>
        <dd>{formatTimestamp(prediction.created_at)}</dd>
        <dt className="text-muted">Model</dt>
        <dd className="font-mono">{prediction.model.version}</dd>
        <dt className="text-muted">Image fingerprint</dt>
        <dd>
          <span className="font-mono break-all">{prediction.image_sha256}</span>
          <span className="block text-muted">
            The image itself was not stored. Only this SHA-256 fingerprint was logged.
          </span>
        </dd>
        <dt className="text-muted">Request</dt>
        <dd className="font-mono">{prediction.request_id}</dd>
      </dl>

      <Button variant="secondary" onClick={onReset}>
        Analyse another image
      </Button>
    </div>
  );
}
