# Agent Coding Guidelines

This document provides guidelines for AI agents operating in this repository.

## Project Overview

**opencode-distributed-delegation** — A distributed delegation plugin for OpenCode. Features a "Titan" orchestrator agent that delegates all executable work to faster child agents, maximizing parallelism and minimizing Titan's slow inference time.

## Architecture

- **Titan**: The primary agent. Most intelligent but slowest. Its only job is planning, routing, and synthesizing results.
- **Children**: N configurable child agents. Each has `speed` (1-10), `intelligence` (1-10), and `modelType` (`dense` | `sparse`). They execute delegated tasks and report back concisely.

## Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Build TypeScript to `dist/` |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run Biome linter |
| `bun run format` | Format codebase with Biome |
| `bun run check` | Biome check with auto-fix |
| `bun run check:ci` | Biome check (CI mode) |

## Code Style

- **Formatter/Linter:** Biome (`biome.json`)
- **Line width:** 80 characters
- **Indentation:** 2 spaces
- **Quotes:** Single quotes
- **Trailing commas:** Always
- **TypeScript:** Strict mode, bundler module resolution

## Project Structure

```
opencode-distributed-delegation/
├── src/
│   ├── index.ts           # Main plugin entry point
│   ├── agents/
│   │   ├── index.ts       # Agent factory orchestration
│   │   ├── titan.ts       # Titan agent definition + prompt builder
│   │   └── child.ts       # Child agent factory
│   ├── config/
│   │   ├── index.ts       # Config exports
│   │   ├── schema.ts      # Zod schemas (PluginConfig, ChildAgentConfig)
│   │   ├── loader.ts      # Config loading (user + project)
│   │   └── constants.ts   # Agent names, reminders
├── opencode-distributed-delegation.schema.json  # JSON schema for config
├── package.json
├── tsconfig.json
└── biome.json
```

## Development Workflow

1. Make code changes
2. Run `bun run check:ci` to verify linting and formatting
3. Run `bun run typecheck` to verify types
4. Commit changes

## Config File Format

Users configure the plugin via `opencode-distributed-delegation.jsonc` in their OpenCode config directory:

```jsonc
{
  "titan": {
    "model": "anthropic/claude-sonnet-4-20250514"
  },
  "children": [
    {
      "model": "openai/gpt-4.1-mini",
      "speed": 9,
      "intelligence": 6,
      "modelType": "sparse"
    },
    {
      "model": "anthropic/claude-haiku-3.5",
      "speed": 7,
      "intelligence": 8,
      "modelType": "dense"
    }
  ]
}
```
