"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Pause,
  Plane,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cities } from "@/data/cities";
import { sortMemoriesByTime, moodConfig, type MemoryMood } from "@/data/memories";
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
  onClose?: () => void;
}

interface TimelinePoint {
  cityId: string;
  cityName: string;
  x: number;
  y: number;
  date: string;
  image: string;
  text?: string;
  mood?: MemoryMood;
}

interface ArcCurve {
  p1: TimelinePoint;
  p2: TimelinePoint;
  cx: number;
  cy: number;
  d: string;
  length: number;
}

// Compute graceful flight arc curving upward
function computeArc(p1: TimelinePoint, p2: TimelinePoint): ArcCurve {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);

  if (dist === 0) {
    return {
      p1,
      p2,
      cx: mx,
      cy: my,
      d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
      length: 0,
    };
  }

  // Normal vector perpendicular to flight direction
  let nx = -dy / dist;
  let ny = dx / dist;

  // Prefer curving upward (negative y in SVG screen coords)
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  // Arc height proportional to distance, max 85px
  const arcHeight = Math.min(Math.max(dist * 0.22, 28), 85);
  const cx = mx + nx * arcHeight;
  const cy = my + ny * arcHeight;

  // Approximate quadratic bezier length using Simpson's rule
  const d = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
  const chord = dist;
  const net = Math.hypot(cx - p1.x, cy - p1.y) + Math.hypot(p2.x - cx, p2.y - cy);
  const approxLength = (chord + 2 * net) / 3;

  return { p1, p2, cx, cy, d, length: approxLength };
}

// Evaluate point & tangent angle on quadratic bezier at parameter t in [0, 1]
function evaluateBezier(
  p1: { x: number; y: number },
  c: { cx: number; cy: number },
  p2: { x: number; y: number },
  t: number
) {
  const invT = 1 - t;
  const x = invT * invT * p1.x + 2 * invT * t * c.cx + t * t * p2.x;
  const y = invT * invT * p1.y + 2 * invT * t * c.cy + t * t * p2.y;

  const tx = 2 * invT * (c.cx - p1.x) + 2 * t * (p2.x - c.cx);
  const ty = 2 * invT * (c.cy - p1.y) + 2 * t * (p2.y - c.cy);
  const angle = Math.atan2(ty, tx) * (180 / Math.PI);

  return { x, y, angle };
}

// Client-side SVG path cache for sub-pixel measurement
const pathCache = new Map<string, SVGPathElement>();

function getSvgPath(d: string): SVGPathElement | null {
  if (typeof document === "undefined") return null;
  let path = pathCache.get(d);
  if (!path) {
    path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    pathCache.set(d, path);
  }
  return path;
}

function getArcLength(arc: ArcCurve): number {
  const pathEl = getSvgPath(arc.d);
  if (pathEl) {
    try {
      const len = pathEl.getTotalLength();
      if (len > 0) return len;
    } catch {
      // fallback
    }
  }
  return arc.length;
}

