"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  Heart,
  LayoutGrid,
  MapPin,
  Search,
  Sparkles,
  Ticket,
  Tv,
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
import { TicketStubCard, type TicketItem } from "./TicketStubCard";
import MemoryProjector from "./MemoryProjector";
import { scrollToPageTop } from "@/lib/client/scroll";

type ViewStyle = "grid" | "cinema";

interface TicketGalleryProps {
  embedded?: boolean;
  initialItems?: TicketItem[];
  externalSearch?: string;
  externalMood?: MemoryMood | "all";
}

export function TicketGalleryContent({
  embedded = false,
  initialItems,
  externalSearch,
  externalMood,
}: TicketGalleryProps) {
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [viewStyle, setViewStyle] = useState<ViewStyle>("grid");
  const [searchQuery, setSearchQuery] = useState(externalSearch ?? "");
  const [moodFilter, setMoodFilter] = useState<MemoryMood | "all">(
    externalMood ?? "all"
  );
  const [cinemaIndex, setCinemaIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isProjectorOpen, setIsProjectorOpen] = useState(false);

  const ITEMS_PER_PAGE = 4;

  // Sync external filters if provided
  useEffect(() => {
    if (externalSearch !== undefined) setSearchQuery(externalSearch);
  }, [externalSearch]);

  useEffect(() => {
    if (externalMood !== undefined) setMoodFilter(externalMood);
  }, [externalMood]);

  // Load memories if not supplied from parent
  useEffect(() => {
    if (initialItems) return;

    let cancelled = false;
    const handleMemoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function loadMemories() {
      const memories = await fetchMemoriesDeduplicated().catch(() => ({}));
      if (!cancelled) setLocalMemories(memories);
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    loadMemories();

    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    };
  }, [initialItems]);

  // Consolidate ticket items
  const allTicketItems = useMemo<TicketItem[]>(() => {
    if (initialItems) return initialItems;

    const localItems = Object.values(localMemories).flat();
    const byId = new Map<string, Memory>();

    [...recentTimelineMemories, ...localItems].forEach((memory) => {
      if (!memory.draft) byId.set(memory.id, memory);
    });

    return sortMemoriesByTime([...byId.values()]).map((memory) => ({
      memory,
      city: cities.find((c) => c.id === memory.cityId),
    }));
  }, [initialItems, localMemories]);

  // Filter items
  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allTicketItems.filter((item) => {
      const matchMood = moodFilter === "all" || item.memory.mood === moodFilter;
      if (!matchMood) return false;

      if (!query) return true;
      return (
        item.memory.city.toLowerCase().includes(query) ||
        item.memory.cityEn.toLowerCase().includes(query) ||
        item.memory.date.includes(query) ||
        item.memory.text.toLowerCase().includes(query) ||
        (item.city?.nameEn.toLowerCase().includes(query) ?? false)
      );
    });
  }, [allTicketItems, searchQuery, moodFilter]);

  // Reset pagination & cinema index on filter change
  useEffect(() => {
    setCurrentPage(1);
    setCinemaIndex(0);
  }, [searchQuery, moodFilter, viewStyle]);

  useEffect(() => {
    scrollToPageTop();
  }, [currentPage]);

  // Ensure cinemaIndex stays within bounds
  useEffect(() => {
    if (cinemaIndex >= filteredTickets.length) {
      setCinemaIndex(Math.max(0, filteredTickets.length - 1));
    }
  }, [filteredTickets.length, cinemaIndex]);

  // Keyboard navigation for Cinema mode
  useEffect(() => {
    if (viewStyle !== "cinema" || filteredTickets.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxPhotos.length > 0) return; // Don't intercept when lightbox is open
      if (e.key === "ArrowLeft") {
        setCinemaIndex((prev) => (prev > 0 ? prev - 1 : filteredTickets.length - 1));
      } else if (e.key === "ArrowRight") {
        setCinemaIndex((prev) => (prev < filteredTickets.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewStyle, filteredTickets.length, lightboxPhotos.length]);

  const handlePhotoClick = useCallback(
    (photo: string, allPhotos: string[], label: string) => {
      setLightboxPhotos(
        allPhotos.map((src, i) => ({
          src,
          alt: `${label} 电影剧照 ${i + 1}`,
          caption: `${label} · 浪漫票根专属剧照`,
        }))
      );
      setLightboxIndex(allPhotos.findIndex((p) => p === photo));
    },
    []
  );

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / ITEMS_PER_PAGE));
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const uniqueCitiesCount = new Set(filteredTickets.map((t) => t.memory.cityId)).size;

  return (
    <div className="w-full space-y-6">
      {/* Standalone Header (Shown only when not embedded inside MemoryArchive) */}
      {!embedded && (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5DCE0] text-[#D86F82]">
                <Ticket className="h-6 w-6" />
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-[#3F4951]">
                电影票根
              </h1>
            </div>
            <p className="mt-1.5 text-sm font-medium text-[#5A6670]/60">
              把我们走过的每一座城市，珍藏成一部永不落幕的浪漫电影
            </p>
          </div>

          <div className="flex items-center gap-3">
            {filteredTickets.length > 0 && (
              <button
                type="button"
                onClick={() => setIsProjectorOpen(true)}
                className="flex items-center gap-1.5 rounded-[8px] border border-[#F5DCE0] bg-[#F5DCE0]/40 px-3.5 py-2 text-xs font-semibold text-[#D86F82] shadow-xs backdrop-blur transition hover:scale-105 hover:bg-[#F5DCE0]"
              >
                <Clapperboard className="h-4 w-4" />
                <span>全屏时光放映机</span>
              </button>
            )}
            <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/80 px-4 py-2 text-xs font-semibold text-[#5A6670]/70 shadow-sm backdrop-blur">
              已珍藏 {filteredTickets.length} 张票根 · 点亮 {uniqueCitiesCount} 座城市
            </div>
          </div>
        </header>
      )}

      {/* Control Bar: Mode Toggle + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-[12px] border border-[#D8DDD8]/70 bg-[#FAFBF7]/70 p-3 backdrop-blur shadow-sm">
        {/* View Mode Toggle: Grid vs Cinema */}
        <div className="flex w-full sm:w-auto rounded-[8px] border border-[#D8DDD8] bg-white p-1">
          <button
            type="button"
            onClick={() => setViewStyle("grid")}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition ${
              viewStyle === "grid"
                ? "bg-[#F5DCE0] text-[#D86F82] shadow-xs"
                : "text-[#5A6670]/60 hover:text-[#5A6670]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>集票册画廊</span>
          </button>
          <button
            type="button"
            onClick={() => setViewStyle("cinema")}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition ${
              viewStyle === "cinema"
                ? "bg-[#F5DCE0] text-[#D86F82] shadow-xs"
                : "text-[#5A6670]/60 hover:text-[#5A6670]"
            }`}
          >
            <Tv className="h-3.5 w-3.5" />
            <span>沉浸放映厅</span>
          </button>
        </div>

        {/* Search input (when standalone) */}
        {!embedded && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5A6670]/40" />
            <input
              type="text"
              placeholder="搜索电影城市或回忆..."
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
        )}

        {/* Mood filter (when standalone) */}
        {!embedded && (
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
        )}
      </div>

      {/* Main Content Area */}
      {filteredTickets.length === 0 ? (
        <div className="grid min-h-[380px] place-items-center rounded-[16px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7]/60 p-8 text-center backdrop-blur">
          <div className="max-w-md">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5DCE0]/50 text-[#D86F82]">
              <Film className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-[#3F4951]">
              {searchQuery ? "未找到匹配的电影票根" : "尚无电影票根"}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#5A6670]/70">
              {searchQuery
                ? "尝试更换搜索词或清除心情筛选试试看。"
                : "回到地图点开任意城市，记录你们的旅行瞬间和照片，系统将自动生成浪漫专属电影票根！"}
            </p>
            <div className="mt-5">
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#D86F82] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#c95d70]"
              >
                <MapPin className="h-4 w-4" />
                回到地图开启回忆
              </Link>
            </div>
          </div>
        </div>
      ) : viewStyle === "cinema" ? (
        /* ================== 沉浸放映厅 (CINEMA CAROUSEL) ================== */
        <div className="relative flex flex-col items-center justify-center rounded-[20px] border border-[#D8DDD8]/80 bg-gradient-to-b from-[#2B3238] via-[#21272C] to-[#1A1F24] p-4 sm:p-8 shadow-2xl overflow-hidden">
          {/* Cinema Ambient Background Glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#E86F82]/15 via-transparent to-transparent opacity-80" />

          {/* Top Cinema Banner */}
          <div className="relative z-10 mb-6 flex w-full max-w-[880px] items-center justify-between text-white/70">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Clapperboard className="h-4 w-4 text-[#E86F82]" />
              <span>独家记忆放映机</span>
              <span className="text-white/40">·</span>
              <span className="text-[#E8B8C2]">
                {filteredTickets[cinemaIndex]?.city?.name ||
                  filteredTickets[cinemaIndex]?.memory.city}
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-white/90 backdrop-blur-md">
              <span className="text-[#E8B8C2]">
                {String(cinemaIndex + 1).padStart(2, "0")}
              </span>
              <span className="text-white/40">/</span>
              <span>{String(filteredTickets.length).padStart(2, "0")}</span>
            </div>
          </div>

          {/* Stage & Ticket Carousel with Arrow Controls */}
          <div className="relative z-10 flex w-full items-center justify-center gap-3 sm:gap-6">
            {/* Prev Button */}
            <button
              type="button"
              onClick={() =>
                setCinemaIndex((prev) =>
                  prev > 0 ? prev - 1 : filteredTickets.length - 1
                )
              }
              aria-label="Previous Ticket"
              className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-[#D86F82]"
            >
              <ChevronLeft className="h-6 w-6 transition group-hover:-translate-x-0.5" />
            </button>

            {/* Current Active Ticket Card */}
            <div className="w-full max-w-[860px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={filteredTickets[cinemaIndex]?.memory.id}
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -15 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                >
                  <TicketStubCard
                    item={filteredTickets[cinemaIndex]}
                    isCinemaMode
                    onPhotoClick={handlePhotoClick}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Next Button */}
            <button
              type="button"
              onClick={() =>
                setCinemaIndex((prev) =>
                  prev < filteredTickets.length - 1 ? prev + 1 : 0
                )
              }
              aria-label="Next Ticket"
              className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-[#D86F82]"
            >
              <ChevronRight className="h-6 w-6 transition group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Bottom Film Strip Thumbnail Scroller */}
          <div className="relative z-10 mt-6 sm:mt-8 flex w-full max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap px-2 sm:px-4 py-2 scrollbar-none">
            {filteredTickets.map((ticket, index) => {
              const isActive = index === cinemaIndex;
              return (
                <button
                  key={ticket.memory.id}
                  type="button"
                  onClick={() => setCinemaIndex(index)}
                  className={`group relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-[#D86F82] text-white shadow-md scale-105"
                      : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  <span className="shrink-0">{ticket.city?.name || ticket.memory.city}</span>
                  <span className="text-[10px] opacity-70 shrink-0">
                    {ticket.memory.date ? ticket.memory.date.slice(5) : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Keyboard navigation hint */}
          <p className="relative z-10 mt-3 text-[11px] text-white/30 hidden sm:block">
            提示：可使用键盘 ← / → 方向键切换电影票根
          </p>
        </div>
      ) : (
        /* ================== 集票册画廊 (GRID VIEW) ================== */
        <div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {paginatedTickets.map((item) => (
              <TicketStubCard
                key={item.memory.id}
                item={item}
                onPhotoClick={handlePhotoClick}
              />
            ))}
          </div>

          {/* Pagination */}
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
              <span className="px-3 text-xs font-medium text-[#5A6670]/70">
                {currentPage} / {totalPages}
              </span>
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

      {/* Fullscreen Memory Projector with Ambient Audio */}
      <MemoryProjector
        slides={filteredTickets}
        initialIndex={cinemaIndex}
        isOpen={isProjectorOpen}
        onClose={() => setIsProjectorOpen(false)}
      />
    </div>
  );
}

// Standalone page wrapper
export default function TicketGallery() {
  return (
    <MemoryPageShell active="tickets">
      <TicketGalleryContent />
    </MemoryPageShell>
  );
}
