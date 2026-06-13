import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { cities } from "@/data/cities";
import type { Memory } from "@/data/memories";
import {
  assertWritableStorageConfigured,
  isSupabaseConfigured,
  readJsonValue,
  writeJsonValue,
} from "@/lib/server/supabase";
import { uploadImageWithFallback, uploadImagesConcurrent } from "@/lib/server/oss";
import { isLocalPrivacyRequest, localPrivacyImagePlaceholder } from "@/lib/localPrivacy";
import { requireAdminSession, requireSiteSession } from "@/lib/server/auth";
import { getBundledDataFilePath, getPrivateDataFilePath } from "@/lib/server/dataDir";

function getCityFolderName(cityId: string): string {
  const city = cities.find((c) => c.id === cityId);
  return city ? city.name : cityId;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RawMemoryStore = Record<string, Memory | Memory[]>;
type MemoryStore = Record<string, Memory[]>;

const memoryStorePath = getPrivateDataFilePath("localMemories.private.json");
const seedMemoryStorePath = getBundledDataFilePath("localMemories.json");
const memoryStoreKey = "memories";
const memoryTextMaxLength = 80;
const imageMaxLength = 12_000_000;
const maxPhotosPerMemory = 24;

const normalizeMemoryDate = (value: string) => {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAllowedImage = (value: string) =>
  value.length <= imageMaxLength &&
  (value.startsWith("/photos/") ||
    value.startsWith("/sprites/") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/"));

const normalizePhotos = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value.filter((photo): photo is string => typeof photo === "string" && isAllowedImage(photo));
};

function normalizeStoredMemory(cityId: string, value: unknown): Memory[] {
  const city = cities.find((candidate) => candidate.id === cityId);
  if (!city) return [];

  const entries = Array.isArray(value) ? value : [value];

  return entries.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];

    const date = typeof entry.date === "string" ? entry.date.trim() : "待添加日期";
    const text =
      typeof entry.text === "string" && entry.text.trim().length > 0
        ? entry.text.trim()
        : "这段回忆还等着我们慢慢写上。";
    const storedImage = typeof entry.image === "string" && isAllowedImage(entry.image) ? entry.image : "";
    const photos = normalizePhotos(entry.photos);
    const image = storedImage || photos[0] || city.sprite;
    const id = typeof entry.id === "string" ? entry.id : `${city.id}-local-${index}`;
    const createdAt = typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString();
    const mood = typeof entry.mood === "string" ? (entry.mood as any) : undefined;

    return [
      {
        id,
        cityId: city.id,
        city: city.name,
        cityEn: city.nameEn,
        date,
        image,
        photos: photos.length > 0 ? photos : [image],
        text,
        createdAt,
        mood,
      },
    ];
  });
}

function normalizeMemoryStore(store: RawMemoryStore): MemoryStore {
  return Object.fromEntries(
    Object.entries(store)
      .map(([cityId, value]) => [cityId, normalizeStoredMemory(cityId, value)] as const)
      .filter(([, memories]) => memories.length > 0),
  );
}

