import { NextResponse } from "next/server";
import { isDemoGifsLocalAllowList } from "@/features/billing/demo-gifs-mode";

export function GET() {
  // Cheap probe for `pnpm demo:gifs`: true only when the Next process was
  // started with the demo flag on the local allow-list (fixtures applied).
  const demoGifsBilling =
    process.env.PROSEFIELD_DEMO_GIFS === "1" && isDemoGifsLocalAllowList();

  return NextResponse.json({
    ok: true,
    service: "prosefield",
    timestamp: new Date().toISOString(),
    demoGifsBilling,
  });
}
