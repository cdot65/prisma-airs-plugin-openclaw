/**
 * Prisma AIRS Scanner - TypeScript Implementation
 *
 * Direct HTTP calls to Prisma AIRS API.
 */

// AIRS API endpoint
const AIRS_API_BASE = "https://service.api.aisecurity.paloaltonetworks.com";
const AIRS_SCAN_ENDPOINT = `${AIRS_API_BASE}/v1/scan/sync/request`;

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

export type ContentErrorType = "prompt" | "response";
export type ErrorStatus = "error" | "timeout";

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

// AIRS API request/response types (per OpenAPI spec)
interface AIRSContentItem {
  prompt?: string;
  response?: string;
  tool_calls?: AIRSToolEvent[];
}

interface AIRSToolEvent {
  metadata: {
    ecosystem: string;
    method: string;
    server_name: string;
    tool_invoked?: string;
  };
  input?: string;
  output?: string;
}

interface AIRSRequest {
  ai_profile: {
    profile_name?: string;
    profile_id?: string;
  };
  contents: AIRSContentItem[];
  tr_id?: string;
  session_id?: string;
  metadata?: {
    app_name?: string;
    app_user?: string;
    ai_model?: string;
  };
}

interface AIRSPromptDetected {
  injection?: boolean;
  dlp?: boolean;
  url_cats?: boolean;
  toxic_content?: boolean;
  malicious_code?: boolean;
  agent?: boolean;
  topic_violation?: boolean;
}

interface AIRSResponseDetected {
  dlp?: boolean;
  url_cats?: boolean;
  db_security?: boolean;
  toxic_content?: boolean;
  malicious_code?: boolean;
  agent?: boolean;
  ungrounded?: boolean;
  topic_violation?: boolean;
}

interface AIRSTopicGuardrails {
  allowed_topics?: string[];
  blocked_topics?: string[];
}

interface AIRSDetectionDetails {
  topic_guardrails_details?: AIRSTopicGuardrails;
}

interface AIRSPatternDetection {
  pattern?: string;
  locations?: number[][];
}

interface AIRSMaskedData {
  data?: string;
  pattern_detections?: AIRSPatternDetection[];
}

interface AIRSContentError {
  content_type?: string;
  feature?: string;
  status?: string;
}

interface AIRSToolDetectionFlags {
  injection?: boolean;
  url_cats?: boolean;
  dlp?: boolean;
  db_security?: boolean;
  toxic_content?: boolean;
  malicious_code?: boolean;
  agent?: boolean;
  topic_violation?: boolean;
}

interface AIRSToolDetected {
  verdict?: string;
  metadata?: {
    ecosystem?: string;
    method?: string;
    server_name?: string;
    tool_invoked?: string;
  };
  summary?: string;
  input_detected?: AIRSToolDetectionFlags;
  output_detected?: AIRSToolDetectionFlags;
}

interface AIRSResponse {
  scan_id?: string;
  report_id?: string;
  profile_name?: string;
  category?: string;
  action?: string;
  prompt_detected?: AIRSPromptDetected;
  response_detected?: AIRSResponseDetected;
  prompt_detection_details?: AIRSDetectionDetails;
  response_detection_details?: AIRSDetectionDetails;
  prompt_masked_data?: AIRSMaskedData;
  response_masked_data?: AIRSMaskedData;
  tr_id?: string;
  timeout?: boolean;
  error?: boolean;
  errors?: AIRSContentError[];
  tool_detected?: AIRSToolDetected;
  source?: string;
  profile_id?: string;
  created_at?: string;
  completed_at?: string;
}

/**
 * Scan content through Prisma AIRS API
 */
