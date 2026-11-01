import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getWritableDataDir } from "./dataDir";
import type { Memory } from "@/data/memories";

const dataUrlPattern = /^data:([^;]+);base64,(.+)$/;

const extensionByMime = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const MAX_IMAGE_DIMENSION = 1920;
const IMAGE_QUALITY = 85;

/**
 * Saves a base64 data-URL to the local disk in the uploads directory,
 * compressing/optimizing it, and returns the API URL (e.g. /api/uploads/...).
 */
export async function saveLocalDataImage(
  value: string,
  pathPrefix: string,
  fallbackFileName: string,
): Promise<string> {
  if (!value.startsWith("data:image/")) return value;

  const match = dataUrlPattern.exec(value);
  if (!match) return value;

  const [, mimeType, base64] = match;
  const isGif = mimeType === "image/gif";
  const extension = isGif ? "gif" : (extensionByMime.get(mimeType) ?? "jpg");

  // Sanitize path prefix and file name to prevent directory traversal
  const cleanPrefix = pathPrefix
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((seg) => seg.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, "_"))
    .join("/");

  const cleanFileName = `${fallbackFileName}`.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, "_");
  const fileNameWithExt = `${cleanFileName}.${extension}`;

  const uploadsDir = path.join(getWritableDataDir(), "uploads");
  const targetDir = path.join(uploadsDir, cleanPrefix);
  const targetFilePath = path.join(targetDir, fileNameWithExt);

  const rawBytes = Buffer.from(base64, "base64");
  let outputBytes: Buffer = rawBytes;

  if (!isGif) {
    try {
      const img = sharp(rawBytes);
      const meta = await img.metadata();
      const { width = 0, height = 0 } = meta;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
        outputBytes = Buffer.from(
          await img
            .resize(Math.round(width * scale), Math.round(height * scale))
            .jpeg({ quality: IMAGE_QUALITY })
            .toBuffer(),
        );
      } else {
        outputBytes = Buffer.from(await img.jpeg({ quality: IMAGE_QUALITY }).toBuffer());
      }
    } catch {
      outputBytes = rawBytes;
    }
  }

  await mkdir(targetDir, { recursive: true });
  await writeFile(targetFilePath, outputBytes);

  return `/api/uploads/${cleanPrefix}/${fileNameWithExt}`;
}

/**
 * Migrates any base64 images in existing stored memories to local files on disk.
 */
export async function migrateMemoriesBase64ToLocal(
  store: Record<string, Memory[]>,
): Promise<{ store: Record<string, Memory[]>; hasMigrated: boolean }> {
  let hasMigrated = false;
  const nextStore: Record<string, Memory[]> = {};

  for (const [cityId, memories] of Object.entries(store)) {
    const updatedMemories: Memory[] = [];

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      let changed = false;

      let image = memory.image;
      if (image && image.startsWith("data:image/")) {
        image = await saveLocalDataImage(image, `memories/${cityId}`, `${memory.id || Date.now()}-cover`);
        changed = true;
      }

      let photos = memory.photos;
      if (Array.isArray(photos)) {
        const nextPhotos: string[] = [];
        for (let j = 0; j < photos.length; j++) {
          const photo = photos[j];
          if (photo.startsWith("data:image/")) {
            const savedUrl = await saveLocalDataImage(photo, `memories/${cityId}`, `${memory.id || Date.now()}-${j + 1}`);
            nextPhotos.push(savedUrl);
            changed = true;
          } else {
            nextPhotos.push(photo);
          }
        }
        photos = nextPhotos;
      }

      if (changed) {
        hasMigrated = true;
        updatedMemories.push({
          ...memory,
          image,
          photos: photos || [image],
        });
      } else {
        updatedMemories.push(memory);
      }
    }

    nextStore[cityId] = updatedMemories;
  }

  return { store: nextStore, hasMigrated };
}
