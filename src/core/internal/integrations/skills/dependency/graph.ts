import type { DependencyGraph, DependencyNode } from "./types";

/**
 * 依赖图构建器
 * 构建依赖图并检测循环依赖
 */
export class DependencyGraphBuilder {
  /**
   * 构建依赖图
   */
  buildGraph(dependencies: Map<string, string[]>): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();

    // 初始化所有节点
    for (const [name, deps] of dependencies.entries()) {
      if (!nodes.has(name)) {
        nodes.set(name, {
          name,
          dependencies: [],
          dependents: [],
        });
      }

      const node = nodes.get(name)!;
      node.dependencies = deps;

      // 为每个依赖创建节点（如果不存在）
      for (const dep of deps) {
        if (!nodes.has(dep)) {
          nodes.set(dep, {
            name: dep,
            dependencies: [],
            dependents: [],
          });
        }
        nodes.get(dep)!.dependents.push(name);
      }
    }

    // 检测循环依赖
    const { hasCycle, cycles } = this.detectCycles(nodes);

    return { nodes, hasCycle, cycles };
  }

  /**
   * 检测循环依赖
   */
  private detectCycles(
    nodes: Map<string, DependencyNode>
  ): { hasCycle: boolean; cycles: string[][] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeName: string, path: string[]): boolean => {
      visited.add(nodeName);
      recursionStack.add(nodeName);
      path.push(nodeName);

      const node = nodes.get(nodeName);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            if (dfs(dep, [...path])) {
              return true;
            }
          } else if (recursionStack.has(dep)) {
            // 找到循环
            const cycleStart = path.indexOf(dep);
            const cycle = path.slice(cycleStart);
            cycle.push(dep);
            cycles.push(cycle);
            return true;
          }
        }
      }

      recursionStack.delete(nodeName);
      return false;
    };

    for (const nodeName of nodes.keys()) {
      if (!visited.has(nodeName)) {
        dfs(nodeName, []);
      }
    }

    return { hasCycle: cycles.length > 0, cycles };
  }
}
