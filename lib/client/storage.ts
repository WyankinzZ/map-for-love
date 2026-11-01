import { type Memory, type MemoryMood } from "@/data/memories";
import { type LocalMemoryStore, memoryStoreUpdatedEvent } from "@/data/progress";
import { type OssConfig, getStoredOssConfig, hasStoredOssConfigSync, ossGetJson, ossPutJson, ossPutImage } from "./oss";
import { idbGet, idbSet, idbDelete, isMobileStaticApp } from "./idb";
import { cities } from "@/data/cities";

async function uploadMemoryImagesOss(memory: Memory): Promise<Memory> {
  const rawPhotos = memory.photos?.length ? memory.photos : [memory.image];
  const dataUrlPhotos = rawPhotos.filter((p) => p.startsWith("data:image/"));
  const nonDataUrlPhotos = rawPhotos.filter((p) => !p.startsWith("data:image/"));
  
  const city = cities.find((c) => c.id === memory.cityId);
  const folderName = city ? city.name : memory.cityId;
  const timestamp = Date.now();

  let uploadedPhotos: string[] = [...nonDataUrlPhotos];
  
  if (dataUrlPhotos.length > 0) {
    const urls = await Promise.all(
      dataUrlPhotos.map((photo, index) =>
        ossPutImage(`memories/${folderName}/${timestamp}-${index + 1}`, photo)
      )
    );
    uploadedPhotos = [...nonDataUrlPhotos, ...urls];
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
  } as Memory;
}
export type StorageMode = "electron" | "oss";

