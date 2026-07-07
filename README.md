<div align="center">
  <h3>⚡ opencode-distributed-delegation ⚡</h3>

  <p><i>One mind that never touches the keyboard. A fleet of hands that never stops moving.<br>Plan with the slow genius, and let the fast ones build in parallel.</i></p>

  <p><b>OpenCode Orchestration Plugin</b> · Mix any models · Delegate everything · Run in parallel</p>

  <p><sub>✦ ✦ ✦</sub></p>

</div>

## What's This Plugin

`opencode-distributed-delegation` is an agent-orchestration plugin for [OpenCode](https://github.com/sst/opencode). It introduces a **Titan orchestrator** — your most capable (and slowest) model — whose only job is to think, plan, and route. Every piece of executable work is handed off to a fleet of faster **child agents** that run in parallel.

The core idea is simple: **your smartest model is often your slowest one.** Instead of letting it grind through file reads, searches, and edits, Titan spends its expensive inference budget on planning and synthesis, while cheaper, faster children do the legwork simultaneously.

The result is a workflow that balances **quality, speed, and cost** — deep reasoning where it matters, raw throughput everywhere else.

To meet the agents, jump to **[Meet the Agents](#meet-the-agents)**. For setup, see **[Getting Started](#getting-started)**.

## How It Works

The plugin builds a two-tier hierarchy of agents:

- **Titan** dispatches all independent tasks to children **in parallel** within a single response turn.
- **Children** share model providers, so children on the same provider are scheduled sequentially. The plugin automatically detects provider conflicts and warns Titan so it can plan around them.
- Titan **never** performs work a child can handle — it plans, routes, quality-gates, and synthesizes results.

> [!TIP]
> The magic is in the prompt. Titan's system prompt is generated dynamically per session from your configured fleet — it knows each child's speed, intelligence, model type, and provider, and delegates accordingly.

## Installation

> [!NOTE]
> This plugin is not published to npm yet, so install it manually from source. npm/Bun package installation is coming soon.

**1. Clone and build the plugin:**

```bash
git clone https://github.com/DEV-DUFORD/opencode-distributed-delegation.git
cd opencode-distributed-delegation
bun install
bun run build
```

This produces the bundled plugin in `dist/`.

**2. Register the local build in your OpenCode config** (`opencode.json`).

OpenCode treats any plugin entry starting with `.`, `file://`, or an absolute path as a local file plugin, so point it at the cloned directory:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/absolute/path/to/opencode-distributed-delegation"]
}
```

Restart OpenCode and Titan becomes your default agent.

## Getting Started

1. **Create your plugin config** at `~/.config/opencode/opencode-distributed-delegation.jsonc`

2. **Pick your Titan** — the smartest model you have, even if it's slow.

3. **Assemble your fleet** — one or more children, each rated for `speed`, `intelligence`, and `modelType`.

4. **Start OpenCode.** Titan becomes the default agent and delegates from there.

Here's a complete starting configuration:

```jsonc
{
  // Optional: override Titan's model and settings.
  // Titan should be your most capable model, even if it's slow.
  "titan": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "temperature": 0.1
  },

  // Required: at least one child agent.
  // Children should be fast and cheap — they do the actual work.
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
  ]
}
```

> [!TIP]
> Mix providers to unlock real parallelism. Two children on the same provider run one after another; two children on *different* providers run at the same time.

## Meet the Agents

### 🧠 Titan — The Orchestrator

Titan is the most intelligent agent in the fleet, and by far the slowest. It never reads a file, runs a search, or writes a line of code if a child can do it instead. Its entire purpose is strategic: decompose the goal, route each task to the best-suited child, gate the quality of what comes back, and synthesize the final result.

<table>
  <tr><td><b>Role</b></td><td><code>Planning, routing, quality-gating, and synthesis</code></td></tr>
  <tr><td><b>Prompt</b></td><td><a href="src/agents/titan.ts"><code>titan.ts</code></a> — dynamically built from your fleet</td></tr>
  <tr><td><b>Model Guidance</b></td><td>Choose your strongest reasoning model. Titan needs judgment and instruction-following, not throughput. Slow is fine — it delegates the slow parts away.</td></tr>
</table>

### ⚙️ Children — The Fleet

Children are the hands. Each executes a delegated task and reports back concisely — responses to Titan are enforced to a single paragraph, 500 words max, keeping Titan's context lean. Every child declares a `modelType` that shapes how Titan routes work to it:

<table>
  <tr>
    <td width="20%" valign="top"><b>🔍 sparse</b></td>
    <td valign="top">Faster models tuned for <b>information gathering</b> — searching the codebase, reading files, collecting context. Route broad reconnaissance here.</td>
  </tr>
  <tr>
    <td width="20%" valign="top"><b>🛠️ dense</b></td>
    <td valign="top">Models tuned for <b>logic and reasoning</b> — implementation, refactors, and tasks that need careful thought. Route the hard thinking here.</td>
  </tr>
</table>

<table>
  <tr><td><b>Role</b></td><td><code>Execute delegated tasks and report back concisely</code></td></tr>
  <tr><td><b>Prompt</b></td><td><a href="src/agents/child.ts"><code>child.ts</code></a></td></tr>
  <tr><td><b>Model Guidance</b></td><td>Choose fast, cost-efficient models. Speed and parallelism usually matter more than raw reasoning power here.</td></tr>
</table>

## Configuration

### Child Agent Options

| Field | Type | Required | Description |
|---|---|:---:|---|
| `model` | `string` | ✅ | Model identifier in `provider/model` format |
| `speed` | `number` (1–10) | ✅ | Relative speed rating; higher = faster responses |
| `intelligence` | `number` (1–10) | ✅ | Reasoning capability rating; higher = better logic |
| `modelType` | `"dense"` \| `"sparse"` | ✅ | `dense` for logic/reasoning, `sparse` for search/info gathering |
| `temperature` | `number` (0–2) | | Sampling temperature (default: `0.1`) |
| `variant` | `string` | | Model variant name |
| `displayName` | `string` | | Friendly name shown in the UI |
| `provider` | `string` | | Explicit provider name (defaults to the prefix of `model`) |

### Titan Options

| Field | Type | Description |
|---|---|---|
| `model` | `string` | Titan's model in `provider/model` format |
| `temperature` | `number` (0–2) | Sampling temperature (default: `0.1`) |
| `variant` | `string` | Model variant name |
| `prompt` | `string` | Inline custom system prompt (replaces the default entirely) |

### Plugin Options

| Field | Type | Description |
|---|---|---|
| `titan` | `object` | Titan overrides (see above) |
| `children` | `array` | The child agent fleet (see above) |
| `disabled_tools` | `string[]` | Tool names to disable for the plugin's agents |
| `backgroundJobs.maxSessionsPerAgent` | `number` (1–10) | Max concurrent sessions per agent (default: `10`) |

### Config Locations

Config is loaded in two layers — **project settings override user settings** via deep merge:

1. **User-level** — searched in `$XDG_CONFIG_HOME/opencode/`, `~/.config/opencode/`, then `~/.opencode/`
2. **Project-level** — `.opencode/opencode-distributed-delegation.{json,jsonc}`

Both `.json` and `.jsonc` are supported. JSONC files allow comments (`//`, `/* */`) and `{env:VAR_NAME}` environment variable placeholders.

