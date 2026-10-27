// api/tts — server-only spoken replies. POST { text } -> audio/wav bytes.
// Gemini native speech (Live-family voice); client falls back to speechSynthesis
// on any non-200. Text is clamped so a runaway reply can't cost a fortune.
import { NextRequest, NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/gemini";
import { geminiTts } from "@/lib/tts";

export async function POST(req: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 800) : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  try {
    const wav = await geminiTts(text);
    return new NextResponse(new Uint8Array(wav), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "Content-Length": String(wav.length),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err).slice(0, 300) },
      { status: 502 },
    );
  }
}
