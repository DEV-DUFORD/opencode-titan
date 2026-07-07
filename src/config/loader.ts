import * as fs from 'node:fs';
import * as path from 'node:path';
import { type PluginConfig, PluginConfigSchema } from './schema';

const PROMPTS_DIR_NAME = 'opencode-distributed-delegation';

function stripJsonComments(content: string): string {
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let result = '';
  let i = 0;

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += ch;
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      result += ch;
      if (ch === '\\' && content[i + 1]) {
        result += content[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function loadConfigFromPath(configPath: string): PluginConfig | null {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    let rawConfig: unknown;
    try {
      const stripped = stripJsonComments(content);
      const interpolated = stripped.replace(
        /\{env:([^}]+)\}/g,
        (_, varName) => process.env[varName] ?? '',
      );
      rawConfig = JSON.parse(interpolated);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `[opencode-distributed-delegation] FATAL: Invalid JSON in ${configPath}: ${msg}` +
          '\n  Titan will have NO Myrmidons until this is fixed.',
      );
      return null;
    }

    const result = PluginConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      console.error(
        `[opencode-distributed-delegation] FATAL: Config schema validation failed at ${configPath}:` +
          '\n  Titan will have NO Myrmidons until this is fixed.',
      );
      console.error(result.error.format());
      return null;
    }

    return result.data;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code !== 'ENOENT'
    ) {
      console.warn(
        `[opencode-distributed-delegation] Error reading config from ${configPath}:`,
        error.message,
      );
    }
    return null;
  }
}

function findConfigPath(basePath: string): string | null {
  const jsoncPath = `${basePath}.jsonc`;
  const jsonPath = `${basePath}.json`;

  if (fs.existsSync(jsoncPath)) {
    return jsoncPath;
  }
  if (fs.existsSync(jsonPath)) {
    return jsonPath;
  }
  return null;
}

function getConfigSearchDirs(): string[] {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return [path.join(xdgConfig, 'opencode')];
  }
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];
  return [path.join(home, '.config', 'opencode'), path.join(home, '.opencode')];
}

function findConfigPathInDirs(
  configDirs: string[],
  baseName: string,
): string | null {
  for (const configDir of configDirs) {
    const configPath = findConfigPath(path.join(configDir, baseName));
    if (configPath) {
      return configPath;
    }
  }
  return null;
}

export function findPluginConfigPaths(directory: string): {
  userConfigPath: string | null;
  projectConfigPath: string | null;
} {
  const userConfigPath = findConfigPathInDirs(
    getConfigSearchDirs(),
    'opencode-distributed-delegation',
  );

  const projectConfigBasePath = path.join(
    directory,
    '.opencode',
    'opencode-distributed-delegation',
  );
  const projectConfigPath = findConfigPath(projectConfigBasePath);

  return { userConfigPath, projectConfigPath };
}

export function deepMerge<T extends Record<string, unknown>>(
  base?: T,
  override?: T,
): T | undefined {
  if (!base) return override;
  if (!override) return base;

  const result = { ...base } as T;
  for (const key of Object.keys(override) as (keyof T)[]) {
    const baseVal = base[key];
    const overrideVal = override[key];

    if (
      typeof baseVal === 'object' &&
      baseVal !== null &&
      typeof overrideVal === 'object' &&
      overrideVal !== null &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

export function mergePluginConfigs(
  base: PluginConfig,
  override: PluginConfig,
): PluginConfig {
  return {
    ...base,
    ...override,
    titan: deepMerge(base.titan, override.titan),
    backgroundJobs: deepMerge(base.backgroundJobs, override.backgroundJobs),
  };
}

/**
 * Load plugin configuration from user and project config files.
 */
export function loadPluginConfig(directory: string): PluginConfig {
  const { userConfigPath, projectConfigPath } =
    findPluginConfigPaths(directory);

  let config: PluginConfig = userConfigPath
    ? (loadConfigFromPath(userConfigPath) ?? {})
    : {};

  const projectConfig = projectConfigPath
    ? loadConfigFromPath(projectConfigPath)
    : null;
  if (projectConfig) {
    config = mergePluginConfigs(config, projectConfig);
  }

  return config;
}

/**
 * Load custom prompt for an agent from the prompts directory.
 */
export function loadAgentPrompt(
  agentName: string,
  options?: { preset?: string; projectDirectory?: string },
): {
  prompt?: string;
  appendPrompt?: string;
} {
  const projectDirectory = options?.projectDirectory;

  const searchDirs: string[] = [];

  if (projectDirectory) {
    searchDirs.push(path.join(projectDirectory, '.opencode', PROMPTS_DIR_NAME));
  }

  for (const userDir of getConfigSearchDirs()) {
    searchDirs.push(path.join(userDir, PROMPTS_DIR_NAME));
  }

  const readFirstPrompt = (fileName: string): string | undefined => {
    for (const dir of searchDirs) {
      const promptPath = path.join(dir, fileName);
      if (!fs.existsSync(promptPath)) continue;

      try {
        return fs.readFileSync(promptPath, 'utf-8');
      } catch {
        // skip
      }
    }
    return undefined;
  };

  return {
    prompt: readFirstPrompt(`${agentName}.md`),
    appendPrompt: readFirstPrompt(`${agentName}_append.md`),
  };
}
