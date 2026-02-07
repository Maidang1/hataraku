import { z } from "zod";

export const SkillInterfaceSchema = z.object({
  displayName: z.string().optional(),
  shortDescription: z.string().optional(),
  iconSmall: z.string().optional(),
  iconLarge: z.string().optional(),
  brandColor: z.string().optional(),
  defaultPrompt: z.string().optional(),
});

export const SkillToolDependencySchema = z.object({
  type: z.string(),
  value: z.string(),
  description: z.string().optional(),
  transport: z.string().optional(),
  command: z.string().optional(),
  url: z.string().optional(),
});

export const SkillDependenciesSchema = z.object({
  tools: z.array(SkillToolDependencySchema),
});

export const SkillMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  shortDescription: z.string().optional(),
  interface: SkillInterfaceSchema.optional(),
  dependencies: SkillDependenciesSchema.optional(),
  path: z.string(),
  scope: z.enum(["Repo", "User", "System", "Admin"]),
  version: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});
