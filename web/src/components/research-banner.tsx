// Static, on every page. Separate from the per-prediction disclaimer, which
// always comes from the API payload.
export function ResearchBanner() {
  return (
    <div
      role="note"
      className="border-b border-notice-line bg-notice-bg px-4 py-2 text-center text-sm text-notice"
    >
      <strong>Research prototype — not a medical device.</strong> Not for use in
      the care of any patient.
    </div>
  );
}
