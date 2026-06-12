"use client";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { type City, getCitiesByProvince, cityFallbackSprite } from "@/data/cities";
import { type Memory, getLatestMemory, moodConfig, sortMemoriesByTime } from "@/data/memories";
import { type LocalMemoryStore, getLitCityIds, memoryStoreUpdatedEvent } from "@/data/progress";
import { writeAdminMode } from "@/data/adminMode";
import type { Province } from "@/data/provinces";
import { useAdminMode } from "@/hooks/useAdminMode";
import { makeProjectionForProvince, makePath, chinaFeatures, provinceIdOf } from "@/lib/geo";
import { 
  type MapCamera, type DragState, type CityAssetStore, type CardAnchor,
  colors, spring, memoryCardWidth, memoryCardGap, memoryCardMaxHeight, cityListPanelWidth,
  revokeObjectUrl, clampZoom, stableCoordinate
} from "./province/Shared";
import CityPanel from "./province/CityPanel";
import { MemoryImage } from "./province/MemoryImage";
import { LocalPrivacyImage, LocalPrivacyImg } from "@/components/LocalPrivacyImage";


interface ProvinceMapProps {
  province: Province;
  width?: number;
  height?: number;
}
type BrowserTimeout = ReturnType<Window["setTimeout"]>;

const markerLayoutByCity: Record<
  string,
  {
    width: number;
    height: number;
    iconSize: number;
    iconX: number;
    iconY: number;
    labelX: number;
    labelY: number;
  }
> = {
  zhengzhou: {
    width: 214,
    height: 156,
    iconSize: 112,
    iconX: -56,
    iconY: -116,
    labelX: -34,
    labelY: -22,
  },
  jinan: {
    width: 208,
    height: 142,
    iconSize: 102,
    iconX: -52,
    iconY: -106,
    labelX: -28,
    labelY: -18,
  },
  qingdao: {
    width: 208,
    height: 142,
    iconSize: 102,
    iconX: -52,
    iconY: -106,
    labelX: -28,
    labelY: -18,
  },
  shanghai: {
    width: 214,
    height: 156,
    iconSize: 114,
    iconX: -57,
    iconY: -116,
    labelX: -34,
    labelY: -22,
  },
  hangzhou: {
    width: 208,
    height: 144,
    iconSize: 104,
    iconX: -52,
    iconY: -108,
    labelX: -30,
    labelY: -18,
  },
  guangzhou: {
    width: 214,
    height: 150,
    iconSize: 106,
    iconX: -42,
    iconY: -104,
    labelX: -16,
    labelY: -34,
  },
  zhuhai: {
    width: 214,
    height: 142,
    iconSize: 110,
    iconX: -48,
    iconY: -76,
    labelX: -6,
    labelY: 4,
  },
  hongkong: {
    width: 236,
    height: 142,
    iconSize: 124,
    iconX: -62,
    iconY: -94,
    labelX: -28,
    labelY: -10,
  },
  macau: {
    width: 214,
    height: 146,
    iconSize: 102,
    iconX: -51,
    iconY: -98,
    labelX: -26,
    labelY: -10,
  },
};

const defaultMarkerLayout = {
  width: 192,
  height: 140,
  iconSize: 96,
  iconX: -48,
  iconY: -104,
  labelX: -50,
  labelY: -18,
};

const compactMarkerLayout = {
  width: 86,
  height: 54,
  iconSize: 18,
  iconX: -9,
  iconY: -9,
  labelX: 8,
  labelY: -15,
};

const previewMarkerLayout = {
  width: 92,
  height: 86,
  iconSize: 46,
  iconX: -23,
  iconY: -43,
  labelX: -30,
  labelY: 12,
};

const getMarkerLayout = (city: City, selected: boolean) => {
  if (city.sprite === cityFallbackSprite) return compactMarkerLayout;
  if (!selected) return previewMarkerLayout;

  return markerLayoutByCity[city.id] ?? defaultMarkerLayout;
};





