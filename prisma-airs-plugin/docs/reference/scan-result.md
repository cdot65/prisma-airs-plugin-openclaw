# Scan Result Reference

Complete reference for the `ScanRequest` and `ScanResult` types used by all scan operations.

## ScanRequest Interface

```typescript
interface ScanRequest {
  prompt?: string;
  response?: string;
  sessionId?: string;
  trId?: string;
  profileName?: string;
  appName?: string;
  appUser?: string;
  aiModel?: string;
}
```

### ScanRequest Fields

| Field         | Type      | Description                                    |
| ------------- | --------- | ---------------------------------------------- |
| `prompt`      | `string?` | User prompt to scan                            |
| `response`    | `string?` | AI response to scan                            |
| `sessionId`   | `string?` | Session ID for tracking                        |
| `trId`        | `string?` | Transaction ID for correlating prompt/response |
| `profileName` | `string?` | Security profile name (default: "default")     |
| `appName`     | `string?` | Application name for scan metadata             |
| `appUser`     | `string?` | User identifier for scan metadata              |
| `aiModel`     | `string?` | AI model name for scan metadata                |

## ScanResult Interface

```typescript
interface ScanResult {
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

type Action = "allow" | "warn" | "block";
type Severity = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface PromptDetected {
  injection: boolean;
  dlp: boolean;
  urlCats: boolean;
}

interface ResponseDetected {
  dlp: boolean;
  urlCats: boolean;
}
```

## Fields

### action

| Property | Value                          |
| -------- | ------------------------------ |
| Type     | `"allow" \| "warn" \| "block"` |
| Required | Yes                            |

Recommended action based on scan results.

| Value   | Meaning                                  |
| ------- | ---------------------------------------- |
| `allow` | No threats detected, safe to proceed     |
| `warn`  | Potential concerns, proceed with caution |
| `block` | Threat detected, block the request       |

### severity

| Property | Value                                                 |
| -------- | ----------------------------------------------------- |
| Type     | `"SAFE" \| "LOW" \| "MEDIUM" \| "HIGH" \| "CRITICAL"` |
| Required | Yes                                                   |

Threat severity level.

| Value      | Meaning                           |
| ---------- | --------------------------------- |
| `SAFE`     | No issues detected                |
| `LOW`      | Minor concern or API error        |
| `MEDIUM`   | Detection flags triggered         |
| `HIGH`     | Suspicious content detected       |
| `CRITICAL` | Malicious content or block action |

### categories

| Property | Value      |
| -------- | ---------- |
| Type     | `string[]` |
| Required | Yes        |

List of detected threat categories. See [Detection Categories](detection-categories.md).

Example:

```json
["prompt_injection", "dlp_prompt"]
```

### scanId

| Property | Value                |
| -------- | -------------------- |
| Type     | `string`             |
| Required | Yes (empty on error) |

Unique identifier for this scan from Prisma AIRS.

### reportId

| Property | Value                |
| -------- | -------------------- |
| Type     | `string`             |
| Required | Yes (empty on error) |

Report identifier for detailed analysis in Strata Cloud Manager.

### profileName

| Property | Value    |
| -------- | -------- |
| Type     | `string` |
| Required | Yes      |

Security profile name used for the scan.

### promptDetected

| Property | Value            |
| -------- | ---------------- |
| Type     | `PromptDetected` |
| Required | Yes              |

Detection flags for prompt content.

```typescript
{
  injection: boolean; // Prompt injection detected
  dlp: boolean; // Sensitive data in prompt
  urlCats: boolean; // URL category violation in prompt
}
```

### responseDetected

| Property | Value              |
| -------- | ------------------ |
| Type     | `ResponseDetected` |
| Required | Yes                |

Detection flags for response content.

```typescript
{
  dlp: boolean; // Sensitive data in response
  urlCats: boolean; // URL category violation in response
}
```

### sessionId

| Property | Value                 |
| -------- | --------------------- |
| Type     | `string \| undefined` |
| Required | No                    |

Session identifier passed in the scan request.

### trId

| Property | Value                 |
| -------- | --------------------- |
| Type     | `string \| undefined` |
| Required | No                    |

Transaction identifier for correlating prompt/response pairs.

### latencyMs

| Property | Value    |
| -------- | -------- |
| Type     | `number` |
| Required | Yes      |

Scan latency in milliseconds.

### error

| Property | Value                 |
| -------- | --------------------- |
| Type     | `string \| undefined` |
| Required | No                    |

Error message if scan failed.

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
    "injection": false,
    "dlp": false,
    "urlCats": false
  },
  "responseDetected": {
    "dlp": false,
    "urlCats": false
  },
  "latencyMs": 145
}
```

### Prompt Injection

```json
{
  "action": "block",
  "severity": "CRITICAL",
  "categories": ["prompt_injection"],
  "scanId": "scan_xyz789",
  "reportId": "report_abc123",
  "profileName": "default",
  "promptDetected": {
    "injection": true,
    "dlp": false,
    "urlCats": false
  },
  "responseDetected": {
    "dlp": false,
    "urlCats": false
  },
  "latencyMs": 203
}
```

### DLP Violation

```json
{
  "action": "block",
  "severity": "HIGH",
  "categories": ["dlp_response"],
  "scanId": "scan_dlp123",
  "reportId": "report_dlp456",
  "profileName": "strict",
  "promptDetected": {
    "injection": false,
    "dlp": false,
    "urlCats": false
  },
  "responseDetected": {
    "dlp": true,
    "urlCats": false
  },
  "latencyMs": 178
}
```

### Multiple Categories

```json
{
  "action": "block",
  "severity": "CRITICAL",
  "categories": ["prompt_injection", "malicious_url"],
  "scanId": "scan_multi789",
  "reportId": "report_multi012",
  "profileName": "default",
  "promptDetected": {
    "injection": true,
    "dlp": false,
    "urlCats": true
  },
  "responseDetected": {
    "dlp": false,
    "urlCats": false
  },
  "latencyMs": 215
}
```

### API Error

```json
{
  "action": "warn",
  "severity": "LOW",
  "categories": ["api_error"],
  "scanId": "",
  "reportId": "",
  "profileName": "default",
  "promptDetected": {
    "injection": false,
    "dlp": false,
    "urlCats": false
  },
  "responseDetected": {
    "dlp": false,
    "urlCats": false
  },
  "latencyMs": 5023,
  "error": "API error 503: Service temporarily unavailable"
}
```

### Missing API Key

```json
{
  "action": "warn",
  "severity": "LOW",
  "categories": ["api_error"],
  "scanId": "",
  "reportId": "",
  "profileName": "default",
  "promptDetected": {
    "injection": false,
    "dlp": false,
    "urlCats": false
  },
  "responseDetected": {
    "dlp": false,
    "urlCats": false
  },
  "latencyMs": 0,
  "error": "PANW_AI_SEC_API_KEY not set"
}
```
