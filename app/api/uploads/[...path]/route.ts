import { readFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { getBundledDataDir, getWritableDataDir } from "@/lib/server/dataDir";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path;
  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Decode URI segments (e.g. for non-ASCII Chinese folder or city names)
  const decodedSegments = pathSegments.map((seg) => {
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  });

  // Security check: reject directory traversal
  for (const seg of decodedSegments) {
    if (seg === ".." || seg.includes("/") || seg.includes("\\")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const safeRelativePath = path.join(...decodedSegments);

  // 1. Try writable data dir (user uploads)
  const writableUploadsDir = path.join(getWritableDataDir(), "uploads");
  const writableFullPath = path.join(writableUploadsDir, safeRelativePath);

  let fileBuffer: Buffer | null = null;
  try {
    fileBuffer = await readFile(writableFullPath);
  } catch {
    // 2. Try bundled data dir (if sample photos bundled with app)
    try {
      const bundledUploadsDir = path.join(getBundledDataDir(), "uploads");
      const bundledFullPath = path.join(bundledUploadsDir, safeRelativePath);
      fileBuffer = await readFile(bundledFullPath);
    } catch {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  const ext = path.extname(safeRelativePath).toLowerCase().replace(/^\./, "");
  const contentType = mimeByExtension[ext] || "application/octet-stream";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