export default function TimelineOverlay({
  width,
  height,
  projection,
  visible,
  onClose,
}: Readonly<TimelineOverlayProps>) {
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [currentLeg, setCurrentLeg] = useState(0); // 0 to N-1 (when landed: city index; when flying: arc index)
  const [legProgress, setLegProgress] = useState(0); // 0 to 1 along current leg
  const legProgressRef = useRef(0);
  const [isLanded, setIsLanded] = useState(true); // Paused at city checkpoint showing photo
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [isCardDismissed, setIsCardDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play soft chime sound when landing at a city
  const playLandingChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Gentle romantic chime chord
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.28); // G5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.85);
    } catch {
      // AudioContext policy fallback
    }
  }, [soundEnabled]);

  // Load memories
  useEffect(() => {
    let cancelled = false;
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function load() {
      const memories = await fetchMemoriesDeduplicated().catch(() => ({}));
      if (!cancelled) setLocalMemories(memories);
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleUpdate);
    load();
    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleUpdate);
    };
  }, []);

  // Compute chronologically sorted timeline points
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
        text: memory.text,
        mood: memory.mood,
      });
    }

    return points.reverse(); // Earliest to latest
  }, [localMemories, projection]);

  // Compute curved flight arcs
  const arcs = useMemo<ArcCurve[]>(() => {
    if (timelinePoints.length < 2) return [];
    const list: ArcCurve[] = [];
    for (let i = 0; i < timelinePoints.length - 1; i++) {
      list.push(computeArc(timelinePoints[i], timelinePoints[i + 1]));
    }
    return list;
  }, [timelinePoints]);

  // Reset playback state when visibility changes
  useEffect(() => {
    if (visible) {
      setCurrentLeg(0);
      legProgressRef.current = 0;
      setLegProgress(0);
      setIsLanded(true);
      setIsPlaying(true);
      setCompleted(false);
      setIsCardDismissed(false);
    }
  }, [visible]);

  // Animation frame loop for smooth flight & stay durations
  useEffect(() => {
    if (!visible || !isPlaying || arcs.length === 0 || completed) return;

    let animId: number;
    let lastTime = performance.now();
    let landTimer = 0;
    const LAND_DURATION = 2200 / playbackSpeed; // Stay at city for 2.2s

    const frame = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      if (isLanded) {
        landTimer += dt;
        if (landTimer >= LAND_DURATION) {
          // Time to depart for the next leg if not at final destination
          if (currentLeg < arcs.length) {
            setIsLanded(false);
            legProgressRef.current = 0;
            setLegProgress(0);
          } else {
            setCompleted(true);
            setIsPlaying(false);
          }
          return;
        }
      } else {
        // Airplane is flying along the current leg
        const currentArc = arcs[currentLeg];
        const arcLen = currentArc ? getArcLength(currentArc) : 300;
        const flightDuration = Math.max(1300, Math.min(arcLen * 2.5, 3200)) / playbackSpeed;
        const deltaProgress = dt / flightDuration;

        legProgressRef.current += deltaProgress;
        if (legProgressRef.current >= 1) {
          legProgressRef.current = 1;
          setLegProgress(1);
          setIsLanded(true);
          setCurrentLeg((leg) => Math.min(leg + 1, timelinePoints.length - 1));
          playLandingChime();
          return;
        }
        setLegProgress(legProgressRef.current);
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [visible, isPlaying, isLanded, currentLeg, arcs, playbackSpeed, completed, playLandingChime, timelinePoints.length]);

  // Active landed city index
  const activeCityIndex = Math.min(currentLeg, timelinePoints.length - 1);
  const activeCity = timelinePoints[activeCityIndex];

  // Re-enable popup card whenever the flight reaches a new city
  useEffect(() => {
    setIsCardDismissed(false);
  }, [activeCityIndex]);

  // Calculate current airplane position & angle (locked exactly to the SVG curve tangent)
  const planeState = useMemo(() => {
    if (arcs.length === 0 || timelinePoints.length === 0) return null;

    if (isLanded) {
      const city = timelinePoints[activeCityIndex];
      if (!city) return null;

      // When starting at city 0, orient forward along departure arc
      if (activeCityIndex === 0 && arcs.length > 0) {
        const pathEl = getSvgPath(arcs[0].d);
        if (pathEl) {
          const p0 = pathEl.getPointAtLength(0);
          const p1 = pathEl.getPointAtLength(Math.min(pathEl.getTotalLength(), 4));
          const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);
          return { x: city.x, y: city.y, angle };
        }
        return {
          x: city.x,
          y: city.y,
          angle: evaluateBezier(arcs[0].p1, { cx: arcs[0].cx, cy: arcs[0].cy }, arcs[0].p2, 0).angle,
        };
      }

      // When landed at station > 0, preserve natural arrival angle of previous arc
      if (activeCityIndex > 0) {
        const prevArc = arcs[activeCityIndex - 1];
        if (prevArc) {
          const pathEl = getSvgPath(prevArc.d);
          if (pathEl) {
            const len = pathEl.getTotalLength();
            const p0 = pathEl.getPointAtLength(Math.max(0, len - 4));
            const p1 = pathEl.getPointAtLength(len);
            const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);
            return { x: city.x, y: city.y, angle };
          }
          return {
            x: city.x,
            y: city.y,
            angle: evaluateBezier(prevArc.p1, { cx: prevArc.cx, cy: prevArc.cy }, prevArc.p2, 1).angle,
          };
        }
      }

      return { x: city.x, y: city.y, angle: 0 };
    }

    const arc = arcs[currentLeg];
    if (!arc) return null;

    const pathEl = getSvgPath(arc.d);
    if (pathEl) {
      const totalLen = pathEl.getTotalLength();
      const currentDist = totalLen * Math.min(Math.max(legProgress, 0), 1);
      const pt = pathEl.getPointAtLength(currentDist);
      const dBefore = Math.max(0, currentDist - 2);
      const dAfter = Math.min(totalLen, currentDist + 2);
      const pBefore = pathEl.getPointAtLength(dBefore);
      const pAfter = pathEl.getPointAtLength(dAfter);
      const angle = Math.atan2(pAfter.y - pBefore.y, pAfter.x - pBefore.x) * (180 / Math.PI);
      return { x: pt.x, y: pt.y, angle };
    }

    return evaluateBezier(arc.p1, { cx: arc.cx, cy: arc.cy }, arc.p2, legProgress);
  }, [arcs, isLanded, activeCityIndex, timelinePoints, currentLeg, legProgress]);

  // Playback control handlers
  const handlePrev = () => {
    if (currentLeg > 0) {
      const prevLeg = currentLeg - 1;
      legProgressRef.current = 0;
      setLegProgress(0);
      setCurrentLeg(prevLeg);
      setIsLanded(true);
      setCompleted(false);
      playLandingChime();
    }
  };

  const handleNext = () => {
    if (currentLeg < timelinePoints.length - 1) {
      const nextLeg = currentLeg + 1;
      legProgressRef.current = 0;
      setLegProgress(0);
      setCurrentLeg(nextLeg);
      setIsLanded(true);
      setCompleted(false);
      playLandingChime();
    }
  };

  const handleReplay = () => {
    legProgressRef.current = 0;
    setLegProgress(0);
    setCurrentLeg(0);
    setIsLanded(true);
    setCompleted(false);
    setIsPlaying(true);
    playLandingChime();
  };

  if (!visible || timelinePoints.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full overflow-visible"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          {/* Gradient for the flight path */}
          <linearGradient id="flight-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E86F82" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#F5DCE0" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#E86F82" stopOpacity="0.8" />
          </linearGradient>

          {/* Golden/pink glow filter */}
          <filter id="flight-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feFlood floodColor="#E86F82" floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. All background curved flight arcs (completed or forthcoming) */}
        {arcs.map((arc, index) => {
          const isPassed = index < currentLeg || completed;
          const isCurrentFlight = index === currentLeg && !isLanded;
          const arcLen = getArcLength(arc);

          return (
            <g key={`arc-${index}`}>
              {/* Background faint route guide */}
              <path
                d={arc.d}
                fill="none"
                stroke="#C2CAC2"
                strokeWidth="2.5"
                strokeDasharray="5 5"
                opacity="0.75"
              />

              {/* Glowing traveled path */}
              {isPassed && (
                <>
                  <path
                    d={arc.d}
                    fill="none"
                    stroke="#E86F82"
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.25"
                  />
                  <path
                    d={arc.d}
                    fill="none"
                    stroke="url(#flight-gradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    filter="url(#flight-glow)"
                    opacity="0.95"
                  />
                </>
              )}

              {/* Dynamic traveling path on active leg */}
              {isCurrentFlight && (
                <>
                  <path
                    d={arc.d}
                    fill="none"
                    stroke="#E86F82"
                    strokeWidth="10"
                    strokeLinecap="round"
                    opacity="0.32"
                  />
                  <path
                    d={arc.d}
                    fill="none"
                    stroke="url(#flight-gradient)"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    filter="url(#flight-glow)"
                    strokeDasharray={arcLen}
                    strokeDashoffset={arcLen * (1 - legProgress)}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* 2. City Checkpoints (Dots & labels) */}
        {timelinePoints.map((point, index) => {
          const isVisited = index <= activeCityIndex || completed;
          const isCurrent = index === activeCityIndex;

          return (
            <g key={point.cityId} className="pointer-events-auto">
              {/* Checkpoint Outer Circle (clean dot without flashing animation) */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isCurrent ? 9 : 6.5}
                fill={isVisited ? "#E86F82" : "#FAFBF7"}
                stroke={isVisited ? "#FAFBF7" : "#B8BEB8"}
                strokeWidth="2.5"
                filter={isVisited ? "url(#flight-glow)" : undefined}
                className="shadow-md"
              />

              {/* City name label pill */}
              <g
                transform={`translate(${point.x + 9}, ${point.y - 14})`}
                className="select-none"
              >
                <rect
                  x="0"
                  y="0"
                  width={point.cityName.length * 15 + 16}
                  height="22"
                  rx="6"
                  fill="#FAFBF7"
                  fillOpacity="0.96"
                  stroke={isVisited ? "#E86F82" : "#C8CEC8"}
                  strokeWidth="1.5"
                  filter="drop-shadow(0 2px 5px rgba(90,102,112,0.14))"
                />
                <text
                  x="8"
                  y="15.5"
                  fontSize="12.5"
                  fontWeight="700"
                  fill={isVisited ? "#3F4951" : "#5A6670"}
                >
                  {point.cityName}
                </text>
              </g>

              {/* Station sequence number badge */}
              <circle
                cx={point.x}
                cy={point.y + 14}
                r="7.5"
                fill={isVisited ? "#E86F82" : "#B9BEC3"}
              />
              <text
                x={point.x}
                y={point.y + 17.5}
                textAnchor="middle"
                fontSize="9"
                fontWeight="800"
                fill="white"
              >
                {index + 1}
              </text>
            </g>
          );
        })}

        {/* 3. The Animated Airplane (perfectly aligned with the curve tangent) */}
        {planeState && (
          <g
            transform={`translate(${planeState.x}, ${planeState.y}) rotate(${planeState.angle}) scale(1.45)`}
            className="pointer-events-none transition-none"
          >
            {/* Airplane shadow */}
            <path
              d="M 12 0 L -8 -10 L -4 0 L -8 10 Z"
              fill="rgba(90, 102, 112, 0.28)"
              transform="translate(2, 6) scale(1.15)"
            />
            {/* Airplane fuselage */}
            <path
              d="M 15 0 L -6 -11 L -2 -3 L -11 -4 L -10 0 L -11 4 L -2 3 L -6 11 Z"
              fill="#FFFFFF"
              stroke="#D86F82"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Cockpit Heart */}
            <circle cx="2" cy="0" r="2.4" fill="#E86F82" />
          </g>
        )}
      </svg>

      {/* Floating Polaroid Photo Pop-up Card when Landed */}
      <AnimatePresence>
        {isLanded && activeCity && !isCardDismissed && (
          <motion.div
            key={activeCity.cityId}
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -10 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            style={{
              left: `${Math.min(Math.max((activeCity.x / width) * 100, 24), 76)}%`,
              top: `${Math.min(Math.max((activeCity.y / height) * 100, 26), 76)}%`,
              transform: "translate(-50%, -115%)",
            }}
            className="pointer-events-auto absolute z-40 w-[155px] sm:w-[220px] rounded-[10px] sm:rounded-[12px] border border-[#D8DDD8]/90 bg-[#FAFBF7] p-1.5 sm:p-2.5 shadow-[0_18px_38px_rgba(90,102,112,0.22)] backdrop-blur-md"
          >
            {/* Polaroid photo image */}
            <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden rounded-[6px] sm:rounded-[8px] border border-[#D8DDD8] bg-[#FAF8F2]">
              {activeCity.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeCity.image}
                  alt={activeCity.cityName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[#5A6670]/40">
                  <MapPin className="h-5 w-5 text-[#E8B8C2]" />
                </div>
              )}

              {/* Station sequence badge */}
              <div className="absolute top-1 left-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-white backdrop-blur-xs">
                <Plane className="h-2 w-2 text-[#E8B8C2]" />
                第 {activeCityIndex + 1} 站
              </div>

              {/* Close / Dismiss button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCardDismissed(true);
                }}
                className="absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-black/50 text-white hover:bg-black/80 transition"
                title="关闭此站弹窗"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>

            {/* City & Date details */}
            <div className="mt-1.5 px-0.5">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs sm:text-sm font-bold text-[#3F4951] truncate">
                  {activeCity.cityName}
                </h4>
                <span className="flex items-center gap-0.5 text-[9px] sm:text-[11px] font-medium text-[#5A6670]/70 shrink-0">
                  <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-[#E86F82]" />
                  {activeCity.date}
                </span>
              </div>

              {/* Memory text excerpt */}
              {activeCity.text && (
                <p className="mt-0.5 line-clamp-1 sm:line-clamp-2 text-[10px] sm:text-[11px] leading-snug sm:leading-relaxed text-[#5A6670]/80">
                  “{activeCity.text}”
                </p>
              )}

              {/* Mood tag */}
              {activeCity.mood && moodConfig[activeCity.mood] && (
                <div className="mt-1 flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-[#D86F82]">
                  <Sparkles className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                  <span>{moodConfig[activeCity.mood].emoji} {moodConfig[activeCity.mood].label}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Floating Bottom Playback Controller (rendered via Portal to prevent map transform scaling & distortion) */}
      {isMounted &&
        createPortal(
          <div className="pointer-events-auto fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-[999] flex max-w-[calc(100vw-24px)] shrink-0 items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/95 px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_16px_36px_rgba(90,102,112,0.18)] backdrop-blur-md">
            {/* Journey Station Info */}
            <div className="flex shrink-0 items-center gap-2 border-r border-[#D8DDD8]/60 pr-2.5 sm:pr-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5DCE0] text-[#D86F82]">
                <Heart className="h-3.5 w-3.5 fill-current" />
              </span>
              <div className="flex flex-col whitespace-nowrap">
                <span className="text-[11px] font-bold text-[#3F4951]">
                  {completed
                    ? "旅程重温完成"
                    : isLanded
                    ? `第 ${activeCityIndex + 1} / ${timelinePoints.length} 站`
                    : `飞往第 ${activeCityIndex + 1} 站`}
                </span>
                <span className="text-[10px] text-[#5A6670]/70 truncate max-w-[90px] sm:max-w-none">
                  {activeCity?.cityName || "甜蜜足迹"}
                </span>
              </div>
            </div>

            {/* Media Control Buttons */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1">
              {/* Prev station */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentLeg === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#5A6670] transition hover:bg-[#F5DCE0]/60 disabled:opacity-30"
                title="上一站"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Play / Pause or Replay */}
              {completed ? (
                <button
                  type="button"
                  onClick={handleReplay}
                  className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#D86F82] text-white shadow-md transition hover:scale-105 hover:bg-[#c95d70]"
                  title="再次重温旅程"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#D86F82] text-white shadow-md transition hover:scale-105 hover:bg-[#c95d70]"
                  title={isPlaying ? "暂停播放" : "继续飞行"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  )}
                </button>
              )}

              {/* Next station */}
              <button
                type="button"
                onClick={handleNext}
                disabled={currentLeg >= timelinePoints.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#5A6670] transition hover:bg-[#F5DCE0]/60 disabled:opacity-30"
                title="下一站"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Speed & Sound Utilities */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 border-l border-[#D8DDD8]/60 pl-2 sm:pl-3">
              {/* Speed Toggle */}
              <button
                type="button"
                onClick={() =>
                  setPlaybackSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))
                }
                className="rounded-full bg-[#FAF8F2] px-2 py-0.5 text-[10px] font-bold text-[#5A6670] border border-[#D8DDD8] transition hover:border-[#D86F82]"
                title="切换飞行倍速"
              >
                {playbackSpeed}x
              </button>

              {/* Sound Mute/Unmute */}
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="p-1 sm:p-1.5 text-[#5A6670]/70 hover:text-[#D86F82] transition"
                title={soundEnabled ? "关闭提示音" : "开启提示音"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-[#5A6670]/40" />
                )}
              </button>

              {/* Close trajectory mode */}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 sm:p-1.5 text-[#5A6670]/50 hover:text-[#5A6670] transition ml-0.5 sm:ml-1"
                  title="退出重温模式"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// Standalone trigger toggle button
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
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition backdrop-blur-md ${
        visible
          ? "border-[#D86F82] bg-[#D86F82] text-white shadow-[0_4px_14px_rgba(216,111,130,0.35)]"
          : "border-[#D8DDD8]/80 bg-[#FAFBF7]/90 text-[#5A6670] hover:border-[#D86F82] hover:text-[#D86F82]"
      }`}
      type="button"
      onClick={onToggle}
      aria-label={visible ? "退出旅程重温" : "✈️ 重温浪漫旅程"}
      title={visible ? "退出旅程重温" : "✈️ 重温浪漫旅程"}
    >
      <Plane className={`h-3.5 w-3.5 ${visible ? "fill-current" : ""}`} />
      <span>{visible ? "结束重温" : "重温浪漫旅程"}</span>
      <span
        className={`rounded-full px-1.5 py-0.2 text-[10px] ${
          visible ? "bg-white/20 text-white" : "bg-[#F5DCE0] text-[#D86F82]"
        }`}
      >
        {pointCount}城
      </span>
    </button>
  );
}
