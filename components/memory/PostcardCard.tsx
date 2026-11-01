"use client";

import { useState } from "react";
import {
  Download,
  Heart,
  MapPin,
  Maximize2,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { type Memory, moodConfig } from "@/data/memories";
import { type City } from "@/data/cities";
import { LocalPrivacyImg, LocalPrivacyImage } from "@/components/LocalPrivacyImage";

const isBrowserImageUrl = (url: string) =>
  url.startsWith("data:image/") || url.startsWith("https://") || url.startsWith("blob:");

export default function PostcardCard({
  memory,
  city,
  onPhotoClick,
}: {
  memory: Memory;
  city?: City;
  onPhotoClick?: (photo: string) => void;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const cityName = city?.name || memory.city || "城市回忆";
  const currentMood = memory.mood ? moodConfig[memory.mood] : null;

  // Format date tokens
  const dateStr = memory.date || "2026.05.20";
  const dateTokens = dateStr.split(".");
  const year = dateTokens[0] || "2026";
  const month = dateTokens[1] || "05";
  const day = dateTokens[2] || "20";

  return (
    <div
      className="group relative w-full h-[390px] sm:h-[420px] [perspective:1200px]"
      tabIndex={0}
      role="region"
      aria-label={`${cityName} 城市明信片`}
    >
      {/* 3D Flipping Card Container */}
      <div
        className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] cursor-pointer ${
          isFlipped ? "[transform:rotateY(180deg)]" : ""
        }`}
        onClick={() => setIsFlipped((f) => !f)}
      >
        {/* ===================== 正面 (FRONT SIDE) ===================== */}
        <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-[16px] border border-[#D8DDD8]/80 bg-[#FAF7F0] p-3 sm:p-4 shadow-[0_12px_30px_rgba(90,102,112,0.08)] flex flex-col justify-between overflow-hidden">
          {/* Top Stamp & Postmark Area */}
          <div className="relative flex items-start justify-between pb-2 border-b border-[#D8DDD8]/50 shrink-0">
            {/* Vintage Postcard Title */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-black tracking-widest text-[#3F4951] text-xs uppercase">
                  POST CARD
                </span>
                <span className="text-[10px] text-[#D86F82] font-semibold">
                  · 城市记忆专递
                </span>
              </div>
              <p className="text-[10px] text-[#5A6670]/50 font-mono">
                AIR MAIL · 《{cityName}篇》
              </p>
            </div>

            {/* Serrated Postage Stamp & Dated Postmark */}
            <div className="relative flex items-center">
              {/* Dual-ring Postmark (Overlaps stamp) */}
              <div className="absolute -left-12 -top-1 pointer-events-none rotate-[-12deg] select-none z-20">
                <div className="relative flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 border-dashed border-[#D86F82]/80 bg-white/40 backdrop-blur-xs p-1 text-center shadow-xs">
                  <span className="text-[7px] font-bold text-[#D86F82] uppercase tracking-tighter">
                    LOVE POST · 爱情邮局
                  </span>
                  <div className="w-full border-t border-[#D86F82]/50 my-0.5" />
                  <span className="text-[9px] font-bold font-mono text-[#D86F82] leading-none">
                    {year}.{month}.{day}
                  </span>
                  <div className="w-full border-t border-[#D86F82]/50 my-0.5" />
                  <span className="text-[8px] font-semibold text-[#D86F82]">
                    {cityName}
                  </span>
                </div>
              </div>

              {/* Physical Postage Stamp */}
              <div className="relative w-12 h-14 bg-white p-1 rounded-[2px] shadow-sm border border-dashed border-[#D8DDD8] flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between text-[7px] font-bold text-[#D86F82]">
                  <span>中国邮政</span>
                  <span>520分</span>
                </div>
                <div className="relative flex-1 w-full bg-[#FAF0F2] rounded-[2px] overflow-hidden my-0.5 flex items-center justify-center">
                  <Heart className="h-4 w-4 fill-[#F5DCE0] text-[#E8B8C2]" />
                </div>
                <div className="text-[6px] text-[#5A6670]/60 text-center font-mono tracking-tighter">
                  CHINA POST
                </div>
              </div>
            </div>
          </div>

          {/* Photo Frame in the Center */}
          <div className="relative flex-1 w-full my-2 overflow-hidden rounded-[8px] border border-[#D8DDD8] bg-white p-1.5 shadow-inner">
            <div className="relative w-full h-full overflow-hidden rounded-[5px] bg-[#FAF8F2]">
              {isBrowserImageUrl(memory.image) ? (
                <LocalPrivacyImg
                  src={memory.image}
                  alt={cityName}
                  className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                />
              ) : (
                <LocalPrivacyImage
                  src={memory.image}
                  alt={cityName}
                  fill
                  className="object-cover object-center transition duration-500 group-hover:scale-105"
                />
              )}

              {/* View Big Photo Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoClick?.(memory.image);
                }}
                className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition backdrop-blur-xs"
                title="放大照片"
              >
                <Maximize2 className="h-3 w-3" />
              </button>

              {/* City Name Stamp on Photo */}
              <div className="absolute bottom-2 left-2 rounded-[4px] bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                📍 {cityName}
              </div>
            </div>
          </div>

          {/* Bottom Flip Hint Bar */}
          <div className="flex items-center justify-between text-[11px] text-[#5A6670]/70 pt-1.5 pb-0.5 shrink-0">
            <span className="truncate max-w-[200px] italic font-serif">
              “{memory.text.slice(0, 15) || "寄存在岁月里的相遇"}...”
            </span>

            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#D86F82] shrink-0 hover:underline">
              <RotateCw className="h-3 w-3" />
              点击翻转读寄语
            </span>
          </div>
        </div>

        {/* ===================== 背面 (BACK SIDE - 3D FLIPPED 180 DEG) ===================== */}
        <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-[16px] border border-[#D8DDD8]/80 bg-[#FAF7F0] p-4 sm:p-5 shadow-[0_12px_30px_rgba(90,102,112,0.08)] flex flex-col justify-between overflow-hidden">
          {/* Airmail header */}
          <div className="flex items-center justify-between border-b border-[#D8DDD8]/50 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-serif font-black tracking-widest text-[#3F4951] text-xs uppercase">
                CARTE POSTALE
              </span>
              <span className="text-[10px] text-[#5A6670]/40">· 私人明信片</span>
            </div>

            {/* Postal code boxes */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {["5", "2", "0", "1", "3", "1", "4"].map((num, i) => (
                <span
                  key={i}
                  className="w-3.5 h-4.5 sm:w-4 sm:h-5 border border-[#D86F82]/80 rounded-[2px] flex items-center justify-center font-mono font-bold text-[9px] sm:text-[10px] text-[#D86F82] bg-white"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>

          {/* Postcard Body: Left Message + Right Address Lines */}
          <div className="relative flex-1 grid grid-cols-[1fr_1px_1fr] gap-3 my-3">
            {/* Left: Message text in ruled stationery lines */}
            <div className="flex flex-col justify-between pr-1">
              <div>
                <p className="text-xs font-bold text-[#3F4951]">亲爱的：</p>
                <p className="mt-2 text-xs leading-relaxed text-[#5A6670] font-serif italic">
                  “{memory.text || "我们在这一站看过的风景，我都悄悄替你存好了。"}”
                </p>
              </div>

              <div className="mt-2 text-[10px] text-[#5A6670]/60 space-y-0.5">
                <p>寄出日期：{memory.date || "美好时光"}</p>
                {currentMood && (
                  <p className="text-[#D86F82] font-semibold">
                    心情邮戳：{currentMood.emoji} {currentMood.label}
                  </p>
                )}
              </div>
            </div>

            {/* Center Vertical Divider Line */}
            <div className="h-full border-r border-dashed border-[#D8DDD8]" />

            {/* Right: Address & Stamp Box */}
            <div className="flex flex-col justify-between pl-1">
              {/* Postal Address Lines */}
              <div className="space-y-3 pt-2">
                <div className="border-b border-[#D8DDD8] pb-1 text-[11px] text-[#5A6670]">
                  <span className="text-[#5A6670]/40 text-[9px] mr-1">收件：</span>
                  <span className="font-bold text-[#3F4951]">
                    世界上最心爱的你 (收)
                  </span>
                </div>
                <div className="border-b border-[#D8DDD8] pb-1 text-[11px] text-[#5A6670]">
                  <span className="text-[#5A6670]/40 text-[9px] mr-1">地址：</span>
                  <span className="text-xs font-serif">
                    幸福路 520 号 · 我们的未来
                  </span>
                </div>
                <div className="border-b border-[#D8DDD8] pb-1 text-[11px] text-[#5A6670]">
                  <span className="text-[#5A6670]/40 text-[9px] mr-1">寄自：</span>
                  <span className="text-xs font-semibold text-[#D86F82]">
                    中国 · {cityName}
                  </span>
                </div>
              </div>

              {/* Red Wax Seal */}
              <div className="flex items-center justify-end">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#C24153] shadow-md border-2 border-[#A83243] text-white">
                  <span className="font-serif font-black text-[9px] tracking-tighter">
                    LOVE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Flip Back Button */}
          <div className="flex items-center justify-between border-t border-[#D8DDD8]/50 pt-1.5 pb-0.5 text-[10px] text-[#5A6670]/60 shrink-0">
            <span>MAP FOR LOVE POSTAL ARCHIVE</span>
            <span className="flex items-center gap-1 font-semibold text-[#D86F82] hover:underline">
              <RotateCw className="h-3 w-3" />
              翻回正面
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
