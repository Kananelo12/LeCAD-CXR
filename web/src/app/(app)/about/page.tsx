import type { Metadata } from "next";
import { ModelMetrics } from "./model-metrics";

export const metadata: Metadata = { title: "About the model" };

// Static text summarises docs/model-card.md; the numbers come from /api/model.
export default function AboutPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">About the model</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Intended use</h2>
        <p>
          Decision support for qualified healthcare professionals reading frontal chest
          X-rays. It suggests which of 14 findings may deserve a closer look. It does not
          diagnose, and the clinical decision remains the clinician&apos;s.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Not for</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Children&apos;s X-rays, lateral views, or anything other than a chest radiograph</li>
          <li>Any use where a clinician does not review the output</li>
          <li>The care of real patients: this is a research prototype, not a medical device</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Limitations to keep in mind</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Trained on NIH ChestX-ray14, from a single US institution. Patients, equipment
            and disease patterns in Lesotho differ, and performance here is unknown.
          </li>
          <li>Training labels were mined from reports by software, not drawn on images.</li>
          <li>
            &ldquo;Not flagged&rdquo; is not &ldquo;normal&rdquo;: the model only looks for
            14 findings.
          </li>
          <li>
            Hernia, Pneumonia and Fibrosis had few training examples. Their estimates are
            marked low-confidence.
          </li>
          <li>
            Bedside (AP) films, markers and lines can influence the model. Check the heatmap
            against the anatomy.
          </li>
        </ul>
      </section>

      <ModelMetrics />
    </div>
  );
}
