import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/server/auth";
import { getOssConfig, setOssConfig, type OssConfig } from "@/lib/server/oss";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authError = requireAdminSession(request);
  if (authError) return authError;

  const config = await getOssConfig();
  return NextResponse.json({ config: config ?? {} });
}

export async function POST(request: NextRequest) {
  const authError = requireAdminSession(request);
  if (authError) return authError;

  const config = (await request.json()) as OssConfig;
  await setOssConfig(config);
  return NextResponse.json({ success: true, config });
}
