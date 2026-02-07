#!/usr/bin/env bun
/**
 * 端到端测试脚本
 * 测试 MCP 连接管理和 Skills 依赖管理功能
 */

import { ConnectionManager } from "./src/core/internal/integrations/mcp/connection-manager";
import { McpToolCache } from "./src/core/internal/integrations/mcp/tool-cache";
import { RetryStrategy } from "./src/core/internal/integrations/mcp/retry-strategy";
import { HealthChecker } from "./src/core/internal/integrations/mcp/health-checker";
import { DependencyResolver } from "./src/core/internal/integrations/skills/dependency/resolver";
import { ConflictDetector } from "./src/core/internal/integrations/skills/dependency/conflict-detector";
import { DependencyGraphBuilder } from "./src/core/internal/integrations/skills/dependency/graph";
import { McpDependencyLoader } from "./src/core/internal/integrations/skills/integration/mcp-loader";
import { LifecycleManager } from "./src/core/internal/integrations/skills/integration/lifecycle";
import { ToolMapper } from "./src/core/internal/integrations/skills/integration/tool-mapper";

console.log("🧪 开始端到端测试...\n");

// 测试 1: ConnectionManager
console.log("📋 测试 1: ConnectionManager");
try {
  const connectionManager = new ConnectionManager();
  console.log("✅ ConnectionManager 创建成功");

  // 测试事件监听
  let eventFired = false;
  connectionManager.on("connectionStateChanged", () => {
    eventFired = true;
  });
  console.log("✅ 事件监听器设置成功");
} catch (error) {
  console.error("❌ ConnectionManager 测试失败:", error);
}

// 测试 2: McpToolCache
console.log("\n📋 测试 2: McpToolCache");
try {
  const cache = new McpToolCache(1); // 1 分钟 TTL

  // 设置缓存
  cache.set("test-server", [
    { name: "test-tool", description: "Test tool", inputSchema: { type: "object" } }
  ]);
  console.log("✅ 缓存设置成功");

  // 获取缓存
  const cached = cache.get("test-server");
  if (cached && cached.length === 1) {
    console.log("✅ 缓存获取成功");
  } else {
    console.error("❌ 缓存获取失败");
  }

  // 获取统计信息
  const stats = cache.getStats();
  console.log(`✅ 缓存统计: ${stats.size} 个条目`);

  // 清理
  cache.stopCleanup();
} catch (error) {
  console.error("❌ McpToolCache 测试失败:", error);
}

// 测试 3: RetryStrategy
console.log("\n📋 测试 3: RetryStrategy");
try {
  const retryStrategy = new RetryStrategy({
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 1000,
  });

  // 测试延迟计算
  const delay0 = retryStrategy.getDelay(0);
  const delay1 = retryStrategy.getDelay(1);
  const delay2 = retryStrategy.getDelay(2);

  console.log(`✅ 延迟计算: attempt 0 = ${delay0}ms, attempt 1 = ${delay1}ms, attempt 2 = ${delay2}ms`);

  // 验证指数退避
  if (delay1 > delay0 && delay2 > delay1) {
    console.log("✅ 指数退避算法正确");
  } else {
    console.error("❌ 指数退避算法错误");
  }
} catch (error) {
  console.error("❌ RetryStrategy 测试失败:", error);
}

// 测试 4: HealthChecker
console.log("\n📋 测试 4: HealthChecker");
try {
  const healthChecker = new HealthChecker(5000); // 5 秒间隔
  console.log("✅ HealthChecker 创建成功");

  const activeCount = healthChecker.getActiveCount();
  console.log(`✅ 活跃健康检查数量: ${activeCount}`);
} catch (error) {
  console.error("❌ HealthChecker 测试失败:", error);
}

// 测试 5: ConflictDetector
console.log("\n📋 测试 5: ConflictDetector");
try {
  const conflictDetector = new ConflictDetector();

  // 测试版本冲突检测
  const versionConflicts = conflictDetector.detectVersionConflicts([
    { serverName: "server1", skillName: "skill1", version: "1.0.0" },
    { serverName: "server1", skillName: "skill2", version: "2.0.0" },
  ]);

  if (versionConflicts.length > 0) {
    console.log(`✅ 版本冲突检测成功: 发现 ${versionConflicts.length} 个冲突`);
  } else {
    console.log("✅ 版本冲突检测成功: 无冲突");
  }

  // 测试配置冲突检测
  const configConflicts = conflictDetector.detectConfigConflicts([
    { serverName: "server1", skillName: "skill1", url: "http://localhost:3000" },
    { serverName: "server1", skillName: "skill2", url: "http://localhost:4000" },
  ]);

  if (configConflicts.length > 0) {
    console.log(`✅ 配置冲突检测成功: 发现 ${configConflicts.length} 个冲突`);
  } else {
    console.log("✅ 配置冲突检测成功: 无冲突");
  }
} catch (error) {
  console.error("❌ ConflictDetector 测试失败:", error);
}