export default function ProvinceMap({ province, width = 1120, height = 760 }: ProvinceMapProps) {
  const isAdmin = useAdminMode();
  const frameRef = useRef<HTMLDivElement>(null);
  const nudgeTimeoutRef = useRef<BrowserTimeout | null>(null);
  const localMemoriesRef = useRef<LocalMemoryStore>({});
  const cameraRef = useRef<MapCamera>({ scale: 1, x: 0, y: 0 });
  const dragStateRef = useRef<DragState | null>(null);
  const dragMovedRef = useRef(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [nudgedCityId, setNudgedCityId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [frameScale, setFrameScale] = useState(1);
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [cityAssets, setCityAssets] = useState<CityAssetStore>({});
  const [camera, setCameraState] = useState<MapCamera>({ scale: 1, x: 0, y: 0 });
  const provinceCities = useMemo(() => getCitiesByProvince(province.id), [province.id]);
  const litCityIds = useMemo(() => getLitCityIds(localMemories), [localMemories]);
  const selectedCity = provinceCities.find((city) => city.id === selectedCityId) ?? null;
  const cityList = useMemo(
    () =>
      [...provinceCities].sort((a, b) => {
        const aLit = litCityIds.has(a.id);
        const bLit = litCityIds.has(b.id);
        if (aLit !== bLit) return aLit ? -1 : 1;

        return a.name.localeCompare(b.name, "zh-Hans-CN");
      }),
    [litCityIds, provinceCities],
  );

  const setCamera = (nextCamera: MapCamera | ((current: MapCamera) => MapCamera)) => {
    setCameraState((current) => {
      const resolved = typeof nextCamera === "function" ? nextCamera(current) : nextCamera;
      const clamped = {
        ...resolved,
        scale: clampZoom(resolved.scale),
      };
      cameraRef.current = clamped;

      return clamped;
    });
  };

  useEffect(() => {
    return () => {
      if (nudgeTimeoutRef.current) window.clearTimeout(nudgeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    localMemoriesRef.current = localMemories;
  }, [localMemories]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    return () => {
      Object.values(localMemoriesRef.current).forEach((memories) => {
        memories.forEach((memory) => revokeObjectUrl(memory.image));
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalState() {
      const [memoryResponse, assetResponse] = await Promise.all([
        fetch("/api/memories", { cache: "no-store" }).catch(() => null),
        fetch("/api/city-assets", { cache: "no-store" }).catch(() => null),
      ]);

      const memoryData = (await memoryResponse?.json().catch(() => null)) as
        | { memories?: LocalMemoryStore }
        | null;
      const assetData = (await assetResponse?.json().catch(() => null)) as
        | { assets?: CityAssetStore }
        | null;

      if (cancelled) return;
      if (memoryData?.memories) setLocalMemories(memoryData.memories);
      if (assetData?.assets) setCityAssets(assetData.assets);
    }

    loadLocalState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const { width: renderedWidth } = frame.getBoundingClientRect();
      setFrameScale(renderedWidth / width);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [width]);

  const mapData = useMemo(() => {
    const projection = makeProjectionForProvince(province.id, width, height, 88);
    const path = makePath(projection);
    const cityPoint = (city: Pick<City, "lng" | "lat">) => {
      const [x, y] = projection([city.lng, city.lat]) ?? [width / 2, height / 2];

      return [stableCoordinate(x), stableCoordinate(y)] as const;
    };

    return {
      paths: chinaFeatures.map((feature) => ({
        id: provinceIdOf(feature),
        d: path(feature as never) ?? "",
        active: provinceIdOf(feature) === province.id,
      })),
      cities: provinceCities.map((city) => {
        const [x, y] = cityPoint(city);
        const localMemory = localMemories[city.id]?.[0];
        const lit = litCityIds.has(city.id);
        const customSprite = cityAssets[city.id];

        return {
          ...city,
          sprite: customSprite ?? city.sprite,
          customSprite,
          x,
          y,
          lit,
          memory: localMemory ?? (lit ? getLatestMemory(city.id) : undefined),
        };
      }),
    };
  }, [cityAssets, height, litCityIds, localMemories, province.id, provinceCities, width]);

  const selectedPoint = mapData.cities.find((city) => city.id === selectedCityId);
  const cardAnchor = selectedPoint
    ? (() => {
        const renderedWidth = width * frameScale;
        const renderedHeight = height * frameScale;
        const rightLimit = Math.max(memoryCardWidth + 24, renderedWidth - cityListPanelWidth);
        const anchorX = (selectedPoint.x * camera.scale + camera.x) * frameScale;
        const anchorY = (selectedPoint.y * camera.scale + camera.y) * frameScale;
        const side = anchorX + memoryCardGap + memoryCardWidth > rightLimit ? "left" : "right";
        const x =
          side === "right"
            ? Math.min(anchorX + memoryCardGap, rightLimit - memoryCardWidth - 12)
            : Math.max(anchorX - memoryCardGap - memoryCardWidth, 12);
        const y = Math.min(
          Math.max(anchorY - 170, 82),
          Math.max(82, renderedHeight - memoryCardMaxHeight),
        );

        return { x, y, side } satisfies CardAnchor;
      })()
    : null;

  const handleSaveMemory = async (cityId: string, memory: Memory) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory }),
    });

    if (response.status === 401 || response.status === 403) {
      writeAdminMode(false);
      throw new Error("Admin session expired");
    }
    if (!response.ok) throw new Error("Failed to save memory");

    const data = (await response.json()) as { memory: Memory; memories: LocalMemoryStore };

    setLocalMemories(() => {
      localMemoriesRef.current = data.memories;

      return data.memories;
    });
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
  };

  const handleSetMemoryCover = async (cityId: string, memoryId: string, coverImage: string) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId, coverImage }),
    });

    if (response.status === 401 || response.status === 403) {
      writeAdminMode(false);
      throw new Error("Admin session expired");
    }
    if (!response.ok) throw new Error("Failed to update memory cover");

    const data = (await response.json()) as { memory: Memory; memories: LocalMemoryStore };

    setLocalMemories(() => {
      localMemoriesRef.current = data.memories;

      return data.memories;
    });
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
  };

  const handleUpdateMemory = async (cityId: string, memoryId: string, memory: Memory) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId, memory }),
    });

    if (response.status === 401 || response.status === 403) {
      writeAdminMode(false);
      throw new Error("Admin session expired");
    }
    if (!response.ok) throw new Error("Failed to update memory");

    const data = (await response.json()) as { memory: Memory; memories: LocalMemoryStore };

    setLocalMemories(() => {
      localMemoriesRef.current = data.memories;

      return data.memories;
    });
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
  };

  const handleDeleteMemory = async (cityId: string, memoryId: string) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId }),
    });

    if (response.status === 401 || response.status === 403) {
      writeAdminMode(false);
      throw new Error("Admin session expired");
    }
    if (!response.ok) throw new Error("Failed to delete memory");

    const data = (await response.json()) as { memories: LocalMemoryStore };
    setLocalMemories(data.memories);
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent));
  };

  const focusCity = (city: Pick<City, "id" | "lng" | "lat">) => {
    const point = mapData.cities.find((candidate) => candidate.id === city.id);
    if (!point) return;

    const scale = clampZoom(Math.max(cameraRef.current.scale, 1.62));
    setCamera({
      scale,
      x: width / 2 - point.x * scale - 150,
      y: height / 2 - point.y * scale + 12,
    });
  };

  const handleSelectCity = (cityId: string, lit: boolean) => {
    const city = provinceCities.find((candidate) => candidate.id === cityId);
    setSelectedCityId(cityId);
    if (city) focusCity(city);
    if (!lit) {
      setNudgedCityId(cityId);
      if (nudgeTimeoutRef.current) window.clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = window.setTimeout(() => setNudgedCityId(null), 520);
    }
  };

  const resetCamera = () => {
    setSelectedCityId(null);
    setCamera({ scale: 1, x: 0, y: 0 });
  };

  useEffect(() => {
    const cityId = new URLSearchParams(window.location.search).get("city");
    const city = provinceCities.find((candidate) => candidate.id === cityId);
    if (!city) return;

    const timer = window.setTimeout(() => {
      setSelectedCityId(city.id);
      focusCity(city);
    }, 0);

    return () => window.clearTimeout(timer);
    // Run after city coordinates are projected so deep links can focus the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData.cities, provinceCities]);

  const zoomAt = (clientX: number, clientY: number, delta: number) => {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    const pointerX = (clientX - rect.left) / frameScale;
    const pointerY = (clientY - rect.top) / frameScale;

    setCamera((current) => {
      const nextScale = clampZoom(current.scale * delta);
      const mapX = (pointerX - current.x) / current.scale;
      const mapY = (pointerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointerX - mapX * nextScale,
        y: pointerY - mapY * nextScale,
      };
    });
  };

  const zoomFromCenter = (delta: number) => {
    const frame = frameRef.current;
    const rect = frame?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : 0;
    const centerY = rect ? rect.top + rect.height / 2 : 0;

    zoomAt(centerX, centerY, delta);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    // Note: wheel events in React are passive, so preventDefault is ignored.
    const delta = event.deltaY < 0 ? 1.12 : 0.88;
    zoomAt(event.clientX, event.clientY, delta);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, article, aside")) return;

    dragMovedRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCamera: cameraRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const dx = (event.clientX - dragState.startClientX) / frameScale;
    const dy = (event.clientY - dragState.startClientY) / frameScale;

    if (Math.abs(dx) + Math.abs(dy) > 3) dragMovedRef.current = true;

    setCamera({
      ...dragState.startCamera,
      x: dragState.startCamera.x + dx,
      y: dragState.startCamera.y + dy,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setDragging(false);
    }
  };

  return (
    <div
      ref={frameRef}
      className={`relative mx-auto aspect-[1120/760] w-[min(100%,1120px)] touch-none overflow-visible ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(event) => {
        if (dragMovedRef.current) {
          dragMovedRef.current = false;
          return;
        }
        const target = event.target as HTMLElement;
        if (!target.closest("button, article")) setSelectedCityId(null);
      }}
    >
      <div
        className="absolute left-0 top-0 z-0 origin-top-left"
        style={{
          width,
          height,
          transformOrigin: "0 0",
          transform: `scale(${frameScale})`,
        }}
      >
        <motion.div
          className="absolute left-0 top-0 origin-top-left"
          animate={{ scale: camera.scale, x: camera.x, y: camera.y }}
          transition={spring}
          style={{
            width,
            height,
            transformOrigin: "0 0",
          }}
        >
          <svg
            className="h-full w-full overflow-visible drop-shadow-[0_18px_30px_rgba(168,200,220,0.16)]"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${province.name} province map`}
          >
            <defs>
              <filter id="provinceGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor={colors.bloom} floodOpacity="0.36" />
                <feComposite in2="blur" operator="in" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {mapData.paths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill={path.active ? colors.sakura : colors.dim}
                fillOpacity={path.active ? 0.44 : 0.12}
                stroke={path.active ? colors.bloom : colors.dim}
                strokeOpacity={path.active ? 0.86 : 0.45}
                strokeWidth={path.active ? 2.4 : 1.2}
                strokeLinejoin="round"
                filter={path.active ? "url(#provinceGlow)" : undefined}
              />
            ))}

          </svg>

          {mapData.cities.map((city) => {
            const selected = city.id === selectedCityId;
            const faded = selectedCityId && !selected;
            const nudged = nudgedCityId === city.id;
            const layout = getMarkerLayout(city, selected);

            return (
              <motion.button
                key={city.id}
                className="group absolute text-left transition duration-300"
                initial={false}
                animate={{
                  x: nudged ? [0, -3, 3, -2, 0] : 0,
                }}
                transition={{ duration: nudged ? 0.42 : 0.24 }}
                style={{
                  left: city.x - layout.width / 2,
                  top: city.y - layout.height / 2,
                  width: layout.width,
                  height: layout.height,
                  opacity: faded ? 0.28 : 1,
                }}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelectCity(city.id, city.lit);
                }}
                aria-label={`${city.lit ? "查看" : "添加"}${city.name}回忆`}
              >
                <CityMarker city={city} lit={city.lit} selected={selected} />
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <div
        className="absolute left-3 top-3 z-40 flex items-center gap-2 rounded-[8px] border border-[#D8DDD8]/85 bg-[#FAFBF7]/86 p-2 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="grid h-9 w-9 place-items-center rounded-[7px] text-[#5A6670] transition hover:bg-[#D6E8F0]/45"
          type="button"
          onClick={() => zoomFromCenter(0.88)}
          aria-label="缩小地图"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-12 text-center text-xs font-semibold text-[#5A6670]/70">
          {Math.round(camera.scale * 100)}%
        </span>
        <button
          className="grid h-9 w-9 place-items-center rounded-[7px] text-[#5A6670] transition hover:bg-[#F5DCE0]/55"
          type="button"
          onClick={() => zoomFromCenter(1.12)}
          aria-label="放大地图"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-[7px] text-[#5A6670] transition hover:bg-[#D4E8D0]/55"
          type="button"
          onClick={resetCamera}
          aria-label="重置地图视角"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <aside
        className="absolute right-0 top-3 z-40 w-[230px] rounded-[8px] border border-[#D8DDD8]/85 bg-[#FAFBF7]/90 p-3 shadow-[0_16px_34px_rgba(90,102,112,0.10)] backdrop-blur"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        aria-label={`${province.name}城市列表`}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#5A6670]">城市</h2>
          <span className="text-xs font-medium text-[#5A6670]/54">{provinceCities.length}</span>
        </div>
        <div className="max-h-[430px] space-y-1 overflow-y-auto pr-1">
          {cityList.map((city) => {
            const lit = litCityIds.has(city.id);
            const selected = city.id === selectedCityId;
            const latestMemory = localMemories[city.id] ? sortMemoriesByTime(localMemories[city.id])[0] : undefined;
            const moodConfigInfo = latestMemory?.mood ? moodConfig[latestMemory.mood] : undefined;

            return (
              <button
                key={city.id}
                className={`flex w-full items-center justify-between gap-3 rounded-[7px] px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "bg-[#F5DCE0] text-[#E8B8C2] shadow-[0_8px_18px_rgba(232,184,194,0.16)]"
                    : "text-[#5A6670]/78 hover:bg-[#D6E8F0]/34"
                }`}
                type="button"
                onClick={() => handleSelectCity(city.id, lit)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {moodConfigInfo ? (
                    <span className="text-[14px] leading-none">{moodConfigInfo.emoji}</span>
                  ) : (
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#FAFBF7] ${
                        lit ? "bg-[#E8B8C2] shadow-[0_0_10px_rgba(232,184,194,0.55)]" : "bg-[#D8DDD8]"
                      }`}
                    />
                  )}
                  <span className="truncate font-semibold">{city.name}</span>
                </span>
                <span className={`shrink-0 text-[11px] ${lit ? "text-[#E8B8C2]/80" : "text-[#5A6670]/40"}`}>
                  {lit ? "已去过" : "未去过"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {selectedCity && (
        <CityPanel
          key={selectedCity.id}
          city={selectedCity}
          localMemories={localMemories[selectedCity.id] ?? []}
          isLit={litCityIds.has(selectedCity.id)}
          anchor={cardAnchor}
          isAdmin={isAdmin}
          onClose={() => setSelectedCityId(null)}
          onSave={handleSaveMemory}
        onSetCover={handleSetMemoryCover}
        onUpdate={handleUpdateMemory}
        onDelete={handleDeleteMemory}
        landmarkImage={cityAssets[selectedCity.id] ?? selectedCity.sprite}
      />
      )}
    </div>
  );
}



function CityMarker({ city, lit, selected }: Readonly<{ city: City; lit: boolean; selected: boolean }>) {
  const isFallbackCity = city.sprite === cityFallbackSprite;
  const layout = getMarkerLayout(city, selected);

  if (isFallbackCity) {
    return (
      <span className="relative block h-full w-full">
        <span
          className={`absolute block rounded-full border-2 border-[#FAFBF7] transition duration-300 ${
            lit
              ? "bg-[#E8B8C2] shadow-[0_0_12px_rgba(232,184,194,0.7)]"
              : "bg-[#D8DDD8] shadow-[0_4px_10px_rgba(90,102,112,0.08)]"
          }`}
          style={{
            left: `calc(50% + ${layout.iconX}px)`,
            top: `calc(50% + ${layout.iconY}px)`,
            width: layout.iconSize,
            height: layout.iconSize,
          }}
        />
        <span
          className={`absolute flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FAFBF7]/92 px-3 py-1.5 text-xs font-semibold shadow-[0_8px_18px_rgba(90,102,112,0.10)] backdrop-blur transition duration-200 ${
            lit
              ? "text-[#E8B8C2] opacity-100"
              : "text-[#5A6670]/62 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
          style={{
            left: `calc(50% + ${layout.labelX}px)`,
            top: `calc(50% + ${layout.labelY}px)`,
          }}
        >
          {city.name}
        </span>
      </span>
    );
  }

  const compactLandmark = !selected;

  return (
    <span className="relative block h-full w-full">
      <span
        className="absolute block"
        style={{
          left: `calc(50% + ${layout.iconX}px)`,
          top: `calc(50% + ${layout.iconY}px)`,
          width: layout.iconSize,
          height: layout.iconSize,
        }}
      >
        <LandmarkSprite city={city} lit={lit} />
      </span>
      <span
        className={`absolute flex items-center whitespace-nowrap rounded-full bg-[#FAFBF7]/88 font-semibold shadow-[0_8px_18px_rgba(90,102,112,0.10)] backdrop-blur transition duration-200 ${
          compactLandmark ? "gap-1.5 px-3 py-1.5 text-xs" : "gap-2 px-4 py-2 text-sm"
        } ${
          compactLandmark && !lit ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" : "opacity-100"
        } ${lit ? "text-[#E8B8C2]" : "text-[#5A6670]/58"}
        }`}
        style={{
          left: `calc(50% + ${layout.labelX}px)`,
          top: `calc(50% + ${layout.labelY}px)`,
        }}
      >
        <span
          className={`rounded-full border-2 border-[#FAFBF7] ${
            compactLandmark ? "h-2 w-2" : "h-2.5 w-2.5"
          } ${
            lit
              ? "bg-[#E8B8C2] shadow-[0_0_10px_rgba(232,184,194,0.65)]"
              : "bg-[#D8DDD8]"
          }`}
        />
        {city.name}
        {city.nameEn !== city.name && (
          <span className={lit ? "font-normal text-[#E8B8C2]/80" : "font-normal text-[#5A6670]/42"}>
            {city.nameEn}
          </span>
        )}
      </span>
    </span>
  );
}



function LandmarkSprite({ city, lit }: Readonly<{ city: City; lit: boolean }>) {
  const className = `pixelated h-full w-full object-contain transition duration-500 ${
    lit
      ? "drop-shadow-[0_10px_18px_rgba(90,102,112,0.14)]"
      : "opacity-50 grayscale drop-shadow-[0_8px_14px_rgba(90,102,112,0.08)]"
  }`;

  if (typeof city.sprite === "string" && city.sprite.startsWith("data:image/")) {
    return (
      <LocalPrivacyImg className={className} src={city.sprite} alt={city.landmark ?? city.name} />
    );
  }

  return (
    <Image
      className={className}
      src={city.sprite}
      alt={city.landmark ?? city.name}
      fill
      loading="eager"
      sizes="112px"
      unoptimized
    />
  );
}