import { NextRequest, NextResponse } from "next/server";
import {
  getPointsMaintenanceHealth,
  isMaintenanceAuthorized,
  unauthorizedMaintenanceResponse,
} from "@/lib/server/pointsMaintenance";
import { isSupabaseAdminConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      { error: "Supabase service role is not configured" },
      { status: 503 },
    );
  }

  if (!isMaintenanceAuthorized(req)) {
    return unauthorizedMaintenanceResponse();
  }

  try {
    return NextResponse.json(await getPointsMaintenanceHealth());
  } catch (err) {
    console.error("[points/health]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
