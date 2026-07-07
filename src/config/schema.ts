import { z } from 'zod';

export const ProviderModelIdSchema = z
  .string()
  .regex(
    /^[^/\s]+\/[^\s]+$/,
    'Expected provider/model format (provider/.../model)',
  );

// Child agent model type: dense (slower, better logic) or sparse (faster, better info gathering)
export const ModelTypeSchema = z.enum(['dense', 'sparse']);
export type ModelType = z.infer<typeof ModelTypeSchema>;

// Individual child agent configuration
export const ChildAgentConfigSchema = z
  .object({
    model: z.union([ProviderModelIdSchema, z.string()]),
    speed: z.number().int().min(1).max(10),
    intelligence: z.number().int().min(1).max(10),
    modelType: ModelTypeSchema,
    // Maximum number of parallel instances Titan may run for this child.
    // Because instances share the same model (already loaded in the provider's
    // VRAM), they can run concurrently on the same provider. Defaults to 1.
    maxInstances: z.number().int().min(1).optional(),
    temperature: z.number().min(0).max(2).optional(),
    variant: z.string().optional(),
    displayName: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
  })
  .strict();

export type ChildAgentConfig = z.infer<typeof ChildAgentConfigSchema>;

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
  children: z.array(ChildAgentConfigSchema).optional(),
  disabled_tools: z.array(z.string()).optional(),
  backgroundJobs: z
    .object({
      maxSessionsPerAgent: z.number().int().min(1).max(10).default(10),
    })
    .optional(),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;
