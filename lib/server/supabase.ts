import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shouldUseLocalFileStorage = process.env.MAP_OF_US_STORAGE_MODE === "local";

export const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "map-of-us";

export const isSupabaseConfigured = !shouldUseLocalFileStorage && Boolean(supabaseUrl && supabaseServiceRoleKey);
export const shouldRequirePersistentStorage = process.env.NODE_ENV === "production" && !shouldUseLocalFileStorage;

export function assertWritableStorageConfigured() {
  if (shouldRequirePersistentStorage && !isSupabaseConfigured) {
    throw new Error("Supabase is required for write operations in production.");
  }
}

export function getSupabaseAdmin() {
  if (shouldUseLocalFileStorage) return null;
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function readJsonValue<T>(key: string, fallback: T): Promise<T> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return fallback;

  const { data, error } = await supabase
    .from("map_of_us_store")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;

  return (data?.value as T | null) ?? fallback;
}

export async function writeJsonValue<T>(key: string, value: T): Promise<T> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return value;

  const { error } = await supabase
    .from("map_of_us_store")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw error;

  return value;
}

const dataUrlPattern = /^data:([^;]+);base64,(.+)$/;

const extensionByMime = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export function isDataImageUrl(value: string) {
  return value.startsWith("data:image/");
}

export async function uploadDataImage(
  value: string,
  pathPrefix: string,
  fallbackFileName: string,
) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isDataImageUrl(value)) return value;

  const match = dataUrlPattern.exec(value);
  if (!match) return value;

  const [, mimeType, base64] = match;
  const extension = extensionByMime.get(mimeType) ?? "png";
  const filePath = `${pathPrefix}/${fallbackFileName}.${extension}`.replaceAll(/\/+/g, "/");
  const bytes = Buffer.from(base64, "base64");
  const { error } = await supabase.storage
    .from(supabaseStorageBucket)
    .upload(filePath, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(supabaseStorageBucket).getPublicUrl(filePath);

  return data.publicUrl;
}
