"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Camera, LockKeyhole, MapPinned, Minus, MousePointer2, Plus, RotateCcw } from "lucide-react";
import { chinaFeatures, makePath, makeProjection, provinceIdOf } from "@/lib/geo";
import { cities } from "@/data/cities";
import { getLitCityIds, getLitProvinceIds, type LocalMemoryStore } from "@/data/progress";
import { provinces } from "@/data/provinces";

const colors = {
  cream: "#FAFBF7",
  dim: "#D8DDD8",
  ink: "#5A6670",
  sakura: "#F5DCE0",
  bloom: "#E8B8C2",
  sky: "#A8C8DC",
  mint: "#D4E8D0",
};

const demoMemories: LocalMemoryStore = {
  zhengzhou: [
    {
      id: "demo-zhengzhou",
      cityId: "zhengzhou",
      city: "郑州",
      cityEn: "Zhengzhou",
      date: "2025.12.23",
      image: "",
      photos: [],
      text: "第一次把这座城点亮，路线从这里开始。",
    },
  ],
  hangzhou: [
    {
      id: "demo-hangzhou",
      cityId: "hangzhou",
      city: "杭州",
      cityEn: "Hangzhou",
      date: "2026.03.18",
      image: "",
      photos: [],
      text: "湖边、晚风和一条可以放进地图的路线。",
    },
  ],
  shanghai: [
    {
      id: "demo-shanghai",
      cityId: "shanghai",
      city: "上海",
      cityEn: "Shanghai",
      date: "2026.04.05",
      image: "",
      photos: [],
      text: "夜景亮起来的时候，地图也多了一枚小小的光。",
    },
  ],
  hongkong: [
    {
      id: "demo-hongkong",
      cityId: "hongkong",
      city: "香港",
      cityEn: "Hong Kong",
      date: "2026.05.02",
      image: "",
      photos: [],
      text: "录屏时可以展示日期和城市回忆如何联动。",
    },
  ],
};

const featuredCityIds = ["zhengzhou", "hangzhou", "shanghai", "hongkong"] as const;
const provinceById = new Map(provinces.map((province) => [province.id, province]));
const maxZoom = 1.45;
const minZoom = 1;

const stableCoordinate = (value: number) => Number(value.toFixed(3));

function DemoPhotoPlaceholder({ city }: Readonly<{ city?: string }>) {
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[#D6E8F0]/34">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(250,251,247,.72) 1px, transparent 1px), linear-gradient(0deg, rgba(250,251,247,.72) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
        aria-hidden="true"
      />
      <div className="relative grid h-16 w-16 place-items-center rounded-[8px] border border-[#D8DDD8]/90 bg-[#FAFBF7]/72 text-[#A8C8DC] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <Camera className="h-7 w-7" />
      </div>
      <p className="absolute bottom-3 text-xs font-semibold text-[#5A6670]/45">
        {city ? `${city} 演示占位` : "演示占位"}
      </p>
    </div>
  );
}

