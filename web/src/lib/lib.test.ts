import { describe, expect, it } from "vitest";
import { alpha, colour } from "./heatmap";
import { labelName } from "./labels";
import { safeNext } from "./auth";

describe("labelName", () => {
  it("humanises dataset labels", () => {
    expect(labelName("Pleural_Thickening")).toBe("Pleural thickening");
    expect(labelName("Mass")).toBe("Mass");
  });
});

describe("heatmap colours", () => {
  const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  it("gets brighter as activation rises", () => {
    const steps = Array.from({ length: 11 }, (_, i) => luminance(colour(i / 10)));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
  });

  it("leaves weak activations transparent", () => {
    expect(alpha(0.1)).toBe(0);
    expect(alpha(1)).toBeGreaterThan(200);
  });
});

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/history")).toBe("/history");
    expect(safeNext("//evil.example")).toBe("/analyse");
    expect(safeNext("https://evil.example")).toBe("/analyse");
    expect(safeNext("/\\evil.example")).toBe("/analyse");
    expect(safeNext(null)).toBe("/analyse");
  });
});
