export const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Image read failed"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image read failed")));
    reader.readAsDataURL(blob);
  });

export const readFileAsDataUrl = (file: File) => readBlobAsDataUrl(file);

export const isHeicFile = (file: File | Blob): boolean => {
  const type = file.type ? file.type.toLowerCase() : "";
  if (type.includes("heic") || type.includes("heif")) return true;
  if ("name" in file && typeof file.name === "string") {
    return /\.(heic|heif)$/i.test(file.name);
  }
  return false;
};

export async function convertHeicToJpegBlob(file: Blob): Promise<Blob> {
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    console.warn("[convertHeicToJpegBlob] heic2any conversion failed:", err);
    throw err;
  }
}

export const loadImageBlob = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(blob);
    const image = new window.Image();

    image.addEventListener(
      "load",
      () => {
        URL.revokeObjectURL(imageUrl);
        resolve(image);
      },
      { once: true },
    );
    image.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("Image load failed"));
      },
      { once: true },
    );
    image.src = imageUrl;
  });

export const loadImageFile = (file: File) => loadImageBlob(file);

export async function readCompressedImageDataUrl(
  file: File | Blob,
  {
    maxDimension,
    quality,
  }: Readonly<{
    maxDimension: number;
    quality: number;
  }>,
): Promise<string> {
  if (file.type === "image/svg+xml") return readFileAsDataUrl(file as File);

  let targetBlob: Blob = file;

  // 1. If it's a HEIC/HEIF photo (iOS or Android high-efficiency mode), convert to standard JPEG
  if (isHeicFile(file)) {
    try {
      targetBlob = await convertHeicToJpegBlob(file);
    } catch (heicErr) {
      console.warn("[readCompressedImageDataUrl] HEIC conversion skipped or failed:", heicErr);
    }
  }

  // 2. Modern background decode & downscale with createImageBitmap (avoids huge memory spikes on 50MP+ photos)
  if (typeof window !== "undefined" && typeof window.createImageBitmap === "function") {
    try {
      const probeBitmap = await window.createImageBitmap(targetBlob);
      const srcW = probeBitmap.width;
      const srcH = probeBitmap.height;
      probeBitmap.close();

      const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
      const targetW = Math.max(1, Math.round(srcW * scale));
      const targetH = Math.max(1, Math.round(srcH * scale));

      const bitmap = await window.createImageBitmap(targetBlob, {
        resizeWidth: targetW,
        resizeHeight: targetH,
        resizeQuality: "high",
      });

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FAFBF7";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const jpegBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", quality);
        });

        if (jpegBlob) {
          return await readBlobAsDataUrl(jpegBlob);
        }
      } else {
        bitmap.close();
      }
    } catch (bitmapErr) {
      console.warn("[readCompressedImageDataUrl] createImageBitmap failed, falling back to Image element:", bitmapErr);
    }
  }

  // 3. Fallback to standard Image element + Canvas
  try {
    const image = await loadImageBlob(targetBlob);
    const naturalWidth = image.naturalWidth || image.width || 800;
    const naturalHeight = image.naturalHeight || image.height || 600;
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return readBlobAsDataUrl(targetBlob);

    context.fillStyle = "#FAFBF7";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (blob) return await readBlobAsDataUrl(blob);
  } catch (err) {
    console.warn("[readCompressedImageDataUrl] Image element compression failed:", err);
  }

  // 4. Final safety fallback
  return readBlobAsDataUrl(targetBlob);
}
