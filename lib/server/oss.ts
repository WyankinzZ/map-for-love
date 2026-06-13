import { readFile, writeFile } from "fs/promises";
import OSS from "ali-oss";
import sharp from "sharp";
import { getPrivateDataFilePath } from "./dataDir";
import { uploadDataImage } from "./supabase";

const ossConfigPath = getPrivateDataFilePath("ossConfig.private.json");

export interface OssConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}

let cachedClient: OSS | null = null;
let lastConfigKey = "";

export async function getOssConfig(): Promise<OssConfig | null> {
  try {
    const data = await readFile(ossConfigPath, "utf-8");
    const parsed = JSON.parse(data);
    if (parsed.accessKeyId && parsed.accessKeySecret && parsed.bucket && parsed.region) {
      return parsed as OssConfig;
    }
  } catch {
    // file might not exist yet
  }
  return null;
}

export async function setOssConfig(config: OssConfig | null) {
  if (!config) {
    await writeFile(ossConfigPath, JSON.stringify({}), "utf-8");
  } else {
    await writeFile(ossConfigPath, JSON.stringify(config), "utf-8");
  }
  cachedClient = null;
  lastConfigKey = "";
}

export async function getOssClient(): Promise<OSS | null> {
  const config = await getOssConfig();
  if (!config) return null;

  const configKey = `${config.region}|${config.bucket}|${config.accessKeyId}`;
  if (cachedClient && lastConfigKey === configKey) return cachedClient;

  cachedClient = new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: true,
  });
  lastConfigKey = configKey;
  return cachedClient;
}

const dataUrlPattern = /^data:([^;]+);base64,(.+)$/;

const extensionByMime = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const MAX_OSS_DIMENSION = 1600;
const OSS_QUALITY = 82;

async function compressBufferForOss(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === "image/gif") return buffer;

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const { width = 0, height = 0 } = metadata;

  if (width <= MAX_OSS_DIMENSION && height <= MAX_OSS_DIMENSION) {
    return Buffer.from(await image.jpeg({ quality: OSS_QUALITY }).toBuffer());
  }

  const scale = Math.min(1, MAX_OSS_DIMENSION / Math.max(width, height));
  return Buffer.from(
    await image
      .resize(Math.round(width * scale), Math.round(height * scale))
      .jpeg({ quality: OSS_QUALITY })
      .toBuffer(),
  );
}

async function uploadWithRetry(
  client: OSS,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  retries = 2,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await client.put(filePath, buffer, {
        mime: mimeType,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
      return result.url;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function uploadDataImageOSS(
  value: string,
  pathPrefix: string,
  fallbackFileName: string,
): Promise<string> {
  if (!value.startsWith("data:image/")) return value;

  const match = dataUrlPattern.exec(value);
  if (!match) return value;

  const client = await getOssClient();
  if (!client) return value;

  const [, mimeType, base64] = match;
  const extension = extensionByMime.get(mimeType) ?? "jpg";
  const filePath = `${pathPrefix}/${fallbackFileName}.${extension}`.replaceAll(/\/+/g, "/");
  const originalBytes = Buffer.from(base64, "base64");

  const bytes = await compressBufferForOss(originalBytes, mimeType);

  const url = await uploadWithRetry(client, filePath, bytes, "image/jpeg");
  return url;
}

const CONCURRENCY_LIMIT = 3;

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    const taskIndex = i;
    const promise = tasks[taskIndex]().then((result) => {
      results[taskIndex] = result;
    });
    const wrapped = promise.then(() => { executing.delete(wrapped); });
    executing.add(wrapped);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export async function uploadImagesConcurrent(
  images: { value: string; pathPrefix: string; fileName: string }[],
): Promise<string[]> {
  const tasks = images.map((img) => () =>
    uploadDataImageOSS(img.value, img.pathPrefix, img.fileName).catch(() => img.value),
  );
  return runConcurrent(tasks, CONCURRENCY_LIMIT);
}

export async function uploadImageWithFallback(
  value: string,
  pathPrefix: string,
  fallbackFileName: string,
): Promise<string> {
  let url = await uploadDataImageOSS(value, pathPrefix, fallbackFileName).catch(() => value);
  if (url === value) {
    url = await uploadDataImage(value, pathPrefix, fallbackFileName);
  }
  return url;
}
