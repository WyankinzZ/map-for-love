"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Clapperboard,
  Heart,
  MapPin,
  Search,
  Star,
  X,
} from "lucide-react";
import { cities } from "@/data/cities";
import { MemoryPageShell } from "@/components/MemoryNav";
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
import { LocalPrivacyImage, LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { getLitCityIds } from "@/data/progress";
import { fetchMemoriesDeduplicated } from "@/components/province/Shared";
import { Lightbox, type LightboxPhoto } from "@/components/shared/Lightbox";
import { TicketGalleryContent } from "@/components/memory/TicketGallery";
import MemoryProjector from "@/components/memory/MemoryProjector";
import PostcardCard from "@/components/memory/PostcardCard";
import { readWishlist, WISHLIST_UPDATED_EVENT } from "@/components/memory/wishlistStore";
import { scrollToPageTop } from "@/lib/client/scroll";

type ArchiveView = "city" | "timeline" | "ticket" | "postcard";
type MemoryItem = {
  memory: Memory;
  city?: (typeof cities)[number];
};

const isBrowserImageUrl = (url: string) => url.startsWith("data:image/") || url.startsWith("https://");

const memoryMonthLabel = (memory: Memory) => {
  const match = /^(\d{4})\.(\d{2})\.\d{2}$/.exec(memory.date);
  if (!match) return "未标日期";

  return `${match[1]}年 ${Number(match[2])}月`;
};

function MemoryImage({ memory, city }: Readonly<{ memory: Memory; city?: (typeof cities)[number] }>) {
  const className = "pixelated h-full w-full object-cover transition duration-300 group-hover:scale-105";

  if (isBrowserImageUrl(memory.image)) {
    return (
      <LocalPrivacyImg
        className={className}
        src={memory.image}
        fallbackSrc={city?.sprite || "/sprites/icons/city-dot.svg"}
        alt={`${memory.city} memory`}
      />
    );
  }

  return (
    <LocalPrivacyImage
      className="pixelated object-cover transition duration-300 group-hover:scale-105"
      src={memory.image}
      alt={`${memory.city} memory`}
      fill
      sizes="(min-width: 1024px) 180px, 40vw"
    />
  );
}

function MemoryCard({ item, compact = false, onPhotoClick }: Readonly<{ item: MemoryItem; compact?: boolean; onPhotoClick?: (photo: string) => void }>) {
  const { memory, city } = item;

  return (
    <Link
      className="group block rounded-[8px] border border-[#D8DDD8]/74 bg-[#FAFBF7]/78 p-2.5 sm:p-3 shadow-[0_12px_26px_rgba(90,102,112,0.055)] backdrop-blur transition hover:border-[#F5DCE0] hover:shadow-[0_16px_34px_rgba(90,102,112,0.10)]"
      href={city ? `/province/${city.provinceId}?city=${memory.cityId}` : "/"}
    >
      <article className={compact ? "grid grid-cols-[82px_1fr] sm:grid-cols-[92px_1fr] gap-2.5 sm:gap-3" : "grid grid-cols-[92px_1fr] sm:grid-cols-[112px_1fr] gap-3 sm:gap-4"}>
        <div
          className="relative aspect-square overflow-hidden rounded-[6px] border border-[#D8DDD8] bg-[#D6E8F0] cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPhotoClick?.(memory.image);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onPhotoClick?.(memory.image); } }}
        >
          <MemoryImage memory={memory} city={city} />
        </div>
        <div className="min-w-0 py-0.5 sm:py-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-base sm:text-lg font-semibold text-[#5A6670]">
              {memory.city}
              {memory.mood && moodConfig[memory.mood] && (
                <span className="ml-1 text-[13px] sm:text-[14px] leading-none" title={moodConfig[memory.mood].label}>
                  {moodConfig[memory.mood].emoji}
                </span>
              )}
            </h3>
            <span className="shrink-0 text-xs sm:text-sm text-[#5A6670]/46">{memory.date}</span>
          </div>
          <p className="mt-1.5 sm:mt-2 line-clamp-2 sm:line-clamp-3 text-xs sm:text-sm leading-5 sm:leading-6 text-[#5A6670]/70">{memory.text}</p>
          <p className="mt-2 sm:mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#A8C8DC]">
            <MapPin className="h-3.5 w-3.5" />
            回到地图
          </p>
        </div>
      </article>
    </Link>
  );
}

export default function MemoryArchive() {
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [view, setView] = useState<ArchiveView>("city");
  const [moodFilter, setMoodFilter] = useState<MemoryMood | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProjectorOpen, setIsProjectorOpen] = useState(false);
  const [wishCityIds, setWishCityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refreshWishes = () => {
      const list = readWishlist();
      setWishCityIds(new Set(list.map((w) => w.cityId)));
    };
    refreshWishes();
    window.addEventListener(WISHLIST_UPDATED_EVENT, refreshWishes);
    return () => window.removeEventListener(WISHLIST_UPDATED_EVENT, refreshWishes);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [view, moodFilter, searchQuery]);

  useEffect(() => {
    scrollToPageTop();
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;
    const handleMemoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function loadLocalMemories() {
      const memories = await fetchMemoriesDeduplicated().catch(() => ({}));
      if (!cancelled) setLocalMemories(memories);
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    loadLocalMemories();

    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    };
  }, []);

  const memoryItems = useMemo<MemoryItem[]>(() => {
    const localItems = Object.values(localMemories).flat();
    const byId = new Map<string, Memory>();

    [...recentTimelineMemories, ...localItems].forEach((memory) => {
      if (!memory.draft) byId.set(memory.id, memory);
    });

    const query = searchQuery.trim().toLowerCase();

    return sortMemoriesByTime([...byId.values()])
      .filter((memory) => moodFilter === "all" || memory.mood === moodFilter)
      .filter((memory) => {
        if (!query) return true;
        const city = cities.find((c) => c.id === memory.cityId);
        return (
          memory.city.toLowerCase().includes(query) ||
          memory.cityEn.toLowerCase().includes(query) ||
          memory.date.includes(query) ||
          memory.text.toLowerCase().includes(query) ||
          (city?.nameEn.toLowerCase().includes(query) ?? false)
        );
      })
      .map((memory) => ({
        memory,
        city: cities.find((city) => city.id === memory.cityId),
      }));
  }, [localMemories, moodFilter, searchQuery]);

  const cityGroups = useMemo(() => {
    const groups = new Map<string, MemoryItem[]>();

    memoryItems.forEach((item) => {
      const key = item.memory.cityId;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });

    return [...groups.entries()].map(([cityId, items]) => ({
      cityId,
      cityName: items[0]?.memory.city ?? cityId,
      memories: items,
    }));
  }, [memoryItems]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, MemoryItem[]>();

    memoryItems.forEach((item) => {
      const label = memoryMonthLabel(item.memory);
      groups.set(label, [...(groups.get(label) ?? []), item]);
    });

    return [...groups.entries()].map(([label, items]) => ({ label, memories: items }));
  }, [memoryItems]);

  const cityCount = cityGroups.length;

  const handlePhotoClick = (photo: string, allPhotos: string[], cityLabel: string) => {
    setLightboxPhotos(allPhotos.map((src, i) => ({
      src,
      alt: `${cityLabel} 照片 ${i + 1}`,
      caption: cityLabel,
    })));
    setLightboxIndex(allPhotos.findIndex((p) => p === photo));
  };

  const toggleCity = (cityId: string) => {
    setExpandedCities((current) => {
      const next = new Set(current);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);

      return next;
    });
  };

  return (
    <MemoryPageShell active="memories">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <Star className="h-6 w-6 sm:h-8 sm:w-8 fill-[#F5DCE0] text-[#E8B8C2]" />
                <h1 className="text-2xl sm:text-[34px] font-semibold leading-tight text-[#5A6670]">回忆记录</h1>
              </div>
              <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6670]/58">
                {view === "city"
                  ? "按城市整理我们的足迹"
                  : view === "timeline"
                  ? "按时间从新到旧排列"
                  : "把每一次回忆，珍藏成专属两人的浪漫电影票根"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {memoryItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsProjectorOpen(true)}
                  className="flex items-center gap-1.5 rounded-[8px] border border-[#F5DCE0] bg-[#F5DCE0]/40 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-[#D86F82] shadow-xs backdrop-blur transition hover:scale-105 hover:bg-[#F5DCE0]"
                >
                  <Clapperboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>全屏放映机</span>
                </button>
              )}
              <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-[#5A6670]/62 shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur">
                {memoryItems.length} 条 · {cityCount} 城
              </div>
              <div className="grid grid-cols-4 w-full sm:w-auto sm:flex rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 p-1 shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur">
                {(["city", "timeline", "ticket", "postcard"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`rounded-[7px] px-2 sm:px-3 py-1.5 text-center text-xs font-semibold transition ${
                      view === mode
                        ? "bg-[#F5DCE0] text-[#E8B8C2]"
                        : "text-[#5A6670]/58 hover:bg-[#D6E8F0]/32"
                    }`}
                    type="button"
                    onClick={() => setView(mode)}
                  >
                    {mode === "city"
                      ? "城市"
                      : mode === "timeline"
                      ? "时间线"
                      : mode === "ticket"
                      ? "电影票根"
                      : "城市明信片"}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="mt-4 sm:mt-6 flex flex-col gap-3 sm:gap-4 border-b border-[#D8DDD8]/50 pb-4 sm:pb-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6670]/40" />
              <input
                type="text"
                placeholder="搜索城市、日期或回忆内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] py-2 sm:py-2.5 pl-9 pr-9 text-xs sm:text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white placeholder:text-[#5A6670]/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6670]/40 hover:text-[#5A6670]/70"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Mood filter horizontal scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none py-1">
              <span className="text-xs font-semibold text-[#5A6670]/70 shrink-0 mr-1">心情:</span>
              <button
                type="button"
                onClick={() => setMoodFilter("all")}
                className={`shrink-0 rounded-[6px] px-2.5 py-1 text-xs font-semibold transition ${
                  moodFilter === "all"
                    ? "bg-[#E8B8C2] text-white"
                    : "bg-[#FAFBF7] text-[#5A6670]/70 hover:bg-[#F5DCE0]/50 border border-[#D8DDD8]/70"
                }`}
              >
                全部
              </button>
              {(Object.entries(moodConfig) as [MemoryMood, { emoji: string; label: string }][]).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMoodFilter(key)}
                  className={`shrink-0 flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-xs font-semibold transition ${
                    moodFilter === key
                      ? "bg-[#E8B8C2] text-white"
                      : "bg-[#FAFBF7] text-[#5A6670]/70 hover:bg-[#F5DCE0]/50 border border-[#D8DDD8]/70"
                  }`}
                >
                  <span>{info.emoji}</span>
                  <span>{info.label}</span>
                </button>
              ))}
            </div>

            {/* Quick City Pills Bar horizontal scroll */}
            {cityGroups.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none py-1">
                <span className="text-xs font-semibold text-[#5A6670]/50 mr-1 shrink-0">足迹直达:</span>
                {cityGroups.slice(0, 16).map((g) => (
                  <button
                    key={g.cityId}
                    type="button"
                    onClick={() => {
                      if (searchQuery === g.cityName) setSearchQuery("");
                      else setSearchQuery(g.cityName);
                    }}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                      searchQuery === g.cityName
                        ? "bg-[#D86F82] text-white shadow-xs"
                        : "border border-[#D8DDD8]/80 bg-white/70 text-[#5A6670]/70 hover:border-[#D86F82] hover:text-[#D86F82]"
                    }`}
                  >
                    📍 {g.cityName} ({g.memories.length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {(() => {
            const CITY_PAGE_SIZE = 6;
            const pageSize = view === "postcard" ? 6 : view === "city" ? CITY_PAGE_SIZE : 3;
            const activeGroupLength =
              view === "city"
                ? cityGroups.length
                : view === "timeline"
                ? timelineGroups.length
                : memoryItems.length;
            const totalPages = Math.max(1, Math.ceil(activeGroupLength / pageSize));
            const paginatedCityGroups = cityGroups.slice(
              (currentPage - 1) * CITY_PAGE_SIZE,
              currentPage * CITY_PAGE_SIZE
            );
            const paginatedTimelineGroups = timelineGroups.slice((currentPage - 1) * 3, currentPage * 3);
            const paginatedPostcards = memoryItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

            return (
              <>

          {memoryItems.length === 0 ? (
            <div className="mt-12 grid min-h-[420px] place-items-center rounded-[8px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7]/58 px-6 py-14 text-center shadow-[0_14px_34px_rgba(90,102,112,0.045)] backdrop-blur">
              <div className="max-w-[430px]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-[8px] border border-[#F5DCE0] bg-[#F5DCE0]/42">
                  {searchQuery ? (
                    <Search className="h-8 w-8 text-[#E8B8C2]" />
                  ) : (
                    <Heart className="h-8 w-8 fill-[#F5DCE0] text-[#E8B8C2]" />
                  )}
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-[#5A6670]">
                  {searchQuery ? "没有找到匹配的回忆" : "还没有回忆记录"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#5A6670]/60">
                  {searchQuery
                    ? `没有找到包含"${searchQuery}"的回忆，试试其他关键词。`
                    : "回到地图，点开一座城市，添加日期、照片和一句话回忆。保存后这里会自动按城市和时间整理。"}
                </p>
                {searchQuery ? (
                  <button
                    className="mt-6 inline-flex items-center gap-2 rounded-[8px] border border-[#E8B8C2] bg-[#FAFBF7]/78 px-5 py-3 text-sm font-semibold text-[#E8B8C2] transition hover:bg-[#F5DCE0]/34"
                    type="button"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                    清除搜索
                  </button>
                ) : (
                  <Link
                    className="mt-6 inline-flex items-center gap-2 rounded-[8px] border border-[#A8C8DC] bg-[#FAFBF7]/78 px-5 py-3 text-sm font-semibold text-[#A8C8DC] transition hover:bg-[#D6E8F0]/34"
                    href="/map"
                  >
                    <MapPin className="h-4 w-4" />
                    回到地图
                  </Link>
                )}
              </div>
            </div>
          ) : view === "city" ? (
            <div className="mt-5 sm:mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {paginatedCityGroups.map((group) => {
                const expanded = expandedCities.has(group.cityId);
                const visibleMemories = expanded ? group.memories : group.memories.slice(0, 4);

                return (
                  <section
                    key={group.cityId}
                    className="flex flex-col justify-between rounded-[12px] sm:rounded-[16px] border border-[#D8DDD8]/75 bg-[#FAFBF7]/75 p-3.5 sm:p-5 shadow-xs backdrop-blur transition hover:border-[#F5DCE0]"
                  >
                    <div>
                      <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-[#D8DDD8]/40 pb-2.5">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <MapPin className="h-4 w-4 fill-[#E8B8C2] text-[#E8B8C2]" />
                          <h2 className="text-xl font-bold text-[#5A6670]">{group.cityName}</h2>
                          <span className="text-xs text-[#5A6670]/50">
                            共 {group.memories.length} 条回忆
                          </span>
                          {wishCityIds.has(group.cityId) && (
                            <span className="rounded-full bg-[#FFF0F2] border border-[#F5DCE0] px-2 py-0.5 text-[10px] font-bold text-[#D86F82]">
                              🌟 心愿达成
                            </span>
                          )}
                        </div>
                        {group.memories.length > 4 && (
                          <button
                            className="flex items-center gap-1 text-xs font-semibold text-[#D86F82] transition hover:underline"
                            type="button"
                            onClick={() => toggleCity(group.cityId)}
                          >
                            {expanded ? "收起" : "展开全部"}
                            <ChevronRight className={`h-3.5 w-3.5 transition ${expanded ? "rotate-90" : ""}`} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {visibleMemories.map((item) => (
                          <MemoryCard
                            key={item.memory.id}
                            item={item}
                            compact
                            onPhotoClick={(photo) =>
                              handlePhotoClick(
                                photo,
                                [item.memory.image, ...(item.memory.photos ?? [])],
                                item.memory.city
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : view === "timeline" ? (
            <div className="relative mt-10 space-y-8 pl-9">
              <div className="absolute bottom-0 left-3 top-0 w-px bg-[#E8B8C2]/58" aria-hidden="true" />
              {paginatedTimelineGroups.map((group) => (
                <section key={group.label} className="relative">
                  <span className="absolute -left-[34px] top-1 grid h-6 w-6 place-items-center rounded-full border border-[#F5DCE0] bg-[#FAFBF7]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E8B8C2]" />
                  </span>
                  <h2 className="mb-4 text-2xl font-semibold text-[#5A6670]">{group.label}</h2>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {group.memories.map((item) => (
                      <MemoryCard
                        key={item.memory.id}
                        item={item}
                        onPhotoClick={(photo) => handlePhotoClick(photo, [item.memory.image, ...(item.memory.photos ?? [])], item.memory.city)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : view === "ticket" ? (
            <div className="mt-8">
              <TicketGalleryContent
                embedded={true}
                initialItems={memoryItems}
                externalSearch={searchQuery}
                externalMood={moodFilter}
              />
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedPostcards.map(({ memory, city }) => (
                <PostcardCard
                  key={memory.id}
                  memory={memory}
                  city={city}
                  onPhotoClick={(photo) =>
                    handlePhotoClick(
                      photo,
                      [memory.image, ...(memory.photos ?? [])],
                      memory.city
                    )
                  }
                />
              ))}
            </div>
          )}

          {view !== "ticket" && totalPages > 1 && memoryItems.length > 0 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  scrollToPageTop();
                }}
                disabled={currentPage === 1}
                className="rounded-[6px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-3 text-sm font-medium text-[#5A6670]/60">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  scrollToPageTop();
                }}
                disabled={currentPage === totalPages}
                className="rounded-[6px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          )}
          </>
        );
      })()}
      {lightboxPhotos.length > 0 && (
        <Lightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxPhotos([])}
        />
      )}
      <MemoryProjector
        slides={memoryItems}
        isOpen={isProjectorOpen}
        onClose={() => setIsProjectorOpen(false)}
      />
    </MemoryPageShell>
  );
}
