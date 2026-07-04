# opencode-distributed-delegation

A distributed delegation plugin for OpenCode (v1.3.x) that implements a "Titan" orchestrator agent pattern. A single intelligent but slow "Titan" agent delegates all executable work to faster child agents, maximizing parallelism and minimizing Titan's inference time.

## Core Concept

The plugin is built on a simple philosophy: **parallelize aggressively, delegate everything, never poll running jobs.**

- **Titan** — The primary agent. Most intelligent but borderline unusably slow. Its ONLY job is planning, routing, quality-gating, and synthesizing results from children. It NEVER does work a child can handle.
- **Children** — N configurable child agents, each with `speed` (1-10), `intelligence` (1-10), and `modelType` (`dense` | `sparse`). They execute delegated tasks and report back concisely (enforced 1-paragraph, 500-word max responses).

## Architecture

The plugin is built with TypeScript, bundled with esbuild to ESM, and integrates with OpenCode via the `@opencode-ai/plugin` and `@opencode-ai/sdk` packages. Configuration is validated with Zod (v4). Linting and formatting use Biome.

### Project Structure

```
opencode-distributed-delegation/
├── src/
│   ├── index.ts           # Main plugin entry point
│   ├── agents/
│   │   ├── index.ts       # createAgents() + getAgentConfigs() orchestration
│   │   ├── titan.ts       # Titan agent definition + dynamic prompt builder
│   │   └── child.ts       # Child agent factory
│   ├── config/
│   │   ├── index.ts       # Re-exports
│   │   ├── schema.ts      # Zod schemas
│   │   ├── loader.ts      # Config loading (JSONC, env interpolation, XDG dirs)
│   │   └── constants.ts   # TITAN_AGENT_NAME, DELEGATION_REMINDER
│   ├── hooks/             # Empty placeholder
│   └── utils/             # Empty placeholder
├── opencode-distributed-delegation.schema.json  # JSON schema for config
├── package.json
├── tsconfig.json
├── biome.json
└── AGENTS.md              # Agent coding guidelines
```

## Plugin Hooks

The plugin registers five hooks in `src/index.ts`:

| Hook | Purpose |
|------|---------|
| `agent` | Returns the agents record (Titan + children) for OpenCode to register. |
| `config` | Sets Titan as the default agent; merges plugin agents into the opencode config. |
| `chat.message` | Tracks which agent is active per session via `sessionAgentMap`. |
| `experimental.chat.system.transform` | Injects `DELEGATION_REMINDER` into Titan's system prompt at runtime (serve-mode), preventing double-injection via a sentinel check. |
| `event` | Cleans up the session map on `session.deleted`. |

## Configuration

### Config File Format

Users configure the plugin via `opencode-distributed-delegation.jsonc`:

```jsonc
{
  "titan": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "temperature": 0.1,
    "variant": "default",
    "prompt": "custom prompt string"
  },
  "children": [
    {
      "model": "openai/gpt-4.1-mini",
      "speed": 9,
      "intelligence": 6,
      "modelType": "sparse",
      "displayName": "Fast Searcher"
    },
    {
      "model": "anthropic/claude-haiku-3.5",
      "speed": 7,
      "intelligence": 8,
      "modelType": "dense"
    }
  ],
  "disabled_tools": ["tool1", "tool2"],
  "backgroundJobs": {
    "maxSessionsPerAgent": 3
  }
}
```

### Config Loading

The config system supports two layers: user-level (global) and project-level, with project settings overriding user settings via deep merge.

- **User config** is searched in: `$XDG_CONFIG_HOME/opencode/`, `~/.config/opencode/`, `~/.opencode/`.
- **Project config** lives at `.opencode/opencode-distributed-delegation.{json,jsonc}`.
- Both support `.jsonc` files with comments (`//`, `/* */`) via a hand-rolled comment stripper.
- Environment variable interpolation is supported via `{env:VAR}` syntax.
- Prompt files (`{agentName}.md` and `{agentName}_append.md`) can be placed in the same directories to replace or append to base prompts.

### Schemas

Three Zod schemas define the configuration shape:

- `PluginConfig` — Top-level plugin configuration.
- `ChildAgentConfig` — Per-child agent settings.
- `TitanOverrideConfig` — Titan-specific overrides.

## Agent Details

### Titan (`src/agents/titan.ts`)

Titan's system prompt is dynamically generated per-session based on the configured children fleet. It includes:

- Per-child descriptions with their speed, intelligence, and model type.
- Provider conflict warnings — children sharing the same provider must run sequentially.
- Capability-based delegation guidance derived from the fleet composition.
- Full workflow instructions for planning, dispatching, and synthesizing.
- `DELEGATION_REMINDER` appended at the end to keep Titan in delegation mode.

### Child Agents (`src/agents/child.ts`)

- Named `child-{index}`.
- Responses to Titan are enforced to a single paragraph, maximum 500 words.
- Model-type-specific behavioral hints: `dense` models are guided toward logic and reasoning tasks; `sparse` models toward information gathering and search.
- Temperature defaults to 0.1.

## Design Decisions

1. **Provider-aware scheduling** — Titan knows which children share providers and warns against parallel dispatch to the same provider.
2. **Capability-aware delegation** — The prompt includes dynamic guidance based on the fleet's combined capabilities.
3. **Prompt composition** — Base prompts are replaceable or appendable via `.md` files alongside config directories.
4. **Serve-mode resilience** — The delegation reminder is injected at runtime via the system transform hook to keep Titan in delegation mode during long sessions.
5. **Hand-rolled JSONC parser** — Comment stripping is implemented without external dependencies.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@opencode-ai/plugin` | ^1.3.17 | OpenCode plugin SDK |
| `@opencode-ai/sdk` | ^1.3.17 | OpenCode core SDK |
| `zod` | ^4.3.6 | Schema validation (also a peer dependency) |
| `@biomejs/biome` | 2.4.11 | Linting and formatting (dev) |
| `esbuild` | 0.28.1 | Bundling (dev) |
| `typescript` | 5.9.3 | Type checking (dev) |

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

- 2-space indentation, 80-character line width
- Single quotes, trailing commas
- TypeScript strict mode, ES2022 target, bundler module resolution
- Biome for linting and formatting
