import { z } from "zod";

export const SkillScopeSchema = z.enum(["Repo", "User", "System", "Admin"]);

export const SkillsConfigSchema = z.object({
  directories: z.object({
    homeDir: z.string(),
    userSkillsDir: z.string(),
    systemSkillsDir: z.string(),
    projectMarker: z.array(z.string()),
  }),
  filenames: z.object({
    skillFile: z.string(),
    metadataDir: z.string(),
    metadataFile: z.string(),
  }),
  scanning: z.object({
    maxDepth: z.number().int().positive(),
    maxDirsPerRoot: z.number().int().positive(),
    followSymlinks: z.record(SkillScopeSchema, z.boolean()),
  }),
  cache: z.object({
    enabled: z.boolean(),
    ttl: z.number().int().nonnegative(),
  }),
  validation: z.object({
    enabled: z.boolean(),
  }),
});

export type SkillsConfig = z.infer<typeof SkillsConfigSchema>;
