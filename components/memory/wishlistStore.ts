import { cities } from "@/data/cities";

export interface WishItem {
  id: string;
  cityId: string;
  cityName: string;
  title: string;
  targetDate?: string; // e.g. "2026.10.01" or "2026年秋天"
  note?: string;
  isFulfilled?: boolean;
  fulfilledDate?: string;
  createdAt: string;

  // 📸 心愿相册 / 种草意向图
  images?: string[];
  coverImage?: string;

  // 🏷️ 心愿分类与特征
  category?: string; // 🏖️ 海滨漫步 / 🍜 寻味美食 / 🏔️ 攀登雪山 / 🌸 季节限定 / 🎡 乐园狂欢 / 🏛️ 人文历史 / ⛺ 治愈露营 / 🌃 城市漫步
  priority?: "high" | "normal" | "someday"; // 🔥 强烈想去 / ✨ 计划成行 / 🌿 未来随缘
  budget?: string; // 预算区间
  tags?: string[];
  liked?: boolean;
}

export const WISHLIST_STORAGE_KEY = "mapofus:wishlist";
export const WISHLIST_UPDATED_EVENT = "mapofus:wishlist-updated";

export const WISH_CATEGORIES = [
  "海滨漫步",
  "寻味美食",
  "攀登雪山",
  "季节限定",
  "乐园狂欢",
  "人文历史",
  "治愈露营",
  "城市漫步",
] as const;

export function normalizeWishCategory(cat?: string): string {
  if (!cat) return "";
  return cat.replace(/^[^\u4e00-\u9fa5a-zA-Z0-9]+/, "").trim();
}

export const WISH_BUDGETS = [
  "￥1000 以内",
  "￥1000 - 3000",
  "￥3000 - 6000",
  "￥6000 - 10000",
  "￥10000 以上",
  "丰俭由人",
] as const;

export function readWishlist(): WishItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeWishlist(items: WishItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(WISHLIST_UPDATED_EVENT, { detail: items }));
  } catch (err) {
    console.error("Failed to write wishlist:", err);
  }
}

export function addWish(wish: Omit<WishItem, "id" | "createdAt">): WishItem {
  const current = readWishlist();
  const city = cities.find((c) => c.id === wish.cityId);
  const newItem: WishItem = {
    ...wish,
    cityName: wish.cityName || city?.name || wish.cityId,
    images: wish.images || [],
    coverImage: wish.coverImage || wish.images?.[0] || "",
    category: wish.category || "🏖️ 海滨漫步",
    priority: wish.priority || "normal",
    id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newItem, ...current];
  writeWishlist(updated);
  return newItem;
}

export function updateWish(id: string, patch: Partial<WishItem>): WishItem | null {
  const current = readWishlist();
  let updatedItem: WishItem | null = null;
  const updated = current.map((item) => {
    if (item.id === id) {
      updatedItem = { ...item, ...patch };
      return updatedItem;
    }
    return item;
  });
  if (updatedItem) {
    writeWishlist(updated);
  }
  return updatedItem;
}

export function removeWish(id: string) {
  const current = readWishlist();
  const updated = current.filter((item) => item.id !== id);
  writeWishlist(updated);
}

export function toggleWishFulfilled(id: string, isFulfilled?: boolean) {
  const current = readWishlist();
  const updated = current.map((item) => {
    if (item.id === id) {
      const nextState = isFulfilled !== undefined ? isFulfilled : !item.isFulfilled;
      return {
        ...item,
        isFulfilled: nextState,
        fulfilledDate: nextState ? new Date().toISOString().slice(0, 10).replace(/-/g, ".") : undefined,
      };
    }
    return item;
  });
  writeWishlist(updated);
}

export function toggleWishLiked(id: string) {
  const current = readWishlist();
  const updated = current.map((item) => {
    if (item.id === id) {
      return { ...item, liked: !item.liked };
    }
    return item;
  });
  writeWishlist(updated);
}
