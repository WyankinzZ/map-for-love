"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { useState, useEffect, useSyncExternalStore } from "react";

type LocalPrivacyImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  loading?: "eager" | "lazy";
};

// Privacy substitution is disabled: real photos are always shown. Empty set +
// no dev-mode trigger means every check below resolves to false.
const localHostnames = new Set<string>();

const isPotentialPrivatePhoto = (src: string) =>
  src.startsWith("/photos/") ||
  src.startsWith("/logo/") ||
  src.startsWith("/api/uploads/") ||
  src.startsWith("data:image/") ||
  src.startsWith("blob:") ||
  src.startsWith("https://");

const localPrivacyPlaceholder =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="#d6e8f0"/>
  <path d="M0 0h640v480H0z" fill="#fafbf7" opacity=".34"/>
  <path d="M0 0h640v480H0z" fill="none" stroke="#d8ddd8" stroke-width="18"/>
  <g fill="#fafbf7" opacity=".62">
    <rect x="70" y="66" width="34" height="34"/>
    <rect x="138" y="66" width="34" height="34"/>
    <rect x="206" y="66" width="34" height="34"/>
    <rect x="274" y="66" width="34" height="34"/>
    <rect x="342" y="66" width="34" height="34"/>
    <rect x="410" y="66" width="34" height="34"/>
    <rect x="478" y="66" width="34" height="34"/>
    <rect x="546" y="66" width="34" height="34"/>
    <rect x="70" y="378" width="34" height="34"/>
    <rect x="138" y="378" width="34" height="34"/>
    <rect x="206" y="378" width="34" height="34"/>
    <rect x="274" y="378" width="34" height="34"/>
    <rect x="342" y="378" width="34" height="34"/>
    <rect x="410" y="378" width="34" height="34"/>
    <rect x="478" y="378" width="34" height="34"/>
    <rect x="546" y="378" width="34" height="34"/>
  </g>
  <g fill="#a8c8dc">
    <rect x="250" y="174" width="140" height="100" rx="10"/>
    <rect x="280" y="142" width="80" height="44" rx="8"/>
    <circle cx="320" cy="224" r="36" fill="#fafbf7"/>
    <circle cx="320" cy="224" r="20" fill="#a8c8dc"/>
  </g>
  <text x="320" y="330" text-anchor="middle" fill="#5a6670" font-size="28" font-family="Arial, sans-serif" font-weight="700">LOCAL PRIVACY MODE</text>
</svg>`);

export const isLocalPrivacyMode = () => {
  if (typeof window === "undefined") return false;

  return localHostnames.has(window.location.hostname);
};

export const getLocalPrivacyImageSrc = (src: string) =>
  isLocalPrivacyMode() && isPotentialPrivatePhoto(src) ? localPrivacyPlaceholder : src;

const subscribeToStaticPrivacyMode = () => () => {};

const getServerPrivacySnapshot = () => false;

const useLocalPrivacyMode = () =>
  useSyncExternalStore(subscribeToStaticPrivacyMode, isLocalPrivacyMode, getServerPrivacySnapshot);

export function LocalPrivacyImage({
  src,
  alt,
  className,
  fill,
  sizes,
  width,
  height,
  priority,
  loading,
}: Readonly<LocalPrivacyImageProps>) {
  const isLocalHost = useLocalPrivacyMode();
  const imageSrc = isLocalHost && isPotentialPrivatePhoto(src) ? localPrivacyPlaceholder : src;

  return (
    <Image
      className={className}
      src={imageSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      width={width}
      height={height}
      priority={priority}
      loading={loading}
      unoptimized
    />
  );
}

export function LocalPrivacyImg({
  src,
  alt,
  className,
  fallbackSrc,
}: Readonly<{
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}>) {
  const isLocalHost = useLocalPrivacyMode();
  const [hasError, setHasError] = useState(false);
  const [heicConvertedSrc, setHeicConvertedSrc] = useState<string | null>(null);

  const initialSrc = isLocalHost && isPotentialPrivatePhoto(src) ? localPrivacyPlaceholder : src;

  // Auto-convert existing legacy HEIC dataUrls saved in IndexedDB
  useEffect(() => {
    let cancelled = false;
    if (src && (src.startsWith("data:image/heic") || src.startsWith("data:image/heif"))) {
      (async () => {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          const { convertHeicToJpegBlob, readBlobAsDataUrl } = await import("@/utils/imageUtils");
          const jpegBlob = await convertHeicToJpegBlob(blob);
          const newUrl = await readBlobAsDataUrl(jpegBlob);
          if (!cancelled) setHeicConvertedSrc(newUrl);
        } catch (e) {
          console.warn("[LocalPrivacyImg] Legacy HEIC on-the-fly conversion failed:", e);
          if (!cancelled) setHasError(true);
        }
      })();
    } else {
      setHeicConvertedSrc(null);
      setHasError(false);
    }
    return () => {
      cancelled = true;
    };
  }, [src]);

  const resolvedSrc = heicConvertedSrc || (hasError ? (fallbackSrc || "/sprites/icons/city-dot.svg") : initialSrc);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={resolvedSrc}
      alt={alt}
      onError={() => {
        if (!hasError) setHasError(true);
      }}
    />
  );
}

export function LocalPrivacyBadge() {
  const isLocalHost = useLocalPrivacyMode();

  if (!isLocalHost) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] hidden items-center gap-2 rounded-full border border-[#D8DDD8]/80 bg-[#FAFBF7]/82 px-3 py-2 text-xs font-semibold text-[#5A6670]/62 shadow-[0_10px_26px_rgba(90,102,112,0.08)] backdrop-blur md:flex">
      <Camera className="h-3.5 w-3.5 text-[#A8C8DC]" />
      本地隐私展示
    </div>
  );
}
