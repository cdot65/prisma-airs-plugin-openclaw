/**
 * Prisma AIRS Scanner - SDK-backed Implementation
 *
 * Uses @cdot65/prisma-airs-sdk for HTTP communication with the AIRS API.
 * SDK must be initialized via init() before calling scan().
 * Exports a stable ScanResult interface consumed by all hook handlers.
 * CamelCase adapter types remain plugin-defined (SDK uses snake_case).
 */

import {
  globalConfiguration,
  Scanner as SDKScanner,
  Content,
  AISecSDKException,
} from "@cdot65/prisma-airs-sdk";
import type { ScanResponse, ContentErrorType, ErrorStatus } from "@cdot65/prisma-airs-sdk";

// Types
export type Action = "allow" | "warn" | "block";
export type Severity = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ToolEventMetadata {
  ecosystem: string;
  method: string;
  serverName: string;
  toolInvoked?: string;
}

export interface ToolEventInput {
  metadata: ToolEventMetadata;
  input?: string;
  output?: string;
}

export interface ToolDetectionFlags {
  injection?: boolean;
  urlCats?: boolean;
  dlp?: boolean;
  dbSecurity?: boolean;
  toxicContent?: boolean;
  maliciousCode?: boolean;
  agent?: boolean;
  topicViolation?: boolean;
}

export interface ToolDetected {
  verdict: string;
  metadata: ToolEventMetadata;
  summary: string;
  inputDetected?: ToolDetectionFlags;
  outputDetected?: ToolDetectionFlags;
}

export interface ScanRequest {
  prompt?: string;
  response?: string;
  sessionId?: string;
  trId?: string;
  profileName?: string;
  appName?: string;
  appUser?: string;
  aiModel?: string;
  toolEvents?: ToolEventInput[];
}

export interface PromptDetected {
  injection: boolean;
  dlp: boolean;
  urlCats: boolean;
  toxicContent: boolean;
  maliciousCode: boolean;
  agent: boolean;
  topicViolation: boolean;
}

export interface ResponseDetected {
  dlp: boolean;
  urlCats: boolean;
  dbSecurity: boolean;
  toxicContent: boolean;
  maliciousCode: boolean;
  agent: boolean;
  ungrounded: boolean;
  topicViolation: boolean;
}

export interface TopicGuardrails {
  allowedTopics: string[];
  blockedTopics: string[];
}

export interface DetectionDetails {
  topicGuardrailsDetails?: TopicGuardrails;
}

export interface PatternDetection {
  pattern: string;
  locations: number[][];
}

export interface MaskedData {
  data?: string;
  patternDetections: PatternDetection[];
}

export type { ContentErrorType, ErrorStatus };

export interface ContentError {
  contentType: ContentErrorType;
  feature: string;
  status: ErrorStatus;
}

export interface ScanResult {
  action: Action;
  severity: Severity;
  categories: string[];
  scanId: string;
  reportId: string;
  profileName: string;
  promptDetected: PromptDetected;
  responseDetected: ResponseDetected;
  sessionId?: string;
  trId?: string;
  latencyMs: number;
  error?: string;
  promptDetectionDetails?: DetectionDetails;
  responseDetectionDetails?: DetectionDetails;
  promptMaskedData?: MaskedData;
  responseMaskedData?: MaskedData;
  timeout: boolean;
  hasError: boolean;
  contentErrors: ContentError[];
  toolDetected?: ToolDetected;
  source?: string;
  profileId?: string;
  createdAt?: string;
  completedAt?: string;
}

/** Default prompt detection flags (all false) */
export function defaultPromptDetected(): PromptDetected {
  return {
    injection: false,
    dlp: false,
    urlCats: false,
    toxicContent: false,
    maliciousCode: false,
    agent: false,
    topicViolation: false,
  };
}

/** Default response detection flags (all false) */
export function defaultResponseDetected(): ResponseDetected {
  return {
    dlp: false,
    urlCats: false,
    dbSecurity: false,
    toxicContent: false,
    maliciousCode: false,
    agent: false,
    ungrounded: false,
    topicViolation: false,
  };
}

/**
 * Scan content through Prisma AIRS API using the SDK
 */
