import { BashTool } from "./builtins/bash";
import { SkillsTool } from "./builtins/skills";
import { FileReadTool } from "./builtins/file-read";
import { FileEditTool } from "./builtins/file-edit";
import { ListFilesTool } from "./builtins/list-files";
import { GrepTool } from "./builtins/grep";
import { GlobTool } from "./builtins/glob";
import { FetchTool } from "./builtins/fetch";
import { ArchitectTool } from "./builtins/architect";
import { TodoReadTool, TodoWriteTool } from "./builtins/todo";

const bashTool = new BashTool();
const fileReadTool = new FileReadTool();
const fileEditTool = new FileEditTool();
const listFilesTool = new ListFilesTool();
const grepTool = new GrepTool();
const globTool = new GlobTool();
const fetchTool = new FetchTool();
const architectTool = new ArchitectTool();
const todoReadTool = new TodoReadTool();
const todoWriteTool = new TodoWriteTool();

export { Tool } from "./base";
export {
  bashTool,
  fileReadTool,
  fileEditTool,
  listFilesTool,
  grepTool,
  globTool,
  fetchTool,
  architectTool,
  todoReadTool,
  todoWriteTool,
  SkillsTool,
};

export { FsReadTool, FsWriteTool, FsPatchTool } from "./builtins/fs";
export { SearchTool } from "./builtins/search";