async function readMemoryStore(): Promise<MemoryStore> {
  if (isSupabaseConfigured) {
    return normalizeMemoryStore(await readJsonValue(memoryStoreKey, {}));
  }

  try {
    const file = await readFile(memoryStorePath, "utf8");
    const parsed = JSON.parse(file) as unknown;

    return isRecord(parsed) ? normalizeMemoryStore(parsed as RawMemoryStore) : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  try {
    const file = await readFile(seedMemoryStorePath, "utf8");
    const parsed = JSON.parse(file) as unknown;

    return isRecord(parsed) ? normalizeMemoryStore(parsed as RawMemoryStore) : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writeMemoryStore(store: MemoryStore) {
  if (isSupabaseConfigured) {
    await writeJsonValue(memoryStoreKey, store);
    return;
  }

  await mkdir(path.dirname(memoryStorePath), { recursive: true });
  await writeFile(memoryStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function uploadMemoryImages(memory: Memory): Promise<Memory> {
  const rawPhotos = memory.photos?.length ? memory.photos : [memory.image];
  const dataUrlPhotos = rawPhotos.filter((p) => p.startsWith("data:image/"));
  const nonDataUrlPhotos = rawPhotos.filter((p) => !p.startsWith("data:image/"));
  const folderName = getCityFolderName(memory.cityId);
  const timestamp = Date.now();

  let uploadedPhotos: string[];
  if (dataUrlPhotos.length > 1) {
    const urls = await uploadImagesConcurrent(
      dataUrlPhotos.map((photo, index) => ({
        value: photo,
        pathPrefix: `memories/${folderName}`,
        fileName: `${timestamp}-${index + 1}`,
      })),
    );
    uploadedPhotos = [...nonDataUrlPhotos, ...urls];
  } else {
    uploadedPhotos = await Promise.all(
      rawPhotos.map((photo, index) =>
        uploadImageWithFallback(photo, `memories/${folderName}`, `${timestamp}-${index + 1}`),
      ),
    );
  }

  const image = uploadedPhotos.includes(memory.image)
    ? memory.image
    : memory.image.startsWith("data:image/")
      ? uploadedPhotos[0]
      : memory.image;

  return {
    ...memory,
    image,
    photos: uploadedPhotos,
  };
}

function parseMemoryPayload(payload: unknown): Memory | null {
  if (!isRecord(payload) || !isRecord(payload.memory)) return null;

  const cityId = payload.memory.cityId;
  const date = payload.memory.date;
  const text = payload.memory.text;
  const image = payload.memory.image;
  const photos = normalizePhotos(payload.memory.photos).slice(0, maxPhotosPerMemory);

  if (
    typeof cityId !== "string" ||
    typeof date !== "string" ||
    typeof text !== "string" ||
    (typeof image !== "string" && photos.length === 0)
  ) {
    return null;
  }

  const city = cities.find((candidate) => candidate.id === cityId);
  const trimmedDate = date.trim();
  const trimmedText = text.trim();
  const normalizedDate = normalizeMemoryDate(trimmedDate);

  if (
    !city ||
    !normalizedDate ||
    trimmedText.length === 0 ||
    trimmedText.length > memoryTextMaxLength ||
    (typeof image === "string" && image.length > 0 && !isAllowedImage(image))
  ) {
    return null;
  }

  const coverImage = photos[0] ?? image ?? city.sprite;
  const mood = typeof payload.memory.mood === "string" ? (payload.memory.mood as any) : undefined;

  return {
    id: `${city.id}-${Date.now()}`,
    cityId: city.id,
    city: city.name,
    cityEn: city.nameEn,
    date: normalizedDate,
    image: coverImage,
    photos: photos.length > 0 ? photos : [coverImage],
    text: trimmedText,
    createdAt: new Date().toISOString(),
    mood,
  };
}

function parseCoverPayload(payload: unknown) {
  if (!isRecord(payload)) return null;

  const cityId = payload.cityId;
  const memoryId = payload.memoryId;
  const coverImage = payload.coverImage;

  if (
    typeof cityId !== "string" ||
    typeof memoryId !== "string" ||
    typeof coverImage !== "string" ||
    !isAllowedImage(coverImage)
  ) {
    return null;
  }

  return { cityId, memoryId, coverImage };
}

function parseEditPayload(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.memory)) return null;

  const cityId = payload.cityId;
  const memoryId = payload.memoryId;
  const date = payload.memory.date;
  const text = payload.memory.text;
  const image = payload.memory.image;
  const photos = normalizePhotos(payload.memory.photos).slice(0, maxPhotosPerMemory);
  const mood = typeof payload.memory.mood === "string" ? (payload.memory.mood as any) : undefined;

  if (
    typeof cityId !== "string" ||
    typeof memoryId !== "string" ||
    typeof date !== "string" ||
    typeof text !== "string" ||
    typeof image !== "string"
  ) {
    return null;
  }

  const city = cities.find((candidate) => candidate.id === cityId);
  const trimmedDate = date.trim();
  const trimmedText = text.trim();
  const normalizedDate = normalizeMemoryDate(trimmedDate);

  if (
    !city ||
    !normalizedDate ||
    trimmedText.length === 0 ||
    trimmedText.length > memoryTextMaxLength ||
    !isAllowedImage(image)
  ) {
    return null;
  }

  const safePhotos = photos.length > 0 ? photos : [image];
  const coverImage = safePhotos.includes(image) ? image : safePhotos[0];

  return {
    cityId: city.id,
    memoryId,
    updates: {
      city: city.name,
      cityEn: city.nameEn,
      date: normalizedDate,
      text: trimmedText,
      image: coverImage,
      photos: safePhotos,
      mood,
    },
  };
}

function parseDeletePayload(payload: unknown) {
  if (!isRecord(payload)) return null;

  const cityId = payload.cityId;
  const memoryId = payload.memoryId;

  if (typeof cityId !== "string" || typeof memoryId !== "string") return null;

  return { cityId, memoryId };
}

const maskMemoryPhotos = (memories: MemoryStore): MemoryStore =>
  Object.fromEntries(
    Object.entries(memories).map(([cityId, cityMemories]) => [
      cityId,
      cityMemories.map((memory) => ({
        ...memory,
        image: localPrivacyImagePlaceholder,
        photos: memory.photos?.map(() => localPrivacyImagePlaceholder) ?? [localPrivacyImagePlaceholder],
      })),
    ]),
  );

export async function GET(request: NextRequest) {
  const authResponse = requireSiteSession(request);
  if (authResponse) return authResponse;

  const memories = await readMemoryStore();

  return NextResponse.json({ memories: isLocalPrivacyRequest(request) ? maskMemoryPhotos(memories) : memories });
}

export async function POST(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json({ error: "Supabase is required to save memories in production" }, { status: 503 });
  }

  const parsedMemory = parseMemoryPayload(await request.json().catch(() => null));

  if (!parsedMemory) {
    return NextResponse.json({ error: "Invalid memory payload" }, { status: 400 });
  }

  const memory = await uploadMemoryImages(parsedMemory);
  const memories = await readMemoryStore();
  const nextMemories = {
    ...memories,
    [memory.cityId]: [memory, ...(memories[memory.cityId] ?? [])],
  };

  await writeMemoryStore(nextMemories);

  return NextResponse.json({ memory, memories: nextMemories });
}

export async function PUT(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json({ error: "Supabase is required to import memories in production" }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);

  if (!isRecord(payload) || !isRecord(payload.memories)) {
    return NextResponse.json({ error: "Invalid memory store payload" }, { status: 400 });
  }

  const normalizedMemories = normalizeMemoryStore(payload.memories as RawMemoryStore);
  const nextMemories = Object.fromEntries(
    await Promise.all(
      Object.entries(normalizedMemories).map(async ([cityId, memories]) => [
        cityId,
        await Promise.all(memories.map((memory) => uploadMemoryImages(memory))),
      ]),
    ),
  );

  await writeMemoryStore(nextMemories);

  return NextResponse.json({ memories: nextMemories });
}

export async function PATCH(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json({ error: "Supabase is required to update memories in production" }, { status: 503 });
  }

  const rawPayload = await request.json().catch(() => null);
  const editPayload = parseEditPayload(rawPayload);

  if (editPayload) {
    const memories = await readMemoryStore();
    const cityMemories = memories[editPayload.cityId] ?? [];
    const memoryIndex = cityMemories.findIndex((memory) => memory.id === editPayload.memoryId);

    if (memoryIndex === -1) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    const nextCityMemories = cityMemories.map((entry, index) =>
      index === memoryIndex ? { ...entry, ...editPayload.updates } : entry,
    );
    nextCityMemories[memoryIndex] = await uploadMemoryImages(nextCityMemories[memoryIndex]);
    const nextMemories = {
      ...memories,
      [editPayload.cityId]: nextCityMemories,
    };

    await writeMemoryStore(nextMemories);

    return NextResponse.json({ memory: nextCityMemories[memoryIndex], memories: nextMemories });
  }

  const payload = parseCoverPayload(rawPayload);

  if (!payload) {
    return NextResponse.json({ error: "Invalid memory payload" }, { status: 400 });
  }

  const memories = await readMemoryStore();
  const cityMemories = memories[payload.cityId] ?? [];
  const memoryIndex = cityMemories.findIndex((memory) => memory.id === payload.memoryId);

  if (memoryIndex === -1) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  const memory = cityMemories[memoryIndex];
  const photos = memory.photos?.length ? memory.photos : [memory.image];

  if (!photos.includes(payload.coverImage)) {
    return NextResponse.json({ error: "Cover image must be one of the memory photos" }, { status: 400 });
  }

  const nextCityMemories = cityMemories.map((entry, index) =>
    index === memoryIndex ? { ...entry, image: payload.coverImage } : entry,
  );
  const nextMemories = {
    ...memories,
    [payload.cityId]: nextCityMemories,
  };

  await writeMemoryStore(nextMemories);

  return NextResponse.json({ memory: nextCityMemories[memoryIndex], memories: nextMemories });
}

export async function DELETE(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json({ error: "Supabase is required to delete memories in production" }, { status: 503 });
  }

  const payload = parseDeletePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid delete payload" }, { status: 400 });
  }

  const memories = await readMemoryStore();
  const cityMemories = memories[payload.cityId] ?? [];
  const memoryIndex = cityMemories.findIndex((memory) => memory.id === payload.memoryId);

  if (memoryIndex === -1) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  const nextCityMemories = cityMemories.filter((memory) => memory.id !== payload.memoryId);
  const nextMemories = { ...memories };

  if (nextCityMemories.length > 0) nextMemories[payload.cityId] = nextCityMemories;
  else delete nextMemories[payload.cityId];

  await writeMemoryStore(nextMemories);

  return NextResponse.json({ memories: nextMemories });
}
