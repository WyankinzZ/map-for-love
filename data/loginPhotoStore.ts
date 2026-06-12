export const loginPhotosUpdatedEvent = "mapofus:login-photos-updated";

export type LoginPhotoText = {
  city?: string;
  label?: string;
};

type LoginPhotoServerStore = {
  photos: Record<string, string>;
  texts: Record<string, LoginPhotoText>;
};

const apiEndpoint = "/api/login-photos";
const legacyDatabaseName = "mapofus-media";
const legacyStoreName = "loginPhotos";
const legacyDatabaseVersion = 1;
const legacySettingsKey = "mapofus:settings";
const migrationDoneKey = "mapofus:loginPhotos:migratedToServerV2";

const readLegacyIndexedDb = async (): Promise<Record<string, string>> => {
  if (typeof window === "undefined" || !window.indexedDB) return {};

  try {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(legacyDatabaseName, legacyDatabaseVersion);
      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(legacyStoreName)) db.createObjectStore(legacyStoreName);
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB open failed")));
    });

    return await new Promise<Record<string, string>>((resolve) => {
      const transaction = database.transaction(legacyStoreName, "readonly");
      const store = transaction.objectStore(legacyStoreName);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      const result: Record<string, string> = {};

      transaction.addEventListener("complete", () => {
        database.close();
        const keys = keysRequest.result.map((key) => String(key));
        const values = valuesRequest.result;
        for (let index = 0; index < keys.length; index += 1) {
          const value = values[index];
          if (typeof value === "string") result[keys[index]] = value;
        }
        resolve(result);
      });
      transaction.addEventListener("abort", () => {
        database.close();
        resolve(result);
      });
    });
  } catch {
    return {};
  }
};

const deleteLegacyIndexedDb = async (): Promise<void> => {
  if (typeof window === "undefined" || !window.indexedDB) return;

  await new Promise<void>((resolve) => {
    const request = window.indexedDB.deleteDatabase(legacyDatabaseName);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => resolve());
    request.addEventListener("blocked", () => resolve());
  });
};

const readLegacyTexts = (): Record<string, LoginPhotoText> => {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(legacySettingsKey) ?? "{}") as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const settings = parsed as { loginPhotoTexts?: unknown };
    if (
      typeof settings.loginPhotoTexts !== "object" ||
      settings.loginPhotoTexts === null ||
      Array.isArray(settings.loginPhotoTexts)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(settings.loginPhotoTexts).flatMap(([slotId, value]) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
        const item = value as LoginPhotoText;
        const text = {
          city: typeof item.city === "string" ? item.city : undefined,
          label: typeof item.label === "string" ? item.label : undefined,
        };

        return text.city || text.label ? [[slotId, text] as const] : [];
      }),
    );
  } catch {
    return {};
  }
};

const isMigrationDone = () => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(migrationDoneKey) === "1";
  } catch {
    return false;
  }
};

const markMigrationDone = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(migrationDoneKey, "1");
  } catch {
    // ignore quota or privacy-mode errors; migration will retry next load
  }
};

let migrationPromise: Promise<void> | null = null;

const migrateLegacyToServer = async (): Promise<void> => {
  if (isMigrationDone()) return;

  const legacy = await readLegacyIndexedDb();
  const legacyTexts = readLegacyTexts();
  if (Object.keys(legacy).length === 0 && Object.keys(legacyTexts).length === 0) {
    markMigrationDone();
    await deleteLegacyIndexedDb();
    return;
  }

  const serverResponse = await fetch(apiEndpoint, { cache: "no-store" });
  if (!serverResponse.ok) throw new Error("Failed to read server login photos");
  const serverData = (await serverResponse.json()) as Partial<LoginPhotoServerStore>;
  const serverPhotos = serverData.photos ?? {};
  const serverTexts = serverData.texts ?? {};

  const slotsToUpload = Object.entries(legacy).filter(([slotId]) => !(slotId in serverPhotos));

  const results = await Promise.allSettled(
    slotsToUpload.map(([slotId, image]) =>
      fetch(apiEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, image }),
      }).then((response) => {
        if (!response.ok) throw new Error(`migration upload failed (${response.status})`);
      }),
    ),
  );

  if (Object.keys(legacyTexts).length > 0) {
    const nextTexts = { ...legacyTexts, ...serverTexts };
    const textResponse = await fetch(apiEndpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: nextTexts }),
    });
    if (!textResponse.ok) throw new Error(`text migration failed (${textResponse.status})`);
  }

  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Some login photo migrations failed");
  }

  await deleteLegacyIndexedDb();
  markMigrationDone();
};

const ensureMigrated = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if (!migrationPromise) {
    migrationPromise = migrateLegacyToServer().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
};

const fetchServerStore = async (): Promise<LoginPhotoServerStore> => {
  const response = await fetch(apiEndpoint, { cache: "no-store" });
  if (!response.ok) throw new Error(`readLoginPhotos failed (${response.status})`);
  const data = (await response.json()) as Partial<LoginPhotoServerStore>;

  return {
    photos: data.photos ?? {},
    texts: data.texts ?? {},
  };
};

export const readLoginPhotoStore = async (): Promise<LoginPhotoServerStore> => {
  try {
    await ensureMigrated();
  } catch {
    // best-effort migration; fall through to whatever the server already has
  }

  return fetchServerStore();
};

export const readLoginPhotos = async (): Promise<Record<string, string>> => {
  const { photos } = await readLoginPhotoStore();
  return photos;
};

export const readLoginPhotoTexts = async (): Promise<Record<string, LoginPhotoText>> => {
  const { texts } = await readLoginPhotoStore();
  return texts;
};

export const readLoginPhoto = async (slotId: string): Promise<string | undefined> => {
  const photos = await readLoginPhotos();
  return photos[slotId];
};

export const writeLoginPhoto = async (slotId: string, image: string): Promise<void> => {
  const response = await fetch(apiEndpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, image }),
  });
  if (!response.ok) throw new Error(`writeLoginPhoto failed (${response.status})`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(loginPhotosUpdatedEvent));
  }
};

export const writeLoginPhotoText = async (slotId: string, text: LoginPhotoText): Promise<void> => {
  const response = await fetch(apiEndpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, text }),
  });
  if (!response.ok) throw new Error(`writeLoginPhotoText failed (${response.status})`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(loginPhotosUpdatedEvent));
  }
};

export const deleteLoginPhoto = async (slotId: string): Promise<void> => {
  const response = await fetch(apiEndpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId }),
  });
  if (!response.ok) throw new Error(`deleteLoginPhoto failed (${response.status})`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(loginPhotosUpdatedEvent));
  }
};

export const deleteLoginPhotoText = async (slotId: string): Promise<void> => {
  const response = await fetch(apiEndpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, kind: "text" }),
  });
  if (!response.ok) throw new Error(`deleteLoginPhotoText failed (${response.status})`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(loginPhotosUpdatedEvent));
  }
};
