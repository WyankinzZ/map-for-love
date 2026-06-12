import { type City } from "@/data/cities";
import { type Memory } from "@/data/memories";

export type BrowserTimeout = ReturnType<Window["setTimeout"]>;
export type PhotoDraft = {
  previewUrl: string;
  dataUrl: string | null;
  name: string;
};
export type CardAnchor = {
  x: number;
  y: number;
  side: "left" | "right";
};
export type MapCamera = {
  scale: number;
  x: number;
  y: number;
};
export type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamera: MapCamera;
};
export type MemoryPanelTab = "memory" | "gallery" | "history";
export type CityAssetStore = Record<string, string>;

export const colors = {
  cream: "#FAFBF7",
  dim: "#D8DDD8",
  ink: "#5A6670",
  sakura: "#F5DCE0",
  bloom: "#E8B8C2",
  mist: "#D6E8F0",
  sky: "#A8C8DC",
};

export const spring = { type: "spring" as const, stiffness: 100, damping: 20 };
export const memoryTextMaxLength = 80;
export const maxPhotosPerMemory = 24;
export const memoryPhotoMaxDimension = 900;
export const memoryPhotoQuality = 0.52;
export const landmarkPhotoMaxDimension = 1280;
export const landmarkPhotoQuality = 0.76;
export const memoryCardWidth = 292;
export const memoryCardGap = 26;
export const memoryCardMaxHeight = 620;
export const cityListPanelWidth = 250;

export const isObjectUrl = (url?: string | null): url is string =>
  typeof url === "string" && url.startsWith("blob:");

export const revokeObjectUrl = (url?: string | null) => {
  if (isObjectUrl(url)) URL.revokeObjectURL(url);
};

export const isDataImageUrl = (url?: string | null): url is string =>
  typeof url === "string" && url.startsWith("data:image/");

export const isBrowserImageUrl = (url?: string | null): url is string =>
  typeof url === "string" && (url.startsWith("data:image/") || url.startsWith("https://"));

export const normalizeMemoryDate = (value: string) => {
  const match = value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid) return null;

  return `${rawYear}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
};

export const stableCoordinate = (value: number) => Number(value.toFixed(3));
export const clampZoom = (value: number) => Math.min(Math.max(value, 1), 2.4);

export const revokePhotoDrafts = (photos: PhotoDraft[]) => {
  photos.forEach((photo) => revokeObjectUrl(photo.previewUrl));
};

export const photosOfMemory = (memory?: Memory) => {
  if (!memory) return [];
  return memory.photos?.length ? memory.photos : [memory.image];
};