function DemoMap({
  selectedProvinceId,
  onSelectProvince,
}: Readonly<{
  selectedProvinceId: string;
  onSelectProvince: (provinceId: string) => void;
}>) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const width = 1100;
  const height = 860;
  const litProvinceIds = useMemo(() => getLitProvinceIds(getLitCityIds(demoMemories)), []);

  const paths = useMemo(() => {
    const projection = makeProjection(width, height, 24);
    const path = makePath(projection);

    return chinaFeatures.map((feature) => {
      const id = provinceIdOf(feature);
      const [cx, cy] = path.centroid(feature as never);

      return {
        id,
        d: path(feature as never) ?? "",
        x: stableCoordinate(cx),
        y: stableCoordinate(cy),
        province: provinceById.get(id),
        lit: litProvinceIds.has(id),
      };
    });
  }, [litProvinceIds]);

  const hoveredPath = paths.find((path) => path.id === hoveredId);
  const zoomProgress = ((zoom - minZoom) / (maxZoom - minZoom)) * 100;
  const setClampedZoom = (nextZoom: number) => {
    setZoom(Math.min(Math.max(nextZoom, minZoom), maxZoom));
  };

  return (
    <motion.div
      className="relative w-[min(100%,1060px)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-[#D8DDD8]/85 bg-[#FAFBF7]/84 px-2 py-3 shadow-[0_12px_28px_rgba(90,102,112,0.1)] backdrop-blur">
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#D6E8F0]/42 disabled:opacity-35"
          type="button"
          onClick={() => setClampedZoom(zoom + 0.15)}
          disabled={zoom >= maxZoom}
          aria-label="放大演示地图"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="flex min-h-28 w-9 flex-col items-center justify-center gap-2">
          <input
            className="map-zoom-slider"
            type="range"
            min={minZoom}
            max={maxZoom}
            step="0.01"
            value={zoom}
            onChange={(event) => setClampedZoom(Number(event.target.value))}
            aria-label="拖动缩放演示地图"
            style={{ "--zoom-progress": `${zoomProgress}%` } as CSSProperties}
          />
          <span className="text-[10px] font-semibold leading-none text-[#5A6670]/58">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#F5DCE0]/55 disabled:opacity-35"
          type="button"
          onClick={() => setClampedZoom(zoom - 0.15)}
          disabled={zoom <= minZoom}
          aria-label="缩小演示地图"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#D4E8D0]/48 disabled:opacity-35"
          type="button"
          onClick={() => setZoom(1)}
          disabled={zoom === 1}
          aria-label="重置演示地图缩放"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <motion.div
        className="map-visual-scale relative h-full w-full overflow-visible"
        animate={{ scale: zoom }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        style={{ transformOrigin: "55% 58%" }}
      >
        <svg
          className="h-full w-full overflow-visible drop-shadow-[0_16px_26px_rgba(168,200,220,0.18)]"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="只读演示中国地图"
        >
          <defs>
            <filter id="demoVisitedGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor={colors.bloom} floodOpacity="0.42" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id="demoSoftPixelTexture" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 0h2v2H0z" fill={colors.cream} opacity="0.26" />
              <path d="M5 5h1.5v1.5H5z" fill={colors.sky} opacity="0.08" />
            </pattern>
          </defs>

          <g shapeRendering="geometricPrecision">
            {paths.map((path) => (
              <path
                key={`${path.id}-glow`}
                d={path.d}
                fill="none"
                stroke={path.lit ? colors.bloom : "transparent"}
                strokeWidth={path.lit ? 10 : 0}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={path.lit ? 0.18 : 0}
                filter={path.lit ? "url(#demoVisitedGlow)" : undefined}
                pointerEvents="none"
              />
            ))}

            {paths.map((path) => {
              const isHovered = hoveredId === path.id;
              const isSelected = selectedProvinceId === path.id;

              return (
                <path
                  key={path.id}
                  d={path.d}
                  fill={path.lit ? colors.sakura : colors.dim}
                  fillOpacity={path.lit ? 0.72 : 0.34}
                  stroke={isSelected ? colors.ink : path.lit ? colors.bloom : colors.ink}
                  strokeOpacity={isSelected ? 0.78 : path.lit ? 0.95 : 0.24}
                  strokeWidth={isSelected ? 3 : path.lit ? 2.2 : 1.25}
                  strokeLinejoin="round"
                  className="cursor-pointer transition-all duration-300"
                  filter={path.lit || isHovered || isSelected ? "url(#demoVisitedGlow)" : undefined}
                  onMouseEnter={() => setHoveredId(path.id)}
                  onMouseLeave={() => setHoveredId((current) => (current === path.id ? null : current))}
                  onClick={() => onSelectProvince(path.id)}
                />
              );
            })}

            {paths.map((path) =>
              path.lit ? (
                <path
                  key={`${path.id}-inner`}
                  d={path.d}
                  fill="url(#demoSoftPixelTexture)"
                  stroke={colors.cream}
                  strokeOpacity="0.9"
                  strokeWidth="1"
                  pointerEvents="none"
                />
              ) : null,
            )}
          </g>
        </svg>

        {hoveredPath?.province && (
          <motion.div
            className="pointer-events-none absolute rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/90 px-3 py-2 text-sm text-[#5A6670] shadow-[0_10px_30px_rgba(90,102,112,0.12)] backdrop-blur"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              left: `${(hoveredPath.x / width) * 100}%`,
              top: `${(hoveredPath.y / height) * 100}%`,
              transform: "translate(14px, -50%)",
            }}
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-[#E8B8C2]" />
            {hoveredPath.province.name}
            <span className="ml-2 text-[#5A6670]/60">{hoveredPath.province.nameEn}</span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function DemoCityPanel({ selectedProvinceId }: Readonly<{ selectedProvinceId: string }>) {
  const selectedCities = featuredCityIds
    .map((cityId) => cities.find((city) => city.id === cityId))
    .filter((city): city is NonNullable<typeof city> => Boolean(city));
  const selectedProvince = provinceById.get(selectedProvinceId);

  return (
    <aside className="z-20 flex h-full w-full max-w-[360px] shrink-0 flex-col border-l border-[#D8DDD8]/70 bg-[#FAFBF7]/76 px-5 py-6 shadow-[-18px_0_44px_rgba(90,102,112,0.07)] backdrop-blur-xl max-lg:hidden">
      <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-white/36 p-4 shadow-[0_14px_32px_rgba(90,102,112,0.08)]">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#5A6670]/60">
          <LockKeyhole className="h-4 w-4 text-[#A8C8DC]" />
          只读演示
        </div>
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#5A6670]">
          {selectedProvince?.name ?? "演示地图"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5A6670]/62">
          使用静态样例数据展示点亮和城市记录，适合录制讲解流程。
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["4", "演示城市"],
          ["0", "真实照片"],
          ["0", "数据写入"],
        ].map(([value, label]) => (
          <div
            className="rounded-[8px] border border-[#D8DDD8]/75 bg-white/34 px-3 py-3 text-center shadow-[0_10px_24px_rgba(90,102,112,0.06)]"
            key={label}
          >
            <p className="text-xl font-semibold text-[#5A6670]">{value}</p>
            <p className="mt-1 text-[11px] font-medium text-[#5A6670]/50">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {selectedCities.map((city) => {
          const memory = demoMemories[city.id]?.[0];
          if (!memory) return null;

          return (
            <article
              className="overflow-hidden rounded-[8px] border border-[#D8DDD8]/80 bg-white/38 shadow-[0_14px_32px_rgba(90,102,112,0.08)]"
              key={city.id}
            >
              <div className="relative aspect-[16/10] bg-[#D6E8F0]/36">
                <DemoPhotoPlaceholder city={memory.city} />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-[#5A6670]">{memory.city}</p>
                  <span className="shrink-0 text-xs font-medium text-[#5A6670]/48">{memory.date}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5A6670]/60">{memory.text}</p>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function PixelSparkle({ className }: Readonly<{ className: string }>) {
  return (
    <span className={`pointer-events-none absolute h-4 w-4 opacity-75 ${className}`} aria-hidden="true">
      <span className="absolute left-1.5 top-0 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute left-1.5 bottom-0 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute left-0 top-1.5 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute right-0 top-1.5 h-1.5 w-1.5 bg-[#D4E8D0]" />
    </span>
  );
}

export default function DemoExperience() {
  const [selectedProvinceId, setSelectedProvinceId] = useState("henan");

  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#FAFBF7] text-[#5A6670]">
      <div className="map-mist-band" aria-hidden="true" />
      <Image
        className="pointer-events-none absolute left-[12%] top-[11%] w-28 opacity-24 pixelated"
        src="/sprites/decorations/cloud-medium.png"
        alt=""
        width={132}
        height={54}
        priority
        unoptimized
      />
      <Image
        className="pointer-events-none absolute right-[22%] top-[15%] w-36 opacity-24 pixelated"
        src="/sprites/decorations/cloud-large.png"
        alt=""
        width={160}
        height={64}
        priority
        unoptimized
      />
      <PixelSparkle className="left-[8%] top-[25%]" />
      <PixelSparkle className="right-[27%] top-[42%]" />
      <span className="absolute left-[28%] bottom-[7%] h-2 w-2 bg-[#D4E8D0]" aria-hidden="true" />
      <span className="absolute right-[11%] top-[19%] h-2 w-2 bg-[#D6E8F0]" aria-hidden="true" />

      <div className="relative z-10 flex h-full">
        <section className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden px-6 py-7 sm:px-9">
          <header className="flex items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#5A6670]/58">
                <MapPinned className="h-4 w-4 text-[#E8B8C2]" />
                Map For Everyone
              </div>
              <h1 className="mt-2 text-[30px] font-semibold leading-tight text-[#5A6670]">录屏演示页</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/76 px-4 py-2 text-sm font-semibold text-[#5A6670]/62 shadow-[0_10px_26px_rgba(90,102,112,0.08)] backdrop-blur">
              <LockKeyhole className="h-4 w-4 text-[#A8C8DC]" />
              不保存数据
            </div>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center pb-24 pt-0 lg:pb-4">
            <DemoMap selectedProvinceId={selectedProvinceId} onSelectProvince={setSelectedProvinceId} />
          </div>

          <div className="absolute bottom-7 left-6 flex max-w-[calc(100%-3rem)] flex-wrap items-center gap-3 sm:left-9">
            <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 px-4 py-3 text-sm text-[#5A6670]/72 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-[2px] border border-[#E8B8C2] bg-[#F5DCE0]" />
                <span>样例已点亮</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="h-4 w-4 rounded-[2px] border border-[#C8CEC8] bg-[#D8DDD8]/55" />
                <span>未点亮</span>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/72 px-4 py-3 text-sm font-medium text-[#5A6670]/62 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur sm:flex">
              <MousePointer2 className="h-4 w-4 text-[#A8C8DC]" />
              点击省份只切换画面状态
            </div>
          </div>

          <aside className="absolute bottom-[4.75rem] right-[2.5rem] z-30 hidden w-[248px] rotate-[-1.5deg] xl:block">
            <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/86 p-3 shadow-[0_22px_58px_rgba(90,102,112,0.15)] backdrop-blur-xl">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-[#F5DCE0] bg-[#F5DCE0]/62 text-[#E8B8C2]">
                  <Camera className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#5A6670]">演示相框</p>
                  <p className="truncate text-xs font-medium text-[#5A6670]/48">无真实照片，不连接存储</p>
                </div>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] border border-[#D8DDD8]/80 bg-[#D6E8F0]/45">
                <DemoPhotoPlaceholder />
              </div>
            </div>
          </aside>
        </section>

        <DemoCityPanel selectedProvinceId={selectedProvinceId} />
      </div>
    </main>
  );
}
