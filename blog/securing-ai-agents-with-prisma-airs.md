# Securing AI Agents with Prisma AIRS

AI agents are no longer just chatbots—they execute code, access databases, call APIs, and handle sensitive data. This expanded capability surface creates new attack vectors that traditional security tools weren't designed to address.

Prisma AIRS (AI Runtime Security) API Intercept is a threat detection service designed to secure AI applications. It scans prompts and model responses to identify potential threats and provides actionable recommendations based on your security profile.

## The Problem: Agents Are Attack Targets

Unlike simple chat interfaces, modern AI agents:

- **Execute real actions** - File operations, API calls, database queries
- **Handle credentials** - API keys, auth tokens, user data
- **Process untrusted input** - User prompts can contain malicious payloads
- **Generate dynamic responses** - Output may leak sensitive information

A prompt injection attack against a basic chatbot might produce a rude message. Against an AI agent with tool access, it could exfiltrate data, execute unauthorized commands, or bypass security controls entirely.

## Configuration: Plugin vs Strata Cloud Manager

Understanding where to configure what is critical for effective deployment.

### OpenClaw Plugin Configuration

The plugin handles **connection and runtime settings**:

```yaml
# OpenClaw plugin config
plugins:
  prisma-airs:
    profile_name: "your-profile"    # Which SCM profile to use
    app_name: "openclaw"            # App metadata
    reminder_enabled: true          # Bootstrap hook reminder
```

```bash
# API key via environment variable
export PANW_AI_SEC_API_KEY="your-api-key"
```

### Strata Cloud Manager Console

Detection services and security policies are configured **in SCM**, not in the skill:

| Setting | Where to Configure |
|---------|-------------------|
| API key generation | SCM → Settings → Access Keys |
| Detection services (enable/disable) | SCM → API Security Profile |
| Actions (allow/block/alert) | SCM → API Security Profile |
| DLP data patterns | SCM → API Security Profile |
| URL filtering categories | SCM → API Security Profile |
| Custom topic guardrails | SCM → API Security Profile |

**Key insight**: The plugin calls the API with a profile name. All detection logic and actions are determined by that profile's configuration in SCM.

## Detection Services

Enable these in your API Security Profile in Strata Cloud Manager:

### Prompt Injection Detection

Detects attempts to manipulate agent behavior:

- Jailbreak attempts
- Instruction override attacks
- Role-playing exploits
- System prompt extraction

**Languages**: English, Spanish, Russian, German, French, Japanese, Portuguese, Italian, Simplified Chinese

### Sensitive Data Detection (DLP)

Blocks sensitive data exposure in prompts or responses:

- Credit card numbers
- Social security numbers / Tax IDs
- Bank account and routing numbers
- API keys and secrets
- Custom patterns (PII, PHI, etc.)

**Options**: Basic or Advanced (with custom data patterns)

**Masking**: When enabled with Block action, sensitive data is replaced with `X` characters while preserving offset information for selective redaction.

### Malicious URL Detection

Identifies dangerous URLs in content:

- Phishing links
- Malware distribution sites
- Command and control endpoints

**Options**: Basic or Advanced (with custom URL category filtering)

### Toxic Content Detection

Prevents generation of inappropriate content:

- Violent content
- Harmful instructions
- Hate speech

**Languages**: English, Spanish, Russian, German, French, Japanese, Portuguese, Italian, Simplified Chinese

### Database Security Detection

For AI applications generating database queries:

- Detects potentially malicious SQL operations
- Regulates query types (SELECT, UPDATE, DELETE, etc.)
- Blocks dangerous database modifications

### Malicious Code Detection

Protects against LLM-generated harmful code:

- Supports: JavaScript, Python, VBScript, PowerShell, Batch, Shell, Perl
- Detects malware patterns in code output
- SHA-256 analysis of code blocks

### AI Agent Protection

Specialized detection for agent frameworks:

- Model-based threat detection
- Pattern-based attack recognition
- Tools/memory manipulation attempts
- Works with frameworks like AWS Agent Builder

### Contextual Grounding

Detects hallucinations and ungrounded responses:

- Compares response against provided context
- Identifies fabricated information
- Blocks responses not supported by source material

**Size limits**: Context (100K chars), Prompt (10K chars), Response (20K chars)

**Languages**: English, Spanish, Russian, German, French, Japanese, Portuguese, Italian

### Custom Topic Guardrails

Define allowed/blocked topics for your use case:

- Block discussions of competitors
- Restrict to domain-specific topics
- Prevent off-topic conversations

