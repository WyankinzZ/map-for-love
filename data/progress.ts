import { cities } from "@/data/cities";
import type { Memory } from "@/data/memories";
import { provinces } from "@/data/provinces";

export type LocalMemoryStore = Record<string, Memory[]>;
export const memoryStoreUpdatedEvent = "mapofus:memories-updated";

export const getLitCityIds = (localMemories: LocalMemoryStore = {}) =>
  new Set([
    ...cities.filter((city) => city.visited).map((city) => city.id),
    ...Object.entries(localMemories)
      .filter(([, memories]) => memories.length > 0)
      .map(([cityId]) => cityId),
  ]);

export const getLitProvinceIds = (litCityIds: Set<string>) =>
  new Set(
    cities
      .filter((city) => litCityIds.has(city.id))
      .map((city) => city.provinceId),
  );

export const initialLitCityIds = getLitCityIds();
export const initialLitProvinceIds = getLitProvinceIds(initialLitCityIds);
export const totalProvinceCount = provinces.length;
