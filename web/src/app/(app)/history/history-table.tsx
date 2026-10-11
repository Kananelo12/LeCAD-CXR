"use client";

import { ClockCounterClockwise, Scan } from "@phosphor-icons/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button, buttonClass } from "@/components/button";
import { Panel, PanelHeading } from "@/components/ui";
import { api } from "@/lib/api/client";
import { formatTimestamp, labelName } from "@/lib/labels";

const cell = "px-4 py-3.5";

export function HistoryTable() {
  const history = useInfiniteQuery({
    queryKey: ["history"],
    queryFn: ({ pageParam }) => api.history(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Panel aria-labelledby="history-heading" className="p-5 sm:p-6">
      <PanelHeading
        icon={<ClockCounterClockwise size={18} weight="bold" />}
        aside={
          items.length > 0 && (
            <span className="text-sm text-muted tabular-nums">
              {items.length}
              {history.hasNextPage ? "+" : ""} {items.length === 1 ? "analysis" : "analyses"}
            </span>
          )
        }
      >
        <span id="history-heading">Analysis history</span>
      </PanelHeading>

      {history.isPending ? (
        <div className="mt-5 space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-[10px] bg-surface-2" />
          ))}
          <span className="sr-only">Loading</span>
        </div>
      ) : history.isError ? (
        <div role="alert" className="mt-5 rounded-[10px] bg-surface-2 p-5">
          <p className="font-medium">Could not load your history.</p>
          <Button variant="secondary" className="mt-4" onClick={() => history.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-[10px] bg-surface-2 px-6 py-14 text-center">
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-surface text-muted shadow-panel">
            <Scan size={22} weight="bold" />
          </span>
          <p className="font-medium">You have not analysed any images yet.</p>
          <p className="max-w-[46ch] text-sm text-muted">
            Each analysis you run appears here with its time, flagged findings and image
            fingerprint.
          </p>
          <Link href="/analyse" className={buttonClass("primary", "mt-2")}>
            Analyse an image
          </Link>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr className="bg-surface-2 [&>th:first-child]:rounded-l-[10px] [&>th:last-child]:rounded-r-[10px]">
                <th scope="col" className={`${cell} py-2.5 font-medium`}>When</th>
                <th scope="col" className={`${cell} py-2.5 font-medium`}>Flagged for review</th>
                <th scope="col" className={`${cell} py-2.5 font-medium`}>Image fingerprint</th>
                <th scope="col" className={`${cell} py-2.5 font-medium`}>Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.request_id}>
                  <td className={`${cell} whitespace-nowrap tabular-nums`}>
                    {formatTimestamp(item.created_at)}
                  </td>
                  <td className={cell}>
                    {item.flagged.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {item.flagged.map((label) => (
                          <span key={label} className="rounded-md bg-flag-bg px-2 py-0.5 text-xs font-medium text-flag">
                            {labelName(label)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className={`${cell} font-mono text-[13px]`} title={item.image_sha256}>
                    {item.image_sha256.slice(0, 12)}…
                  </td>
                  <td className={`${cell} font-mono text-[13px] text-muted`}>{item.model_version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.hasNextPage && (
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
        >
          {history.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </Panel>
  );
}
