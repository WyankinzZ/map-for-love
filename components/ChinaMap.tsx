"use client";

import { useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { useRouter } from "next/navigation";
import { Minus, Plus, RotateCcw, Map as MapIcon, Minimize2, ZoomIn } from "lucide-react";
import {
  chinaFeatures,
  dashLineFeature,
  makePath,
  makeProjection,
  makeProjectionForFeature,
  provinceIdOf,
} from "@/lib/geo";
import {
  getLitCityIds,
  getLitProvinceIds,
  memoryStoreUpdatedEvent,
  type LocalMemoryStore,
} from "@/data/progress";
import { sortMemoriesByTime, moodConfig } from "@/data/memories";
import { getCitiesByProvince } from "@/data/cities";
import { provinces } from "@/data/provinces";
import TimelineOverlay, { TimelineToggle } from "@/components/TimelineOverlay";
import { fetchMemoriesDeduplicated } from "@/components/province/Shared";
import { readWishlist, WISHLIST_UPDATED_EVENT, type WishItem } from "@/components/memory/wishlistStore";
import { cities } from "@/data/cities";

interface ChinaMapProps {
  width?: number;
  height?: number;
  className?: string;
}

const colors = {
  cream: "#FAFBF7",
  dim: "#D8DDD8",
  ink: "#5A6670",
  sakura: "#F5DCE0",
  bloom: "#E8B8C2",
  sky: "#A8C8DC",
};

const provinceById = new Map(provinces.map((province) => [province.id, province]));
const easyTapProvinceIds = new Set(["hongkong", "macau"]);
const maxZoom = 8;
const minZoom = 1;
const stableCoordinate = (value: number) => Number(value.toFixed(3));

// The South China Sea ten-dash line, drawn as a small standalone inset box so it
// is always visible and never overlapped by floating cards on the main map.
export function SouthChinaSeaInset() {
  const [collapsed, setCollapsed] = useState(true);
  const inset = useMemo(() => {
    if (!dashLineFeature) return null;

    const insetWidth = 72;
    const insetHeight = 100;
    const projection = makeProjectionForFeature(dashLineFeature, insetWidth, insetHeight, 10);
    const path = makePath(projection);

    return { width: insetWidth, height: insetHeight, d: path(dashLineFeature as never) ?? "" };
  }, []);

  if (!inset || !inset.d) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      style={{ touchAction: "none" }}
      className={`absolute right-4 top-24 z-30 flex flex-col items-center gap-2 w-fit rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/82 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur cursor-grab active:cursor-grabbing ${collapsed ? 'p-2' : 'p-1'}`}
    >
      {collapsed ? (
        <button onClick={() => setCollapsed(false)} className="grid h-6 w-6 place-items-center text-[#5A6670]/60 transition hover:text-[#5A6670]" aria-label="展开南海诸岛">
          <MapIcon className="h-4 w-4" />
        </button>
      ) : (
        <div className="relative">
          <button onClick={() => setCollapsed(true)} className="absolute right-0 top-0 p-1 text-[#5A6670]/40 transition hover:text-[#5A6670]" aria-label="隐藏南海诸岛">
            <Minimize2 className="h-3 w-3" />
          </button>
          <svg
            width={inset.width}
            height={inset.height}
            viewBox={`0 0 ${inset.width} ${inset.height}`}
            role="img"
            aria-label="南海诸岛"
            className="mt-2"
          >
            <path
              d={inset.d}
              fill={colors.ink}
              fillOpacity="0.55"
              stroke={colors.ink}
              strokeOpacity="0.5"
              strokeWidth="0.8"
            />
            <text
              x={inset.width / 2}
              y={inset.height - 18}
              textAnchor="middle"
              fontSize="7"
              fontWeight="600"
              fill={colors.ink}
              fillOpacity="0.6"
            >
              南海诸岛十段线
            </text>
            <text
              x={inset.width / 2}
              y={inset.height - 5}
              textAnchor="middle"
              fontSize="5"
              fontWeight="500"
              fill={colors.ink}
              fillOpacity="0.4"
            >
              GS(2023)2767号
            </text>
          </svg>
        </div>
      )}
    </motion.div>
  );
}

