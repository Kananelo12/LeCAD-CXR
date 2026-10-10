"use client";

import { useId, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/button";
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
    <form onSubmit={submit} className="space-y-6">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center focus-within:outline-2 focus-within:outline-focus ${
          dragging ? "border-accent bg-surface-2" : "border-line bg-surface"
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
        {previewUrl && file ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={previewUrl} alt="Selected chest X-ray" className="max-h-80 rounded bg-black" />
            <span className="text-sm">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <span className="text-sm text-accent underline">Choose a different image</span>
          </>
        ) : (
          <>
            <span className="font-medium">Drop a chest X-ray here, or click to choose one</span>
            <span className="text-sm text-muted">PNG or JPEG, up to 10 MB</span>
          </>
        )}
      </label>

      <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
        <input
          id="scope"
          type="checkbox"
          className="mt-1 size-4 accent-(--accent)"
          checked={confirmed}
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
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!file || !confirmed || pending}>
          {pending ? "Analysing…" : "Analyse image"}
        </Button>
        <p aria-live="polite" className="text-sm text-muted">
          {pending ? "Running the model. This can take a few seconds." : ""}
        </p>
      </div>
    </form>
  );
}
