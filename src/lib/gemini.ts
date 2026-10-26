// gemini.ts — thin REST wrapper around the Gemini Interactions API.
// Server-only. Contract verified against ai.google.dev/gemini-api/docs/function-calling
// and /docs/interactions-overview (last-updated 2026-09/10): POST /v1beta/interactions,
// header x-goog-api-key, steps[].type 'function_call' with {id, name, arguments},
// continuation = previous_interaction_id + function_result step, system_instruction
// is interaction-scoped (re-specified each call), store=true (default) for chaining.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

export type StepType = "thought" | "function_call" | "function_result" | "model_output";

export interface AgentStep {
  type: StepType;
  id?: string; // function_call step id → used as call_id in the function_result step
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

export function geminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is missing — paste it into .env.local.");
  return key;
}

/** Lets callers degrade gracefully (demo mode) instead of hard-crashing the demo. */
export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

async function postInteractions(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = geminiApiKey();
  const doFetch = () =>
    fetch(`${BASE}/interactions`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 429 || res.status >= 500) {
    // single retry, documented fallback per ARCHITECTURE.md
    await new Promise((r) => setTimeout(r, 1200));
    res = await doFetch();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini interactions ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return json;
}

function parseInteraction(json: Record<string, unknown>): InteractionResult {
  const id = typeof json.id === "string" ? json.id : "";
  const rawSteps = Array.isArray(json.steps) ? (json.steps as Record<string, unknown>[]) : [];
  const steps: AgentStep[] = rawSteps.map((s) => {
    const type = (typeof s.type === "string" ? s.type : "model_output") as StepType;
    const out: AgentStep = { type };
    if (typeof s.id === "string") out.id = s.id;
    else if (typeof s.call_id === "string") out.id = s.call_id;
    if (typeof s.name === "string") out.name = s.name;
    if (s.arguments && typeof s.arguments === "object") {
      out.arguments = s.arguments as Record<string, unknown>;
    }
    if (typeof s.output_text === "string") out.outputText = s.output_text;
    else if (Array.isArray(s.content)) {
      // model_output may carry content: [{type:'text', text}]
      for (const c of s.content as Record<string, unknown>[]) {
        if (c?.type === "text" && typeof c.text === "string") out.outputText = c.text as string;
      }
    }
    return out;
  });
  const functionCalls = steps.filter((s) => s.type === "function_call" && s.name);
  const outputText =
    (typeof json.output_text === "string" && json.output_text) ||
    steps.filter((s) => s.outputText).map((s) => s.outputText as string).slice(-1)[0] ||
    "";
  return { id, outputText, steps, functionCalls };
}

export async function createInteraction(opts: CreateInteractionInput): Promise<InteractionResult> {
  const body: Record<string, unknown> = { model: MODEL, input: opts.input };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.systemInstruction) body.system_instruction = opts.systemInstruction;
  if (opts.previousId) body.previous_interaction_id = opts.previousId;
  // store: true (API default) — needed for previous_interaction_id chaining; free tier
  // retains for 1 day, which covers a hackathon demo window.
  return parseInteraction(await postInteractions(body));
}

/** The function_result step shape for continuing an interaction after executing tools. */
export function functionResultStep(name: string, callId: string, resultJson: string): unknown {
  return {
    type: "function_result",
    name,
    call_id: callId,
    result: [{ type: "text", text: resultJson }],
  };
}
