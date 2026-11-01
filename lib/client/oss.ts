import OSS from "ali-oss";

export interface OssConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}

let cachedClient: OSS | null = null;
let lastConfigKey = "";

export function getOssClientSync(config: OssConfig): OSS {
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

export function hasStoredOssConfigSync(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem("mapofus:oss-config");
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return Boolean(
      parsed &&
      typeof parsed.accessKeyId === "string" && parsed.accessKeyId.trim() &&
      typeof parsed.accessKeySecret === "string" && parsed.accessKeySecret.trim() &&
      typeof parsed.bucket === "string" && parsed.bucket.trim() &&
      typeof parsed.region === "string" && parsed.region.trim()
    );
  } catch {
    return false;
  }
}

export async function getStoredOssConfig(): Promise<OssConfig | null> {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem("mapofus:oss-config");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.accessKeyId && parsed.accessKeySecret && parsed.bucket && parsed.region) {
      return parsed as OssConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveOssConfig(config: OssConfig | null): Promise<void> {
  if (typeof window === "undefined") return;

  if (!config) {
    localStorage.removeItem("mapofus:oss-config");
  } else {
    localStorage.setItem("mapofus:oss-config", JSON.stringify(config));
  }
  cachedClient = null;
  lastConfigKey = "";
}

export async function ossGetJson<T>(key: string, fallback: T): Promise<T> {
  const config = await getStoredOssConfig();
  if (!config) return fallback;

  try {
    const client = getOssClientSync(config);
    const url = client.signatureUrl(`data/${key}.json`, { expires: 60 });
    
    // Add a cache-busting query parameter to absolutely ensure no disk cache is used
    const cacheBusterUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    
    const response = await fetch(cacheBusterUrl, { cache: "no-store" });
    if (response.ok) {
      return (await response.json()) as T;
    }
  } catch {
    // file might not exist or network error
  }
  return fallback;
}

export async function ossPutJson<T>(key: string, value: T): Promise<void> {
  const config = await getStoredOssConfig();
  if (!config) throw new Error("OSS not configured");

  const client = getOssClientSync(config);
  const data = JSON.stringify(value, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  await client.put(`data/${key}.json`, blob, {
    mime: "application/json",
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

export async function ossPutImage(
  path: string,
  dataUrl: string,
): Promise<string> {
  const config = await getStoredOssConfig();
  if (!config) return dataUrl;

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return dataUrl;

  const [, mimeType] = match;
  const client = getOssClientSync(config);
  // Convert data URL to Blob via fetch (Buffer not available in browser/WebView)
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const result = await client.put(path, blob, {
    mime: mimeType,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });

  return result.url;
}

export async function ossDelete(key: string): Promise<void> {
  const config = await getStoredOssConfig();
  if (!config) return;

  const client = getOssClientSync(config);
  await client.delete(key);
}
