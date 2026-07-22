"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Mirror Check Photo (spec §9.4). A visual aid: pick a standing / forward-bend
 * photo and overlay a vertical plumb line + horizontal reference lines to eye
 * shoulder/hip level. Local preview only — nothing is uploaded or stored.
 */
export default function MirrorPage() {
  const [url, setUrl] = useState<string | null>(null);
  const [showV, setShowV] = useState(true);
  const [showH, setShowH] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(file));
  }

  return (
    <div>
      <TopBar
        title="Mirror Check"
        subtitle="Garis bantu vertikal & horizontal untuk cek simetri."
      />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />

        {url ? (
          <Card className="items-center">
            <div className="relative w-full overflow-hidden rounded-[var(--radius-md)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Mirror check" className="w-full" />
              {showV && (
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary/80" />
              )}
              {showH && (
                <>
                  <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-warning/80" />
                  <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-warning/80" />
                </>
              )}
            </div>
          </Card>
        ) : (
          <Card className="items-center text-center">
            <p className="text-sm text-muted-foreground">
              Pilih foto berdiri atau forward-bend untuk mengecek simetri bahu,
              panggul, dan garis tengah tubuh.
            </p>
          </Card>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
            <Upload size={16} /> {url ? "Ganti foto" : "Pilih foto"}
          </Button>
        </div>

        {url && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowV((v) => !v)}
              className={
                "flex-1 rounded-[var(--radius-md)] py-2 text-sm font-semibold " +
                (showV ? "bg-primary/10 text-primary" : "bg-background border border-border text-foreground/70")
              }
            >
              Garis tengah
            </button>
            <button
              type="button"
              onClick={() => setShowH((h) => !h)}
              className={
                "flex-1 rounded-[var(--radius-md)] py-2 text-sm font-semibold " +
                (showH ? "bg-warning/15 text-warning" : "bg-background border border-border text-foreground/70")
              }
            >
              Garis horizontal
            </button>
          </div>
        )}

        <p className="px-1 text-xs text-muted-foreground">
          Alat bantu visual, bukan pengukuran. Foto tidak disimpan atau dikirim
          ke mana pun.
        </p>
      </div>
    </div>
  );
}
