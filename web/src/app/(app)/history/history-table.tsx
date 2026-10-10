"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { api } from "@/lib/api/client";
import { formatTimestamp, labelName } from "@/lib/labels";

export function HistoryTable() {
  const history = useInfiniteQuery({
    queryKey: ["history"],
    queryFn: ({ pageParam }) => api.history(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  if (history.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (history.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        Could not load your history.
      </p>
    );
  }

  const items = history.data.pages.flatMap((p) => p.items);
  if (items.length === 0) {
    return <p className="text-sm text-muted">You have not analysed any images yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">When</th>
              <th scope="col" className="px-4 py-2 font-medium">Flagged for review</th>
              <th scope="col" className="px-4 py-2 font-medium">Image fingerprint</th>
              <th scope="col" className="px-4 py-2 font-medium">Model</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.request_id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">{formatTimestamp(item.created_at)}</td>
                <td className="px-4 py-2">
                  {item.flagged.length ? (
                    item.flagged.map(labelName).join(", ")
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono" title={item.image_sha256}>
                  {item.image_sha256.slice(0, 12)}…
                </td>
                <td className="px-4 py-2 font-mono text-muted">{item.model_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {history.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
        >
          {history.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
