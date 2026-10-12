"use client";

import { CircleNotch, FileImage, ShieldCheck, UploadSimple } from "@phosphor-icons/react";
import { useId, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/button";
import { Panel, PanelHeading } from "@/components/ui";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "@/lib/api/schemas";

type Props = {
  file: File | null;
  previewUrl: string | null;
  onFile: (file: File | null) => void;
  onSubmit: () => void;
  pending: boolean;
  serverError: string | null;
};

// Fast feedback only; the server checks again.
export function checkFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a PNG or JPEG image. DICOM files are not supported yet.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "That image is larger than 10 MB.";
  return null;
}

export function UploadPanel({ file, previewUrl, onFile, onSubmit, pending, serverError }: Props) {
  const inputId = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    const problem = checkFile(candidate);
    setFileError(problem);
    setConfirmed(false); // the confirmation is about one specific image
    onFile(problem ? null : candidate);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (file && confirmed) onSubmit();
  }

  const error = fileError ?? serverError;

  return (
    <form
      onSubmit={submit}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]"
    >
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`block cursor-pointer rounded-2xl bg-surface p-3 shadow-panel transition duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          pending ? "pointer-events-none" : ""
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
        {previewUrl && file ? (
          <>
            <div className="relative grid place-items-center overflow-hidden rounded-xl bg-[#060a12]">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img
                src={previewUrl}
                alt="Selected chest X-ray"
                className="block h-auto max-h-[max(22rem,calc(100dvh-28rem))] w-auto max-w-full"
              />
              {pending && (
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="scan-sweep h-1/3 w-full bg-linear-to-b from-transparent via-accent/25 to-transparent" />
                </div>
              )}
            </div>
            <span className="mt-3 block px-1 pb-1 text-center text-sm font-medium text-accent">
              Choose a different image
            </span>
          </>
        ) : (
          <span
            className={`flex min-h-[26rem] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition duration-150 ${
              dragging ? "border-accent bg-accent-soft" : "border-line bg-surface-2 hover:border-[#b9c6d6]"
            }`}
          >
            <span aria-hidden className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
              <UploadSimple size={26} weight="bold" />
            </span>
            <span className="text-lg font-medium tracking-[-0.01em]">
              Drop a chest X-ray here, or click to choose one
            </span>
            <span className="text-sm text-muted">PNG or JPEG, up to 10 MB</span>
          </span>
        )}
      </label>

      <Panel aria-labelledby="confirm-heading" className="p-5 sm:p-6">
        <PanelHeading icon={<ShieldCheck size={18} weight="bold" />}>
          <span id="confirm-heading">Confirm and analyse</span>
        </PanelHeading>

        <div className="mt-5 flex items-center gap-3 rounded-[10px] bg-surface-2 px-3.5 py-3 text-sm">
          <FileImage aria-hidden size={20} className="shrink-0 text-muted" />
          {file ? (
            <span className="min-w-0">
              <span className="block truncate font-medium">{file.name}</span>
              <span className="text-muted tabular-nums">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </span>
          ) : (
            <span className="text-muted">No image chosen yet</span>
          )}
        </div>

        <div className="mt-3 flex items-start gap-3 rounded-[10px] bg-surface-2 px-3.5 py-3">
          <input
            id="scope"
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={confirmed}
            disabled={pending}
            onChange={(e) => setConfirmed(e.target.checked)}
            aria-describedby="scope-help"
          />
          <div>
            <label htmlFor="scope" className="font-medium">
              This is a frontal (PA or AP) chest X-ray of an adult, 18 or over.
            </label>
            <p id="scope-help" className="mt-1 text-sm text-muted">
              The model was not built for lateral views or children&apos;s X-rays, and its
              output on them is not meaningful. Your confirmation is recorded.
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="mt-6 w-full" disabled={!file || !confirmed || pending}>
          {pending && <CircleNotch aria-hidden size={16} weight="bold" className="animate-spin" />}
          {pending ? "Analysing…" : "Analyse image"}
        </Button>
        <p aria-live="polite" className="mt-3 min-h-5 text-center text-sm text-muted">
          {pending ? "Running the model. This can take a few seconds." : ""}
        </p>

        <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
          DICOM files are not supported yet. Export the film as PNG or JPEG first.
        </p>
      </Panel>
    </form>
  );
}
