"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  Heart,
  Mail,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cities, type City } from "@/data/cities";
import {
  recentTimelineMemories,
  sortMemoriesByTime,
  type Memory,
  type MemoryMood,
  moodConfig,
} from "@/data/memories";
import {
  memoryStoreUpdatedEvent,
  type LocalMemoryStore,
} from "@/data/progress";
import { fetchMemoriesDeduplicated } from "@/components/province/Shared";
import { Lightbox, type LightboxPhoto } from "@/components/shared/Lightbox";
import { MemoryPageShell } from "@/components/MemoryNav";
import PostcardCard from "./PostcardCard";
import { scrollToPageTop } from "@/lib/client/scroll";

export default function PostcardGallery() {
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<MemoryMood | "all">("all");
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, moodFilter]);

  useEffect(() => {
    scrollToPageTop();
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function load() {
      const data = await fetchMemoriesDeduplicated().catch(() => ({}));
      if (!cancelled) setLocalMemories(data);
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleUpdate);
    load();
    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleUpdate);
    };
  }, []);

  const allItems = useMemo(() => {
    const localItems = Object.values(localMemories).flat();
    const byId = new Map<string, Memory>();

    [...recentTimelineMemories, ...localItems].forEach((m) => {
      if (!m.draft) byId.set(m.id, m);
    });

    return sortMemoriesByTime([...byId.values()]).map((memory) => ({
      memory,
      city: cities.find((c) => c.id === memory.cityId),
    }));
  }, [localMemories]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allItems.filter(({ memory, city }) => {
      const matchMood = moodFilter === "all" || memory.mood === moodFilter;
      if (!matchMood) return false;

      if (!q) return true;
      return (
        memory.city.toLowerCase().includes(q) ||
        memory.date.includes(q) ||
        memory.text.toLowerCase().includes(q) ||
        (city?.nameEn.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allItems, searchQuery, moodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePhotoClick = (photo: string) => {
    setLightboxPhotos([
      {
        src: photo,
        alt: "城市明信片剧照",
        caption: "城市明信片高清原图",
      },
    ]);
    setLightboxIndex(0);
  };

  return (
    <MemoryPageShell active="postcards">
      <div className="w-full space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5DCE0] text-[#D86F82]">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#3F4951]">
                  城市明信片 · 邮戳寄语
                </h1>
              </div>
            </div>
            <p className="mt-1.5 text-sm font-medium text-[#5A6670]/60">
              把每一座走过的城市，制作成盖着专属邮戳的明信片。点击卡片可 3D 翻转阅读背面手写寄语
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 px-4 py-2 text-xs font-semibold text-[#5A6670]/70 shadow-sm backdrop-blur">
              已寄出 {filteredItems.length} 张明信片
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-[12px] border border-[#D8DDD8]/70 bg-[#FAFBF7]/80 p-3 shadow-xs backdrop-blur">
          {/* Mood Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMoodFilter("all")}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-semibold transition ${
                moodFilter === "all"
                  ? "bg-[#D86F82] text-white"
                  : "bg-white text-[#5A6670]/70 hover:bg-[#F5DCE0]/40"
              }`}
            >
              全部
            </button>
            {(Object.entries(moodConfig) as [MemoryMood, { emoji: string; label: string }][]).map(
              ([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMoodFilter(key)}
                  className={`flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs font-medium transition ${
                    moodFilter === key
                      ? "bg-[#D86F82] text-white"
                      : "bg-white text-[#5A6670]/70 hover:bg-[#F5DCE0]/40"
                  }`}
                >
                  <span>{info.emoji}</span>
                  <span className="hidden md:inline">{info.label}</span>
                </button>
              )
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/40" />
            <input
              type="text"
              placeholder="搜索城市或寄语内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[8px] border border-[#D8DDD8] bg-white py-1.5 pl-8 pr-8 text-xs text-[#5A6670] outline-none transition focus:border-[#D86F82]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6670]/40 hover:text-[#5A6670]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Postcards Grid */}
        {filteredItems.length === 0 ? (
          <div className="grid min-h-[360px] place-items-center rounded-[16px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7]/60 p-8 text-center backdrop-blur">
            <div className="max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5DCE0]/50 text-[#D86F82]">
                <Mail className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-[#3F4951]">
                {searchQuery ? "未找到匹配的明信片" : "尚无城市明信片"}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5A6670]/70">
                {searchQuery
                  ? "尝试更换搜索词或清除心情筛选试试看。"
                  : "回到地图中点开任意城市添加照片与回忆，系统将自动生成带有城市邮戳和手写情书的精美明信片！"}
              </p>
              <div className="mt-5">
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#D86F82] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#c95d70]"
                >
                  <MapPin className="h-4 w-4" />
                  回到地图开启回忆
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {paginatedItems.map(({ memory, city }) => (
                <PostcardCard
                  key={memory.id}
                  memory={memory}
                  city={city}
                  onPhotoClick={handlePhotoClick}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    scrollToPageTop();
                  }}
                  disabled={currentPage === 1}
                  className="rounded-[6px] border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:border-[#D86F82] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  上一页
                </button>

                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setCurrentPage(pageNum);
                          scrollToPageTop();
                        }}
                        className={`h-7 w-7 rounded-[6px] text-xs font-semibold transition cursor-pointer ${
                          currentPage === pageNum
                            ? "bg-[#D86F82] text-white shadow-xs"
                            : "border border-[#D8DDD8] bg-white text-[#5A6670] hover:border-[#D86F82]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    scrollToPageTop();
                  }}
                  disabled={currentPage === totalPages}
                  className="rounded-[6px] border border-[#D8DDD8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A6670] transition hover:border-[#D86F82] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lightbox for Zooming Photos */}
        {lightboxPhotos.length > 0 && (
          <Lightbox
            photos={lightboxPhotos}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxPhotos([])}
          />
        )}
      </div>
    </MemoryPageShell>
  );
}
