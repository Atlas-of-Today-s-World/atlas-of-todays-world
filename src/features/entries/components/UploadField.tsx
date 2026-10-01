"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { cssBackgroundImage, safeUrl } from "@/lib/security/urls";
import { ACCEPT_AUDIO, ACCEPT_IMAGES, uploadFile, type UploadKind } from "@/lib/upload";

const ACCEPT: Record<UploadKind, string> = { image: ACCEPT_IMAGES, audio: ACCEPT_AUDIO };

/**
 * Pole s adresou souboru: vložit https adresu, nebo nahrát soubor do Storage.
 * Obrázek ukáže náhled, zvuk přehrávač.
 */
export function UploadField({
  id,
  name,
  defaultValue,
  invalid,
  kind = "image",
}: {
  id: string;
  name: string;
  defaultValue: string;
  invalid?: boolean;
  kind?: UploadKind;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = kind === "image" ? cssBackgroundImage(url) : undefined;
  const audio = kind === "audio" ? safeUrl(url) : null;

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input
          id={id}
          name={name}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          inputMode="url"
          aria-invalid={invalid || undefined}
        />
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-[var(--color-accent)]",
          )}
        >
          {busy ? "Nahrávám…" : "Nahrát"}
          <input
            type="file"
            accept={ACCEPT[kind]}
            className="sr-only"
            disabled={busy}
            onChange={async (event) => {
              const picked = event.target.files?.[0];
              event.target.value = "";
              if (!picked) return;
              setBusy(true);
              setError("");
              try {
                setUrl(await uploadFile(picked, kind));
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-[12px] text-red-700">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div
          className="h-32 w-full max-w-sm rounded-lg bg-cover bg-center"
          style={{ backgroundImage: preview }}
          role="img"
          aria-label="Náhled obrázku"
        />
      ) : null}
      {audio ? <audio controls preload="none" src={audio} className="w-full max-w-md" /> : null}
    </div>
  );
}
