"use client";

import { useState } from "react";
import Image from "next/image";
import ChinaMap, { SouthChinaSeaInset } from "@/components/ChinaMap";
import BackToLoginButton from "@/components/BackToLoginButton";
import { LegendProgress, ProgressBadge, StatsPanel } from "@/components/HomeProgress";
import RandomPhotoCard from "@/components/RandomPhotoCard";
import { MobileBottomNav } from "@/components/MobileBottomNav";

function BrandMark() {
  return (
    <svg className="h-11 w-11 pixelated" viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M5 3h4v2h2V3h4v2h2v6h-2v2h-2v2h-2v2H9v-2H7v-2H5v-2H3V5h2z"
        fill="#F5DCE0"
      />
      <path
        d="M5 3h4v2H5v6H3V5h2zm10 0v2h2v6h-2V5h-4V3zm0 8v2h-2v2h-2v2H9v-2H7v-2H5v-2h2v2h2v2h2v-2h2v-2z"
        fill="#E8B8C2"
      />
      <path d="M7 5h2v2H7zm8 2h-2V5h2z" fill="#FAFBF7" />
    </svg>
  );
}

function Cloud({
  src,
  className,
}: Readonly<{
  src: string;
  className: string;
}>) {
  return (
    <Image
      className={`pointer-events-none absolute pixelated opacity-24 ${className}`}
      src={src}
      alt=""
      width={132}
      height={54}
      priority
      unoptimized
    />
  );
}

function PixelSparkle({ className }: Readonly<{ className: string }>) {
  return (
    <span
      className={`pointer-events-none absolute h-4 w-4 opacity-75 ${className}`}
      aria-hidden="true"
    >
      <span className="absolute left-1.5 top-0 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute left-1.5 bottom-0 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute left-0 top-1.5 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute right-0 top-1.5 h-1.5 w-1.5 bg-[#D4E8D0]" />
    </span>
  );
}

function Legend() {
  return (
    <div className="space-y-5">

      <LegendProgress />
    </div>
  );
}

export default function MapPage() {
  const [mobileTab, setMobileTab] = useState<"map" | "stats">("map");

  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#FAFBF7] text-[#5A6670]">
      <div className="map-mist-band" aria-hidden="true" />
      <Cloud src="/sprites/decorations/cloud-medium.png" className="left-[18%] top-[12%] w-28" />
      <Cloud src="/sprites/decorations/cloud-large.png" className="left-[43%] top-[11%] w-36" />
      <Cloud src="/sprites/decorations/cloud-small.png" className="left-[7%] top-[61%] w-24" />
      <Cloud src="/sprites/decorations/cloud-small.png" className="right-[25%] top-[55%] w-24" />
      <Cloud src="/sprites/decorations/cloud-medium.png" className="bottom-[8%] right-[28%] w-24" />
      <PixelSparkle className="left-[7%] top-[22%]" />
      <PixelSparkle className="left-[19%] bottom-[16%]" />
      <PixelSparkle className="right-[24%] top-[42%]" />
      <span className="absolute left-[28%] bottom-[7%] h-2 w-2 bg-[#D4E8D0]" aria-hidden="true" />
      <span className="absolute right-[11%] top-[19%] h-2 w-2 bg-[#D6E8F0]" aria-hidden="true" />

      <div className="relative z-10 flex flex-col lg:flex-row h-full">
        {/* Main Map View */}
        <section
          className={`relative min-w-0 flex-1 flex-col overflow-hidden px-3 pt-3 pb-16 sm:px-9 sm:py-6 lg:pb-6 shrink-0 h-full ${
            mobileTab === "map" ? "flex" : "hidden lg:flex"
          }`}
        >
          <header className="flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-4">
              <BrandMark />
              <div>
                <h1 className="text-xl sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[#5A6670] whitespace-nowrap">
                  Map For Love
                </h1>
              </div>
              <ProgressBadge />
            </div>
            <div className="flex items-center gap-2">
              <BackToLoginButton />
            </div>
          </header>

          {/* Mobile Segmented Toggle */}
          <div className="my-2 flex shrink-0 items-center justify-center p-0.5 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/90 shadow-xs lg:hidden max-w-[220px] self-center">
            <button
              type="button"
              onClick={() => setMobileTab("map")}
              className={`flex-1 py-1 px-3 text-xs font-semibold rounded-full transition ${
                mobileTab === "map"
                  ? "bg-[#D86F82] text-white shadow-xs"
                  : "text-[#5A6670]/60 hover:text-[#5A6670]"
              }`}
            >
              🗺️ 探索地图
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("stats")}
              className={`flex-1 py-1 px-3 text-xs font-semibold rounded-full transition ${
                mobileTab === "stats"
                  ? "bg-[#D86F82] text-white shadow-xs"
                  : "text-[#5A6670]/60 hover:text-[#5A6670]"
              }`}
            >
              📊 沿途数据
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center pt-0 pb-2 sm:pb-6">
            <ChinaMap className="w-[min(100%,1100px)] max-w-[1100px] h-full" width={1100} height={860} />
          </div>

          <RandomPhotoCard />

          <SouthChinaSeaInset />

          <div className="absolute bottom-16 left-3 z-20 sm:bottom-7 sm:left-9 xl:left-6">
            <Legend />
          </div>
        </section>

        {/* Mobile Stats Panel View */}
        <div
          className={`flex-col flex-1 overflow-y-auto px-4 pt-3 pb-24 h-full ${
            mobileTab === "stats" ? "flex lg:hidden" : "hidden"
          }`}
        >
          {/* Mobile Segmented Toggle Header in Stats View */}
          <div className="mb-3 flex shrink-0 items-center justify-center p-0.5 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/90 shadow-xs max-w-[220px] self-center">
            <button
              type="button"
              onClick={() => setMobileTab("map")}
              className={`flex-1 py-1 px-3 text-xs font-semibold rounded-full transition ${
                mobileTab === "map"
                  ? "bg-[#D86F82] text-white shadow-xs"
                  : "text-[#5A6670]/60 hover:text-[#5A6670]"
              }`}
            >
              🗺️ 探索地图
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("stats")}
              className={`flex-1 py-1 px-3 text-xs font-semibold rounded-full transition ${
                mobileTab === "stats"
                  ? "bg-[#D86F82] text-white shadow-xs"
                  : "text-[#5A6670]/60 hover:text-[#5A6670]"
              }`}
            >
              📊 沿途数据
            </button>
          </div>
          <StatsPanel>{null}</StatsPanel>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:h-full lg:w-[310px] shrink-0">
          <StatsPanel>{null}</StatsPanel>
        </div>
      </div>
      <MobileBottomNav />
    </main>
  );
}
