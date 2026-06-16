import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { cities } from "@/data/cities";
import {
  assertWritableStorageConfigured,
  isSupabaseConfigured,
  readJsonValue,
  writeJsonValue,
} from "@/lib/server/supabase";
import { uploadImageWithFallback } from "@/lib/server/oss";
import { isLocalPrivacyRequest, localPrivacyImagePlaceholder } from "@/lib/localPrivacy";
import { getMissingAuthEnv, hasSiteSession, requireAdminSession } from "@/lib/server/auth";
import { getPrivateDataFilePath } from "@/lib/server/dataDir";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CityAssetStore = Record<string, string>;

const cityAssetStorePath = getPrivateDataFilePath("cityAssets.private.json");
const cityAssetStoreKey = "city-assets";
const imageMaxLength = 12_000_000;

function getCityFolderName(cityId: string): string {
  const city = cities.find((c) => c.id === cityId);
  return city ? city.name : cityId;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAllowedImage = (value: string) =>
  value.length <= imageMaxLength &&
  (value.startsWith("/sprites/") || value.startsWith("https://") || value.startsWith("data:image/"));

function normalizeCityAssetStore(value: unknown): CityAssetStore {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([cityId, image]) =>
      cities.some((city) => city.id === cityId) && typeof image === "string" && isAllowedImage(image),
    ),
  ) as CityAssetStore;
}

async function readCityAssetStore(): Promise<CityAssetStore> {
  if (isSupabaseConfigured) {
    return normalizeCityAssetStore(await readJsonValue(cityAssetStoreKey, {}));
  }

  try {
    const file = await readFile(cityAssetStorePath, "utf8");
    return normalizeCityAssetStore(JSON.parse(file) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writeCityAssetStore(store: CityAssetStore) {
  if (isSupabaseConfigured) {
    await writeJsonValue(cityAssetStoreKey, store);
    return;
  }

  await mkdir(path.dirname(cityAssetStorePath), { recursive: true });
  await writeFile(cityAssetStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function parseCityAssetPayload(payload: unknown) {
  if (!isRecord(payload)) return null;

  const cityId = payload.cityId;
  const image = payload.image;

  if (
    typeof cityId !== "string" ||
    typeof image !== "string" ||
    !cities.some((city) => city.id === cityId) ||
    !isAllowedImage(image)
  ) {
    return null;
  }

  return { cityId, image };
}

function parseCityPayload(payload: unknown) {
  if (!isRecord(payload) || typeof payload.cityId !== "string") return null;
  if (!cities.some((city) => city.id === payload.cityId)) return null;

  return { cityId: payload.cityId };
}

const maskCityAssets = (assets: CityAssetStore): CityAssetStore =>
  Object.fromEntries(Object.keys(assets).map((cityId) => [cityId, localPrivacyImagePlaceholder]));

export async function GET(request: NextRequest) {
  if (getMissingAuthEnv().length > 0 || !hasSiteSession(request)) {
    return NextResponse.json({ assets: {} });
  }

  const assets = await readCityAssetStore();

  return NextResponse.json({ assets: isLocalPrivacyRequest(request) ? maskCityAssets(assets) : assets });
}

export async function PUT(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json({ error: "Supabase is required to save city assets in production" }, { status: 503 });
  }

  const payload = parseCityAssetPayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid city asset payload" }, { status: 400 });
  }

  const assets = await readCityAssetStore();
  const folderName = getCityFolderName(payload.cityId);
  const image = await uploadImageWithFallback(payload.image, `city-assets/${folderName}`, "landmark");
  const nextAssets = { ...assets, [payload.cityId]: image };

  await writeCityAssetStore(nextAssets);

  return NextResponse.json({ assets: nextAssets });
}

export async function PATCH(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json({ error: "Supabase is required to import city assets in production" }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);

  if (!isRecord(payload) || !isRecord(payload.assets)) {
    return NextResponse.json({ error: "Invalid city asset store payload" }, { status: 400 });
  }

  const normalizedAssets = normalizeCityAssetStore(payload.assets);
  const nextAssets = Object.fromEntries(
    await Promise.all(
      Object.entries(normalizedAssets).map(async ([cityId, image]) => [
        cityId,
        await uploadImageWithFallback(image, `city-assets/${getCityFolderName(cityId)}`, "landmark"),
      ]),
    ),
  );

  await writeCityAssetStore(nextAssets);

  return NextResponse.json({ assets: nextAssets });
}

export async function DELETE(request: NextRequest) {
  const authResponse = requireAdminSession(request);
  if (authResponse) return authResponse;

  try {
    assertWritableStorageConfigured();
  } catch {
    return NextResponse.json({ error: "Supabase is required to delete city assets in production" }, { status: 503 });
  }

  const payload = parseCityPayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid city asset payload" }, { status: 400 });
  }

  const assets = await readCityAssetStore();
  const nextAssets = { ...assets };
  delete nextAssets[payload.cityId];

  await writeCityAssetStore(nextAssets);

  return NextResponse.json({ assets: nextAssets });
}
