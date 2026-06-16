import { type Memory, type MemoryMood } from "@/data/memories";
import { type LocalMemoryStore, memoryStoreUpdatedEvent } from "@/data/progress";
import { type OssConfig, getStoredOssConfig, ossGetJson, ossPutJson, ossPutImage } from "./oss";
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

let cachedMode: StorageMode | null = null;

export function getStorageMode(): StorageMode {
  if (cachedMode) return cachedMode;

  if (typeof window === "undefined") {
    cachedMode = "electron";
    return cachedMode;
  }

  const isElectron = Boolean(
    (window as unknown as Record<string, unknown>).electronAPI ||
    navigator.userAgent.includes("Electron") ||
    process.env.NODE_ENV === "development"
  );

  cachedMode = isElectron ? "electron" : "oss";
  return cachedMode;
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const mode = getStorageMode();

  if (mode === "oss") {
    return ossGetJson<T>(key, fallback);
  }

  const response = await fetch(`/api/settings/${key}`, { cache: "no-store" }).catch(() => null);
  if (response?.ok) {
    const data = await response.json();
    return (data.value as T) ?? fallback;
  }
  return fallback;
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  const mode = getStorageMode();

  if (mode === "oss") {
    await ossPutJson(key, value);
    return;
  }

  await fetch(`/api/settings/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}

export async function readMemories(): Promise<LocalMemoryStore> {
  const mode = getStorageMode();

  if (mode === "oss") {
    return ossGetJson<LocalMemoryStore>("memories", {});
  }

  const response = await fetch("/api/memories", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to read memories");
  const data = await response.json();
  return data.memories ?? {};
}

export async function writeMemories(memories: LocalMemoryStore): Promise<void> {
  const mode = getStorageMode();

  if (mode === "oss") {
    await ossPutJson("memories", memories);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: memories }));
    }
    return;
  }

  const response = await fetch("/api/memories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memories }),
  });
  if (!response.ok) throw new Error("Failed to write memories");
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

  const response = await fetch("/api/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memory }),
  });
  if (!response.ok) throw new Error("Failed to save memory");
  return response.json();
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

  const response = await fetch("/api/memories", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityId, memoryId, memory }),
  });
  if (!response.ok) throw new Error("Failed to update memory");
  return response.json();
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

  const response = await fetch("/api/memories", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityId, memoryId }),
  });
  if (!response.ok) throw new Error("Failed to delete memory");
  return response.json();
}

export async function readCityAssets(): Promise<Record<string, string>> {
  const mode = getStorageMode();

  if (mode === "oss") {
    return ossGetJson<Record<string, string>>("city-assets", {});
  }

  const response = await fetch("/api/city-assets", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to read city assets");
  const data = await response.json();
  return data.assets ?? {};
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
    return nextAssets;
  }

  const response = await fetch("/api/city-assets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityId, image }),
  });
  if (!response.ok) throw new Error("Failed to write city asset");
  const data = await response.json();
  return data.assets ?? {};
}

export async function deleteCityAsset(cityId: string): Promise<Record<string, string>> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const assets = await readCityAssets();
    const nextAssets = { ...assets };
    delete nextAssets[cityId];
    await ossPutJson("city-assets", nextAssets);
    return nextAssets;
  }

  const response = await fetch("/api/city-assets", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityId }),
  });
  if (!response.ok) throw new Error("Failed to delete city asset");
  const data = await response.json();
  return data.assets ?? {};
}

export async function readLoginPhotos(): Promise<Record<string, string>> {
  const mode = getStorageMode();

  if (mode === "oss") {
    const store = await ossGetJson<{ photos: Record<string, string>; texts: Record<string, unknown> }>("login-photos", { photos: {}, texts: {} });
    return store.photos ?? {};
  }

  const response = await fetch("/api/login-photos", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to read login photos");
  const data = await response.json();
  return data.photos ?? {};
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapofus:login-photos-updated"));
    }
    return;
  }

  const response = await fetch("/api/login-photos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, image }),
  });
  if (!response.ok) throw new Error("Failed to write login photo");
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapofus:login-photos-updated"));
    }
    return;
  }

  const response = await fetch("/api/login-photos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId }),
  });
  if (!response.ok) throw new Error("Failed to delete login photo");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mapofus:login-photos-updated"));
  }
}
