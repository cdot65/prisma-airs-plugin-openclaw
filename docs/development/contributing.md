# Contributing

Guidelines for contributing to the Prisma AIRS plugin.

## Prerequisites

- Node.js 18+
- npm
- Git

## Setup

```bash
git clone https://github.com/cdot65/prisma-airs-plugin-openclaw.git
cd prisma-airs-plugin-openclaw/prisma-airs-plugin
npm ci
npm run check
```

## Branch Naming

Prefix personal branches with `cdot65/`:

```bash
git checkout -b cdot65/feature-name
```

## Commit Conventions

Use conventional commit prefixes:

| Prefix | Use |
|--------|-----|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `refactor:` | Code refactoring |
| `test:` | Test changes |
| `chore:` | Maintenance |

Example: `feat: add rate limiting for AIRS API calls`

## Pre-Commit Hooks

The project uses Husky + lint-staged. On every commit:

1. TypeScript type check (`tsc --noEmit`)
2. ESLint + Prettier on staged `.ts` files
3. Full test suite (`vitest run`)

If the hook fails, fix the issue and commit again.

## Development Workflow

1. Create a branch: `git checkout -b cdot65/my-feature`
2. Make changes in `prisma-airs-plugin/`
3. Run `npm run check` (typecheck + lint + format + tests)
4. Commit with conventional prefix
5. Push and open a PR

## Pull Request Process

### PR Title

Format: `type: brief description`

### PR Description

Include:

- Summary of changes
- Motivation
- Testing done
- Breaking changes (if any)

### Review Checklist

- [ ] `npm run check` passes
- [ ] Documentation updated (if behavior changed)
- [ ] HOOK.md updated (for hook changes)
- [ ] Version bumped in all 3 locations (for releases)

## Code Style

- TypeScript strict mode
- ESLint with `@typescript-eslint` rules
- Prettier formatting
- No emojis in code or docs unless explicitly requested

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `scan-cache.ts` |
| Functions | camelCase | `getCachedScanResult` |
| Types/Interfaces | PascalCase | `ScanResult` |
| Constants | UPPER_SNAKE | `TTL_MS` |

## File Structure

```
prisma-airs-plugin/
├── index.ts              # Plugin entrypoint
├── package.json
├── openclaw.plugin.json  # Plugin manifest + config schema
├── src/
│   ├── scanner.ts        # SDK adapter (ScanResult, scan(), mapScanResponse())
│   ├── scanner.test.ts
│   ├── scan-cache.ts     # Result caching (30s TTL)
│   ├── scan-cache.test.ts
│   └── config.ts         # Mode resolution (FeatureMode, resolveAllModes())
│   └── config.test.ts
└── hooks/
    ├── prisma-airs-guard/
    │   ├── HOOK.md
    │   ├── handler.ts
    │   └── handler.test.ts
    └── ... (12 hooks total)
```

## Adding a New Hook

1. Create directory: `hooks/prisma-airs-<name>/`
2. Create `HOOK.md` with frontmatter (name, description, events)
3. Create `handler.ts` with default export function
4. Create `handler.test.ts`
5. Add config field to `openclaw.plugin.json` configSchema
6. Register hook path in `openclaw.plugin.json` hooks array
7. Add to docs: `docs/hooks/prisma-airs-<name>.md`

## Version Locations

When releasing, update version in all 3 files:

- `package.json` `version` field
- `openclaw.plugin.json` `version` field
- `index.ts` (3 occurrences: status RPC, CLI command, export const)

## Release Process

1. Update version in all 3 locations
2. Update release notes
3. Create PR for version bump
4. Merge to main
5. Create GitHub Release (triggers npm publish)

## Questions

Open an issue on [GitHub](https://github.com/cdot65/prisma-airs-plugin-openclaw/issues).
