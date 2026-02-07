import type Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";
import type { SkillMetadata } from "../../integrations/skills";

type SkillsToolOptions = {
  listSkills: () => SkillMetadata[];
  getSkillByName: (name: string) => SkillMetadata | undefined;
  injectSkillDetails: (name: string, details: string) => boolean;
};

type SkillsToolInput = {
  action: "list" | "get";
  name?: string;
};

export class SkillsTool extends Tool {
  name = "skills";
  readonly = true;
  description =
    "List available skills or inject full skill details into system context. Use action 'list' to see skills, or action 'get' with a skill name to inject details.";

  private listSkills: () => SkillMetadata[];
  private getSkillByName: (name: string) => SkillMetadata | undefined;
  private injectSkillDetails: (name: string, details: string) => boolean;

  constructor(options: SkillsToolOptions) {
    super();
    this.listSkills = options.listSkills;
    this.getSkillByName = options.getSkillByName;
    this.injectSkillDetails = options.injectSkillDetails;
  }

  getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "Action to perform: list or get",
            enum: ["list", "get"],
          },
          name: {
            type: "string",
            description: "Skill name to get details for (required when action is 'get')",
          },
        },
        required: ["action"],
      },
    };
  }

  execute(input: SkillsToolInput, _context: ToolExecutionContext): ToolExecutionResult {
    if (!input || !input.action) {
      return "Error: Missing required field 'action'.";
    }

    if (input.action === "list") {
      const skills = this.listSkills();
      if (!skills.length) return "No skills available.";
      return skills
        .map((skill) => {
          const short = skill.shortDescription ? ` — ${skill.shortDescription}` : "";
          return `${skill.name}: ${skill.description}${short}`;
        })
        .join("\n");
    }

    if (input.action === "get") {
      const name = input.name?.trim();
      if (!name) return "Error: Missing required field 'name' for action 'get'.";

      const skill = this.getSkillByName(name);
      if (!skill) return `Error: Skill not found: ${name}`;

      const details = buildSkillDetails(skill);
      const injected = this.injectSkillDetails(skill.name, details);
      if (!injected) return `Skill details already injected: ${skill.name}`;
      return `Injected skill details into system context: ${skill.name}`;
    }

    return `Error: Unsupported action '${(input as any).action}'.`;
  }
}

function buildSkillDetails(skill: SkillMetadata): string {
  const content = safeReadFile(skill.path);
  const body = extractBody(content);
  const sections: string[] = [];
  sections.push(`Description: ${skill.description}`);
  if (skill.shortDescription) {
    sections.push(`Short description: ${skill.shortDescription}`);
  }
  if (skill.interface?.defaultPrompt) {
    sections.push(`Default prompt:\n${skill.interface.defaultPrompt}`);
  }
  if (body) {
    sections.push(`Details:\n${body}`);
  }
  return sections.join("\n");
}

function safeReadFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function extractBody(content: string): string {
  if (!content) return "";
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return content.trim();
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return content.trim();
  return lines.slice(end + 1).join("\n").trim();
}
