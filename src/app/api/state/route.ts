import { NextResponse } from "next/server";
import { loadState, saveState } from "@/lib/store";
import { normalize } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadState());
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const state = { ...normalize(body), updatedAt: Date.now() };
  await saveState(state);
  return NextResponse.json({ updatedAt: state.updatedAt });
}
