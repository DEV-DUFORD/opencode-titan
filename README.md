# opencode-distributed-delegation

A distributed delegation plugin for [OpenCode](https://github.com/nicepkg/opencode) that introduces a **Titan orchestrator agent** which delegates all executable work to faster child agents, maximizing parallelism and minimizing Titan's slow inference time.

## How It Works

The plugin creates a hierarchy of agents:

- **Titan** — The primary orchestrator. Most intelligent but by far the slowest. Its only job is planning, routing, quality-gating, and synthesizing results from its children. It never does work a child can handle.
- **Children** — N configurable child agents, each with `speed` (1-10), `intelligence` (1-10), and `modelType` (`dense` | `sparse`). They execute delegated tasks and report back concisely.

Titan dispatches all independent tasks to children **in parallel** within a single response turn. Children share providers, so children on the same provider run sequentially. The plugin automatically detects provider conflicts and warns Titan.

## Installation

```bash
bun install opencode-distributed-delegation
# or
npm install opencode-distributed-delegation
```

Add the plugin to your OpenCode config (`opencode.json`):

```json
{
  "plugins": ["opencode-distributed-delegation"]
}
```

## Configuration

Create `opencode-distributed-delegation.jsonc` in your OpenCode config directory:

```jsonc
{
  // Optional: override Titan's model and settings
  "titan": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "temperature": 0.1
  },

  // Required: at least one child agent
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

### Child Agent Configuration

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | Yes | Model identifier in `provider/model` format |
| `speed` | `number` (1-10) | Yes | Relative speed rating; higher = faster responses |
| `intelligence` | `number` (1-10) | Yes | Reasoning capability rating; higher = better logic |
| `modelType` | `"dense"` \| `"sparse"` | Yes | `dense` for logic/reasoning tasks, `sparse` for search/info gathering |
| `temperature` | `number` (0-2) | No | Sampling temperature (default: 0.1) |
| `variant` | `string` | No | Model variant name |
| `displayName` | `string` | No | Friendly display name shown in the UI |
| `provider` | `string` | No | Explicit provider name (defaults to prefix of `model`) |

### Config Locations

The plugin searches for config files in two locations (project config overrides user config):

1. **User-level:** `~/.config/opencode/opencode-distributed-delegation.jsonc`
2. **Project-level:** `.opencode/opencode-distributed-delegation.jsonc`

Both `.jsonc` and `.json` extensions are supported. JSONC files support comments and `{env:VAR_NAME}` environment variable placeholders.

### Custom Prompts

Place custom prompt files in a prompts directory alongside your config:

- `titan.md` — Replaces Titan's default system prompt entirely
- `titan_append.md` — Appended to the end of Titan's system prompt

Locations:
- User-level: `~/.config/opencode/opencode-distributed-delegation/titan.md`
- Project-level: `.opencode/opencode-distributed-delegation/titan.md`

## Architecture

```
src/
├── index.ts              # Plugin entry point — registers agents, hooks, and events
├── agents/
│   ├── index.ts          # Agent factory — creates Titan + N children
│   ├── titan.ts          # Titan prompt builder with dynamic child descriptions
│   └── child.ts          # Child agent factory with context budget constraints
└── config/
    ├── index.ts          # Config exports
    ├── schema.ts         # Zod schemas for all config types
    ├── loader.ts         # Config loading with JSONC parsing, env vars, deep merge
    └── constants.ts      # Agent names, delegation reminders
```

## Development

```bash
bun run build       # Build to dist/
bun run typecheck   # TypeScript type checking
bun run check:ci    # Lint and format (CI mode)
```

## License

MIT
