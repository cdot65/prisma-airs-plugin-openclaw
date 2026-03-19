/**
 * Prisma AIRS LLM Audit Logger (llm_input + llm_output)
 *
 * Fire-and-forget hooks that scan the exact LLM I/O through AIRS.
 * Provides definitive audit trail at the LLM boundary.
 *
 * - llm_input: scans the prompt sent to the model
 * - llm_output: scans the response received from the model
 */

import { scan, type ScanResult } from "../../src/scanner.ts";

// Discriminated union for both event types
interface LlmInputEvent {
  hookEvent: "llm_input";
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
}

interface LlmOutputEvent {
  hookEvent: "llm_output";
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}

type LlmAuditEvent = LlmInputEvent | LlmOutputEvent;

interface HookContext {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  cfg?: {
    plugins?: {
      entries?: {
        "prisma-airs"?: {
          config?: {
            profile_name?: string;
            app_name?: string;
            llm_audit_mode?: string;
          };
        };
      };
    };
  };
}

/**
 * Handle llm_input event — scan prompt sent to LLM
 */
async function handleInput(event: LlmInputEvent, ctx: HookContext): Promise<void> {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  const profileName = cfg?.profile_name ?? "default";
  const appName = cfg?.app_name ?? "openclaw";
  const sessionKey = ctx.sessionKey ?? event.sessionId ?? "unknown";

  // Build scan content: system prompt + user prompt
  const parts: string[] = [];
  if (event.systemPrompt) {
    parts.push(`[system]: ${event.systemPrompt}`);
  }
  parts.push(event.prompt);
  const content = parts.join("\n");

  if (!content.trim()) return;

  let result: ScanResult;
  try {
    result = await scan({ prompt: content, profileName, appName });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "prisma_airs_llm_input_error",
        timestamp: new Date().toISOString(),
        sessionKey,
        runId: event.runId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return;
  }

  console.log(
    JSON.stringify({
      event: "prisma_airs_llm_input_audit",
      timestamp: new Date().toISOString(),
      sessionKey,
      runId: event.runId,
      provider: event.provider,
      model: event.model,
      action: result.action,
      severity: result.severity,
      categories: result.categories,
      scanId: result.scanId,
      reportId: result.reportId,
      latencyMs: result.latencyMs,
      promptDetected: result.promptDetected,
    })
  );
}

/**
 * Handle llm_output event — scan response from LLM
 */
async function handleOutput(event: LlmOutputEvent, ctx: HookContext): Promise<void> {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  const profileName = cfg?.profile_name ?? "default";
  const appName = cfg?.app_name ?? "openclaw";
  const sessionKey = ctx.sessionKey ?? event.sessionId ?? "unknown";

  // Concatenate assistant texts
  const content = event.assistantTexts.join("\n");
  if (!content.trim()) return;

  let result: ScanResult;
  try {
    result = await scan({ response: content, profileName, appName });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "prisma_airs_llm_output_error",
        timestamp: new Date().toISOString(),
        sessionKey,
        runId: event.runId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return;
  }

  console.log(
    JSON.stringify({
      event: "prisma_airs_llm_output_audit",
      timestamp: new Date().toISOString(),
      sessionKey,
      runId: event.runId,
      provider: event.provider,
      model: event.model,
      action: result.action,
      severity: result.severity,
      categories: result.categories,
      scanId: result.scanId,
      reportId: result.reportId,
      latencyMs: result.latencyMs,
      responseDetected: result.responseDetected,
      usage: event.usage,
    })
  );
}

/**
 * Main hook handler — dispatches based on hookEvent type
 */
const handler = async (event: LlmAuditEvent, ctx: HookContext): Promise<void> => {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  const mode = cfg?.llm_audit_mode ?? "deterministic";

  if (mode === "off") return;

  if (event.hookEvent === "llm_input") {
    await handleInput(event, ctx);
  } else if (event.hookEvent === "llm_output") {
    await handleOutput(event, ctx);
  }
};

export default handler;
