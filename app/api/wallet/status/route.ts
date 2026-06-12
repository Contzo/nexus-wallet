import { NextResponse, NextRequest } from "next/server";
import { getOperationStatus } from "../../../controllers/wallet.controller";

export async function GET(request: NextRequest) {
  const hash = new URL(request.url).searchParams.get("hash");
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid or missing hash." }, { status: 400 });
  }

  try {
    const result = await getOperationStatus(hash as `0x${string}`);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/wallet/status] Error:", e);
    return NextResponse.json({ error: "Failed to fetch operation status." }, { status: 500 });
  }
}
