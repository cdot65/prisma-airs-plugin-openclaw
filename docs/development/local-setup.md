# Local Setup

Set up the plugin for local development and testing.

## Prerequisites

- Node.js 18+
- npm
- Git
- Docker (for E2E testing)
- Prisma AIRS API key from Strata Cloud Manager (for live/E2E testing)

## Clone and Install

```bash
git clone https://github.com/cdot65/prisma-airs-plugin-openclaw.git
cd prisma-airs-plugin-openclaw/prisma-airs-plugin
npm ci
```

## Verify Setup

```bash
npm run check
```

This runs typecheck, lint, format check, and all tests. If everything passes, the environment is ready.

## Available Scripts

All scripts run from `prisma-airs-plugin/`:

| Command | Description |
|---------|-------------|
| `npm test` | Run tests once (`vitest run`) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Tests with coverage report |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm run check` | All of the above in sequence |

## Project Structure

```
prisma-airs-plugin-openclaw/
├── prisma-airs-plugin/           # Plugin source
│   ├── index.ts                  # Plugin entrypoint (register, commands, RPC)
│   ├── package.json              # v1.0.0, depends on @cdot65/prisma-airs-sdk
│   ├── openclaw.plugin.json      # Plugin manifest + config schema (16 fields)
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── scanner.ts            # SDK adapter: ScanResult, scan(), mapScanResponse()
│   │   ├── scanner.test.ts
│   │   ├── scan-cache.ts         # Result caching (30s TTL)
│   │   ├── scan-cache.test.ts
│   │   ├── config.ts             # FeatureMode, resolveMode(), resolveAllModes()
│   │   └── config.test.ts
│   └── hooks/                    # 12 hook handlers, each with handler.ts + handler.test.ts
│       ├── prisma-airs-guard/
│       ├── prisma-airs-audit/
│       ├── prisma-airs-context/
│       ├── prisma-airs-outbound/
│       ├── prisma-airs-tools/
│       ├── prisma-airs-inbound-block/
│       ├── prisma-airs-outbound-block/
│       ├── prisma-airs-tool-guard/
│       ├── prisma-airs-prompt-scan/
│       ├── prisma-airs-tool-redact/
│       ├── prisma-airs-llm-audit/
│       └── prisma-airs-tool-audit/
├── docs/                         # MkDocs documentation
├── docker/                       # Docker E2E infrastructure
│   ├── Dockerfile.e2e
│   ├── entrypoint.sh
│   └── openclaw-e2e.json
├── e2e/
│   └── smoke-test.sh
├── docker-compose.yml
└── mkdocs.yml
```

## Dependencies

Runtime:

- `@cdot65/prisma-airs-sdk` ^0.6.7 -- AIRS API client (HTTP, auth, retries, content validation)

Dev:

- `typescript` ^5.0.0
- `vitest` ^2.0.0
- `eslint` ^9.0.0 with `@typescript-eslint`
- `prettier` ^3.0.0
- `husky` ^9.0.0 + `lint-staged` ^15.0.0

## Docker E2E Testing

For live API testing with Docker:

```bash
# Set API key
export PANW_AI_SEC_API_KEY="your-api-key"

# Build and start gateway
docker compose up -d --build

# Run smoke tests
docker compose exec gateway bash /home/node/e2e/smoke-test.sh

# Stop
docker compose down
```

See the [Docker Guide](../guides/docker.md) for details.

## Testing Without an API Key

Unit tests mock the SDK and do not require an API key. Only E2E smoke tests need a live key.

```bash
# Unit tests work without any API key
npm test
```

## Common Issues

### npm ci fails

Ensure Node.js 18+:

```bash
node --version
```

### TypeScript errors

```bash
npm run typecheck
```

Fix reported issues, then re-run.

### Tests failing

```bash
npm test -- --reporter=verbose
```

### Pre-commit hook fails

The hook runs typecheck + lint-staged + tests. Fix the reported issue and commit again. Do not skip hooks.
