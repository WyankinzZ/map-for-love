"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, MapPin, RefreshCw, Minimize2 } from "lucide-react";
import { cities } from "@/data/cities";
import { memories, type Memory } from "@/data/memories";
import {
  memoryStoreUpdatedEvent,
  type LocalMemoryStore,
} from "@/data/progress";
import { LocalPrivacyImage, LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { fetchMemoriesDeduplicated } from "@/components/province/Shared";

interface RandomPhoto {
  id: string;
  memoryId: string;
  src: string;
  city: string;
  cityId: string;
  date: string;
  text: string;
}

const isBrowserImageUrl = (url: string) => url.startsWith("data:image/") || url.startsWith("https://");

function collectMemories(localMemories: LocalMemoryStore) {
  const localItems = Object.values(localMemories).flat();
  const byId = new Map<string, Memory>();

  [...memories, ...localItems].forEach((memory) => {
    if (!memory.draft) byId.set(memory.id, memory);
  });

  return [...byId.values()];
}

function PhotoImage({ photo }: Readonly<{ photo: RandomPhoto }>) {
  const className = "h-full w-full object-cover";

  if (isBrowserImageUrl(photo.src)) {
    return (
      <LocalPrivacyImg className={className} src={photo.src} alt={`${photo.city} 的随机照片`} />
    );
  }

  return (
    <LocalPrivacyImage
      className={className}
      src={photo.src}
      alt={`${photo.city} 的随机照片`}
      fill
      sizes="190px"
    />
  );
}

export default function RandomPhotoCard() {
  const [photo, setPhoto] = useState<RandomPhoto | null>(null);
  const [photos, setPhotos] = useState<RandomPhoto[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 640) {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyMemories = (localMemories: LocalMemoryStore) => {
      const nextPhotos = collectMemories(localMemories).flatMap((memory) =>
        (memory.photos?.length ? memory.photos : [memory.image]).map((src, photoIndex) => ({
          id: `${memory.id}-${photoIndex}`,
          memoryId: memory.id,
          src,
          city: memory.city,
          cityId: memory.cityId,
          date: memory.date,
          text: memory.text,
        })),
      );

      setPhotos(nextPhotos);
      setPhoto(nextPhotos.length > 0 ? nextPhotos[Math.floor(Math.random() * nextPhotos.length)] : null);
    };

    const handleMemoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) applyMemories(detail);
    };

    async function loadLocalMemories() {
      const memories = await fetchMemoriesDeduplicated().catch(() => ({}));
      if (!cancelled) applyMemories(memories);
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    loadLocalMemories();

    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    };
  }, []);

  const href = useMemo(() => {
    if (!photo) return "/memories";
    const city = cities.find((candidate) => candidate.id === photo.cityId);
    return city ? `/province/${city.provinceId}?city=${photo.cityId}&memory=${photo.memoryId}` : "/memories";
  }, [photo]);

  const shufflePhoto = () => {
    setPhoto((current) => {
      if (!current) return current;
      const candidates = photos.filter((candidate) => candidate.id !== current.id);
      const source = candidates.length > 0 ? candidates : photos;
      return source[Math.floor(Math.random() * source.length)];
    });
  };

  const savedCallback = useRef(shufflePhoto);

  useEffect(() => {
    savedCallback.current = shufflePhoto;
  });

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => savedCallback.current(), 10000);
    return () => clearInterval(timer);
  }, [photos.length]);

  if (!mounted) {
    return null;
  }

  if (collapsed) {
    return (
      <motion.button
        drag
        dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
        dragElastic={0.2}
        dragMomentum={false}
        onClick={() => setCollapsed(false)}
        whileDrag={{ scale: 1.05, cursor: "grabbing" }}
        className="absolute bottom-20 left-4 z-30 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/86 shadow-[0_12px_28px_rgba(90,102,112,0.15)] backdrop-blur-xl transition hover:scale-105 cursor-grab active:cursor-grabbing sm:left-auto sm:bottom-[7.25rem] sm:right-[2.5rem]"
        aria-label="展开随机相框"
      >
        <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-[#E8B8C2]" />
      </motion.button>
    );
  }

  return (
    <motion.div
      drag
      dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
      dragElastic={0.2}
      dragMomentum={false}
      whileDrag={{ scale: 1.05, cursor: "grabbing" }}
      className="absolute bottom-20 left-4 z-30 w-[170px] sm:w-[200px] xl:w-[248px] rotate-[-1.5deg] sm:left-auto sm:bottom-[7.25rem] sm:right-[2.5rem] origin-bottom-left sm:origin-bottom-right cursor-grab"
    >
      <div className="rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/86 p-2.5 sm:p-3 shadow-[0_22px_58px_rgba(90,102,112,0.15)] backdrop-blur-xl transition duration-300 hover:border-[#F5DCE0]">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-6 w-6 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-[6px] border border-[#F5DCE0] bg-[#F5DCE0]/62 text-[#E8B8C2] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs sm:text-sm font-semibold text-[#5A6670]">随机相框</p>
              <p className="hidden sm:block truncate text-xs font-medium text-[#5A6670]/48">点照片回到那座城</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="grid h-6 w-6 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-full text-[#A8C8DC] transition hover:bg-[#D6E8F0]/48 hover:text-[#5A6670]"
              type="button"
              onClick={shufflePhoto}
              disabled={!photo}
              aria-label="换一张随机照片"
            >
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
            <button
              className="grid h-6 w-6 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-full text-[#A8C8DC] transition hover:bg-[#D6E8F0]/48 hover:text-[#5A6670]"
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="收起随机相框"
            >
              <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>

        {photo ? (
          <Link
            className="group block"
            href={href}
            aria-label={`查看${photo.city} ${photo.date} 的随机照片`}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] border border-[#D8DDD8]/80 bg-[#D6E8F0]/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <PhotoImage photo={photo} />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#344451]/42 to-transparent opacity-80 transition group-hover:opacity-55" />
            </div>
            <div className="mt-2 sm:mt-3 flex items-start gap-1.5 sm:gap-2.5">
              <span className="mt-0.5 grid h-4 w-4 sm:h-6 sm:w-6 shrink-0 place-items-center rounded sm:rounded-[6px] border border-[#D6E8F0] bg-[#D6E8F0]/48 text-[#A8C8DC]">
                <MapPin className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] sm:text-[13px] font-semibold leading-relaxed sm:leading-5 text-[#5A6670]">
                  {photo.city}
                  <span className="ml-1 sm:ml-1.5 text-[10px] sm:text-xs font-normal text-[#5A6670]/48">{photo.date}</span>
                </p>
                <p className="hidden sm:-webkit-box mt-0.5 line-clamp-1 text-xs leading-5 text-[#5A6670]/58">{photo.text}</p>
              </div>
            </div>
          </Link>
        ) : (
          <div className="rounded-[6px] border border-dashed border-[#D8DDD8]/90 bg-[#FAFBF7]/72 p-3">
            <div className="grid aspect-[4/3] place-items-center rounded-[5px] bg-[#D6E8F0]/34 text-center">
              <div>
                <Camera className="mx-auto h-7 w-7 text-[#E8B8C2]" />
                <p className="mt-2 text-sm font-semibold text-[#5A6670]">相框在等照片</p>
                <p className="mt-1 text-xs leading-5 text-[#5A6670]/52">点一座城市写回忆后，这里会随机展示。</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