**Languages**: English only

## Quick Integration

### TypeScript / OpenClaw Plugin

```typescript
import { scan } from "prisma-airs-plugin";

// Scan user input before processing
const result = await scan({ prompt: userMessage });
if (result.action === "block") {
  return "Request blocked for security reasons.";
}

// Process with your LLM
const response = await llm.generate(userMessage);

// Scan output before returning
const outputResult = await scan({ response });
if (outputResult.action === "block") {
  return "Response blocked - contains sensitive data.";
}

return response;
```

### Session Tracking

Group related scans and correlate prompt/response pairs:

```typescript
// Use sessionId to group scans in a conversation
// Use trId to correlate a prompt scan with its response scan
const result = await scan({
  prompt: userMessage,
  sessionId: "conversation-123",  // Group related scans
  trId: "tx-001",                 // Correlate prompt/response
  appUser: "user@example.com",
  aiModel: "gpt-4",
});

// Same trId links the response scan to the prompt scan
const outputResult = await scan({
  response,
  sessionId: "conversation-123",
  trId: "tx-001",
});
```

## API Response Structure

When a threat is detected:

```json
{
  "action": "block",
  "category": "malicious",
  "profile_name": "your-profile",
  "prompt_detected": {
    "dlp": false,
    "injection": true,
    "url_cats": false
  },
  "response_detected": {},
  "scan_id": "...",
  "report_id": "...",
  "session_id": "conversation-123",
  "tr_id": "tx-001"
}
```

- `category`: `malicious` (threat detected) or `benign` (clean)
- `action`: Based on your SCM profile settings
- `*_detected`: Boolean flags for each detection type
- `session_id`: Groups related scans in a conversation
- `tr_id`: Correlates prompt/response scan pairs

## Service Limitations

| Limitation | Value |
|------------|-------|
| API keys per deployment profile | 1 |
| Regional API key usage | Same region only (no cross-region) |
| Sync request payload | 2 MB max, 100 URLs max |
| Async request payload | 5 MB max, 100 URLs max |
| Async batch requests | 25 max |

**Regional Endpoints**:
- US: `https://service.api.aisecurity.paloaltonetworks.com`
- EU (Germany): `https://service-de.api.aisecurity.paloaltonetworks.com`

## Use Cases

### Secure AI Models in Production

Validate prompt requests and responses to protect deployed models from manipulation.

### Detect Data Poisoning

Identify contaminated training data before fine-tuning by scanning for malicious patterns.

### Protect Against Adversarial Input

Safeguard AI agents from malicious inputs/outputs while maintaining workflow flexibility.

### Prevent Sensitive Data Leakage

Block PII, credentials, and confidential data from leaking during AI interactions.

## Onboarding Workflow

1. **Onboard in SCM**: Enable Prisma AIRS AI Runtime: API Intercept
2. **Create API Key**: Generate key in Customer Support Portal
3. **Create Security Profile**: Configure detection services and actions
4. **Set Environment Variable**: `export PANW_AI_SEC_API_KEY="your-key"`
5. **Install Plugin**: `openclaw plugins install ./prisma-airs-plugin`
6. **Verify**: Run `openclaw prisma-airs` to check status

![Onboarding Workflow](https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/dita/_graphics/ai-runtime-security/activation-and-onboarding/airs-apis-onboarding-workflow.png)

## CLI Tools

```bash
# Basic scan
openclaw prisma-airs-scan "test message"

# JSON output
openclaw prisma-airs-scan --json "test message"

# Scan with specific profile
openclaw prisma-airs-scan --profile strict "test message"

# Check plugin status
openclaw prisma-airs

# RPC scan
openclaw gateway call prisma-airs.scan --params '{"prompt":"test"}'

# RPC status check
openclaw gateway call prisma-airs.status
```

## Best Practices

1. **Scan both input and output** - Threats can originate from users or emerge in responses
2. **Configure profiles in SCM** - Don't expect to enable detections in config.yaml
3. **Use appropriate profile** - Create different profiles for different risk levels
4. **Log all detections** - Build audit trails for security review
5. **Handle failures gracefully** - API errors shouldn't crash your agent
6. **Stay regional** - Use API keys only in their designated region

## Learn More

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/ai-runtime-security)
- [API Intercept Administration Guide](https://docs.paloaltonetworks.com/ai-runtime-security/administration/prevent-network-security-threats/api-intercept-create-configure-security-profile)
- [Prisma AIRS API Reference](https://pan.dev/prisma-airs/)
