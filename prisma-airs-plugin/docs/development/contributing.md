# Contributing

Guidelines for contributing to the Prisma AIRS plugin.

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- OpenClaw installed locally

### Setup

```bash
# Clone repository
git clone https://github.com/cdot65/prisma-airs-plugin-openclaw.git
cd prisma-airs-plugin-openclaw/prisma-airs-plugin

# Install dependencies
npm install

# Run checks
npm run check
```

## Development Workflow

### 1. Create Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Edit files in `prisma-airs-plugin/`.

### 3. Run Tests

```bash
npm test
```

### 4. Run Full Check Suite

```bash
npm run check
```

This runs:

- TypeScript type checking
- ESLint
- Prettier format check
- Tests

### 5. Commit

Pre-commit hooks run automatically:

- Type check
- Lint staged files
- Format staged files
- Run tests

### 6. Push and Create PR

```bash
git push origin feature/my-feature
```

Create PR on GitHub.

## Code Style

### TypeScript

- Strict mode enabled
- ESLint with TypeScript rules
- Prettier formatting

### File Structure

```
prisma-airs-plugin/
├── index.ts              # Plugin entrypoint
├── src/
│   ├── scanner.ts        # AIRS API integration
│   ├── scanner.test.ts   # Scanner tests
│   ├── scan-cache.ts     # Result caching
│   └── scan-cache.test.ts
└── hooks/
    ├── prisma-airs-guard/
    │   ├── HOOK.md       # Hook documentation
    │   ├── handler.ts    # Hook implementation
    │   └── handler.test.ts
    └── ... other hooks
```

### Naming Conventions

| Type      | Convention  | Example               |
| --------- | ----------- | --------------------- |
| Files     | kebab-case  | `scan-cache.ts`       |
| Functions | camelCase   | `getCachedScanResult` |
| Types     | PascalCase  | `ScanResult`          |
| Constants | UPPER_SNAKE | `TTL_MS`              |

## Testing

### Run Tests

```bash
# Run once
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('scan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return safe result for benign content', async () => {
    // Arrange
    vi.spyOn(global, 'fetch').mockResolvedValue(...);

    // Act
    const result = await scan({ prompt: 'hello', apiKey: 'test-key' });

    // Assert
    expect(result.action).toBe('allow');
  });
});
```

### Mocking

Use Vitest mocks for:

- `fetch` - AIRS API calls
- Plugin config (pass `apiKey` as param)
- Time (for cache TTL tests)

## Adding a New Hook

### 1. Create Directory

```bash
mkdir -p hooks/prisma-airs-newhook
```

### 2. Create HOOK.md

````yaml
---
name: prisma-airs-newhook
description: "Description of hook"
metadata:
  openclaw:
    emoji: "🔧"
    events:
      - event_name
---

# Hook Name

Description.

## Configuration

```yaml
plugins:
  prisma-airs:
    newhook_enabled: true
````

````

### 3. Create handler.ts

```typescript
interface NewHookEvent {
  // Event shape
}

interface HookContext {
  // Context shape
}

const handler = async (
  event: NewHookEvent,
  ctx: HookContext
): Promise<HookResult | void> => {
  // Implementation
};

export default handler;
````

### 4. Create handler.test.ts

```typescript
import { describe, it, expect } from "vitest";
import handler from "./handler";

describe("prisma-airs-newhook", () => {
  it("should handle event", async () => {
    const result = await handler(event, ctx);
    expect(result).toBeDefined();
  });
});
```

### 5. Add Config Option

Update `index.ts` to read new config option.

### 6. Document

- Add to `docs/hooks/index.md`
- Create `docs/hooks/prisma-airs-newhook.md`
- Update `mkdocs.yml` navigation

## Pull Request Guidelines

### PR Title

Format: `type: brief description`

Types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Maintenance

Example: `feat: add rate limiting for AIRS API calls`

### PR Description

Include:

- Summary of changes
- Motivation
- Testing done
- Breaking changes (if any)

### Review Checklist

- [ ] Tests pass
- [ ] TypeScript compiles
- [ ] ESLint passes
- [ ] Documentation updated
- [ ] HOOK.md updated (for hook changes)

## Release Process

1. Update version in `package.json`
2. Update `RELEASE_NOTES.md`
3. Create PR for version bump
4. Merge to main
5. Tag release: `git tag v0.x.0`
6. Push tag: `git push origin v0.x.0`
7. GitHub Actions publishes to npm

## Questions?

- Open an issue on GitHub
- Check existing issues for answers
