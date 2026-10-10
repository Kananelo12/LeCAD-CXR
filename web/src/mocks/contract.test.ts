// The mocks stand in for FastAPI, so they must satisfy the same contract
// the real service will be held to.
import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/client";
import { LABELS, ModelInfo, Prediction } from "@/lib/api/schemas";
import { bandFor, MOCK_MODEL, mockPrediction } from "./fixtures";

const hash = (i: number) => i.toString(16).padStart(8, "0").repeat(8);

describe("mock fixtures follow the contract", () => {
  it("produces valid predictions across many seeds", () => {
    for (let i = 0; i < 300; i++) {
      const p = Prediction.parse(mockPrediction(hash(i * 7919)));
      for (const f of p.findings) expect(f.band).toBe(bandFor(f.probability, f.threshold));
      const above = p.findings.filter((f) => f.band === "above").map((f) => f.label);
      for (const label of Object.keys(p.heatmaps)) expect(above).toContain(label);
      expect(Object.keys(p.heatmaps).length).toBeLessThanOrEqual(5);
    }
  });

  it("is deterministic for the same image", () => {
    const a = mockPrediction(hash(42));
    const b = mockPrediction(hash(42));
    expect(a.findings).toEqual(b.findings);
  });

  it("describes all 14 labels in the model info", () => {
    expect(Object.keys(ModelInfo.parse(MOCK_MODEL).validation.per_class).sort()).toEqual(
      [...LABELS].sort(),
    );
  });
});

describe("mock API through the real client", () => {
  const png = () => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], "cxr.png", { type: "image/png" });

  it("requires sign-in", async () => {
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    await expect(api.predict(png())).rejects.toMatchObject({ status: 401 });
  });

  it("rejects bad credentials", async () => {
    await expect(api.login("clinician", "wrong")).rejects.toMatchObject({ status: 401 });
  });

  it("signs in, predicts, and records history", async () => {
    const { user } = await api.login("clinician", "demo");
    expect((await api.me()).user).toEqual(user);

    const prediction = await api.predict(png());
    const history = await api.history();
    expect(history.items).toHaveLength(1);
    expect(history.items[0].image_sha256).toBe(prediction.image_sha256);

    await api.logout();
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
  });

  it("rejects non-image uploads", async () => {
    await api.login("clinician", "demo");
    const txt = new File(["hello"], "notes.txt", { type: "text/plain" });
    await expect(api.predict(txt)).rejects.toMatchObject({ status: 415 });
  });
});
