import {
  architectTool,
  bashTool,
  fetchTool,
  fileEditTool,
  fileReadTool,
  globTool,
  grepTool,
  listFilesTool,
  todoReadTool,
  todoWriteTool,
} from "../index";
import type { Tool } from "../base";

export function defaultBuiltInTools(): Tool[] {
  return [
    fileReadTool,
    fileEditTool,
    listFilesTool,
    grepTool,
    globTool,
    fetchTool,
    architectTool,
    todoReadTool,
    todoWriteTool,
    bashTool,
  ];
}