export default function ChinaMap({ width = 1100, height = 860, className }: ChinaMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [zoomCollapsed, setZoomCollapsed] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [showTimeline, setShowTimeline] = useState(false);
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [hoveredWish, setHoveredWish] = useState<(WishItem & { x: number; y: number }) | null>(null);
  const [navigatingProvince, setNavigatingProvince] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const isContinuousZooming = useRef(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const router = useRouter();
  const pinchRef = useRef<{ dist: number }>({ dist: 0 });

  const resetMap = () => {
    isContinuousZooming.current = false;
    setZoom(1);
    animate(x, 0, { type: "spring", stiffness: 120, damping: 20 });
    animate(y, 0, { type: "spring", stiffness: 120, damping: 20 });
  };

  // Mouse wheel zoom towards pointer
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      isContinuousZooming.current = true;
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(() => {
        isContinuousZooming.current = false;
      }, 200);

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - (rect.left + rect.width / 2);
      const mouseY = e.clientY - (rect.top + rect.height / 2);

      setZoom((current) => {
        const next = Math.min(Math.max(current * factor, minZoom), maxZoom);
        const ratio = next / current;
        if (ratio !== 1) {
          const curX = x.get();
          const curY = y.get();
          x.set(mouseX - (mouseX - curX) * ratio);
          y.set(mouseY - (mouseY - curY) * ratio);
        }
        return Number(next.toFixed(3));
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    };
  }, [x, y]);

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

  // Prefetch all province detail pages on client mount so transitions are instantaneous
  useEffect(() => {
    for (const p of provinces) {
      router.prefetch(`/province/${p.id}`);
    }
  }, [router]);

  const litProvinceIds = useMemo(
    () => getLitProvinceIds(getLitCityIds(localMemories)),
    [localMemories],
  );

  const projection = useMemo(() => makeProjection(width, height, 24), [width, height]);

  useEffect(() => {
    setWishes(readWishlist());
    const handleWishUpdate = (e: Event) => {
      const detail = (e as CustomEvent<WishItem[]>).detail;
      setWishes(detail || readWishlist());
    };
    window.addEventListener(WISHLIST_UPDATED_EVENT, handleWishUpdate);
    return () => window.removeEventListener(WISHLIST_UPDATED_EVENT, handleWishUpdate);
  }, []);

  const wishPins = useMemo(() => {
    const litCities = getLitCityIds(localMemories);
    return wishes
      .filter((w) => !w.isFulfilled && !litCities.has(w.cityId))
      .map((w) => {
        const city = cities.find((c) => c.id === w.cityId);
        if (!city) return null;
        const projected = projection([city.lng, city.lat]);
        if (!projected) return null;
        return {
          ...w,
          x: Number(projected[0].toFixed(2)),
          y: Number(projected[1].toFixed(2)),
          city,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [wishes, localMemories, projection]);

  const timelinePointCount = useMemo(() => {
    const allMemories = Object.values(localMemories).flat();
    const seen = new Set<string>();
    let count = 0;
    const sorted = sortMemoriesByTime(allMemories);
    for (const m of sorted) {
      if (!seen.has(m.cityId)) {
        seen.add(m.cityId);
        count++;
      }
    }
    return count;
  }, [localMemories]);

  const paths = useMemo(() => {
    const path = makePath(projection);

    return chinaFeatures.map((feature) => {
      const id = provinceIdOf(feature);
      const [cx, cy] = path.centroid(feature as never);
      const isLit = litProvinceIds.has(id);
      let latestMoodInfo = undefined;

      if (isLit) {
        const provinceCities = getCitiesByProvince(id);
        const provinceMemories = provinceCities.flatMap(c => localMemories[c.id] || []);
        const sorted = sortMemoriesByTime(provinceMemories);
        const latestMood = sorted[0]?.mood;
        if (latestMood) latestMoodInfo = moodConfig[latestMood];
      }

      return {
        id,
        d: path(feature as never) ?? "",
        x: stableCoordinate(cx),
        y: stableCoordinate(cy),
        province: provinceById.get(id),
        lit: isLit,
        moodInfo: latestMoodInfo,
      };
    });
  }, [projection, litProvinceIds, localMemories]);

  const hoveredPath = paths.find((path) => path.id === hoveredId);
  const zoomProgress = ((zoom - minZoom) / (maxZoom - minZoom)) * 100;
  const setClampedZoom = (nextZoom: number) => {
    setZoom(Math.min(Math.max(nextZoom, minZoom), maxZoom));
  };

  const goProvince = (id: string) => {
    if (navigatingProvince) return;
    setNavigatingProvince(id);
    router.push(`/province/${id}`);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const initX = x.get();
      const initY = y.get();

      const onPointerMove = (ev: PointerEvent) => {
        x.set(initX + (ev.clientX - startX));
        y.set(initY + (ev.clientY - startY));
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }
  };

  return (
    <motion.div
      ref={mapContainerRef}
      className={`relative ${className ?? ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      style={{ aspectRatio: `${width} / ${height}`, touchAction: "none" }}
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          pinchRef.current.dist = dist;
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 2) {
          const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          const delta = dist / pinchRef.current.dist;
          pinchRef.current.dist = dist;
          setZoom((current) => Math.min(Math.max(current * delta, minZoom), maxZoom));
        }
      }}
    >
      <motion.div
        drag
        dragMomentum={false}
        style={{ touchAction: "none" }}
        className={`absolute left-3 top-24 h-fit z-20 flex flex-col items-center rounded-[24px] border border-[#D8DDD8]/85 bg-[#FAFBF7]/82 shadow-[0_12px_28px_rgba(90,102,112,0.1)] backdrop-blur sm:left-4 cursor-grab active:cursor-grabbing ${zoomCollapsed ? 'p-2' : 'px-2 py-3 gap-2'}`}
      >
        {zoomCollapsed ? (
          <button onClick={() => setZoomCollapsed(false)} className="grid h-6 w-6 place-items-center text-[#5A6670]/60 transition hover:text-[#5A6670]" aria-label="展开缩放控制">
            <ZoomIn className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              className="grid h-8 w-8 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#D6E8F0]/42 disabled:opacity-35"
              type="button"
              onClick={() => {
                isContinuousZooming.current = false;
                setZoom((z) => Math.min(z * 1.5, maxZoom));
              }}
              disabled={zoom >= maxZoom}
              aria-label="放大中国地图"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex min-h-16 w-8 flex-col items-center justify-center gap-1.5">
              <input
                className="map-zoom-slider"
                type="range"
                min={minZoom}
                max={maxZoom}
                step="0.01"
                value={zoom}
                onChange={(event) => {
                  isContinuousZooming.current = true;
                  if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
                  zoomTimeoutRef.current = setTimeout(() => {
                    isContinuousZooming.current = false;
                  }, 180);
                  setClampedZoom(Number(event.target.value));
                }}
                aria-label="拖动缩放中国地图"
                style={{ "--zoom-progress": `${zoomProgress}%` } as CSSProperties}
              />
            </div>
            <button
              className="grid h-8 w-8 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#F5DCE0]/55 disabled:opacity-35"
              type="button"
              onClick={() => {
                isContinuousZooming.current = false;
                setZoom((z) => Math.max(z / 1.5, minZoom));
              }}
              disabled={zoom <= minZoom}
              aria-label="缩小中国地图"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              className="mt-1 grid h-8 w-8 place-items-center rounded-full text-[#5A6670]/70 transition hover:bg-[#D8DDD8]/42 hover:text-[#5A6670]"
              type="button"
              onClick={resetMap}
              aria-label="重置中国地图"
              title="重置居中"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              className="mt-1 grid h-6 w-6 place-items-center rounded-full text-[#5A6670]/40 transition hover:text-[#5A6670]"
              type="button"
              onClick={() => setZoomCollapsed(true)}
              aria-label="隐藏缩放控制"
            >
              <Minimize2 className="h-3 w-3" />
            </button>
          </>
        )}
      </motion.div>

      <motion.div
        drag
        dragConstraints={{ 
          left: -width * Math.max(0.45, (zoom - 1) * 0.7 + 0.45), 
          right: width * Math.max(0.45, (zoom - 1) * 0.7 + 0.45), 
          top: -height * Math.max(0.45, (zoom - 1) * 0.7 + 0.45), 
          bottom: height * Math.max(0.45, (zoom - 1) * 0.7 + 0.45) 
        }}
        dragElastic={0.08}
        dragMomentum={true}
        dragTransition={{ bounceStiffness: 260, bounceDamping: 24 }}
        className="map-visual-scale relative h-full w-full overflow-visible cursor-grab active:cursor-grabbing select-none"
        animate={{ scale: zoom }}
        transition={
          isContinuousZooming.current
            ? { duration: 0 }
            : { type: "spring", stiffness: 220, damping: 25 }
        }
        style={{ x, y, transformOrigin: "50% 50%", willChange: "transform" }}
        onPointerDown={handlePointerDown}
      >
        <svg
          className="h-full w-full overflow-visible"
          style={{ filter: "drop-shadow(0 14px 24px rgba(168,200,220,0.15))" }}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="China map with visited provinces highlighted"
        >
          <defs>
            <filter id="visitedGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor={colors.bloom} floodOpacity="0.42" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id="softPixelTexture" width="8" height="8" patternUnits="userSpaceOnUse">
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
                filter={path.lit ? "url(#visitedGlow)" : undefined}
                pointerEvents="none"
              />
            ))}

            {paths.map((path) => {
              const isHovered = hoveredId === path.id;
              const isNavigating = navigatingProvince === path.id;
              const isOtherNavigating = navigatingProvince !== null && !isNavigating;
              const litColor = path.moodInfo?.color ?? colors.sakura;

              return (
                <path
                  key={path.id}
                  d={path.d}
                  fill={path.lit ? litColor : isHovered || isNavigating ? "#F9ECEF" : colors.dim}
                  fillOpacity={isOtherNavigating ? 0.35 : path.lit ? 0.68 : isHovered || isNavigating ? 0.52 : 0.34}
                  stroke={path.lit ? colors.bloom : isHovered || isNavigating ? "#D86F82" : colors.ink}
                  strokeOpacity={isOtherNavigating ? 0.2 : path.lit ? 0.95 : isHovered || isNavigating ? 0.8 : 0.24}
                  strokeWidth={path.lit ? 2.2 : isHovered || isNavigating ? 2 : 1.25}
                  strokeLinejoin="round"
                  className="cursor-pointer transition-colors duration-150"
                  filter={path.lit || isHovered || isNavigating ? "url(#visitedGlow)" : undefined}
                  onMouseEnter={() => {
                    setHoveredId(path.id);
                    router.prefetch(`/province/${path.id}`);
                  }}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === path.id ? null : current))
                  }
                  onClick={() => goProvince(path.id)}
                />
              );
            })}

            {paths
              .filter((path) => easyTapProvinceIds.has(path.id))
              .map((path) => (
                <g key={`${path.id}-easy-tap`}>
                  <circle
                    cx={path.x}
                    cy={path.y}
                    r={path.id === "macau" ? 18 : 24}
                    fill={colors.sakura}
                    fillOpacity={hoveredId === path.id ? 0.22 : 0.08}
                    stroke={colors.bloom}
                    strokeOpacity={hoveredId === path.id ? 0.5 : 0.18}
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredId(path.id)}
                    onMouseLeave={() =>
                      setHoveredId((current) => (current === path.id ? null : current))
                    }
                    onClick={() => goProvince(path.id)}
                  />
                  <circle
                    cx={path.x}
                    cy={path.y}
                    r="3.5"
                    fill={colors.bloom}
                    opacity="0.55"
                    pointerEvents="none"
                  />
                </g>
              ))}

            {paths.map((path) =>
              path.lit ? (
                <path
                  key={`${path.id}-inner`}
                  d={path.d}
                  fill="url(#softPixelTexture)"
                  stroke={colors.cream}
                  strokeOpacity="0.9"
                  strokeWidth="1"
                  pointerEvents="none"
                />
              ) : null,
            )}

            {/* Wishlist Pending Flag Pins */}
            {wishPins.map((pin) => (
              <g
                key={pin.id}
                className="cursor-pointer transition-transform duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/wishlist");
                }}
                onMouseEnter={() => setHoveredWish(pin)}
                onMouseLeave={() => setHoveredWish(null)}
              >
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r="9"
                  fill="#F5DCE0"
                  opacity="0.5"
                  className="animate-pulse"
                />
                <circle cx={pin.x} cy={pin.y} r="3" fill="#D86F82" />
                <g transform={`translate(${pin.x - 1.5}, ${pin.y - 17})`}>
                  <path d="M 0 0 L 10 3 L 0 6.5 Z" fill="#D86F82" />
                  <line x1="0" y1="0" x2="0" y2="15" stroke="#D86F82" strokeWidth="1.5" strokeLinecap="round" />
                </g>
              </g>
            ))}
          </g>
        </svg>

        <TimelineOverlay
          width={width}
          height={height}
          projection={projection}
          visible={showTimeline}
          onClose={() => setShowTimeline(false)}
        />

        {!navigatingProvince && hoveredPath?.province && (
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
            <span
              className="mr-2 inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: hoveredPath.moodInfo?.color ?? colors.bloom }}
            />
            {hoveredPath.province.name}
            {hoveredPath.moodInfo && (
              <span className="ml-1.5 font-medium">
                · {hoveredPath.moodInfo.label} <span className="text-[12px]">{hoveredPath.moodInfo.emoji}</span>
              </span>
            )}
            <span className="ml-2 text-[#5A6670]/60">{hoveredPath.province.nameEn}</span>
          </motion.div>
        )}

        {!navigatingProvince && hoveredWish && (
          <motion.div
            className="pointer-events-none absolute z-40 rounded-[8px] border border-[#F5DCE0] bg-[#FAFBF7]/95 px-3 py-2 text-xs text-[#5A6670] shadow-[0_10px_28px_rgba(90,102,112,0.15)] backdrop-blur"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              left: `${(hoveredWish.x / width) * 100}%`,
              top: `${(hoveredWish.y / height) * 100}%`,
              transform: "translate(-50%, -135%)",
            }}
          >
            <div className="flex items-center gap-1 font-bold text-[#D86F82]">
              <span>🚩 想去心愿：{hoveredWish.cityName}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#5A6670]/80">
              {hoveredWish.title}
            </p>
            {hoveredWish.targetDate && (
              <p className="mt-0.5 text-[10px] text-[#5A6670]/50">
                期望时间: {hoveredWish.targetDate}
              </p>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Flight Trajectory & Journey Replay Floating Button (hidden while playing trajectory to prevent overlapping with controller) */}
      {timelinePointCount > 0 && !showTimeline && (
        <div className="absolute bottom-5 right-5 z-30 sm:bottom-6 sm:right-6">
          <TimelineToggle
            visible={showTimeline}
            onToggle={() => {
              const nextState = !showTimeline;
              setShowTimeline(nextState);
              setZoom(nextState ? 1.35 : 1);
            }}
            pointCount={timelinePointCount}
          />
        </div>
      )}
    </motion.div>
  );
}
