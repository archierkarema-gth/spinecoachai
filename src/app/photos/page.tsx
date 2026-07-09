"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getPhotosForUser, putPhoto, deletePhoto } from "@/lib/db";
import type { Photo, PhotoPose } from "@/lib/media-schemas";

const POSES: { value: PhotoPose; label: string }[] = [
  { value: "front", label: "Depan" },
  { value: "back", label: "Belakang" },
  { value: "side", label: "Samping" },
  { value: "other", label: "Lainnya" },
];

interface PhotoView {
  photo: Photo;
  url: string;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PhotosPage() {
  const { user, hydrated, hydrate } = useAppStore();
  const [pose, setPose] = useState<PhotoPose>("back");
  const [views, setViews] = useState<PhotoView[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let created: string[] = [];
    getPhotosForUser(user.id).then((photos) => {
      if (!active) return;
      const next = photos.map((photo) => ({
        photo,
        url: URL.createObjectURL(photo.blob),
      }));
      created = next.map((v) => v.url);
      setViews(next);
    });
    return () => {
      active = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [user]);

  async function reload() {
    if (!user) return;
    // Revoke old object URLs before replacing.
    views.forEach((v) => URL.revokeObjectURL(v.url));
    const photos = await getPhotosForUser(user.id);
    setViews(
      photos.map((photo) => ({ photo, url: URL.createObjectURL(photo.blob) }))
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    await putPhoto({
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      pose,
      blob: file,
    });
    if (fileRef.current) fileRef.current.value = "";
    await reload();
  }

  async function onDelete(id: string) {
    await deletePhoto(id);
    await reload();
  }

  return (
    <div>
      <TopBar
        title="Progress Photos"
        subtitle="Foto postur untuk perbandingan. Tersimpan di perangkat ini saja."
      />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Pose</p>
            <div className="flex gap-1.5">
              {POSES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPose(p.value)}
                  aria-pressed={pose === p.value}
                  className={
                    "h-10 flex-1 rounded-[var(--radius-md)] border text-xs font-semibold transition-colors " +
                    (pose === p.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={!user}>
            Ambil / pilih foto
          </Button>
        </Card>

        {views.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">Belum ada foto.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {views.map(({ photo, url }) => (
              <Card key={photo.id} className="p-2">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[calc(var(--radius-md)-0.4rem)]">
                  <Image
                    src={url}
                    alt={`Foto ${photo.pose} ${formatDate(photo.createdAt)}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold capitalize text-foreground">
                      {photo.pose}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(photo.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(photo.id)}
                    aria-label="Hapus foto"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <CardTitle>Catatan privasi</CardTitle>
        <p className="-mt-2 px-1 text-xs text-muted-foreground">
          Foto tidak diunggah ke mana pun. Reset data di Settings menghapusnya
          permanen.
        </p>
      </div>
    </div>
  );
}
