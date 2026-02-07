import path from "path";
import os from "os";
import { SkillScope } from "../core/types";
import type { SkillsConfig } from "./index";

export const DEFAULT_CONFIG: SkillsConfig = {
  directories: {
    homeDir: path.join(os.homedir(), ".codex"),
    userSkillsDir: "skills",
    systemSkillsDir: "skills/.system",
    projectMarker: [".git", ".codex", ".agents"],
  },
  filenames: {
    skillFile: "SKILL.md",
    metadataDir: "agents",
    metadataFile: "openai.yaml",
  },
  scanning: {
    maxDepth: 6,
    maxDirsPerRoot: 2000,
    followSymlinks: {
      [SkillScope.Repo]: true,
      [SkillScope.User]: true,
      [SkillScope.System]: false,
      [SkillScope.Admin]: true,
    },
  },
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes in milliseconds
  },
  validation: {
    enabled: true,
  },
};
