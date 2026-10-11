import { Info } from "@phosphor-icons/react/ssr";

// Static, on every page. Separate from the per-prediction disclaimer, which
// always comes from the API payload.
export function ResearchBanner() {
  return (
    <div role="note" className="bg-track px-4 py-2 text-center text-[13px] text-muted">
      <Info aria-hidden size={15} weight="bold" className="mr-1.5 inline -translate-y-px" />
      <strong className="font-medium text-ink">Research prototype, not a medical device.</strong>{" "}
      Not for use in the care of any patient.
    </div>
  );
}