export function getStorageMode(): StorageMode {
  // If the user has explicitly configured OSS credentials, use OSS cloud storage
  if (hasStoredOssConfigSync()) {
    return "oss";
  }

  // Default to pure local storage (desktop/local API mode)
  return "electron";
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const mode = getStorageMode();

  if (mode === "oss") {
    return ossGetJson<T>(key, fallback);
  }

  if (isMobileStaticApp()) {
    return idbGet<T>(`settings:${key}`, fallback);
  }

  try {
    const response = await fetch(`/api/settings/${key}`, { cache: "no-store" }).catch(() => null);
    if (response?.ok) {
      const data = await response.json();
      const val = (data.value as T) ?? fallback;
      idbSet(`settings:${key}`, val).catch(() => {});
      return val;
    }
  } catch {
    // fallback
  }

  return idbGet<T>(`settings:${key}`, fallback);
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  const mode = getStorageMode();

  if (mode === "oss") {
    await ossPutJson(key, value);
    idbSet(`settings:${key}`, value).catch(() => {});
    return;
  }

  await idbSet(`settings:${key}`, value);

  if (!isMobileStaticApp()) {
    await fetch(`/api/settings/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }).catch(() => {});
  }
}

export async function readMemories(): Promise<LocalMemoryStore> {
  const mode = getStorageMode();

  if (mode === "oss") {
    return ossGetJson<LocalMemoryStore>("memories", {});
  }

  if (isMobileStaticApp()) {
    const local = await idbGet<LocalMemoryStore>("memories", {});
    if (local && Object.keys(local).length > 0) return local;

    // Try seed file if available in static root
    try {
      const res = await fetch("./data/localMemories.json").catch(() => null);
      if (res?.ok) {
        const seed = await res.json();
        if (seed && Object.keys(seed).length > 0) {
          await idbSet("memories", seed);
          return seed;
        }
      }
    } catch {
      // ignore
    }
    return {};
  }

  try {
    const response = await fetch("/api/memories", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      const store = data.memories ?? {};
      idbSet("memories", store).catch(() => {});
      return store;
    }
  } catch {
    // offline or static fallback
  }

  return idbGet<LocalMemoryStore>("memories", {});
}

export async function writeMemories(memories: LocalMemoryStore): Promise<void> {
  const mode = getStorageMode();

  if (mode === "oss") {
    await ossPutJson("memories", memories);
    await idbSet("memories", memories);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: memories }));
    }
    return;
  }

  await idbSet("memories", memories);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: memories }));
  }

  if (!isMobileStaticApp()) {
    const response = await fetch("/api/memories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memories }),
    }).catch(() => null);
    if (response && !response.ok) throw new Error("Failed to write memories");
  }
}

export async function saveMemory(
  cityId: string,
  memory: { id: string; cityId: string; city: string; cityEn: string; date: string; image: string; photos?: string[]; text: string; mood?: MemoryMood; createdAt?: string },
): Promise<{ memories: LocalMemoryStore }> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const memories = await readMemories();
    const cityMemories = memories[cityId] ?? [];
    const uploadedMemory = await uploadMemoryImagesOss(memory as Memory);
    const nextMemories = {
      ...memories,
      [cityId]: [uploadedMemory, ...cityMemories],
    };
    await writeMemories(nextMemories);
    return { memories: nextMemories };
  }

  if (isMobileStaticApp()) {
    const memories = await readMemories();
    const cityMemories = memories[cityId] ?? [];
    const nextMemories = {
      ...memories,
      [cityId]: [memory as Memory, ...cityMemories],
    };
    await writeMemories(nextMemories);
    return { memories: nextMemories };
  }

  try {
    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.memories) {
        await idbSet("memories", data.memories);
      }
      return data;
    }
  } catch {
    // offline fallback
  }

  // Fallback to local IndexedDB
  const memories = await readMemories();
  const cityMemories = memories[cityId] ?? [];
  const nextMemories = {
    ...memories,
    [cityId]: [memory as Memory, ...cityMemories],
  };
  await writeMemories(nextMemories);
  return { memories: nextMemories };
}

export async function updateMemory(
  cityId: string,
  memoryId: string,
  memory: Record<string, unknown>,
): Promise<{ memories: LocalMemoryStore }> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const memories = await readMemories();
    const cityMemories = memories[cityId] ?? [];
    const index = cityMemories.findIndex((m) => m.id === memoryId);
    if (index === -1) throw new Error("Memory not found");
    const mergedMemory = { ...cityMemories[index], ...memory } as Memory;
    cityMemories[index] = await uploadMemoryImagesOss(mergedMemory);
    await writeMemories(memories);
    return { memories };
  }

  if (isMobileStaticApp()) {
    const memories = await readMemories();
    const cityMemories = memories[cityId] ?? [];
    const index = cityMemories.findIndex((m) => m.id === memoryId);
    if (index === -1) throw new Error("Memory not found");
    const mergedMemory = { ...cityMemories[index], ...memory } as Memory;
    cityMemories[index] = mergedMemory;
    const nextMemories = { ...memories, [cityId]: cityMemories };
    await writeMemories(nextMemories);
    return { memories: nextMemories };
  }

  try {
    const response = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId, memory }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.memories) {
        await idbSet("memories", data.memories);
      }
      return data;
    }
  } catch {
    // offline fallback
  }

  const memories = await readMemories();
  const cityMemories = memories[cityId] ?? [];
  const index = cityMemories.findIndex((m) => m.id === memoryId);
  if (index === -1) throw new Error("Memory not found");
  const mergedMemory = { ...cityMemories[index], ...memory } as Memory;
  cityMemories[index] = mergedMemory;
  const nextMemories = { ...memories, [cityId]: cityMemories };
  await writeMemories(nextMemories);
  return { memories: nextMemories };
}

export async function deleteMemory(
  cityId: string,
  memoryId: string,
): Promise<{ memories: LocalMemoryStore }> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const memories = await readMemories();
    const cityMemories = memories[cityId] ?? [];
    const nextMemories = {
      ...memories,
      [cityId]: cityMemories.filter((m) => m.id !== memoryId),
    };
    if (nextMemories[cityId]?.length === 0) {
      delete nextMemories[cityId];
    }
    await writeMemories(nextMemories);
    return { memories: nextMemories };
  }

  if (isMobileStaticApp()) {
    const memories = await readMemories();
    const cityMemories = memories[cityId] ?? [];
    const nextMemories = {
      ...memories,
      [cityId]: cityMemories.filter((m) => m.id !== memoryId),
    };
    if (nextMemories[cityId]?.length === 0) {
      delete nextMemories[cityId];
    }
    await writeMemories(nextMemories);
    return { memories: nextMemories };
  }

  try {
    const response = await fetch("/api/memories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.memories) {
        await idbSet("memories", data.memories);
      }
      return data;
    }
  } catch {
    // offline fallback
  }

  const memories = await readMemories();
  const cityMemories = memories[cityId] ?? [];
  const nextMemories = {
    ...memories,
    [cityId]: cityMemories.filter((m) => m.id !== memoryId),
  };
  if (nextMemories[cityId]?.length === 0) {
    delete nextMemories[cityId];
  }
  await writeMemories(nextMemories);
  return { memories: nextMemories };
}

export async function readCityAssets(): Promise<Record<string, string>> {
  const mode = getStorageMode();

  if (mode === "oss") {
    return ossGetJson<Record<string, string>>("city-assets", {});
  }

  if (isMobileStaticApp()) {
    return idbGet<Record<string, string>>("city-assets", {});
  }

  try {
    const response = await fetch("/api/city-assets", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      const assets = data.assets ?? {};
      idbSet("city-assets", assets).catch(() => {});
      return assets;
    }
  } catch {
    // fallback
  }

  return idbGet<Record<string, string>>("city-assets", {});
}

export async function writeCityAsset(
  cityId: string,
  image: string,
): Promise<Record<string, string>> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const assets = await readCityAssets();
    const city = cities.find((c) => c.id === cityId);
    const folderName = city ? city.name : cityId;
    let finalImage = image;
    if (image.startsWith("data:image/")) {
      finalImage = await ossPutImage(`assets/${folderName}-${Date.now()}`, image);
    }
    const nextAssets = { ...assets, [cityId]: finalImage };
    await ossPutJson("city-assets", nextAssets);
    await idbSet("city-assets", nextAssets);
    return nextAssets;
  }

  const assets = await readCityAssets();
  const nextAssets = { ...assets, [cityId]: image };
  await idbSet("city-assets", nextAssets);

  if (!isMobileStaticApp()) {
    await fetch("/api/city-assets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, image }),
    }).catch(() => {});
  }

  return nextAssets;
}

export async function writeCityAssets(assets: Record<string, string>): Promise<void> {
  const mode = getStorageMode();
  if (mode === "oss") {
    await ossPutJson("city-assets", assets);
  }
  await idbSet("city-assets", assets);
  if (!isMobileStaticApp()) {
    await fetch("/api/city-assets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch: assets }),
    }).catch(() => {});
  }
}

export async function deleteCityAsset(cityId: string): Promise<Record<string, string>> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const assets = await readCityAssets();
    const nextAssets = { ...assets };
    delete nextAssets[cityId];
    await ossPutJson("city-assets", nextAssets);
    await idbSet("city-assets", nextAssets);
    return nextAssets;
  }

  const assets = await readCityAssets();
  const nextAssets = { ...assets };
  delete nextAssets[cityId];
  await idbSet("city-assets", nextAssets);

  if (!isMobileStaticApp()) {
    await fetch("/api/city-assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId }),
    }).catch(() => {});
  }

  return nextAssets;
}

export async function readLoginPhotos(): Promise<Record<string, string>> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const store = await ossGetJson<{ photos: Record<string, string>; texts: Record<string, unknown> }>("login-photos", { photos: {}, texts: {} });
    return store.photos ?? {};
  }

  if (isMobileStaticApp()) {
    const store = await idbGet<{ photos: Record<string, string> }>("login-photos", { photos: {} });
    return store.photos ?? {};
  }

  try {
    const response = await fetch("/api/login-photos", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      const photos = data.photos ?? {};
      idbSet("login-photos", { photos }).catch(() => {});
      return photos;
    }
  } catch {
    // fallback
  }

  const store = await idbGet<{ photos: Record<string, string> }>("login-photos", { photos: {} });
  return store.photos ?? {};
}

export async function writeLoginPhoto(
  slotId: string,
  image: string,
): Promise<void> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const store = await ossGetJson<{ photos: Record<string, string>; texts: Record<string, unknown> }>("login-photos", { photos: {}, texts: {} });
    let finalImage = image;
    if (image.startsWith("data:image/")) {
      finalImage = await ossPutImage(`login-photos/${slotId}-${Date.now()}`, image);
    }
    const nextStore = { ...store, photos: { ...store.photos, [slotId]: finalImage } };
    await ossPutJson("login-photos", nextStore);
    await idbSet("login-photos", nextStore);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapofus:login-photos-updated"));
    }
    return;
  }

  const currentStore = await idbGet<{ photos: Record<string, string> }>("login-photos", { photos: {} });
  const nextStore = { ...currentStore, photos: { ...currentStore.photos, [slotId]: image } };
  await idbSet("login-photos", nextStore);

  if (!isMobileStaticApp()) {
    await fetch("/api/login-photos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId, image }),
    }).catch(() => {});
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mapofus:login-photos-updated"));
  }
}

export async function deleteLoginPhoto(slotId: string): Promise<void> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const store = await ossGetJson<{ photos: Record<string, string>; texts: Record<string, unknown> }>("login-photos", { photos: {}, texts: {} });
    const nextStore = { ...store };
    delete nextStore.photos[slotId];
    await ossPutJson("login-photos", nextStore);
    await idbSet("login-photos", nextStore);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapofus:login-photos-updated"));
    }
    return;
  }

  const currentStore = await idbGet<{ photos: Record<string, string> }>("login-photos", { photos: {} });
  const nextStore = { ...currentStore };
  delete nextStore.photos[slotId];
  await idbSet("login-photos", nextStore);

  if (!isMobileStaticApp()) {
    await fetch("/api/login-photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId }),
    }).catch(() => {});
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mapofus:login-photos-updated"));
  }
}
