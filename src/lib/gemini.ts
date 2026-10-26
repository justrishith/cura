// Gemini transport — REST against the Interactions API (GA June 2026, per docs
// checked 2026-10-25). Server-only. No SDK dependency.
//
// Shapes per https://ai.google.dev/gemini-api/docs/function-calling (REST samples):
//   POST /v1beta/interactions  { model, input, tools?, system_instruction?,
//                                previous_interaction_id?, store? }
//   steps[].type === "function_call" → { name, arguments, id (call_id) }
//   results sent as input: [{ type:"function_result", name, call_id,
//                             result: [{ type:"text", text }] }]

const BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

export type ToolFunction = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ExecutedToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  callId?: string;
};

export type Exchange = {
  interactionId: string | null;
  text: string | null;
  calls: ExecutedToolCall[];
};

type InteractionStep = {
  type?: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: unknown;
  text?: string;
  output?: { text?: string }[];
  output_text?: string;
};

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing in .env.local");
  return key;
}

async function post(body: unknown): Promise<unknown> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": requireKey(),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json as { error?: { message?: string } })?.error?.message ??
      `Gemini HTTP ${res.status}`;
    throw new Error(`Gemini request failed: ${msg}`);
  }
  return json;
}

/**
 * Parse an interactions response defensively:
 * prefer `output_text`, else join any message/model_output step text.
 */
export function parseExchange(json: unknown): Exchange {
  const j = json as { id?: string; output_text?: string; steps?: InteractionStep[] };
  const steps = Array.isArray(j.steps) ? j.steps : [];
  const calls: ExecutedToolCall[] = [];
  let text: string | null = j.output_text ?? null;

  if (text == null) {
    const parts: string[] = [];
    for (const s of steps) {
      if (typeof s.output_text === "string") parts.push(s.output_text);
      else if (typeof s.text === "string") parts.push(s.text);
      else if (Array.isArray(s.output)) {
        for (const o of s.output) if (typeof o?.text === "string") parts.push(o.text);
      }
    }
    const joined = parts.join("\n").trim();
    text = joined.length ? joined : null;
  }

  for (const s of steps) {
    if (s.type === "function_call" && s.name) {
      calls.push({
        name: s.name,
        arguments: (s.arguments ?? {}) as Record<string, unknown>,
        callId: s.id ?? s.call_id,
      });
    }
  }
  return { interactionId: j.id ?? null, text, calls };
}

export async function createInteraction(opts: {
  input: string;
  tools?: ToolFunction[];
  systemInstruction?: string;
}): Promise<Exchange> {
  const body: Record<string, unknown> = {
    model: GEMINI_MODEL,
    input: opts.input,
    store: true, // needed to chain function_result rounds; free tier retains 1 day, demo data only
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.systemInstruction) body.system_instruction = opts.systemInstruction;
  return parseExchange(await post(body));
}

export async function sendFunctionResults(opts: {
  previousInteractionId: string;
  results: { name: string; callId?: string; text: string }[];
  tools: ToolFunction[];
  systemInstruction?: string;
}): Promise<Exchange> {
  const body: Record<string, unknown> = {
    model: GEMINI_MODEL,
    input: opts.results.map((r) => ({
      type: "function_result",
      name: r.name,
      ...(r.callId ? { call_id: r.callId } : {}),
      result: [{ type: "text", text: r.text }],
    })),
    tools: opts.tools,
    previous_interaction_id: opts.previousInteractionId,
    store: true,
  };
  if (opts.systemInstruction) body.system_instruction = opts.systemInstruction;
  return parseExchange(await post(body));
}
