import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Analyse } from "./analyse";

export const metadata: Metadata = { title: "Analyse" };

export default function AnalysePage() {
  return (
    <>
      <PageHeader title="Analyse a chest X-ray">
        Upload a frontal film to see which of 14 findings may deserve a closer look.
      </PageHeader>
      <Analyse />
    </>
  );
}
