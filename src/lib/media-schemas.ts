import { z } from "zod";

/**
 * Photo entity (docs/08_Data_Model.md). Progress photos are posture
 * self-checks stored entirely on-device (IndexedDB) — they never leave the
 * browser in the MVP (docs/09: IndexedDB, no cloud yet).
 *
 * The image itself is kept as a Blob, which Zod can't meaningfully validate,
 * so the schema covers only the metadata; the blob is typed separately.
 */

export const photoPoseEnum = z.enum(["front", "back", "side", "other"]);
export type PhotoPose = z.infer<typeof photoPoseEnum>;

export interface Photo {
  id: string;
  userId: string;
  createdAt: number;
  pose: PhotoPose;
  note?: string;
  blob: Blob;
}

export const photoMetaSchema = z.object({
  pose: photoPoseEnum,
  note: z.string().max(300).optional(),
});
export type PhotoMeta = z.infer<typeof photoMetaSchema>;
