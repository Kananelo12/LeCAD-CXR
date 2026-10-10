import type { Metadata } from "next";
import { Analyse } from "./analyse";

export const metadata: Metadata = { title: "Analyse" };

export default function AnalysePage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Analyse a chest X-ray</h1>
      <Analyse />
    </>
  );
}
