"use client";

import { useEffect, useRef, useState } from "react";
import type { Heatmap } from "@/lib/api/schemas";
import { drawHeatmap } from "@/lib/heatmap";

type Props = {
  src: string;
  heatmap: Heatmap | null;
  heatmapLabel: string | null;
};

export function XrayViewer({ src, heatmap, heatmapLabel }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.6);

  useEffect(() => {
    if (canvas.current && heatmap) drawHeatmap(canvas.current, heatmap);
  }, [heatmap]);

  const showing = heatmap !== null && visible;

  return (
    <figure className="space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded back */}
        <img src={src} alt="The analysed chest X-ray" className="block h-auto w-full" />
        {/* The grid covers the whole image: eval preprocessing resizes
            without cropping (docs/api-contract.md). */}
        <canvas
          ref={canvas}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: showing ? opacity : 0 }}
        />
      </div>

      <figcaption className="space-y-3 text-sm">
        {heatmap ? (
          <>
            <p>
              Heatmap for <strong>{heatmapLabel}</strong>: the regions that most influenced
              this score. It is not an outline of a lesion.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-(--accent)"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                />
                Show heatmap
              </label>
              <label className="flex items-center gap-2">
                Opacity
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={opacity}
                  disabled={!visible}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="accent-(--accent)"
                />
              </label>
              <span className="flex items-center gap-2 text-muted" aria-hidden>
                weaker
                <span className="h-2 w-20 rounded bg-linear-to-r from-[#57106e] via-[#f98e09] to-[#fcffa4]" />
                stronger
              </span>
            </div>
          </>
        ) : (
          <p className="text-muted">No heatmap: no finding was flagged for review.</p>
        )}
      </figcaption>
    </figure>
  );
}