### Custom Prompts

Drop prompt files alongside your config to override or extend an agent's system prompt:

| File | Effect |
|---|---|
| `titan.md` | **Replaces** Titan's default system prompt entirely |
| `titan_append.md` | **Appends** to the end of Titan's system prompt |

Search locations:

- **User-level:** `~/.config/opencode/opencode-distributed-delegation/titan.md`
- **Project-level:** `.opencode/opencode-distributed-delegation/titan.md`

## Architecture

```
src/
├── index.ts              # Plugin entry — registers agents, hooks, and events
├── agents/
│   ├── index.ts          # Agent factory — creates Titan + N children
│   ├── titan.ts          # Titan prompt builder with dynamic child descriptions
│   └── child.ts          # Child agent factory with context-budget constraints
├── config/
│   ├── index.ts          # Config exports
│   ├── schema.ts         # Zod schemas for all config types
│   ├── loader.ts         # Config loading — JSONC parsing, env vars, deep merge
│   ├── providers.ts      # Provider resolution helpers
│   └── constants.ts      # Agent names, delegation reminders
└── utils/
    └── provider-lock.ts  # Provider-conflict detection for scheduling
```

The plugin registers hooks in `src/index.ts` to wire everything into OpenCode:

| Hook | Purpose |
|------|---------|
| `agent` | Returns the agents record (Titan + children) for OpenCode to register |
| `config` | Sets Titan as the default agent and merges plugin agents into the config |
| `chat.message` | Tracks which agent is active per session |
| `experimental.chat.system.transform` | Injects the delegation reminder into Titan's prompt at runtime |
| `event` | Cleans up session state on `session.deleted` |

## Development

```bash
bun run build       # Build to dist/
bun run typecheck   # TypeScript type checking
bun run lint        # Biome linter
bun run format      # Biome formatter
bun run check:ci    # Lint and format (CI mode)
```

Built with TypeScript, bundled to ESM with esbuild, validated with Zod, and linted/formatted with Biome (80-char lines, 2-space indent, single quotes, trailing commas).

## License

MIT
