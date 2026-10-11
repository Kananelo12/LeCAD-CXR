import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { HistoryTable } from "./history-table";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="Your analyses">
        Images are not stored, so they cannot be shown here. Each analysis is identified by its
        image fingerprint (SHA-256): the same file always gives the same fingerprint.
      </PageHeader>
      <HistoryTable />
    </>
  );
}
