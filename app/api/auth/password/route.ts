import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function POST(request: NextRequest) {
  const authError = requireAdminSession(request);
  if (authError) return authError;

  const payload = await request.json().catch(() => null);
  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const target = payload.target === "admin" ? "admin" : payload.target === "site" ? "site" : null;
  const newPassword = typeof payload.newPassword === "string" ? payload.newPassword.trim() : "";

  if (!target) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }
  if (newPassword.length < 1 || newPassword.length > 64) {
    return NextResponse.json({ error: "Password length must be 1-64" }, { status: 400 });
  }

  // Update the running server immediately (verifyPassword reads process.env).
  if (target === "site") {
    process.env.SITE_PASSWORD = newPassword;
  } else {
    process.env.ADMIN_PASSWORD = newPassword;
  }

  // Persist to the desktop auth config so the new password survives restarts.
  const configPath = process.env.MAP_OF_US_AUTH_CONFIG;
  if (configPath) {
    try {
      let config: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(await readFile(configPath, "utf8")) as unknown;
        if (isRecord(parsed)) config = parsed;
      } catch {
        config = {};
      }

      config.sitePassword = process.env.SITE_PASSWORD;
      config.adminPassword = process.env.ADMIN_PASSWORD;
      if (typeof config.cookieSecret !== "string" && process.env.AUTH_COOKIE_SECRET) {
        config.cookieSecret = process.env.AUTH_COOKIE_SECRET;
      }

      await mkdir(path.dirname(configPath), { recursive: true });
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    } catch {
      return NextResponse.json(
        { error: "Password updated for this session, but saving to disk failed." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, persisted: Boolean(configPath) });
}
