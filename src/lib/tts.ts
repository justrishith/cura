// tts.ts — Gemini native speech generation (Live API family voices) for Cura's
// spoken replies. Server-only: takes the agent's reply text, asks the TTS model
// to speak it in a warm, unhurried companion voice, converts the returned raw
// PCM into a WAV the browser can play directly.
// Fallback contract: the client stays on Web Speech speechSynthesis whenever
// this errors (missing key / model unavailable / rate limit).

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE ?? "Aoede"; // breezy, warm, unhurried
const TIMEOUT_MS = 30_000;

interface TtsResult {
  mime: string; // e.g. "audio/L16;codec=pcm;rate=24000"
  base64: string;
}

async function requestTts(text: string): Promise<TtsResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is missing — paste it into .env.local.");

  const body = {
    contents: [
      {
        parts: [
          {
            text: `Speak this aloud in the warm, reassuring voice of a kind care companion — natural, gentle pace: ${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
      },
    },
  };

  const call = () =>
    fetch(`${BASE}/${TTS_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let res = await call();
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await call();
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini TTS ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { inlineData?: { mimeType?: string; data?: string } }[];
      };
    }[];
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini TTS returned no audio part.");
  return { mime: part.inlineData.mimeType ?? "audio/L16;rate=24000", base64: part.inlineData.data };
}

function sampleRateFromMime(mime: string): number {
  const m = /rate=(\d+)/i.exec(mime);
  const rate = m ? Number(m[1]) : 24_000;
  return rate > 8000 && rate <= 192_000 ? rate : 24_000;
}

/** Wrap headerless 16-bit LE mono PCM in a minimal 44-byte RIFF/WAVE container. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** The one call other code uses. Returns a WAV buffer ready to serve. */
export async function geminiTts(text: string): Promise<Buffer> {
  const { mime, base64 } = await requestTts(text);
  const pcm = Buffer.from(base64, "base64");
  if (pcm.length < 100) throw new Error("Gemini TTS audio too short.");
  return pcmToWav(pcm, sampleRateFromMime(mime));
}
