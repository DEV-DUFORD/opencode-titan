import { z } from 'zod';

export const ProviderModelIdSchema = z
  .string()
  .regex(
    /^[^/\s]+\/[^\s]+$/,
    'Expected provider/model format (provider/.../model)',
  );

// Myrmidon model type: dense (slower, better logic) or sparse (faster, better info gathering)
export const ModelTypeSchema = z.enum(['dense', 'sparse']);
export type ModelType = z.infer<typeof ModelTypeSchema>;

// Individual Myrmidon (worker agent) configuration
export const MyrmidonConfigSchema = z
  .object({
    model: z.union([ProviderModelIdSchema, z.string()]),
    speed: z.number().int().min(1).max(10),
    intelligence: z.number().int().min(1).max(10),
    modelType: ModelTypeSchema,
    // Maximum number of parallel instances Titan may run for this Myrmidon.
    // Because instances share the same model (already loaded in the provider's
    // VRAM), they can run concurrently on the same provider. Defaults to 1.
    maxInstances: z.number().int().min(1).optional(),
    temperature: z.number().min(0).max(2).optional(),
    variant: z.string().optional(),
    displayName: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
  })
  .strict();

export type MyrmidonConfig = z.infer<typeof MyrmidonConfigSchema>;

/**
 * @deprecated Use `MyrmidonConfigSchema`. Retained as a backwards-compatible
 * alias for the former "child agent" naming.
 */
export const ChildAgentConfigSchema = MyrmidonConfigSchema;

/**
 * @deprecated Use `MyrmidonConfig`. Retained as a backwards-compatible alias
 * for the former "child agent" naming.
 */
export type ChildAgentConfig = MyrmidonConfig;

// Titan agent override configuration
export const TitanOverrideConfigSchema = z
  .object({
    model: z.union([ProviderModelIdSchema, z.string()]).optional(),
    temperature: z.number().min(0).max(2).optional(),
    variant: z.string().optional(),
    prompt: z.string().min(1).optional(),
  })
  .strict();

export type TitanOverrideConfig = z.infer<typeof TitanOverrideConfigSchema>;

// Main plugin configuration
export const PluginConfigSchema = z.object({
  titan: TitanOverrideConfigSchema.optional(),
  // Preferred: the Myrmidon fleet Titan delegates work to.
  myrmidons: z.array(MyrmidonConfigSchema).optional(),
  // Deprecated alias for `myrmidons`, retained for backwards compatibility.
  // If both are present, `myrmidons` takes precedence.
  children: z.array(MyrmidonConfigSchema).optional(),
  // Maximum word count enforced on each Myrmidon's final response to Titan.
  // Keeps Titan's context lean. Defaults to DEFAULT_MAX_RESPONSE_WORDS (1000).
  maxResponseWords: z.number().int().min(1).optional(),
  disabled_tools: z.array(z.string()).optional(),
  backgroundJobs: z
    .object({
      maxSessionsPerAgent: z.number().int().min(1).max(10).default(10),
    })
    .optional(),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * Resolve the configured Myrmidon fleet, honoring the deprecated `children`
 * key. `myrmidons` takes precedence when both are provided.
 */
export function getMyrmidonConfigs(config?: PluginConfig): MyrmidonConfig[] {
  return config?.myrmidons ?? config?.children ?? [];
}
