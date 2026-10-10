import type { Metadata } from "next";
import { HistoryTable } from "./history-table";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Your analyses</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-muted">
        Images are not stored, so they cannot be shown here. Each analysis is identified by
        its image fingerprint (SHA-256): the same file always gives the same fingerprint.
      </p>
      <HistoryTable />
    </>
  );
}
