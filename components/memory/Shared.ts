import { Heart, CalendarDays, Archive, PlaneTakeoff } from "lucide-react";
import { type MemoryNavKey } from "@/components/MemoryNav";
import { type AppSettings, type LoginPhotoText } from "@/data/appSettings";

export { type CityAssetStore } from "@/components/province/Shared";

export type StoredItem = {
  id: string;
  title: string;
  date?: string;
  note: string;
  cityId?: string;
};

export type ToolConfig = {
  active: MemoryNavKey;
  icon: typeof Heart;
  title: string;
  subtitle: string;
  storageKey: string;
  kind: "favorite" | "anniversary" | "capsule" | "trip";
};

export const configs = {
  favorite: {
    active: "favorites",
    icon: Heart,
    title: "地点收藏",
    subtitle: "先收好想一起去的地方，不点亮地图。",
    storageKey: "mapofus:favorites",
    kind: "favorite",
  },
  anniversary: {
    active: "anniversaries",
    icon: CalendarDays,
    title: "纪念日",
    subtitle: "把重要的日子放在这里，慢慢倒数。",
    storageKey: "mapofus:anniversaries",
    kind: "anniversary",
  },
  capsule: {
    active: "capsule",
    icon: Archive,
    title: "时光宝盒",
    subtitle: "存放不一定属于某座城市的小秘密。",
    storageKey: "mapofus:capsules",
    kind: "capsule",
  },
  trip: {
    active: "trips",
    icon: PlaneTakeoff,
    title: "旅行倒计时",
    subtitle: "期待下一次出发，计算距离旅行还有多少天。",
    storageKey: "mapofus:trips",
    kind: "trip",
  },
} satisfies Record<string, ToolConfig>;

export const auxiliaryStorageKeys = ["mapofus:favorites", "mapofus:anniversaries", "mapofus:capsules", "mapofus:trips"] as const;
const loginPhotoVersion = "placeholder-20260601";
export const loginPhotoFallback = (fileName: string) => `/photos/login/${fileName}.jpg?v=${loginPhotoVersion}`;

export const loginPhotoSlots = [
  { id: "hangzhou", city: "杭州", label: "春日湖畔", fallback: loginPhotoFallback("hangzhou") },
  { id: "shanghai", city: "上海", label: "外滩傍晚", fallback: loginPhotoFallback("shanghai") },
  { id: "macau", city: "澳门", label: "旧城花影", fallback: loginPhotoFallback("macau") },
  { id: "hongkong", city: "香港", label: "夜色亮起", fallback: loginPhotoFallback("hongkong") },
  { id: "qingdao", city: "青岛", label: "海风经过", fallback: loginPhotoFallback("qingdao") },
  { id: "zhengzhou", city: "郑州", label: "见面那天", fallback: loginPhotoFallback("zhengzhou") },
  { id: "zhuhai", city: "珠海", label: "海边散步", fallback: loginPhotoFallback("zhuhai") },
  { id: "guangzhou", city: "广州", label: "旧街热气", fallback: loginPhotoFallback("guangzhou") },
  { id: "jinan", city: "济南", label: "泉边小记", fallback: loginPhotoFallback("jinan") },
] as const;

export const readItems = (key: string): StoredItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is StoredItem => typeof item === "object" && item !== null && "id" in item) : [];
  } catch {
    return [];
  }
};

export const writeItems = (key: string, items: StoredItem[]) => {
  window.localStorage.setItem(key, JSON.stringify(items));
};

export const readJsonArray = (key: string) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeAppSettings = (value: unknown): AppSettings => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const settings = value as AppSettings & { loginCoverImage?: string };
  const loginPhotos =
    settings.loginPhotos && typeof settings.loginPhotos === "object" && !Array.isArray(settings.loginPhotos)
      ? Object.fromEntries(
          Object.entries(settings.loginPhotos).filter(
            ([key, photo]) =>
              loginPhotoSlots.some((slot) => slot.id === key) &&
              typeof photo === "string" &&
              photo.startsWith("data:image/"),
          ),
        )
      : {};
  const loginPhotoTexts =
    settings.loginPhotoTexts && typeof settings.loginPhotoTexts === "object" && !Array.isArray(settings.loginPhotoTexts)
      ? Object.fromEntries(
          Object.entries(settings.loginPhotoTexts)
            .filter(([key]) => loginPhotoSlots.some((slot) => slot.id === key))
            .map(([key, value]) => {
              if (typeof value !== "object" || value === null || Array.isArray(value)) return [key, {}];
              const item = value as LoginPhotoText;

              return [
                key,
                {
                  city: typeof item.city === "string" ? item.city : undefined,
                  label: typeof item.label === "string" ? item.label : undefined,
                },
              ];
            }),
        )
      : {};

  if (
    Object.keys(loginPhotos).length === 0 &&
    typeof settings.loginCoverImage === "string" &&
    settings.loginCoverImage.startsWith("data:image/")
  ) {
    return { loginPhotos: { hangzhou: settings.loginCoverImage }, loginPhotoTexts };
  }

  return { loginPhotos, loginPhotoTexts };
};

export const daysUntil = (value?: string) => {
  if (!value || !/^\d{4}\.\d{2}\.\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split(".").map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};
