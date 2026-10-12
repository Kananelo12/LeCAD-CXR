"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { Results } from "./results";
import { UploadPanel } from "./upload-panel";

type Selected = { file: File; url: string } | null;

export function Analyse() {
  const qc = useQueryClient();
  // The preview comes from the local file; the server never sends the image back.
  const [selected, setSelected] = useState<Selected>(null);
  const urlRef = useRef<string | null>(null);
  // Remounting the panel clears its state for the next image.
  const [round, setRound] = useState(0);

  const predict = useMutation({
    mutationFn: api.predict,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  function onFile(file: File | null) {
    predict.reset();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = file ? URL.createObjectURL(file) : null;
    setSelected(file && urlRef.current ? { file, url: urlRef.current } : null);
  }

  function reset() {
    onFile(null);
    setRound((r) => r + 1);
  }

  if (predict.data && selected) {
    return <Results prediction={predict.data} imageUrl={selected.url} onReset={reset} />;
  }

  const serverError = predict.error
    ? predict.error instanceof ApiError && predict.error.status !== 401
      ? predict.error.message
      : "The analysis failed. Try again."
    : null;

  return (
    <div>
      <UploadPanel
        key={round}
        file={selected?.file ?? null}
        previewUrl={selected?.url ?? null}
        onFile={onFile}
        onSubmit={() => selected && predict.mutate(selected.file)}
        pending={predict.isPending}
        serverError={serverError}
      />
    </div>
  );
}
