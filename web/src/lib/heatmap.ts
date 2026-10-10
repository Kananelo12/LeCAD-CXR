import type { Heatmap } from "./api/schemas";

// Perceptually ordered (inferno-like), so brighter always means stronger.
// A rainbow map would invent boundaries that are not in the data.
const STOPS: [number, [number, number, number]][] = [
  [0, [0, 0, 4]],
  [0.25, [87, 16, 110]],
  [0.5, [188, 55, 84]],
  [0.75, [249, 142, 9]],
  [1, [252, 255, 164]],
];

export function colour(v: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, v));
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i];
    if (x <= x1) {
      const [x0, c0] = STOPS[i - 1];
      const t = (x - x0) / (x1 - x0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + t * (c1[k] - c0[k]))) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// Weak activations fade to transparent so the radiograph stays readable.
export function alpha(v: number): number {
  return Math.round(Math.min(1, Math.max(0, (v - 0.3) / 0.7)) * 230);
}

// One pixel per grid cell; the browser's smoothing does the upsampling
// when the canvas is stretched over the image.
export function drawHeatmap(canvas: HTMLCanvasElement, grid: Heatmap) {
  const rows = grid.length;
  const cols = grid[0].length;
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(cols, rows);
  grid.forEach((row, y) =>
    row.forEach((v, x) => {
      const i = (y * cols + x) * 4;
      const [r, g, b] = colour(v);
      img.data.set([r, g, b, alpha(v)], i);
    }),
  );
  ctx.putImageData(img, 0, 0);
}
