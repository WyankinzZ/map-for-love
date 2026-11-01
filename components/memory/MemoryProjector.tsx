"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  Heart,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { type Memory, moodConfig } from "@/data/memories";
import { type City } from "@/data/cities";
import { LocalPrivacyImg, LocalPrivacyImage } from "@/components/LocalPrivacyImage";

export interface ProjectorSlide {
  memory: Memory;
  city?: City;
}

const isBrowserImageUrl = (url: string) =>
  url.startsWith("data:image/") || url.startsWith("https://") || url.startsWith("blob:");

// Pentatonic scale frequencies for gentle music box chime melody
const CHIME_NOTES = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66 // D6
];

// Soothing arpeggio pattern of note indices
const MELODY_PATTERN = [0, 2, 4, 3, 1, 4, 5, 2, 0, 3, 4, 1];

export default function MemoryProjector({
  slides,
  initialIndex = 0,
  isOpen,
  onClose,
}: {
  slides: ProjectorSlide[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [intervalSec, setIntervalSec] = useState<number>(5);
  const [progress, setProgress] = useState(0); // 0 to 1 for progress bar
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundTimerRef = useRef<number | null>(null);
  const melodyStepRef = useRef(0);

  // Sync initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setIsPlaying(true);
    }
  }, [isOpen, initialIndex]);

  // Web Audio Music Box synthesizer
  const playChimeNote = useCallback((freq: number, volume = 0.04) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Sine wave with soft harmonic tone
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      // Music box chime envelope (instant attack, long sweet decay)
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      // Subtle projector mechanical tick sound
      const tickOsc = ctx.createOscillator();
      const tickGain = ctx.createGain();
      tickOsc.type = "triangle";
      tickOsc.frequency.setValueAtTime(140, now);
      tickGain.gain.setValueAtTime(0.015, now);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      tickOsc.connect(tickGain);
      tickGain.connect(ctx.destination);
      tickOsc.start(now);
      tickOsc.stop(now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.85);
    } catch {
      // Audio autoplay policy fallback
    }
  }, []);

  // Ambient chime & projector audio loop
  useEffect(() => {
    if (!isOpen || !soundEnabled || !isPlaying) {
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
      return;
    }

    // Play initial gentle note on start
    const step = melodyStepRef.current % MELODY_PATTERN.length;
    playChimeNote(CHIME_NOTES[MELODY_PATTERN[step]], 0.05);

    soundTimerRef.current = window.setInterval(() => {
      melodyStepRef.current++;
      const currentStep = melodyStepRef.current % MELODY_PATTERN.length;
      playChimeNote(CHIME_NOTES[MELODY_PATTERN[currentStep]], 0.045);
    }, 1400);

    return () => {
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
    };
  }, [isOpen, soundEnabled, isPlaying, playChimeNote]);

  // Slideshow auto-advance progress loop
  useEffect(() => {
    if (!isOpen || !isPlaying || slides.length === 0) return;

    const stepMs = 50;
    const totalMs = intervalSec * 1000;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + stepMs / totalMs;
        if (next >= 1) {
          // Advance slide
          setCurrentIndex((idx) => (idx < slides.length - 1 ? idx + 1 : 0));
          return 0;
        }
        return next;
      });
    }, stepMs);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, intervalSec, slides.length]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setProgress(0);
    setCurrentIndex((idx) => (idx > 0 ? idx - 1 : slides.length - 1));
  }, [slides.length]);

  const handleNext = useCallback(() => {
    setProgress(0);
    setCurrentIndex((idx) => (idx < slides.length - 1 ? idx + 1 : 0));
  }, [slides.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "m") {
        setSoundEnabled((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentSlide = slides[currentIndex];
  const activeMemory = currentSlide?.memory;
  const activeCity = currentSlide?.city;
  const cityName = activeCity?.name || activeMemory?.city || "城市回忆";
  const currentMood = activeMemory?.mood ? moodConfig[activeMemory.mood] : null;

  // GPS coordinates formatted
  const gpsString =
    activeCity && typeof activeCity.lng === "number" && typeof activeCity.lat === "number"
      ? `${activeCity.lng.toFixed(2)}°E, ${activeCity.lat.toFixed(2)}°N`
      : "";

  if (!isOpen || slides.length === 0 || !activeMemory || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col justify-between overflow-hidden bg-[#121418] text-[#FAFBF7] select-none">
      {/* 1. Projector Lens & Light Beam Ambient Effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#E86F82]/20 via-[#181C20]/60 to-[#101215] opacity-90" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-b from-[#FFF2F4]/20 via-[#E8B8C2]/5 to-transparent blur-3xl opacity-60" />

      {/* 2. Top Bar: Progress countdown, cinema logo & utilities */}
      <div className="relative z-10 w-full px-6 pt-5">
        {/* Continuous auto-advance progress line */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full bg-gradient-to-r from-[#F5DCE0] via-[#E86F82] to-[#F5DCE0]"
            style={{ width: `${progress * 100}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        {/* Header utilities */}
        <div className="mt-3.5 flex items-center justify-between">
          {/* Cinema Projector Title */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E86F82]/20 text-[#E8B8C2]">
              <Clapperboard className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-white uppercase">
                  时光放映机
                </span>
                <span className="rounded-full bg-[#E86F82]/20 px-2 py-0.5 text-[10px] font-semibold text-[#E8B8C2]">
                  独家电影放映
                </span>
              </div>
              <p className="text-[10px] text-white/40">
                回忆正在自动放映中 · 浪漫永不落幕
              </p>
            </div>
          </div>

          {/* Right utility buttons */}
          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <div className="hidden sm:flex rounded-full bg-white/10 p-0.5 text-[10px] font-semibold text-white/70">
              {[3, 5, 8].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setIntervalSec(sec)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    intervalSec === sec
                      ? "bg-[#D86F82] text-white shadow-xs"
                      : "hover:text-white"
                  }`}
                >
                  {sec}秒
                </button>
              ))}
            </div>

            {/* Sound Toggle Button with animated wave */}
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md transition hover:bg-white/20"
              title={soundEnabled ? "静音 (按 M 键)" : "开启伴音 (按 M 键)"}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="h-4 w-4 text-[#E8B8C2]" />
                  <span className="hidden sm:inline text-[11px]">放映伴音</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4 text-white/40" />
                  <span className="hidden sm:inline text-[11px] text-white/40">静音</span>
                </>
              )}
            </button>

            {/* Fullscreen Toggle - Hidden on mobile screens */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden sm:grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur-md transition hover:bg-white/20"
              title={isFullscreen ? "退出全屏" : "全屏放映"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur-md transition hover:bg-[#D86F82] hover:text-white"
              title="退出放映 (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Stage: Floating Cinema Photo & Subtitle Details */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-4 sm:px-12">
        {/* Previous Button */}
        <button
          type="button"
          onClick={handlePrev}
          className="group absolute left-4 sm:left-8 z-30 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/80 shadow-xl backdrop-blur-md transition hover:scale-110 hover:bg-[#D86F82] hover:text-white"
          title="上一张 (←)"
        >
          <ChevronLeft className="h-6 w-6 transition group-hover:-translate-x-0.5" />
        </button>

        {/* Current Active Photo Frame with Ken Burns Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMemory.id}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
            className="flex flex-col items-center max-w-4xl w-full"
          >
            {/* The Vintage Movie Frame */}
            <div className="relative max-h-[58vh] w-auto overflow-hidden rounded-[14px] border border-white/20 bg-black/60 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
              {/* Subtle film sprocket holes decoration */}
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-b from-black/50 to-transparent z-10" />

              {/* Photo with Ken Burns slow zoom */}
              <motion.div
                initial={{ scale: 1, x: 0 }}
                animate={{ scale: 1.08, x: currentIndex % 2 === 0 ? 10 : -10 }}
                transition={{ duration: intervalSec + 1, ease: "easeOut" }}
                className="relative flex items-center justify-center max-h-[58vh]"
              >
                {isBrowserImageUrl(activeMemory.image) ? (
                  <LocalPrivacyImg
                    src={activeMemory.image}
                    alt={cityName}
                    className="max-h-[58vh] w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="relative h-[55vh] w-[70vw] max-w-[720px]">
                    <LocalPrivacyImage
                      src={activeMemory.image}
                      alt={cityName}
                      fill
                      className="object-contain"
                    />
                  </div>
                )}
              </motion.div>

              {/* Slide counter pill */}
              <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 font-mono text-xs font-semibold text-white/90 backdrop-blur-md">
                <span className="text-[#E8B8C2]">
                  {String(currentIndex + 1).padStart(2, "0")}
                </span>
                <span className="text-white/40"> / </span>
                <span>{String(slides.length).padStart(2, "0")}</span>
              </div>
            </div>

            {/* Movie Subtitles & Quotes */}
            <div className="mt-5 text-center max-w-2xl px-4">
              {/* Title & Coordinates */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-wide text-white">
                  《 {cityName} · {activeMemory.text.slice(0, 12) || "两人的浪漫漫游"} 》
                </h2>
                {currentMood && (
                  <span className="rounded-full bg-[#E86F82]/30 px-2 py-0.5 text-xs font-semibold text-[#E8B8C2]">
                    {currentMood.emoji} {currentMood.label}
                  </span>
                )}
              </div>

              {/* Date & Hall */}
              <p className="mt-1 text-xs font-medium text-[#E8B8C2]/90 tracking-wider">
                {activeMemory.date} · {gpsString ? `GPS: ${gpsString} · ` : ""}情侣专属放映厅
              </p>

              {/* The Dialogue / Quotation */}
              {activeMemory.text && (
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-white/85 font-serif italic">
                  “ {activeMemory.text} ”
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Next Button */}
        <button
          type="button"
          onClick={handleNext}
          className="group absolute right-4 sm:right-8 z-30 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/80 shadow-xl backdrop-blur-md transition hover:scale-110 hover:bg-[#D86F82] hover:text-white"
          title="下一张 (→)"
        >
          <ChevronRight className="h-6 w-6 transition group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* 4. Bottom Controls & Filmstrip Slider */}
      <div className="relative z-10 w-full px-6 pb-6 flex flex-col items-center gap-3">
        {/* Play / Pause Pill */}
        <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 backdrop-blur-md border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={handlePrev}
            className="text-white/70 hover:text-white transition p-1"
            title="上一部"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center gap-1.5 rounded-full bg-[#D86F82] px-4 py-1.5 text-xs font-bold text-white shadow-md transition hover:scale-105 hover:bg-[#c95d70]"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>暂停放映</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                <span>继续放映</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="text-white/70 hover:text-white transition p-1"
            title="下一部"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Filmstrip Thumbnail Ticker */}
        <div className="flex max-w-full items-center gap-2 overflow-x-auto px-4 py-1.5 scrollbar-none">
          {slides.map((slide, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={slide.memory.id + idx}
                type="button"
                onClick={() => {
                  setProgress(0);
                  setCurrentIndex(idx);
                }}
                className={`relative h-11 w-16 shrink-0 overflow-hidden rounded-[5px] border transition-all ${
                  isActive
                    ? "border-[#E86F82] ring-2 ring-[#F5DCE0] scale-105 opacity-100"
                    : "border-white/20 opacity-40 hover:opacity-80"
                }`}
              >
                {isBrowserImageUrl(slide.memory.image) ? (
                  <LocalPrivacyImg
                    src={slide.memory.image}
                    alt="缩略图"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <LocalPrivacyImage
                    src={slide.memory.image}
                    alt="缩略图"
                    fill
                    className="object-cover"
                  />
                )}
                {/* City watermark */}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-white font-medium truncate px-1 text-center">
                  {slide.city?.name || slide.memory.city}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