export async function scan(request: ScanRequest): Promise<ScanResult> {
  const profileName = request.profileName ?? "default";

  if (!globalConfiguration.initialized) {
    return {
      action: "warn",
      severity: "LOW",
      categories: ["api_error"],
      scanId: "",
      reportId: "",
      profileName,
      promptDetected: defaultPromptDetected(),
      responseDetected: defaultResponseDetected(),
      latencyMs: 0,
      timeout: false,
      hasError: false,
      contentErrors: [],
      error: "SDK not initialized. Call init() before scanning.",
    };
  }

  const startTime = Date.now();

  try {
    // Build Content object
    const contentOpts: Record<string, unknown> = {};
    if (request.prompt) contentOpts.prompt = request.prompt;
    if (request.response) contentOpts.response = request.response;

    // Map first tool event if present (SDK supports single toolEvent per Content)
    if (request.toolEvents && request.toolEvents.length > 0) {
      const te = request.toolEvents[0];
      contentOpts.toolEvent = {
        metadata: {
          ecosystem: te.metadata.ecosystem,
          method: te.metadata.method,
          server_name: te.metadata.serverName,
          ...(te.metadata.toolInvoked ? { tool_invoked: te.metadata.toolInvoked } : {}),
        },
        ...(te.input ? { input: te.input } : {}),
        ...(te.output ? { output: te.output } : {}),
      };
    }

    const content = new Content(contentOpts as ConstructorParameters<typeof Content>[0]);

    // Build scan options
    const opts: Record<string, unknown> = {};
    if (request.trId) opts.trId = request.trId;
    if (request.sessionId) opts.sessionId = request.sessionId;
    if (request.appName || request.appUser || request.aiModel) {
      const metadata: Record<string, string> = {};
      if (request.appName) metadata.app_name = request.appName;
      if (request.appUser) metadata.app_user = request.appUser;
      if (request.aiModel) metadata.ai_model = request.aiModel;
      opts.metadata = metadata;
    }

    const scanner = new SDKScanner();
    const data = await scanner.syncScan({ profile_name: profileName }, content, opts);

    const latencyMs = Date.now() - startTime;
    return mapScanResponse(data, profileName, request, latencyMs);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      action: "warn",
      severity: "LOW",
      categories: ["api_error"],
      scanId: "",
      reportId: "",
      profileName,
      promptDetected: defaultPromptDetected(),
      responseDetected: defaultResponseDetected(),
      latencyMs,
      timeout: false,
      hasError: true,
      contentErrors: [],
      error:
        err instanceof AISecSDKException
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
    };
  }
}

/**
 * Map SDK ScanResponse to plugin ScanResult
 */
export function mapScanResponse(
  data: ScanResponse,
  defaultProfileName: string,
  request: ScanRequest,
  latencyMs: number
): ScanResult {
  const scanId = data.scan_id ?? "";
  const reportId = data.report_id ?? "";
  const profileName = data.profile_name ?? defaultProfileName;
  const category = data.category ?? "benign";
  const actionStr = data.action ?? "allow";

  // Parse detection flags
  const promptDetected: PromptDetected = {
    injection: data.prompt_detected?.injection ?? false,
    dlp: data.prompt_detected?.dlp ?? false,
    urlCats: data.prompt_detected?.url_cats ?? false,
    toxicContent: data.prompt_detected?.toxic_content ?? false,
    maliciousCode: data.prompt_detected?.malicious_code ?? false,
    agent: data.prompt_detected?.agent ?? false,
    topicViolation: data.prompt_detected?.topic_violation ?? false,
  };

  const responseDetected: ResponseDetected = {
    dlp: data.response_detected?.dlp ?? false,
    urlCats: data.response_detected?.url_cats ?? false,
    dbSecurity: data.response_detected?.db_security ?? false,
    toxicContent: data.response_detected?.toxic_content ?? false,
    maliciousCode: data.response_detected?.malicious_code ?? false,
    agent: data.response_detected?.agent ?? false,
    ungrounded: data.response_detected?.ungrounded ?? false,
    topicViolation: data.response_detected?.topic_violation ?? false,
  };

  // Build categories list
  const categories: string[] = [];
  if (promptDetected.injection) categories.push("prompt_injection");
  if (promptDetected.dlp) categories.push("dlp_prompt");
  if (promptDetected.urlCats) categories.push("url_filtering_prompt");
  if (promptDetected.toxicContent) categories.push("toxic_content_prompt");
  if (promptDetected.maliciousCode) categories.push("malicious_code_prompt");
  if (promptDetected.agent) categories.push("agent_threat_prompt");
  if (promptDetected.topicViolation) categories.push("topic_violation_prompt");
  if (responseDetected.dlp) categories.push("dlp_response");
  if (responseDetected.urlCats) categories.push("url_filtering_response");
  if (responseDetected.dbSecurity) categories.push("db_security_response");
  if (responseDetected.toxicContent) categories.push("toxic_content_response");
  if (responseDetected.maliciousCode) categories.push("malicious_code_response");
  if (responseDetected.agent) categories.push("agent_threat_response");
  if (responseDetected.ungrounded) categories.push("ungrounded_response");
  if (responseDetected.topicViolation) categories.push("topic_violation_response");

  if (categories.length === 0) {
    categories.push(category === "benign" ? "safe" : category);
  }

  // Determine severity
  const anyDetected =
    Object.values(promptDetected).some(Boolean) || Object.values(responseDetected).some(Boolean);
  let severity: Severity;
  if (category === "malicious" || actionStr === "block") {
    severity = "CRITICAL";
  } else if (category === "suspicious") {
    severity = "HIGH";
  } else if (anyDetected) {
    severity = "MEDIUM";
  } else {
    severity = "SAFE";
  }

  // Map action
  let action: Action;
  if (actionStr === "block") {
    action = "block";
  } else if (actionStr === "alert") {
    action = "warn";
  } else {
    action = "allow";
  }

  // Extract detection details (optional)
  const promptDetectionDetails = parseDetectionDetails(data.prompt_detection_details);
  const responseDetectionDetails = parseDetectionDetails(data.response_detection_details);

  // Extract masked data (optional)
  const promptMaskedData = parseMaskedData(data.prompt_masked_data);
  const responseMaskedData = parseMaskedData(data.response_masked_data);

  // Extract timeout/error info
  const isTimeout = data.timeout === true;
  const hasError = data.error === true;
  const contentErrors: ContentError[] = (data.errors ?? []).map((e) => ({
    contentType: (e.content_type === "prompt" ? "prompt" : "response") as ContentErrorType,
    feature: e.feature ?? "",
    status: (e.status === "timeout" ? "timeout" : "error") as ErrorStatus,
  }));

  if (isTimeout && !categories.includes("partial_scan")) {
    categories.push("partial_scan");
  }

  const result: ScanResult = {
    action,
    severity,
    categories,
    scanId,
    reportId,
    profileName,
    promptDetected,
    responseDetected,
    sessionId: request.sessionId,
    trId: data.tr_id ?? request.trId,
    latencyMs,
    timeout: isTimeout,
    hasError,
    contentErrors,
  };

  if (promptDetectionDetails) result.promptDetectionDetails = promptDetectionDetails;
  if (responseDetectionDetails) result.responseDetectionDetails = responseDetectionDetails;
  if (promptMaskedData) result.promptMaskedData = promptMaskedData;
  if (responseMaskedData) result.responseMaskedData = responseMaskedData;

  // Extract tool detection (optional)
  const toolDetected = parseToolDetected(data.tool_detected);
  if (toolDetected) result.toolDetected = toolDetected;

  // Extract timestamps and metadata (optional)
  if (data.source) result.source = data.source;
  if (data.profile_id) result.profileId = data.profile_id;
  if (data.created_at) result.createdAt = data.created_at;
  if (data.completed_at) result.completedAt = data.completed_at;

  return result;
}

