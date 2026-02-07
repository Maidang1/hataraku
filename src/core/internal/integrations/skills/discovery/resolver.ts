import path from "path";
import { SkillScope } from "../core/types";
import type { SkillRoot } from "../core/types";
import { resolveProjectRoot } from "../utils/path";

export interface ResolveOptions {
  cwd: string;
  codexHome: string;
  projectMarkers: string[];
}

export function resolveRoots(options: ResolveOptions): SkillRoot[] {
  const { cwd, codexHome, projectMarkers } = options;
  const roots: SkillRoot[] = [];

  const projectRoot = resolveProjectRoot(cwd, projectMarkers);
  if (projectRoot) {
    roots.push({
      path: path.join(projectRoot, ".codex", "skills"),
      scope: SkillScope.Repo,
    });
    roots.push({
      path: path.join(projectRoot, ".agents", "skills"),
      scope: SkillScope.Repo,
    });
  }

  roots.push({
    path: path.join(codexHome, "skills"),
    scope: SkillScope.User,
  });

  roots.push({
    path: path.join(codexHome, "skills", ".system"),
    scope: SkillScope.System,
  });

  return roots;
}
