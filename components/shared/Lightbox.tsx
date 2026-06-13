"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { LocalPrivacyImage, LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { isBrowserImageUrl } from "@/components/province/Shared";

export interface LightboxPhoto {
  src: string;
  alt?: string;
  caption?: string;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  initialIndex?: number;
  onClose: () => void;
}

export function Lightbox({ photos, initialIndex = 0, onClose }: Readonly<LightboxProps>) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, goPrev, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0].clientX - touchStart);
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > 60) {
      if (touchDelta > 0) goPrev();
      else goNext();
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  const photo = photos[currentIndex];
  if (!photo) return null;

  const renderImage = (src: string, alt: string) => {
    if (isBrowserImageUrl(src)) {
      return (
        <LocalPrivacyImg
          className="max-h-[80vh] max-w-[90vw] object-contain select-none"
          src={src}
          alt={alt}
        />
      );
    }
    return (
      <LocalPrivacyImage
        className="max-h-[80vh] max-w-[90vw] object-contain select-none"
        src={src}
        alt={alt}
        width={1200}
        height={800}
        priority
      />
    );
  };

  const content = (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white/80 transition hover:bg-white/25 hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        {photos.length > 1 && (
          <>
            <button
              className="absolute left-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white/80 transition hover:bg-white/25 hover:text-white"
              type="button"
              onClick={goPrev}
              aria-label="上一张"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              className="absolute right-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white/80 transition hover:bg-white/25 hover:text-white md:right-16"
              type="button"
              onClick={goNext}
              aria-label="下一张"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{ transform: `translateX(${touchDelta * 0.3}px)` }}
          >
            {renderImage(photo.src, photo.alt ?? "")}

            {(photo.caption || photos.length > 1) && (
              <div className="flex items-center gap-3 text-sm text-white/70">
                {photo.caption && <span>{photo.caption}</span>}
                {photos.length > 1 && (
                  <span className="text-white/50">
                    {currentIndex + 1} / {photos.length}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );

  return mounted ? createPortal(content, document.body) : null;
}
