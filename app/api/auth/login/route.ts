import { NextResponse, type NextRequest } from "next/server";
import {
  clearAuthCookies,
  getMissingAuthEnv,
  setAuthCookies,
  type AuthRole,
  verifyPassword,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseLoginPayload = (payload: unknown): { role: AuthRole; password: string } | null => {
  if (!isRecord(payload) || typeof payload.password !== "string") return null;

  return {
    role: payload.mode === "admin" ? "admin" : "site",
    password: payload.password,
  };
};

const parseLogoutPayload = (payload: unknown): AuthRole | "all" => {
  if (!isRecord(payload)) return "all";
  if (payload.mode === "site" || payload.mode === "admin") return payload.mode;

  return "all";
};

export async function POST(request: NextRequest) {
  const payload = parseLoginPayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
  }

  const missingEnv = getMissingAuthEnv(true);
  if (missingEnv.length > 0) {
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  }

  if (!verifyPassword(payload.role, payload.password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role: payload.role });
  setAuthCookies(response, payload.role);

  return response;
}

export async function DELETE(request: NextRequest) {
  const role = parseLogoutPayload(await request.json().catch(() => null));
  const response = NextResponse.json({ ok: true });

  clearAuthCookies(response, role);

  return response;
}
