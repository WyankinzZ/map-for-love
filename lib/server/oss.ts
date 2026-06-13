import { readFile, writeFile } from "fs/promises";
import OSS from "ali-oss";
import { getPrivateDataFilePath } from "./dataDir";
import { uploadDataImage } from "./supabase";

const ossConfigPath = getPrivateDataFilePath("ossConfig.private.json");

export interface OssConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}

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
}

const dataUrlPattern = /^data:([^;]+);base64,(.+)$/;

const extensionByMime = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function uploadDataImageOSS(
  value: string,
  pathPrefix: string,
  fallbackFileName: string,
): Promise<string> {
  if (!value.startsWith("data:image/")) return value;

  const match = dataUrlPattern.exec(value);
  if (!match) return value;

  const config = await getOssConfig();
  if (!config) return value; // Fallback to returning local dataUrl

  const [, mimeType, base64] = match;
  const extension = extensionByMime.get(mimeType) ?? "png";
  const filePath = `${pathPrefix}/${fallbackFileName}.${extension}`.replaceAll(/\/+/g, "/");
  const bytes = Buffer.from(base64, "base64");

  const client = new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: true,
  });

  const result = await client.put(filePath, bytes, {
    mime: mimeType,
  });

  return result.url;
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
