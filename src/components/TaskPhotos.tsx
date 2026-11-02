"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Attachment } from "@/lib/types";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
// Photos are private, so each one is shown through a link that expires after an hour.
const LINK_SECONDS = 3600;

interface TaskPhotosProps {
  attachments: Attachment[];
  currentUserId: string;
  isManager: boolean;
  onAdd: (file: File) => Promise<void>;
  onDelete: (attachment: Attachment) => void;
}

export default function TaskPhotos({ attachments, currentUserId, isManager, onAdd, onDelete }: TaskPhotosProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const missing = attachments.filter((a) => !urls[a.path]).map((a) => a.path);
  const missingKey = missing.join("|");

  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    supabase.storage
      .from("task-photos")
      .createSignedUrls(missingKey.split("|"), LINK_SECONDS)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setUrls((u) => {
          const next = { ...u };
          for (const d of data) if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!PHOTO_TYPES.includes(file.type)) {
        setError("Photos must be JPEG, PNG or WebP.");
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError("Photos must be 10 MB or smaller.");
        continue;
      }
      setUploading(true);
      await onAdd(file);
      setUploading(false);
    }
  }

  const sorted = attachments.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <span className="label mb-0">Photos</span>
        <button className="btn btn-ghost ml-auto py-1 text-xs" onClick={() => fileInput.current?.click()} disabled={uploading}>
          <Camera size={14} /> {uploading ? "Uploading…" : "Add photo"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-xs text-faint">Add before and after photos to show the work.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {sorted.map((a) => (
            <li key={a.id} className="group relative aspect-square overflow-hidden rounded-xl bg-black/25 ring-1 ring-white/10">
              {urls[a.path] ? (
                <button className="h-full w-full" onClick={() => setViewing(urls[a.path])} aria-label="View photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[a.path]} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <span className="block h-full w-full animate-pulse bg-white/5" />
              )}
              {(a.uploaded_by === currentUserId || isManager) && (
                <button
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  onClick={() => confirm("Delete this photo?") && onDelete(a)}
                  aria-label="Delete photo"
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setViewing(null)}
          role="dialog"
          aria-label="Photo"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