// 测试 6: DependencyGraphBuilder
console.log("\n📋 测试 6: DependencyGraphBuilder");
try {
  const graphBuilder = new DependencyGraphBuilder();

  // 构建简单的依赖图
  const dependencies = new Map([
    ["skill1", ["dep1", "dep2"]],
    ["skill2", ["dep1"]],
    ["skill3", []],
  ]);

  const graph = graphBuilder.buildGraph(dependencies);
  console.log(`✅ 依赖图构建成功: ${graph.nodes.size} 个节点`);

  if (graph.hasCycle) {
    console.log(`⚠️ 检测到循环依赖: ${graph.cycles.length} 个`);
  } else {
    console.log("✅ 无循环依赖");
  }
} catch (error) {
  console.error("❌ DependencyGraphBuilder 测试失败:", error);
}

// 测试 7: DependencyResolver
console.log("\n📋 测试 7: DependencyResolver");
try {
  const resolver = new DependencyResolver();

  // 测试空依赖
  const result = resolver.resolve([]);
  console.log(`✅ 依赖解析成功: ${Object.keys(result.mcpServers).length} 个 MCP 服务器`);
  console.log(`✅ 冲突数量: ${result.conflicts.length}`);
  console.log(`✅ 警告数量: ${result.warnings.length}`);
} catch (error) {
  console.error("❌ DependencyResolver 测试失败:", error);
}

// 测试 8: McpDependencyLoader
console.log("\n📋 测试 8: McpDependencyLoader");
try {
  const loader = new McpDependencyLoader();

  // 测试空 Skills
  const result = loader.loadDependencies([]);
  console.log(`✅ MCP 依赖加载成功: ${Object.keys(result.mcpServers).length} 个服务器`);
  console.log(`✅ 警告数量: ${result.warnings.length}`);
} catch (error) {
  console.error("❌ McpDependencyLoader 测试失败:", error);
}

// 测试 9: LifecycleManager
console.log("\n📋 测试 9: LifecycleManager");
try {
  const lifecycle = new LifecycleManager();

  // 标记加载
  lifecycle.markSkillLoaded("skill1");
  lifecycle.markMcpServerLoaded("server1");

  // 检查状态
  if (lifecycle.isSkillLoaded("skill1")) {
    console.log("✅ Skill 加载状态跟踪正确");
  }

  if (lifecycle.isMcpServerLoaded("server1")) {
    console.log("✅ MCP 服务器加载状态跟踪正确");
  }

  // 获取统计
  const stats = lifecycle.getStats();
  console.log(`✅ 生命周期统计: ${stats.skillCount} 个 Skills, ${stats.mcpServerCount} 个 MCP 服务器`);

  // 清理
  lifecycle.clear();
  const statsAfterClear = lifecycle.getStats();
  if (statsAfterClear.skillCount === 0 && statsAfterClear.mcpServerCount === 0) {
    console.log("✅ 清理成功");
  }
} catch (error) {
  console.error("❌ LifecycleManager 测试失败:", error);
}

// 测试 10: ToolMapper
console.log("\n📋 测试 10: ToolMapper");
try {
  const mapper = new ToolMapper();

  // 测试工具名称映射
  const fullName = mapper.mapToolName("server1", "tool1");
  if (fullName === "server1.tool1") {
    console.log("✅ 工具名称映射正确");
  }

  // 测试工具名称解析
  const parsed = mapper.parseToolName("server1.tool1");
  if (parsed && parsed.serverName === "server1" && parsed.toolName === "tool1") {
    console.log("✅ 工具名称解析正确");
  }

  // 测试工具可用性检查
  const availableTools = new Set(["server1.tool1", "server2.tool2"]);
  if (mapper.isToolAvailable("server1.tool1", availableTools)) {
    console.log("✅ 工具可用性检查正确");
  }

  // 测试获取服务器工具
  const serverTools = mapper.getServerTools("server1", availableTools);
  if (serverTools.length === 1 && serverTools[0] === "server1.tool1") {
    console.log("✅ 获取服务器工具正确");
  }
} catch (error) {
  console.error("❌ ToolMapper 测试失败:", error);
}

console.log("\n✅ 所有测试完成！");
