"use client";

import { ChartBar } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Panel, PanelHeading } from "@/components/ui";
import { api } from "@/lib/api/client";
import { LABELS } from "@/lib/api/schemas";
import { labelName } from "@/lib/labels";

const fmt = (v: number | null, digits = 2) => (v === null ? "n/a" : v.toFixed(digits));
const cell = "px-3 py-3 sm:px-4";
const num = `${cell} text-right font-mono text-[13px] tabular-nums`;

export function ModelMetrics() {
  const model = useQuery({ queryKey: ["model"], queryFn: api.model, staleTime: Infinity });

  return (
    <Panel aria-labelledby="metrics-heading" className="p-5 sm:p-6">
      <PanelHeading icon={<ChartBar size={18} weight="bold" />}>
        <span id="metrics-heading">Validation results</span>
      </PanelHeading>

      {model.isPending ? (
        <div className="mt-5 space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-[10px] bg-surface-2" />
          ))}
          <span className="sr-only">Loading model details</span>
        </div>
      ) : model.isError ? (
        <div role="alert" className="mt-5 rounded-[10px] bg-surface-2 p-5">
          <p className="font-medium">Could not load model details.</p>
          <Button variant="secondary" className="mt-4" onClick={() => model.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Model <span className="font-mono text-[13px] text-ink">{model.data.version}</span> (
            {model.data.architecture})
            {model.data.validation.n_images !== null &&
              `, measured on ${model.data.validation.n_images.toLocaleString()} validation images`}
            . Overall accuracy (macro AUC){" "}
            <span className="font-medium text-ink tabular-nums">
              {fmt(model.data.validation.macro_auc, 3)}
            </span>
            . AUC measures how well the tool ranks images with a finding above images
            without it: 0.5 is chance, 1 is perfect.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr className="bg-surface-2 [&>th:first-child]:rounded-l-[10px] [&>th:last-child]:rounded-r-[10px]">
                  <th scope="col" className={`${cell} py-2.5 font-medium`}>Finding</th>
                  <th scope="col" className={`${cell} py-2.5 text-right font-medium`}>Positive images</th>
                  <th scope="col" className={`${cell} py-2.5 text-right font-medium`}>Accuracy (AUC)</th>
                  <th scope="col" className={`${cell} py-2.5 text-right font-medium`}>Sensitivity</th>
                  <th scope="col" className={`${cell} py-2.5 text-right font-medium`}>Specificity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LABELS.map((label) => {
                  const m = model.data.validation.per_class[label];
                  return (
                    <tr key={label}>
                      <th scope="row" className={`${cell} font-normal`}>
                        {labelName(label)}
                        {m.sparse && (
                          <span className="ml-2 rounded-md px-1.5 py-0.5 text-xs text-muted ring-1 ring-line">
                            less reliable
                          </span>
                        )}
                      </th>
                      <td className={num}>{m.n_pos.toLocaleString()}</td>
                      <td className={num}>{fmt(m.auc)}</td>
                      <td className={num}>{fmt(m.sensitivity)}</td>
                      <td className={num}>{fmt(m.specificity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Sensitivity and specificity are at each finding&apos;s review level, set to catch
            at least 9 in 10 cases on validation data.
            Validation data come from the same institution as training data, so they likely
            overstate performance elsewhere.
          </p>
        </>
      )}
    </Panel>
  );
}
