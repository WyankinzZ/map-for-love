"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  Film,
  Loader2,
  MapPin,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { type Memory, moodConfig } from "@/data/memories";
import { type City } from "@/data/cities";
import { LocalPrivacyImage, LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { exportTicketAsImage } from "./ticketExport";

export type TicketItem = {
  memory: Memory;
  city?: City;
};

const isBrowserImageUrl = (url: string) =>
  url.startsWith("data:image/") || url.startsWith("https://") || url.startsWith("blob:");

export function TicketStubCard({
  item,
  isCinemaMode = false,
  onPhotoClick,
}: {
  item: TicketItem;
  isCinemaMode?: boolean;
  onPhotoClick?: (photo: string, allPhotos: string[], label: string) => void;
}) {
  const { memory, city } = item;
  const cityName = city?.name || memory.city || "城市回忆";

  // GPS coordinates formatted
  const hasGps = city && typeof city.lng === "number" && typeof city.lat === "number";
  const gpsText = hasGps ? `${city.lng.toFixed(2)}°E, ${city.lat.toFixed(2)}°N` : "";
  const coordinateFull = gpsText ? `${cityName} (${gpsText})` : cityName;

  // Deduplicate all available photos for this memory
  const allPhotos = Array.from(
    new Set([memory.image, ...(memory.photos ?? [])].filter(Boolean))
  );

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const activePhoto = allPhotos[activePhotoIndex] || memory.image;

  const handleExport = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isExporting) return;

    try {
      setIsExporting(true);
      await exportTicketAsImage({
        memory,
        photoUrl: activePhoto,
        cityName,
        city,
      });
    } catch (err) {
      console.error("Failed to export ticket:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const currentMood = memory.mood ? moodConfig[memory.mood] : null;

  // Title excerpt from memory text
  const titleExcerpt = memory.text
    ? memory.text.slice(0, 12).trim()
    : "两人的浪漫漫游记";

  return (
    <article
      className={`group relative flex flex-col md:flex-row overflow-hidden rounded-[16px] border border-[#D8DDD8]/80 bg-[#FFFDF9] transition duration-300 ${
        isCinemaMode
          ? "w-full max-w-[880px] shadow-[0_22px_60px_rgba(90,102,112,0.18)] ring-1 ring-[#F5DCE0]/60"
          : "shadow-[0_10px_28px_rgba(90,102,112,0.06)] hover:border-[#E8B8C2]/80 hover:shadow-[0_16px_36px_rgba(90,102,112,0.12)]"
      }`}
    >
      {/* ===================== 主券 (MAIN TICKET) ===================== */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-[#D8DDD8]/50 pb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5DCE0] text-[#D86F82]">
              <Film className="h-3 w-3" />
            </span>
            <span className="text-xs font-bold tracking-wider text-[#5A6670]/80 uppercase truncate">
              LOVE CINEMA
            </span>
            <span className="hidden sm:inline-block shrink-0 rounded-full bg-[#F5DCE0]/50 px-2 py-0.5 text-[10px] font-semibold text-[#D86F82]">
              第 1314 放映厅
            </span>
          </div>

          <div className="shrink-0 text-[10px] sm:text-[11px] font-mono font-medium text-[#5A6670]/50 tracking-wider whitespace-nowrap">
            NO. {memory.date ? memory.date.replace(/\./g, "") : "520"}-
            {memory.id.slice(0, 4).toUpperCase()}
          </div>
        </div>

        {/* Center Content: Poster + Movie Details */}
        <div
          className={`mt-3.5 flex flex-col sm:flex-row gap-4 min-w-0 ${
            isCinemaMode ? "sm:gap-6" : ""
          }`}
        >
          {/* Movie Poster Frame */}
          <div
            className={`shrink-0 flex flex-col items-center ${
              isCinemaMode
                ? "w-full sm:w-[200px]"
                : "w-full sm:w-[130px] md:w-[140px]"
            }`}
          >
            <div
              className={`group/poster relative w-full cursor-pointer overflow-hidden rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7] shadow-inner ${
                isCinemaMode
                  ? "aspect-[3/4]"
                  : "aspect-[3/4] max-h-[190px] sm:max-h-none"
              }`}
              onClick={() => onPhotoClick?.(activePhoto, allPhotos, cityName)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onPhotoClick?.(activePhoto, allPhotos, cityName);
              }}
            >
              {isBrowserImageUrl(activePhoto) ? (
                <LocalPrivacyImg
                  src={activePhoto}
                  alt={`${cityName} 电影剧照`}
                  className="h-full w-full object-cover transition duration-300 group-hover/poster:scale-105"
                />
              ) : (
                <LocalPrivacyImage
                  src={activePhoto}
                  alt={`${cityName} 电影剧照`}
                  fill
                  className="object-cover transition duration-300 group-hover/poster:scale-105"
                  sizes="(min-width: 1024px) 180px, 80vw"
                />
              )}

              {/* Hover overlay hint */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 backdrop-blur-[2px] transition duration-200 group-hover/poster:opacity-100">
                <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#5A6670] shadow-md">
                  <Maximize2 className="h-3 w-3 text-[#D86F82]" />
                  大图
                </span>
              </div>

              {/* Photo count badge */}
              {allPhotos.length > 1 && (
                <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                  {activePhotoIndex + 1}/{allPhotos.length}
                </div>
              )}
            </div>

            {/* Thumbnail mini strip if multiple photos */}
            {allPhotos.length > 1 && (
              <div className="mt-2 flex w-full gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                {allPhotos.map((photo, idx) => (
                  <button
                    key={photo + idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-[3px] border transition ${
                      activePhotoIndex === idx
                        ? "border-[#D86F82] ring-1 ring-[#F5DCE0]"
                        : "border-[#D8DDD8] opacity-60 hover:opacity-100"
                    }`}
                  >
                    {isBrowserImageUrl(photo) ? (
                      <LocalPrivacyImg
                        src={photo}
                        alt="缩略图"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <LocalPrivacyImage
                        src={photo}
                        alt="缩略图"
                        fill
                        className="object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Movie Metadata & Dialogue */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              {/* Title & City */}
              <h3
                className="text-base sm:text-lg font-bold tracking-tight text-[#3F4951] truncate"
                title={`《 ${cityName} · ${titleExcerpt} 》`}
              >
                《 {cityName} · {titleExcerpt} 》
              </h3>

              {/* GPS Coordinate Subtitle */}
              <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#D86F82]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {gpsText ? `GPS: ${gpsText}` : `CITY: ${cityName}`} · EXCLUSIVE
                </span>
              </div>

              {/* Details Box - Space-safe responsive rows */}
              <div className="mt-2.5 rounded-[8px] bg-[#FAF8F2] p-2.5 text-xs border border-[#EBEBE6] space-y-1.5">
                {/* 放映时间 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-[#5A6670]/60 whitespace-nowrap">
                      📅 放映时间:
                    </span>
                    <span className="font-semibold text-[#5A6670] whitespace-nowrap">
                      {memory.date || "未标注"}
                    </span>
                  </div>
                  {currentMood && (
                    <span className="shrink-0 rounded bg-[#F5DCE0]/60 px-1.5 py-0.5 text-[10px] font-semibold text-[#D86F82]">
                      {currentMood.emoji} {currentMood.label}
                    </span>
                  )}
                </div>

                {/* 城市打卡坐标 */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-[#5A6670]/60 whitespace-nowrap">
                    📍 打卡坐标:
                  </span>
                  <span
                    className="font-semibold text-[#5A6670] truncate"
                    title={coordinateFull}
                  >
                    {coordinateFull}
                  </span>
                </div>

                {/* 专属席位 */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#5A6670]/70 pt-1 border-t border-[#EBEBE6]/60">
                  <span className="truncate">心动双人放映厅</span>
                  <span className="font-semibold shrink-0 text-[#D86F82]">
                    情侣VIP · 05排20号
                  </span>
                </div>
              </div>

              {/* Dialogue / Lines */}
              <div className="relative mt-2 rounded-[8px] border border-[#F0ECE1] bg-[#FCF9F2] p-2">
                <span className="text-[10px] font-semibold text-[#D86F82]">
                  台词与剧情简介：
                </span>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#5A6670]">
                  “{memory.text || "我们在这一站留下了专属足迹，回忆如电影般放映。"}”
                </p>
              </div>
            </div>

            {/* Bottom Mood Stamp */}
            <div className="mt-2.5 flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#5A6670]/40 tracking-wider">
                CINEMA ARCHIVE
              </span>

              {/* Vintage Ink Stamp */}
              <div className="rotate-[-6deg] select-none rounded-[6px] border-2 border-dashed border-[#D86F82]/80 bg-[#FFF5F6] px-2 py-0.5 shadow-xs">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#D86F82]">
                  <Sparkles className="h-3 w-3" />
                  <span>{currentMood ? currentMood.label : "浪漫上映"} · 独家珍藏</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 分割撕票线 (PERFORATION DIVIDER) ===================== */}
      {/* Desktop Vertical Perforation */}
      <div className="relative hidden md:flex w-0 flex-col items-center justify-between py-2">
        {/* Top Notch Cutout */}
        <div className="absolute -top-3.5 h-7 w-7 rounded-full border-b border-[#D8DDD8] bg-[#FAFBF7] shadow-inner" />
        {/* Vertical Dashed Line */}
        <div className="h-full border-r-2 border-dashed border-[#D8DDD8]/80" />
        {/* Bottom Notch Cutout */}
        <div className="absolute -bottom-3.5 h-7 w-7 rounded-full border-t border-[#D8DDD8] bg-[#FAFBF7] shadow-inner" />
      </div>

      {/* Mobile Horizontal Perforation */}
      <div className="relative flex md:hidden h-0 items-center justify-between px-2">
        {/* Left Notch Cutout */}
        <div className="absolute -left-3.5 h-7 w-7 rounded-full border-r border-[#D8DDD8] bg-[#FAFBF7] shadow-inner" />
        {/* Horizontal Dashed Line */}
        <div className="w-full border-t-2 border-dashed border-[#D8DDD8]/80" />
        {/* Right Notch Cutout */}
        <div className="absolute -right-3.5 h-7 w-7 rounded-full border-l border-[#D8DDD8] bg-[#FAFBF7] shadow-inner" />
      </div>

      {/* ===================== 副券 (STUB SECTION) ===================== */}
      <div className="flex flex-col justify-between border-t border-[#D8DDD8]/40 bg-[#FAF7F0] p-4 md:w-[150px] md:border-t-0 md:border-l md:border-[#D8DDD8]/40 shrink-0">
        <div>
          <div className="flex items-center justify-between md:flex-col md:items-start">
            <span className="text-[10px] font-bold tracking-wider text-[#D86F82] uppercase">
              ADMIT TWO · 双人
            </span>
            <span className="text-xs font-semibold text-[#5A6670]/80 truncate max-w-[90px]">
              {cityName}
            </span>
          </div>

          <div className="mt-2.5 space-y-1 text-[11px] text-[#5A6670]/70">
            <p className="truncate">
              <span className="text-[#5A6670]/50">日期:</span> {memory.date}
            </p>
            <p className="truncate">
              <span className="text-[#5A6670]/50">影厅:</span> 甜蜜放映厅
            </p>
            <p className="truncate">
              <span className="text-[#5A6670]/50">席位:</span> VIP二人席
            </p>
          </div>

          <div className="mt-2.5 rounded-[5px] border border-[#EADFCF] bg-[#FFFDF9] px-2 py-1 text-center">
            <span className="text-[10px] font-bold tracking-wider text-[#D86F82]">
              PRICE: 无价
            </span>
          </div>

          {/* Barcode Simulation */}
          <div className="mt-2.5">
            <div className="flex h-8 w-full items-stretch justify-center gap-[1.5px] bg-white px-1.5 py-1 border border-[#E6E6DF] rounded-[3px]">
              {Array.from({ length: 24 }).map((_, i) => {
                const isThick = (i * 7 + 3) % 4 === 0;
                const isMedium = (i * 3 + 1) % 3 === 0;
                return (
                  <span
                    key={i}
                    className={`bg-[#3F4951] ${
                      isThick ? "w-[2.5px]" : isMedium ? "w-[1.5px]" : "w-[1px]"
                    }`}
                  />
                );
              })}
            </div>
            <p className="mt-1 text-center font-mono text-[9px] text-[#5A6670]/50 tracking-wider">
              5201314 · {memory.date ? memory.date.slice(0, 4) : "2026"}
            </p>
          </div>
        </div>

        {/* Action Buttons on Stub */}
        <div className="mt-3 flex flex-row md:flex-col gap-1.5 pt-2 border-t border-[#D8DDD8]/50">
          {city && (
            <Link
              href={`/province/${city.provinceId}?city=${memory.cityId}`}
              className="flex flex-1 items-center justify-center gap-1 rounded-[6px] border border-[#D8DDD8] bg-white px-2 py-1 text-[11px] font-semibold text-[#5A6670] transition hover:border-[#D86F82] hover:text-[#D86F82]"
            >
              <MapPin className="h-3 w-3" />
              定位
            </Link>
          )}

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex flex-1 items-center justify-center gap-1 rounded-[6px] border border-[#F5DCE0] bg-[#F5DCE0]/40 px-2 py-1 text-[11px] font-semibold text-[#D86F82] transition hover:bg-[#F5DCE0] disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {isExporting ? "导出中" : "保存票根"}
          </button>
        </div>
      </div>
    </article>
  );
}
