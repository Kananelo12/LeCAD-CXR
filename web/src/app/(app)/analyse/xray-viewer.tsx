"use client";

import { CaretLeft, CaretRight, Eye, EyeSlash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Heatmap, Label } from "@/lib/api/schemas";
import { drawHeatmap } from "@/lib/heatmap";
import { labelName } from "@/lib/labels";

type Props = {
  src: string;
  // Findings that have a heatmap, strongest first.
  mapped: Label[];
  selected: Label | null;
  heatmap: Heatmap | null;
  onSelect: (label: Label) => void;
};

const iconButton =
  "grid size-9 place-items-center rounded-full text-ink transition duration-150 hover:bg-track active:scale-95 disabled:opacity-35 disabled:hover:bg-transparent";

export function XrayViewer({ src, mapped, selected, heatmap, onSelect }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.6);

  useEffect(() => {
    if (canvas.current && heatmap) drawHeatmap(canvas.current, heatmap);
  }, [heatmap]);

  const index = selected ? mapped.indexOf(selected) : -1;
  const step = (delta: number) => onSelect(mapped[(index + delta + mapped.length) % mapped.length]);
  const showing = heatmap !== null && visible;

  return (
    <figure>
      <div className="rounded-2xl bg-surface p-3 shadow-panel sm:pb-0">
        <div className="grid place-items-center rounded-xl bg-[#060a12]">
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded back */}
            <img
              src={src}
              alt="The analysed chest X-ray"
              className="block h-auto max-h-[max(22rem,calc(100dvh-28rem))] w-auto max-w-full"
            />
            {/* The grid covers the whole image: eval preprocessing resizes
                without cropping (docs/api-contract.md). */}
            <canvas
              ref={canvas}
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ease-out"
              style={{ opacity: showing ? opacity : 0 }}
            />
          </div>
        </div>

        {/* Docked astride the panel's lower edge from sm up, below the
            film on phones. It never covers the image: the lung bases and
            costophrenic angles sit at the film's bottom edge. */}
        {mapped.length > 0 && (
          <div className="relative z-10 mx-auto mt-3 mb-1 flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-[22px] bg-surface p-1.5 shadow-raised sm:top-6 sm:mt-0 sm:mb-0 sm:rounded-full">
            <button
              type="button"
              className={iconButton}
              onClick={() => step(-1)}
              disabled={mapped.length < 2}
              aria-label="Previous finding's heatmap"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span className="min-w-28 px-1 text-center text-sm font-medium sm:min-w-36" aria-live="polite">
              {selected ? labelName(selected) : ""}
            </span>
            <button
              type="button"
              className={iconButton}
              onClick={() => step(1)}
              disabled={mapped.length < 2}
              aria-label="Next finding's heatmap"
            >
              <CaretRight size={16} weight="bold" />
            </button>
            <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />
            <button
              type="button"
              role="switch"
              aria-checked={visible}
              onClick={() => setVisible((v) => !v)}
              className={`flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition duration-150 active:scale-[0.98] ${
                visible ? "bg-accent-soft text-accent" : "text-muted hover:bg-track"
              }`}
            >
              {visible ? <Eye aria-hidden size={17} /> : <EyeSlash aria-hidden size={17} />}
              Heatmap
            </button>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              disabled={!visible}
              onChange={(e) => setOpacity(Number(e.target.value))}
              aria-label="Heatmap opacity"
              className="mx-2 w-24 disabled:opacity-40"
            />
          </div>
        )}
      </div>

      <figcaption className="mt-4 flex sm:mt-10 flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm">
        {heatmap && selected ? (
          <>
            <p className="max-w-[60ch] text-muted">
              Heatmap for <strong className="font-medium text-ink">{labelName(selected)}</strong>:
              the regions that most influenced this score. It is not an outline of a lesion.
            </p>
            <span className="flex items-center gap-2 text-muted" aria-hidden>
              weaker
              <span className="h-1.5 w-20 rounded-full bg-linear-to-r from-[#57106e] via-[#f98e09] to-[#fcffa4]" />
              stronger
            </span>
          </>
        ) : (
          <p className="text-muted">No heatmap: no finding was flagged for review.</p>
        )}
      </figcaption>
    </figure>
  );
}
