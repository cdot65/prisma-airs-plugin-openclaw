# ScanResult Interface

Complete reference for the `ScanResult` interface and its sub-types. Defined in `prisma-airs-plugin/src/scanner.ts`. This is the plugin's adapter layer between the SDK's snake_case `ScanResponse` and all 12 hook handlers.

## ScanResult

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `Action` | Yes | Resolved action: `"allow"`, `"warn"`, or `"block"` |
| `severity` | `Severity` | Yes | Computed severity level |
| `categories` | `string[]` | Yes | List of detection category strings |
| `scanId` | `string` | Yes | AIRS scan identifier (empty string on error) |
| `reportId` | `string` | Yes | AIRS report identifier (empty string on error) |
| `profileName` | `string` | Yes | AIRS profile used for the scan |
| `promptDetected` | `PromptDetected` | Yes | Prompt-side detection flags |
| `responseDetected` | `ResponseDetected` | Yes | Response-side detection flags |
| `latencyMs` | `number` | Yes | Scan round-trip time in milliseconds |
| `timeout` | `boolean` | Yes | Whether the scan timed out |
| `hasError` | `boolean` | Yes | Whether the scan encountered an error |
| `contentErrors` | `ContentError[]` | Yes | Per-content-type error details |
| `sessionId` | `string` | No | Session identifier from request |
| `trId` | `string` | No | Transaction ID from response or request |
| `error` | `string` | No | Error message when scan fails |
| `promptDetectionDetails` | `DetectionDetails` | No | Topic guardrail details for prompt |
| `responseDetectionDetails` | `DetectionDetails` | No | Topic guardrail details for response |
| `promptMaskedData` | `MaskedData` | No | Masked data info for prompt |
| `responseMaskedData` | `MaskedData` | No | Masked data info for response |
| `toolDetected` | `ToolDetected` | No | Tool-level detection result |
| `source` | `string` | No | Scan source metadata |
| `profileId` | `string` | No | AIRS profile ID |
| `createdAt` | `string` | No | Scan creation timestamp |
| `completedAt` | `string` | No | Scan completion timestamp |

## Action

```typescript
type Action = "allow" | "warn" | "block";
```

Mapping from AIRS API:

| API Value | Plugin Action |
|-----------|---------------|
| `"allow"` | `"allow"` |
| `"alert"` | `"warn"` |
| `"block"` | `"block"` |

## Severity

```typescript
type Severity = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
```

Computed from API response:

| Condition | Severity |
|-----------|----------|
| `category === "malicious"` or `action === "block"` | `CRITICAL` |
| `category === "suspicious"` | `HIGH` |
| Any detection flag is true | `MEDIUM` |
| No detections | `SAFE` |

!!! note
    `LOW` severity is used only for error fallback results (SDK not initialized or scan exception), not computed from normal API responses.

## PromptDetected

Detection flags for prompt-side analysis.

| Field | Type | Description |
|-------|------|-------------|
| `injection` | `boolean` | Prompt injection attempt detected |
| `dlp` | `boolean` | Sensitive data in prompt |
| `urlCats` | `boolean` | Disallowed URL categories in prompt |
| `toxicContent` | `boolean` | Toxic/harmful content in prompt |
| `maliciousCode` | `boolean` | Malicious code patterns in prompt |
| `agent` | `boolean` | AI agent manipulation attempt |
| `topicViolation` | `boolean` | Topic policy violation in prompt |

## ResponseDetected

Detection flags for response-side analysis.

| Field | Type | Description |
|-------|------|-------------|
| `dlp` | `boolean` | Sensitive data leakage in response |
| `urlCats` | `boolean` | Disallowed URL categories in response |
| `dbSecurity` | `boolean` | Database security threat in response |
| `toxicContent` | `boolean` | Toxic/harmful content in response |
| `maliciousCode` | `boolean` | Malicious code patterns in response |
| `agent` | `boolean` | AI agent threat in response |
| `ungrounded` | `boolean` | Ungrounded/hallucinated content |
| `topicViolation` | `boolean` | Topic policy violation in response |

!!! info "PromptDetected vs ResponseDetected"
    `PromptDetected` has `injection` (prompt-only). `ResponseDetected` has `dbSecurity` and `ungrounded` (response-only). All other flags appear in both.

## Category Strings

Built from detection flags in `mapScanResponse()`. When a flag is true, the corresponding category string is added:

| Detection Flag | Category String |
|----------------|-----------------|
| `promptDetected.injection` | `prompt_injection` |
| `promptDetected.dlp` | `dlp_prompt` |
| `promptDetected.urlCats` | `url_filtering_prompt` |
| `promptDetected.toxicContent` | `toxic_content_prompt` |
| `promptDetected.maliciousCode` | `malicious_code_prompt` |
| `promptDetected.agent` | `agent_threat_prompt` |
| `promptDetected.topicViolation` | `topic_violation_prompt` |
| `responseDetected.dlp` | `dlp_response` |
| `responseDetected.urlCats` | `url_filtering_response` |
| `responseDetected.dbSecurity` | `db_security_response` |
| `responseDetected.toxicContent` | `toxic_content_response` |
| `responseDetected.maliciousCode` | `malicious_code_response` |
| `responseDetected.agent` | `agent_threat_response` |
| `responseDetected.ungrounded` | `ungrounded_response` |
| `responseDetected.topicViolation` | `topic_violation_response` |

When no flags are true, the category defaults to `"safe"` (if API returns `"benign"`) or the raw API `category` value.

If `timeout` is true, `"partial_scan"` is appended.

## ToolDetected

