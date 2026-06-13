"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Route } from "lucide-react";
import { cities } from "@/data/cities";
import { sortMemoriesByTime } from "@/data/memories";
import { fetchMemoriesDeduplicated } from "@/components/province/Shared";
import {
  memoryStoreUpdatedEvent,
  type LocalMemoryStore,
} from "@/data/progress";
import { type GeoProjection } from "@/lib/geo";

interface TimelineOverlayProps {
  width: number;
  height: number;
  projection: GeoProjection;
  visible: boolean;
}

interface TimelinePoint {
  cityId: string;
  cityName: string;
  x: number;
  y: number;
  date: string;
  image: string;
}

export default function TimelineOverlay({
  width,
  height,
  projection,
  visible,
}: Readonly<TimelineOverlayProps>) {
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [activeIndex, setActiveIndex] = useState(-1);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function load() {
      const res = await fetchMemoriesDeduplicated().catch(() => null);
      if (!res?.ok) return;
      const data = (await res.json().catch(() => null)) as { memories?: LocalMemoryStore } | null;
      if (!cancelled && data?.memories) setLocalMemories(data.memories);
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleUpdate);
    load();
    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleUpdate);
    };
  }, []);

  const timelinePoints = useMemo(() => {
    const allMemories = Object.values(localMemories).flat();
    if (allMemories.length === 0) return [];

    const sorted = sortMemoriesByTime(allMemories);
    const seen = new Set<string>();
    const points: TimelinePoint[] = [];

    for (const memory of sorted) {
      if (seen.has(memory.cityId)) continue;
      seen.add(memory.cityId);

      const city = cities.find((c) => c.id === memory.cityId);
      if (!city) continue;

      const projected = projection([city.lng, city.lat]);
      if (!projected) continue;

      points.push({
        cityId: city.id,
        cityName: city.name,
        x: Number(projected[0].toFixed(2)),
        y: Number(projected[1].toFixed(2)),
        date: memory.date,
        image: memory.image,
      });
    }

    return points.reverse();
  }, [localMemories, projection]);

  const pathD = useMemo(() => {
    if (timelinePoints.length < 2) return "";
    return timelinePoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }, [timelinePoints]);

  const pathLength = useMemo(() => {
    if (timelinePoints.length < 2) return 0;
    let length = 0;
    for (let i = 1; i < timelinePoints.length; i++) {
      const dx = timelinePoints[i].x - timelinePoints[i - 1].x;
      const dy = timelinePoints[i].y - timelinePoints[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }, [timelinePoints]);

  useEffect(() => {
    if (!visible || timelinePoints.length < 2) {
      return;
    }

    let current = 0;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      const step = () => {
        if (cancelled) return;
        current++;
        if (current <= timelinePoints.length) {
          setActiveIndex(current - 1);
          animationRef.current = window.setTimeout(step, 400);
        }
      };
      step();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (animationRef.current) window.clearTimeout(animationRef.current);
    };
  }, [visible, timelinePoints.length]);

  if (!visible || timelinePoints.length < 2) return null;

  return (
    <svg
      className="absolute left-0 top-0 h-full w-full pointer-events-none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id="timeline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8B8C2" />
          <stop offset="50%" stopColor="#A8C8DC" />
          <stop offset="100%" stopColor="#E8B8C2" />
        </linearGradient>
        <filter id="timeline-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#E8B8C2" floodOpacity="0.5" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shadow path */}
      <path
        d={pathD}
        fill="none"
        stroke="#E8B8C2"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.15"
        filter="url(#timeline-glow)"
      />

      {/* Main animated path */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="url(#timeline-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        initial={{ strokeDashoffset: pathLength }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: timelinePoints.length * 0.4, ease: "easeInOut" }}
      />

      {/* City dots and labels */}
      {timelinePoints.map((point, index) => {
        const isActive = index <= activeIndex;
        const isCurrent = index === activeIndex;

        return (
          <g key={point.cityId}>
            {/* Outer glow */}
            {isActive && (
              <motion.circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill="#E8B8C2"
                opacity="0.15"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.4, duration: 0.3 }}
              />
            )}

            {/* City dot */}
            <motion.circle
              cx={point.x}
              cy={point.y}
              r={isCurrent ? 6 : 4}
              fill={isActive ? "#E8B8C2" : "#D8DDD8"}
              stroke="#FAFBF7"
              strokeWidth="2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.4, duration: 0.3 }}
            />

            {/* Photo popup */}
            {isActive && point.image && (
              <motion.foreignObject
                x={point.x - 45}
                y={point.y - 110}
                width="90"
                height="100"
                initial={{ opacity: 0, y: 30, scale: 0.4, rotate: index % 2 === 0 ? -25 : 25 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: index % 2 === 0 ? -6 : 6 }}
                transition={{ delay: index * 0.4 + 0.15, type: "spring", bounce: 0.55 }}
                className="overflow-visible pointer-events-none"
              >
                <div className="flex h-full w-full flex-col bg-[#FAFBF7] p-1.5 pb-5 shadow-[0_12px_24px_rgba(90,102,112,0.22)] rounded-[4px] border border-[#D8DDD8]/50">
                   <img src={point.image} alt={point.cityName} className="w-full flex-1 rounded-[2px] object-cover bg-[#D6E8F0]/30" />
                </div>
              </motion.foreignObject>
            )}

            {/* City label */}
            {isActive && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.4 + 0.3, duration: 0.3 }}
              >
                <rect
                  x={point.x + 10}
                  y={point.y - 22}
                  width={point.cityName.length * 14 + 16}
                  height="24"
                  rx="6"
                  fill="#FAFBF7"
                  fillOpacity="0.92"
                  stroke="#E8B8C2"
                  strokeWidth="1"
                />
                <text
                  x={point.x + 18}
                  y={point.y - 6}
                  fontSize="12"
                  fontWeight="600"
                  fill="#5A6670"
                >
                  {point.cityName}
                </text>
                <text
                  x={point.x + 18 + point.cityName.length * 14 + 4}
                  y={point.y - 6}
                  fontSize="10"
                  fill="#5A6670"
                  opacity="0.5"
                >
                  {point.date}
                </text>
              </motion.g>
            )}

            {/* Number badge */}
            <motion.circle
              cx={point.x}
              cy={point.y - 14}
              r="8"
              fill={isActive ? "#E8B8C2" : "#D8DDD8"}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.4, duration: 0.25 }}
            />
            <motion.text
              x={point.x}
              y={point.y - 10}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.4, duration: 0.25 }}
            >
              {index + 1}
            </motion.text>
          </g>
        );
      })}
    </svg>
  );
}

export function TimelineToggle({
  visible,
  onToggle,
  pointCount,
}: Readonly<{
  visible: boolean;
  onToggle: () => void;
  pointCount: number;
}>) {
  if (pointCount < 1) return null;

  return (
    <button
      className={`grid h-9 w-9 place-items-center rounded-full transition ${
        visible
          ? "bg-[#E8B8C2] text-white shadow-[0_4px_12px_rgba(232,184,194,0.4)]"
          : "text-[#5A6670] hover:bg-[#F5DCE0]/55 hover:text-[#E8B8C2]"
      }`}
      type="button"
      onClick={onToggle}
      aria-label={visible ? "隐藏时间线" : "显示旅行时间线"}
      title={visible ? "隐藏时间线" : "显示旅行时间线"}
    >
      <Route className="h-4 w-4" />
    </button>
  );
}