function parseDetectionDetails(raw?: {
  topic_guardrails_details?: Record<string, unknown>;
}): DetectionDetails | undefined {
  if (!raw) return undefined;
  const details: DetectionDetails = {};
  if (raw.topic_guardrails_details) {
    const tg = raw.topic_guardrails_details as {
      allowed_topics?: string[];
      blocked_topics?: string[];
    };
    details.topicGuardrailsDetails = {
      allowedTopics: tg.allowed_topics ?? [],
      blockedTopics: tg.blocked_topics ?? [],
    };
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

function parseMaskedData(raw?: {
  data?: string;
  pattern_detections?: { pattern?: string; locations?: number[][] }[];
}): MaskedData | undefined {
  if (!raw) return undefined;
  return {
    data: raw.data,
    patternDetections: (raw.pattern_detections ?? []).map((p) => ({
      pattern: p.pattern ?? "",
      locations: p.locations ?? [],
    })),
  };
}

function parseToolDetectionFlags(raw?: Record<string, unknown>): ToolDetectionFlags | undefined {
  if (!raw) return undefined;
  const flags: ToolDetectionFlags = {};
  if (raw.injection != null) flags.injection = raw.injection as boolean;
  if (raw.url_cats != null) flags.urlCats = raw.url_cats as boolean;
  if (raw.dlp != null) flags.dlp = raw.dlp as boolean;
  if (raw.db_security != null) flags.dbSecurity = raw.db_security as boolean;
  if (raw.toxic_content != null) flags.toxicContent = raw.toxic_content as boolean;
  if (raw.malicious_code != null) flags.maliciousCode = raw.malicious_code as boolean;
  if (raw.agent != null) flags.agent = raw.agent as boolean;
  if (raw.topic_violation != null) flags.topicViolation = raw.topic_violation as boolean;
  return Object.keys(flags).length > 0 ? flags : undefined;
}

function parseToolDetected(raw?: {
  verdict?: string;
  metadata?: Record<string, unknown>;
  summary?: unknown;
  input_detected?: Record<string, unknown>;
  output_detected?: Record<string, unknown>;
}): ToolDetected | undefined {
  if (!raw || !raw.metadata) return undefined;
  const result: ToolDetected = {
    verdict: raw.verdict ?? "",
    metadata: {
      ecosystem: (raw.metadata.ecosystem as string) ?? "",
      method: (raw.metadata.method as string) ?? "",
      serverName: (raw.metadata.server_name as string) ?? "",
      toolInvoked: raw.metadata.tool_invoked as string | undefined,
    },
    summary: typeof raw.summary === "string" ? raw.summary : "",
  };
  const inputDetected = parseToolDetectionFlags(raw.input_detected);
  const outputDetected = parseToolDetectionFlags(raw.output_detected);
  if (inputDetected) result.inputDetected = inputDetected;
  if (outputDetected) result.outputDetected = outputDetected;
  return result;
}

/**
 * Check if SDK is initialized (API key configured)
 */
export function isConfigured(apiKey?: string): boolean {
  // Support both: direct apiKey check (for plugin config) and SDK state
  return apiKey ? true : globalConfiguration.initialized;
}