Returned when scanning tool events via the `toolEvent` content type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `verdict` | `string` | Yes | Tool-level verdict string |
| `metadata` | `ToolEventMetadata` | Yes | Tool metadata |
| `summary` | `string` | Yes | Summary (parsed from string or `{verdict, action}` object) |
| `inputDetected` | `ToolDetectionFlags` | No | Detection flags on tool input |
| `outputDetected` | `ToolDetectionFlags` | No | Detection flags on tool output |

### ToolEventMetadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ecosystem` | `string` | Yes | Tool ecosystem (e.g., `"mcp"`) |
| `method` | `string` | Yes | Method name (e.g., `"tool_call"`) |
| `serverName` | `string` | Yes | Server providing the tool |
| `toolInvoked` | `string` | No | Specific tool name invoked |

### ToolDetectionFlags

All fields are optional; only present when the corresponding flag was returned by the API.

| Field | Type | Description |
|-------|------|-------------|
| `injection` | `boolean` | Injection detected |
| `urlCats` | `boolean` | URL category violation |
| `dlp` | `boolean` | Data loss prevention trigger |
| `dbSecurity` | `boolean` | Database security threat |
| `toxicContent` | `boolean` | Toxic content |
| `maliciousCode` | `boolean` | Malicious code |
| `agent` | `boolean` | Agent threat |
| `topicViolation` | `boolean` | Topic violation |

## ContentError

| Field | Type | Description |
|-------|------|-------------|
| `contentType` | `ContentErrorType` | `"prompt"` or `"response"` |
| `feature` | `string` | Feature that errored (e.g., `"dlp"`) |
| `status` | `ErrorStatus` | `"timeout"` or `"error"` |

`ContentErrorType` and `ErrorStatus` are re-exported from `@cdot65/prisma-airs-sdk`.

## DetectionDetails

| Field | Type | Description |
|-------|------|-------------|
| `topicGuardrailsDetails` | `TopicGuardrails` | Topic guardrail evaluation results |

### TopicGuardrails

| Field | Type | Description |
|-------|------|-------------|
| `allowedTopics` | `string[]` | Topics that passed guardrails |
| `blockedTopics` | `string[]` | Topics that were blocked |

## MaskedData

| Field | Type | Description |
|-------|------|-------------|
| `data` | `string` | Masked version of the content |
| `patternDetections` | `PatternDetection[]` | Pattern match details |

### PatternDetection

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | `string` | Pattern name that matched |
| `locations` | `number[][]` | Character offset ranges of matches |

## ScanRequest

Input to the `scan()` function.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | `string` | No | Prompt text to scan |
| `response` | `string` | No | Response text to scan |
| `sessionId` | `string` | No | Session identifier |
| `trId` | `string` | No | Transaction ID |
| `profileName` | `string` | No | AIRS profile (defaults to `"default"`) |
| `appName` | `string` | No | Application name for metadata |
| `appUser` | `string` | No | User identifier for metadata |
| `aiModel` | `string` | No | AI model name for metadata |
| `toolEvents` | `ToolEventInput[]` | No | Tool events to scan (first element used) |

### ToolEventInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata` | `ToolEventMetadata` | Yes | Tool metadata |
| `input` | `string` | No | Tool input content |
| `output` | `string` | No | Tool output content |

!!! note "Single Tool Event"
    The SDK `Content` supports a single `toolEvent`, not an array. The plugin takes the first element from `toolEvents[]`.

## Example Results

### Safe Content

```json
{
  "action": "allow",
  "severity": "SAFE",
  "categories": ["safe"],
  "scanId": "scan_abc123xyz",
  "reportId": "report_def456",
  "profileName": "default",
  "promptDetected": {
    "injection": false, "dlp": false, "urlCats": false,
    "toxicContent": false, "maliciousCode": false,
    "agent": false, "topicViolation": false
  },
  "responseDetected": {
    "dlp": false, "urlCats": false, "dbSecurity": false,
    "toxicContent": false, "maliciousCode": false,
    "agent": false, "ungrounded": false, "topicViolation": false
  },
  "latencyMs": 145,
  "timeout": false,
  "hasError": false,
  "contentErrors": []
}
```

### Prompt Injection (Block)

```json
{
  "action": "block",
  "severity": "CRITICAL",
  "categories": ["prompt_injection"],
  "scanId": "scan_xyz789",
  "reportId": "report_abc123",
  "profileName": "default",
  "promptDetected": {
    "injection": true, "dlp": false, "urlCats": false,
    "toxicContent": false, "maliciousCode": false,
    "agent": false, "topicViolation": false
  },
  "responseDetected": {
    "dlp": false, "urlCats": false, "dbSecurity": false,
    "toxicContent": false, "maliciousCode": false,
    "agent": false, "ungrounded": false, "topicViolation": false
  },
  "latencyMs": 203,
  "timeout": false,
  "hasError": false,
  "contentErrors": []
}
```

### SDK Not Initialized

```json
{
  "action": "warn",
  "severity": "LOW",
  "categories": ["api_error"],
  "scanId": "",
  "reportId": "",
  "profileName": "default",
  "latencyMs": 0,
  "timeout": false,
  "hasError": false,
  "contentErrors": [],
  "error": "SDK not initialized. Call init() before scanning."
}
```

### API Exception

```json
{
  "action": "warn",
  "severity": "LOW",
  "categories": ["api_error"],
  "scanId": "",
  "reportId": "",
  "latencyMs": 5023,
  "timeout": false,
  "hasError": true,
  "contentErrors": [],
  "error": "Service temporarily unavailable"
}
```

## Source File

- `prisma-airs-plugin/src/scanner.ts`
