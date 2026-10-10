import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "@/lib/api/client";
import { mockPrediction } from "@/mocks/fixtures";
import { server } from "@/mocks/node";
import { renderWithQuery } from "@/test/render";
import { Analyse } from "./analyse";

const png = () => new File([new Uint8Array([137, 80, 78, 71, 9])], "cxr.png", { type: "image/png" });

async function chooseAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText(/drop a chest x-ray/i), png());
  await user.click(screen.getByRole("checkbox", { name: /frontal/i }));
}

describe("Analyse", () => {
  beforeEach(async () => {
    await api.login("clinician", "demo");
  });

  it("cannot submit until an image is chosen and the scope confirmed", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Analyse />);
    const submit = screen.getByRole("button", { name: /analyse image/i });
    expect(submit).toBeDisabled();

    await user.upload(screen.getByLabelText(/drop a chest x-ray/i), png());
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /frontal/i }));
    expect(submit).toBeEnabled();
  });

  it("rejects files that are not PNG or JPEG before uploading", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithQuery(<Analyse />);
    await user.upload(
      screen.getByLabelText(/drop a chest x-ray/i),
      new File(["x"], "scan.dcm", { type: "application/dicom" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/PNG or JPEG/);
  });

  it("renders the disclaimer from the response, not a hardcoded one", async () => {
    const disclaimer = "Payload disclaimer 7f3a";
    server.use(
      http.post("/api/predict", () =>
        HttpResponse.json({ ...mockPrediction("ab".repeat(32)), disclaimer }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<Analyse />);
    await chooseAndConfirm(user);
    await user.click(screen.getByRole("button", { name: /analyse image/i }));

    expect(await screen.findByText(disclaimer)).toBeInTheDocument();
  });

  it("orders flagged findings first and shows the strongest heatmap", async () => {
    const prediction = mockPrediction("00".repeat(32));
    prediction.findings = prediction.findings.map((f) =>
      f.label === "Effusion"
        ? { ...f, probability: 0.6, band: "above" }
        : f.label === "Mass"
          ? { ...f, probability: 0.3, band: "above" }
          : { ...f, probability: 0, band: "below" },
    );
    prediction.heatmaps = { Effusion: [[0, 1], [1, 0]], Mass: [[1, 0], [0, 1]] };
    server.use(http.post("/api/predict", () => HttpResponse.json(prediction)));

    const user = userEvent.setup();
    renderWithQuery(<Analyse />);
    await chooseAndConfirm(user);
    await user.click(screen.getByRole("button", { name: /analyse image/i }));

    expect(await screen.findByRole("heading", { name: "2 findings flagged for review" })).toBeVisible();
    const pressed = screen.getByRole("button", { pressed: true });
    expect(pressed.closest("li")).toHaveTextContent("Effusion");
    expect(screen.getByText(/Heatmap for/)).toHaveTextContent("Effusion");

    await user.click(within(screen.getByText("Mass").closest("li")!).getByRole("button"));
    expect(screen.getByText(/Heatmap for/)).toHaveTextContent("Mass");
  });

  it("shows the server's message when the upload is refused", async () => {
    server.use(
      http.post("/api/predict", () =>
        HttpResponse.json({ detail: "Image is larger than 10 MB." }, { status: 413 }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<Analyse />);
    await chooseAndConfirm(user);
    await user.click(screen.getByRole("button", { name: /analyse image/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("larger than 10 MB");
  });
});

describe("Analyse focus", () => {
  it("moves focus to the result summary when results appear", async () => {
    await api.login("clinician", "demo");
    const user = userEvent.setup();
    renderWithQuery(<Analyse />);
    await chooseAndConfirm(user);
    await user.click(screen.getByRole("button", { name: /analyse image/i }));
    const heading = await screen.findByRole("heading", { name: /flagged for review/ });
    expect(heading).toHaveFocus();
  });
});
