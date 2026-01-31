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

export interface ScanRequest {
  prompt?: string;
  response?: string;
  sessionId?: string;
  trId?: string;
  profileName?: string;
  appName?: string;
  appUser?: string;
  aiModel?: string;
}

export interface PromptDetected {
  injection: boolean;
  dlp: boolean;
  urlCats: boolean;
}

export interface ResponseDetected {
  dlp: boolean;
  urlCats: boolean;
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
}

// AIRS API request/response types (per OpenAPI spec)
interface AIRSContentItem {
  prompt?: string;
  response?: string;
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
}

interface AIRSResponseDetected {
  dlp?: boolean;
  url_cats?: boolean;
}

interface AIRSResponse {
  scan_id?: string;
  report_id?: string;
  profile_name?: string;
  category?: string;
  action?: string;
  prompt_detected?: AIRSPromptDetected;
  response_detected?: AIRSResponseDetected;
  tr_id?: string;
}

/**
 * Scan content through Prisma AIRS API
 */
export async function scan(request: ScanRequest): Promise<ScanResult> {
  const apiKey = process.env.PANW_AI_SEC_API_KEY;
  if (!apiKey) {
    return {
      action: "warn",
      severity: "LOW",
      categories: ["api_error"],
      scanId: "",
      reportId: "",
      profileName: request.profileName ?? "default",
      promptDetected: { injection: false, dlp: false, urlCats: false },
      responseDetected: { dlp: false, urlCats: false },
      latencyMs: 0,
      error: "PANW_AI_SEC_API_KEY not set",
    };
  }

  const startTime = Date.now();

  // Build contents array
  const contentItem: AIRSContentItem = {};
  if (request.prompt) contentItem.prompt = request.prompt;
  if (request.response) contentItem.response = request.response;

  // Build request body (per OpenAPI spec)
  const body: AIRSRequest = {
    ai_profile: {
      profile_name: request.profileName ?? "default",
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
        profileName: request.profileName ?? "default",
        promptDetected: { injection: false, dlp: false, urlCats: false },
        responseDetected: { dlp: false, urlCats: false },
        latencyMs,
        error: `API error ${resp.status}: ${errorText}`,
      };
    }

    const data: AIRSResponse = await resp.json();
    return parseResponse(data, request, latencyMs);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      action: "warn",
      severity: "LOW",
      categories: ["api_error"],
      scanId: "",
      reportId: "",
      profileName: request.profileName ?? "default",
      promptDetected: { injection: false, dlp: false, urlCats: false },
      responseDetected: { dlp: false, urlCats: false },
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Parse AIRS API response into ScanResult
 */
function parseResponse(data: AIRSResponse, request: ScanRequest, latencyMs: number): ScanResult {
  const scanId = data.scan_id ?? "";
  const reportId = data.report_id ?? "";
  const profileName = data.profile_name ?? request.profileName ?? "default";
  const category = data.category ?? "benign";
  const actionStr = data.action ?? "allow";

  // Parse detection flags
  const promptDetected: PromptDetected = {
    injection: data.prompt_detected?.injection ?? false,
    dlp: data.prompt_detected?.dlp ?? false,
    urlCats: data.prompt_detected?.url_cats ?? false,
  };

  const responseDetected: ResponseDetected = {
    dlp: data.response_detected?.dlp ?? false,
    urlCats: data.response_detected?.url_cats ?? false,
  };

  // Build categories list
  const categories: string[] = [];
  if (promptDetected.injection) categories.push("prompt_injection");
  if (promptDetected.dlp) categories.push("dlp_prompt");
  if (promptDetected.urlCats) categories.push("url_filtering_prompt");
  if (responseDetected.dlp) categories.push("dlp_response");
  if (responseDetected.urlCats) categories.push("url_filtering_response");

  if (categories.length === 0) {
    categories.push(category === "benign" ? "safe" : category);
  }

  // Determine severity
  let severity: Severity;
  if (category === "malicious" || actionStr === "block") {
    severity = "CRITICAL";
  } else if (category === "suspicious") {
    severity = "HIGH";
  } else if (
    promptDetected.injection ||
    promptDetected.dlp ||
    promptDetected.urlCats ||
    responseDetected.dlp ||
    responseDetected.urlCats
  ) {
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

  return {
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
  };
}

/**
 * Check if API key is configured
 */
export function isConfigured(): boolean {
  return !!process.env.PANW_AI_SEC_API_KEY;
}
