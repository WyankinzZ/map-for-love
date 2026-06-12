"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
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
import { Lightbox, type LightboxPhoto } from "@/components/shared/Lightbox";

type ArchiveView = "city" | "timeline";
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

function MemoryImage({ memory }: Readonly<{ memory: Memory }>) {
  const className = "pixelated h-full w-full object-cover transition duration-300 group-hover:scale-105";

  if (isBrowserImageUrl(memory.image)) {
    return (
      <LocalPrivacyImg className={className} src={memory.image} alt={`${memory.city} memory`} />
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
      className="group block rounded-[8px] border border-[#D8DDD8]/74 bg-[#FAFBF7]/78 p-3 shadow-[0_12px_26px_rgba(90,102,112,0.055)] backdrop-blur transition hover:border-[#F5DCE0] hover:shadow-[0_16px_34px_rgba(90,102,112,0.10)]"
      href={city ? `/province/${city.provinceId}?city=${memory.cityId}` : "/"}
    >
      <article className={compact ? "grid grid-cols-[92px_1fr] gap-3" : "grid grid-cols-[112px_1fr] gap-4"}>
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
          <MemoryImage memory={memory} />
        </div>
        <div className="min-w-0 py-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-lg font-semibold text-[#5A6670]">
              {memory.city}
              {memory.mood && moodConfig[memory.mood] && (
                <span className="ml-1 text-[14px] leading-none" title={moodConfig[memory.mood].label}>
                  {moodConfig[memory.mood].emoji}
                </span>
              )}
            </h3>
            <span className="shrink-0 text-sm text-[#5A6670]/46">{memory.date}</span>
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5A6670]/70">{memory.text}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#A8C8DC]">
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

  useEffect(() => {
    setCurrentPage(1);
  }, [view, moodFilter, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const handleMemoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function loadLocalMemories() {
      const response = await fetch("/api/memories", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;

      const data = (await response.json().catch(() => null)) as
        | { memories?: LocalMemoryStore }
        | null;

      if (!cancelled && data?.memories) setLocalMemories(data.memories);
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
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <Star className="h-8 w-8 fill-[#F5DCE0] text-[#E8B8C2]" />
                <h1 className="text-[34px] font-semibold leading-tight text-[#5A6670]">回忆记录</h1>
              </div>
              <p className="mt-2 text-sm font-medium text-[#5A6670]/58">
                {view === "city" ? "按城市整理我们的足迹" : "按时间从新到旧排列"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 px-4 py-2 text-sm font-semibold text-[#5A6670]/62 shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur">
                {memoryItems.length} 条 · {cityCount} 城
              </div>
              <div className="flex rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 p-1 shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur">
                {(["city", "timeline"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`rounded-[7px] px-4 py-2 text-sm font-semibold transition ${
                      view === mode
                        ? "bg-[#F5DCE0] text-[#E8B8C2]"
                        : "text-[#5A6670]/58 hover:bg-[#D6E8F0]/32"
                    }`}
                    type="button"
                    onClick={() => setView(mode)}
                  >
                    {mode === "city" ? "城市" : "时间线"}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="mt-6 flex flex-col gap-4 border-b border-[#D8DDD8]/50 pb-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6670]/40" />
              <input
                type="text"
                placeholder="搜索城市、日期或回忆内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] py-2.5 pl-9 pr-9 text-sm text-[#5A6670] outline-none transition focus:border-[#E8B8C2] focus:bg-white placeholder:text-[#5A6670]/40"
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
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-[#5A6670]/70">心情：</span>
              <button
              type="button"
              onClick={() => setMoodFilter("all")}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
                moodFilter === "all"
                  ? "bg-[#E8B8C2] text-white"
                  : "bg-[#FAFBF7] text-[#5A6670]/70 hover:bg-[#F5DCE0]/50"
              }`}
            >
              全部
            </button>
            {(Object.entries(moodConfig) as [MemoryMood, { emoji: string; label: string }][]).map(([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMoodFilter(key)}
                className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
                  moodFilter === key
                    ? "bg-[#E8B8C2] text-white"
                    : "bg-[#FAFBF7] text-[#5A6670]/70 hover:bg-[#F5DCE0]/50"
                }`}
              >
                <span>{info.emoji}</span>
                <span>{info.label}</span>
              </button>
            ))}
            </div>
          </div>

          {(() => {
            const activeGroupLength = view === "city" ? cityGroups.length : timelineGroups.length;
            const totalPages = Math.max(1, Math.ceil(activeGroupLength / 3));
            const paginatedCityGroups = cityGroups.slice((currentPage - 1) * 3, currentPage * 3);
            const paginatedTimelineGroups = timelineGroups.slice((currentPage - 1) * 3, currentPage * 3);

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
            <div className="mt-10 space-y-9">
              {paginatedCityGroups.map((group) => {
                const expanded = expandedCities.has(group.cityId);
                const visibleMemories = expanded ? group.memories : group.memories.slice(0, 3);

                return (
                  <section key={group.cityId}>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div className="flex items-baseline gap-3">
                        <MapPin className="h-5 w-5 fill-[#E8B8C2] text-[#E8B8C2]" />
                        <h2 className="text-2xl font-semibold text-[#5A6670]">{group.cityName}</h2>
                        <span className="text-sm text-[#5A6670]/48">
                          共 {group.memories.length} 条回忆
                        </span>
                      </div>
                      {group.memories.length > 3 && (
                        <button
                          className="flex items-center gap-1 text-sm font-semibold text-[#5A6670]/58 transition hover:text-[#E8B8C2]"
                          type="button"
                          onClick={() => toggleCity(group.cityId)}
                        >
                          {expanded ? "收起" : "查看全部"}
                          <ChevronRight className={`h-4 w-4 transition ${expanded ? "rotate-90" : ""}`} />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 xl:grid-cols-3">
                      {visibleMemories.map((item) => (
                        <MemoryCard
                          key={item.memory.id}
                          item={item}
                          compact
                          onPhotoClick={(photo) => handlePhotoClick(photo, [item.memory.image, ...(item.memory.photos ?? [])], item.memory.city)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
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
          )}

          {totalPages > 1 && memoryItems.length > 0 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-[6px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-30"
              >
                上一页
              </button>
              <span className="px-3 text-sm font-medium text-[#5A6670]/60">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-[6px] border border-[#D8DDD8] px-3 py-1.5 text-sm text-[#5A6670]/70 transition hover:bg-[#FAFBF7] disabled:opacity-30"
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
    </MemoryPageShell>
  );
}
