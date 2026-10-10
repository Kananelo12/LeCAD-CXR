"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { LABELS } from "@/lib/api/schemas";
import { labelName } from "@/lib/labels";

const fmt = (v: number | null, digits = 2) => (v === null ? "—" : v.toFixed(digits));

export function ModelMetrics() {
  const model = useQuery({ queryKey: ["model"], queryFn: api.model, staleTime: Infinity });

  if (model.isPending) return <p className="text-sm text-muted">Loading model details…</p>;
  if (model.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        Could not load model details.
      </p>
    );
  }

  const { version, architecture, validation } = model.data;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Validation results</h2>
      <p className="text-sm text-muted">
        Model <span className="font-mono">{version}</span> ({architecture})
        {validation.n_images !== null &&
          `, measured on ${validation.n_images.toLocaleString()} validation images`}
        . Macro AUC {fmt(validation.macro_auc, 3)}. AUC ranges from 0.5 (chance) to 1
        (perfect).
      </p>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Finding</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Positive images</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">AUC</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Sensitivity</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Specificity</th>
            </tr>
          </thead>
          <tbody>
            {LABELS.map((label) => {
              const m = validation.per_class[label];
              return (
                <tr key={label} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2 font-normal">
                    {labelName(label)}
                    {m.sparse && <span className="ml-2 text-xs text-muted">(low-confidence)</span>}
                  </th>
                  <td className="px-4 py-2 text-right font-mono">{m.n_pos.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(m.auc)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(m.sensitivity)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(m.specificity)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Sensitivity and specificity are at each finding&apos;s flagging threshold. Validation
        data come from the same institution as training data, so they likely overstate
        performance elsewhere.
      </p>
    </section>
  );
}
