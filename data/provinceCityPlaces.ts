import { cities } from "@/data/cities";

export interface ProvinceCityPlace {
  id: string;
  provinceId: string;
  name: string;
  nameEn: string;
  lng: number;
  lat: number;
}

export const provinceCityPlaces: ProvinceCityPlace[] = cities.map(
  ({ id, provinceId, name, nameEn, lng, lat }) => ({
    id,
    provinceId,
    name,
    nameEn,
    lng,
    lat,
  }),
);

export const getProvinceCityPlaces = (provinceId: string): ProvinceCityPlace[] =>
  provinceCityPlaces.filter((city) => city.provinceId === provinceId);

export const getProvinceCityTotal = (provinceId: string): number =>
  getProvinceCityPlaces(provinceId).length;

export const getUnvisitedProvinceCityPlaces = (
  provinceId: string,
  visitedCityIds: Set<string>,
): ProvinceCityPlace[] =>
  getProvinceCityPlaces(provinceId).filter((city) => !visitedCityIds.has(city.id));
