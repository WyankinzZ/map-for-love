import { NextResponse, type NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getWritableDataDir } from "@/lib/server/dataDir";
import { readJsonValue, writeJsonValue } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sanitizeKey = (key: string) => key.replace(/[^a-zA-Z0-9_-]/g, "_");

function getSettingsFilePath(key: string) {
  const dir = path.join(getWritableDataDir(), "settings");
  return { dir, file: path.join(dir, `${sanitizeKey(key)}.json`) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });

    // Try supabase if configured
    try {
      const val = await readJsonValue(`settings:${key}`, null);
      if (val !== null) return NextResponse.json({ value: val });
    } catch {}

    // Fallback to local file in data/settings
    const { file } = getSettingsFilePath(key);
    const content = await readFile(file, "utf8").catch(() => null);
    if (content) {
      try {
        return NextResponse.json({ value: JSON.parse(content) });
      } catch {
        return NextResponse.json({ value: null });
      }
    }

    return NextResponse.json({ value: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const value = body.value;

    // Try supabase if configured
    try {
      await writeJsonValue(`settings:${key}`, value);
    } catch {}

    // Save to local file in data/settings
    const { dir, file } = getSettingsFilePath(key);
    await mkdir(dir, { recursive: true }).catch(() => {});
    await writeFile(file, JSON.stringify(value, null, 2), "utf8").catch(() => {});

    return NextResponse.json({ success: true, value });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