export async function scan(request: ScanRequest): Promise<ScanResult> {
  const apiKey = process.env.PANW_AI_SEC_API_KEY;
  // Profile name: request param > env var > default
  const profileName = request.profileName ?? process.env.PANW_AI_SEC_PROFILE_NAME ?? "default";

  if (!apiKey) {
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
      error: "PANW_AI_SEC_API_KEY not set",
    };
  }

  const startTime = Date.now();

  // Build contents array
  const contentItem: AIRSContentItem = {};
  if (request.prompt) contentItem.prompt = request.prompt;
  if (request.response) contentItem.response = request.response;

  // Map tool events into contents
  if (request.toolEvents && request.toolEvents.length > 0) {
    contentItem.tool_calls = request.toolEvents.map((te) => ({
      metadata: {
        ecosystem: te.metadata.ecosystem,
        method: te.metadata.method,
        server_name: te.metadata.serverName,
        ...(te.metadata.toolInvoked ? { tool_invoked: te.metadata.toolInvoked } : {}),
      },
      ...(te.input ? { input: te.input } : {}),
      ...(te.output ? { output: te.output } : {}),
    }));
  }

  // Build request body (per OpenAPI spec)
  const body: AIRSRequest = {
    ai_profile: {
      profile_name: profileName,
    },
    contents: [contentItem],
  };

  // Add optional tracking IDs
  if (request.trId) body.tr_id = request.trId;
  if (request.sessionId) body.session_id = request.sessionId;

  // Add metadata if provided
  if (request.appName || request.appUser || request.aiModel) {
    body.metadata = {};
    if (request.appName) body.metadata.app_name = request.appName;
    if (request.appUser) body.metadata.app_user = request.appUser;
    if (request.aiModel) body.metadata.ai_model = request.aiModel;
  }

  try {
    const resp = await fetch(AIRS_SCAN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-pan-token": apiKey,
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - startTime;

    if (!resp.ok) {
      const errorText = await resp.text();
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
        error: `API error ${resp.status}: ${errorText}`,
      };
    }

    const data: AIRSResponse = await resp.json();
    return parseResponse(data, profileName, request, latencyMs);
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
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Parse AIRS API response into ScanResult
 */
function parseResponse(
  data: AIRSResponse,
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
  // Prompt detections
  if (promptDetected.injection) categories.push("prompt_injection");
  if (promptDetected.dlp) categories.push("dlp_prompt");
  if (promptDetected.urlCats) categories.push("url_filtering_prompt");
  if (promptDetected.toxicContent) categories.push("toxic_content_prompt");
  if (promptDetected.maliciousCode) categories.push("malicious_code_prompt");
  if (promptDetected.agent) categories.push("agent_threat_prompt");
  if (promptDetected.topicViolation) categories.push("topic_violation_prompt");
  // Response detections
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

function parseDetectionDetails(raw?: AIRSDetectionDetails): DetectionDetails | undefined {
  if (!raw) return undefined;
  const details: DetectionDetails = {};
  if (raw.topic_guardrails_details) {
    details.topicGuardrailsDetails = {
      allowedTopics: raw.topic_guardrails_details.allowed_topics ?? [],
      blockedTopics: raw.topic_guardrails_details.blocked_topics ?? [],
    };
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

function parseMaskedData(raw?: AIRSMaskedData): MaskedData | undefined {
  if (!raw) return undefined;
  return {
    data: raw.data,
    patternDetections: (raw.pattern_detections ?? []).map((p) => ({
      pattern: p.pattern ?? "",
      locations: p.locations ?? [],
    })),
  };
}

function parseToolDetectionFlags(raw?: AIRSToolDetectionFlags): ToolDetectionFlags | undefined {
  if (!raw) return undefined;
  const flags: ToolDetectionFlags = {};
  if (raw.injection != null) flags.injection = raw.injection;
  if (raw.url_cats != null) flags.urlCats = raw.url_cats;
  if (raw.dlp != null) flags.dlp = raw.dlp;
  if (raw.db_security != null) flags.dbSecurity = raw.db_security;
  if (raw.toxic_content != null) flags.toxicContent = raw.toxic_content;
  if (raw.malicious_code != null) flags.maliciousCode = raw.malicious_code;
  if (raw.agent != null) flags.agent = raw.agent;
  if (raw.topic_violation != null) flags.topicViolation = raw.topic_violation;
  return Object.keys(flags).length > 0 ? flags : undefined;
}

function parseToolDetected(raw?: AIRSToolDetected): ToolDetected | undefined {
  if (!raw || !raw.metadata) return undefined;
  const result: ToolDetected = {
    verdict: raw.verdict ?? "",
    metadata: {
      ecosystem: raw.metadata.ecosystem ?? "",
      method: raw.metadata.method ?? "",
      serverName: raw.metadata.server_name ?? "",
      toolInvoked: raw.metadata.tool_invoked,
    },
    summary: raw.summary ?? "",
  };
  const inputDetected = parseToolDetectionFlags(raw.input_detected);
  const outputDetected = parseToolDetectionFlags(raw.output_detected);
  if (inputDetected) result.inputDetected = inputDetected;
  if (outputDetected) result.outputDetected = outputDetected;
  return result;
}

/**
 * Check if API key is configured
 */
export function isConfigured(): boolean {
  return !!process.env.PANW_AI_SEC_API_KEY;
}
