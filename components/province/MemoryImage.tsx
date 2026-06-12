import { LocalPrivacyImage, LocalPrivacyImg } from "@/components/LocalPrivacyImage";
import { isBrowserImageUrl } from "./Shared";

export function MemoryImage({
  src,
  alt,
  dim = false,
  fit = "contain",
}: Readonly<{ src: string; alt: string; dim?: boolean; fit?: "contain" | "cover" }>) {
  const objectClass = fit === "cover" ? "object-cover" : "object-contain";
  const className = `pixelated h-full w-full ${objectClass} ${dim ? "opacity-50 grayscale" : ""}`;

  if (isBrowserImageUrl(src)) {
    return (
      <LocalPrivacyImg className={className} src={src} alt={alt} />
    );
  }

  return (
    <LocalPrivacyImage
      className={`pixelated ${objectClass} ${dim ? "opacity-50 grayscale" : ""}`}
      src={src}
      alt={alt}
      fill
      sizes="292px"
    />
  );
}

