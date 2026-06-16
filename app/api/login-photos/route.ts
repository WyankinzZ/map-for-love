import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import {
  assertWritableStorageConfigured,
  isSupabaseConfigured,
  readJsonValue,
  writeJsonValue,
} from "@/lib/server/supabase";
import { uploadImageWithFallback } from "@/lib/server/oss";
import { isLocalPrivacyRequest } from "@/lib/localPrivacy";
import { getMissingAuthEnv, requireAdminSession } from "@/lib/server/auth";
import { getPrivateDataFilePath } from "@/lib/server/dataDir";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginPhotoText = {
  city?: string;
  label?: string;
};

type LoginPhotoStore = {
  photos: Record<string, string>;
  texts: Record<string, LoginPhotoText>;
};

const loginPhotoStorePath = getPrivateDataFilePath("loginPhotos.private.json");
const loginPhotoStoreKey = "login-photos";
const imageMaxLength = 12_000_000;
const slotIdPattern = /^[a-z0-9_-]{1,40}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAllowedImage = (value: string) =>
  value.length <= imageMaxLength &&
  (value.startsWith("/photos/") ||
    value.startsWith("/sprites/") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/"));

function normalizePhotoMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([slotId, image]) =>
        typeof slotId === "string" &&
        slotIdPattern.test(slotId) &&
        typeof image === "string" &&
        isAllowedImage(image),
    ),
  ) as Record<string, string>;
}

function normalizeTextMap(value: unknown): Record<string, LoginPhotoText> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([slotId, text]) => {
      if (!slotIdPattern.test(slotId) || !isRecord(text)) return [];

      const item = {
        city: typeof text.city === "string" ? text.city.trim().slice(0, 40) : undefined,
        label: typeof text.label === "string" ? text.label.trim().slice(0, 80) : undefined,
      };

      return item.city || item.label ? [[slotId, item] as const] : [];
    }),
  ) as Record<string, LoginPhotoText>;
}

function normalizeLoginPhotoStore(value: unknown): LoginPhotoStore {
  if (!isRecord(value)) return { photos: {}, texts: {} };

  return {
    photos: normalizePhotoMap(isRecord(value.photos) ? value.photos : value),
    texts: normalizeTextMap(value.texts),
  };
}

async function readLoginPhotoStore(): Promise<LoginPhotoStore> {
  if (isSupabaseConfigured) {
    return normalizeLoginPhotoStore(await readJsonValue(loginPhotoStoreKey, {}));
  }

  try {
    const file = await readFile(loginPhotoStorePath, "utf8");
    return normalizeLoginPhotoStore(JSON.parse(file) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { photos: {}, texts: {} };
    throw error;
  }
}

async function writeLoginPhotoStore(store: LoginPhotoStore) {
  if (isSupabaseConfigured) {
    await writeJsonValue(loginPhotoStoreKey, store);
    return;
  }

  await mkdir(path.dirname(loginPhotoStorePath), { recursive: true });
  await writeFile(loginPhotoStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function parseLoginPhotoPayload(
  payload: unknown,
): { slotId: string; image: string } | { slotId: string; text: LoginPhotoText } | null {
  if (!isRecord(payload)) return null;

  const slotId = payload.slotId;
  const image = payload.image;
  const text = payload.text;

  if (typeof slotId !== "string" || !slotIdPattern.test(slotId)) {
    return null;
  }

  if (typeof image === "string") {
    if (!isAllowedImage(image)) return null;
    return { slotId, image };
  }

  if (isRecord(text)) {
    const normalizedText = normalizeTextMap({ [slotId]: text })[slotId];
    if (!normalizedText) return null;
    return { slotId, text: normalizedText };
  }

  return null;
}

function parseSlotPayload(payload: unknown) {
  if (!isRecord(payload) || typeof payload.slotId !== "string") return null;
  if (!slotIdPattern.test(payload.slotId)) return null;

  return {
    slotId: payload.slotId,
    kind: payload.kind === "text" ? "text" : "photo",
  };
}

export async function GET(request: NextRequest) {
  // These 9 photos are placeholders shown on the pre-login unlock screen, so
  // they must be readable without a site session. Otherwise a user's custom
  // photos only appear after logging in (e.g. on the settings page) and the
  // login screen keeps showing the defaults.
  if (getMissingAuthEnv().length > 0) {
    return NextResponse.json({ photos: {}, texts: {} });
  }

  if (isLocalPrivacyRequest(request)) {
    return NextResponse.json({ photos: {}, texts: {} });
  }

  const { photos, texts } = await readLoginPhotoStore();

  return NextResponse.json({ photos, texts });
}

export async function PUT(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json(
      { error: "Supabase is required to save login photos in production" },
      { status: 503 },
    );
  }

  const payload = parseLoginPhotoPayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid login photo payload" }, { status: 400 });
  }

  const store = await readLoginPhotoStore();

  if ("image" in payload) {
    const image = await uploadImageWithFallback(payload.image, `login-photos/${payload.slotId}`, "cover");
    const nextStore = { ...store, photos: { ...store.photos, [payload.slotId]: image } };

    await writeLoginPhotoStore(nextStore);

    return NextResponse.json(nextStore);
  }

  const nextStore = { ...store, texts: { ...store.texts, [payload.slotId]: payload.text } };

  await writeLoginPhotoStore(nextStore);

  return NextResponse.json(nextStore);
}

export async function PATCH(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json(
      { error: "Supabase is required to import login photos in production" },
      { status: 503 },
    );
  }

  const payload = await request.json().catch(() => null);

  if (!isRecord(payload) || (!isRecord(payload.photos) && !isRecord(payload.texts))) {
    return NextResponse.json({ error: "Invalid login photo store payload" }, { status: 400 });
  }

  const currentStore = await readLoginPhotoStore();
  const normalizedPhotos = normalizePhotoMap(payload.photos);
  const nextPhotos = Object.fromEntries(
    await Promise.all(
      Object.entries(normalizedPhotos).map(async ([slotId, image]) => [
        slotId,
        await uploadImageWithFallback(image, `login-photos/${slotId}`, "cover"),
      ]),
    ),
  );
  const nextStore = {
    photos: isRecord(payload.photos) ? nextPhotos : currentStore.photos,
    texts: isRecord(payload.texts) ? normalizeTextMap(payload.texts) : currentStore.texts,
  };

  await writeLoginPhotoStore(nextStore);

  return NextResponse.json(nextStore);
}

export async function DELETE(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json(
      { error: "Supabase is required to delete login photos in production" },
      { status: 503 },
    );
  }

  const payload = parseSlotPayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid login photo payload" }, { status: 400 });
  }

  const store = await readLoginPhotoStore();
  const nextStore = {
    photos: { ...store.photos },
    texts: { ...store.texts },
  };

  if (payload.kind === "text") {
    delete nextStore.texts[payload.slotId];
  } else {
    delete nextStore.photos[payload.slotId];
  }

  await writeLoginPhotoStore(nextStore);

  return NextResponse.json(nextStore);
}
