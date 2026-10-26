// gemini.ts — REST transport for the check-in brain.
// IMPLEMENTATION NOTE (2026-10-26, live-tested): the Interactions API + model
// gemini-3.8-flash stalled indefinitely from this key/network (0 bytes >75s on
// valid bodies, POST and generateContent both). Validated fallback:
//   POST /v1beta/models/{model}:generateContent with function_declarations
//   model default gemini-3.6-flash — plain turn ~2s, tool turn ~3-35s, HTTP 200.
// Sharp edge: system_instruction must be a Content object ({parts:[{text}]}),
// not a string; continuations echo the model content (thoughtSignature) back as
// turn N with the functionResponse as an extra user-role part.
// Local Map keeps per-conversation contents for previousId chaining (same
// guarantees the Interactions API server-storage gave us). Cold-start loss of
// the Map degrades to a fresh call whose input carries flattened thread text.
// Server-only.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const TIMEOUT_MS = 45_000;

export type StepType = "function_call" | "model_output";

export interface AgentStep {
  type: StepType;
  id?: string; // functionCall.id from the API (call_*)
  name?: string;
  arguments?: Record<string, unknown>;
  outputText?: string; // model_output payload
}

export interface InteractionResult {
  id: string;
  outputText: string;
  steps: AgentStep[];
  functionCalls: AgentStep[];
}

export interface CreateInteractionInput {
  /** Plain string input for a new turn, or a function_result step array for continuation. */
  input: string | unknown[];
  tools?: unknown[];
  systemInstruction?: string;
  previousId?: string | null;
}

type RawContent = {
  role?: string;
  parts: Record<string, unknown>[];
};

const conversations = new Map<
  string,
  { contents: RawContent[]; systemInstruction: string | undefined }
>();

export function geminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is missing — paste it into .env.local.");
  return key;
}

/** Lets callers degrade gracefully (demo mode) instead of hard-crashing the demo. */
export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** Interaction-style tool declaration → generateContent function_declaration. */
function toGenerateContentTools(tools?: unknown[]): unknown[] | undefined {
  if (!tools?.length) return undefined;
  const declarations = tools
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object" && "name" in t)
    .map((t) => ({
      name: t.name,
      ...(t.description ? { description: t.description } : {}),
      ...(t.parameters ? { parameters: t.parameters } : {}),
    }));
  if (declarations.length === 0) return undefined;
  return [{ function_declarations: declarations }];
}

function asSystemContent(systemInstruction?: string) {
  if (!systemInstruction) return undefined;
  return { parts: [{ text: systemInstruction }] };
}

async function postGenerateContent(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = geminiApiKey();
  const call = () =>
    fetch(`${BASE}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS), // never let a hung call freeze the demo request
    });

  let res = await call();
  if (res.status === 429 || res.status >= 500) {
    // single retry, documented fallback per ARCHITECTURE.md
    await new Promise((r) => setTimeout(r, 1200));
    res = await call();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini generateContent ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return json;
}

/** The function_result step shape callers build; translated to functionResponse on send. */
export function functionResultStep(name: string, callId: string, resultJson: string): unknown {
  return {
    type: "function_result",
    name,
    call_id: callId,
    result: [{ type: "text", text: resultJson }],
  };
}

function parseGenerateContent(json: Record<string, unknown>, convoKey: string): InteractionResult {
  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  const content = (candidates[0] as { content?: { parts?: Record<string, unknown>[]; role?: string } } | undefined)?.content;
  const rawParts = Array.isArray(content?.parts) ? content!.parts : [];

  const steps: AgentStep[] = [];
  const functionCalls: AgentStep[] = [];
  const texts: string[] = [];
  let callIndex = 0;
  for (const p of rawParts) {
    if (p.functionCall && typeof p.functionCall === "object") {
      const fc = p.functionCall as { name?: string; args?: Record<string, unknown>; id?: string };
      const step: AgentStep = {
        type: "function_call",
        id: fc.id ?? `call_${convoKey}_${callIndex}`,
        name: fc.name,
        arguments: fc.args ?? {},
      };
      steps.push(step);
      functionCalls.push(step);
      callIndex += 1;
    } else if (typeof p.text === "string" && p.text) {
      texts.push(p.text);
    }
  }
  const outputText = texts[texts.length - 1] ?? texts.join("\n") ?? "";
  return { id: convoKey, outputText, steps, functionCalls };
}

/** Model turn echoed back as-is — verified: thoughtSignature + functionCall parts round-trip cleanly. */
function sanitizeContent(content: { role?: string; parts?: Record<string, unknown>[] }): RawContent {
  return {
    role: content.role ?? "model",
    parts: content.parts ?? [],
  };
}

function functionResponses(userText: string, results: unknown[]): RawContent {
  const parts: Record<string, unknown>[] = [];
  for (const r of results) {
    const step = r as { type?: string; name?: string; result?: { text?: string }[] };
    const text = step.result?.map((x) => (x as { text?: string }).text ?? "").join("") ?? "{}";
    let response: unknown;
    try {
      response = JSON.parse(text);
    } catch {
      response = { result: text };
    }
    parts.push({
      functionResponse: {
        name: step.name ?? "unknown_tool",
        response,
      },
    });
  }
  return { role: "user", parts };
}

export async function createInteraction(opts: CreateInteractionInput): Promise<InteractionResult> {
  const chainable = typeof opts.previousId === "string" && conversations.has(opts.previousId);
  const convoKey = chainable ? (opts.previousId as string) : `gc_${crypto.randomUUID()}`;

  const tools = toGenerateContentTools(opts.tools);
  const entry = conversations.get(convoKey);

  if (chainable && entry) {
    // Completion round: continue the stored conversation with tool results.
    if (Array.isArray(opts.input)) {
      entry.contents.push(functionResponses("", opts.input));
    } else {
      entry.contents.push({ role: "user", parts: [{ text: opts.input }] });
    }
    entry.systemInstruction = opts.systemInstruction ?? entry.systemInstruction;
  } else {
    // Fresh conversation. Map loss (cold start) + string input = stateless turn;
    // routes pass flattened history inside the string for this case.
    if (conversations.size > 40) {
      const first = conversations.keys().next();
      if (!first.done) conversations.delete(first.value);
    }
    const text = typeof opts.input === "string" ? opts.input : JSON.stringify(opts.input);
    conversations.set(convoKey, {
      contents: [{ role: "user", parts: [{ text }] }],
      systemInstruction: opts.systemInstruction,
    });
  }

  const entry2 = conversations.get(convoKey)!;
  const body: Record<string, unknown> = {
    contents: entry2.contents,
    ...(tools ? { tools } : {}),
    ...(asSystemContent(entry2.systemInstruction) ? { system_instruction: asSystemContent(entry2.systemInstruction) } : {}),
  };
  const json = await postGenerateContent(body);
  const result = parseGenerateContent(json, convoKey);

  // Persist the model turn (incl. functionCall parts) for the next round.
  const modelContent = (json as { candidates?: { content?: { role?: string; parts?: Record<string, unknown>[] } }[] })
    .candidates?.[0]?.content;
  if (modelContent?.parts?.length && result.functionCalls.length > 0) {
    entry2.contents.push(sanitizeContent(modelContent));
  } else if (result.outputText) {
    entry2.contents.push({ role: "model", parts: [{ text: result.outputText }] });
  }
  return result;
}
