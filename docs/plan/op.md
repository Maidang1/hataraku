# MCP 和 Skills 系统代码优化计划

## 概述

基于对 `src/core/mcp` 和 `src/core/skills` 目录的深入分析，发现了多个可优化的问题。本计划旨在提升代码质量、可维护性和性能。

---

## 问题分析总结

### MCP 模块问题（7个文件，约900行代码）

| 优先级 | 问题 | 影响 |
|--------|------|------|
| 🔴 高 | 使用 `any` 类型（4处） | 类型安全 |
| 🔴 高 | 错误规范化代码重复（4处） | 可维护性 |
| 🔴 高 | 健康检查异常处理不完善 | 稳定性 |
| 🟡 中 | 超时处理代码重复（2处） | 可维护性 |
| 🟡 中 | 魔法数字未提取（6处） | 可维护性 |
| 🟡 中 | 错误分类使用字符串匹配效率低 | 性能 |
| 🟢 低 | 缺少日志级别控制 | 可观测性 |

### Skills 模块问题（37个文件，约2500行代码）

| 优先级 | 问题 | 影响 |
|--------|------|------|
| 🔴 高 | 类型定义重复（`core/types.ts` 和 `parsers/types.ts`） | 维护困难 |
| 🔴 高 | 解析器逻辑重复（60-70行） | 可维护性 |
| 🔴 高 | 错误处理不一致 | 稳定性 |
| 🟡 中 | 未使用的代码（5个方法） | 代码膨胀 |
| 🟡 中 | 缓存失效机制缺失 | 数据一致性 |
| 🟡 中 | 扫描性能问题（串行扫描） | 性能 |
| 🟡 中 | 冲突检测 O(n²) 算法 | 性能 |
| 🟢 低 | 命名不一致（Manager vs Coordinator） | 可读性 |
| 🟢 低 | 缺少文档注释 | 可维护性 |

---

## 优化计划

### 阶段 1：类型安全和代码重复修复（高优先级）

#### 1.1 消除 MCP 模块中的 `any` 类型

**修改文件：**
- `src/core/mcp/index.ts`
- `src/core/mcp/transport.ts`

**具体修改：**
```typescript
// 替换 any 为具体类型
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

// index.ts 第12行
private client: Client;  // 原: any

// index.ts 第20行
constructor(params: { client: Client; ... })  // 原: any

// transport.ts 第48行
export async function connectWithTimeout(
  client: Client,  // 原: any
  transport: Transport,
  timeoutSec: number = 30
): Promise<void>
```

#### 1.2 提取通用工具函数

**新建文件：** `src/core/mcp/utils.ts`

```typescript
/**
 * 规范化错误对象
 */
export function normalizeError(error: unknown, context?: string): Error {
  if (error instanceof Error) {
    return error;
  }
  const message = context
    ? `${context}: ${String(error)}`
    : String(error);
  return new Error(message);
}

/**
 * 创建超时 Promise
 */
export function createTimeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}

/**
 * MCP 模块常量
 */
export const MCP_CONSTANTS = {
  DEFAULT_CLIENT_NAME: "hataraku",
  DEFAULT_CLIENT_VERSION: "1.0.0",
  DEFAULT_STARTUP_TIMEOUT_SEC: 30,
  DEFAULT_TOOL_TIMEOUT_SEC: 60,
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_INITIAL_RETRY_DELAY_MS: 1000,
  DEFAULT_MAX_RETRY_DELAY_MS: 30000,
  DEFAULT_JITTER_FACTOR: 0.1,
  DEFAULT_TOOL_CACHE_TTL_MINUTES: 5,
  DEFAULT_HEALTH_CHECK_INTERVAL_MS: 60000,
} as const;
```

**修改文件：**
- `src/core/mcp/connection-manager.ts` - 使用 `normalizeError()`
- `src/core/mcp/retry-strategy.ts` - 使用 `normalizeError()` 和常量
- `src/core/mcp/health-checker.ts` - 使用 `normalizeError()` 和常量
- `src/core/mcp/tool-cache.ts` - 使用常量
- `src/core/mcp/index.ts` - 使用 `normalizeError()` 和 `createTimeoutPromise()`
- `src/core/mcp/transport.ts` - 使用 `createTimeoutPromise()`

#### 1.3 合并 Skills 模块重复的类型定义

**删除文件：** `src/core/skills/parsers/types.ts`

**修改文件：** `src/core/skills/core/types.ts`
- 保留所有类型定义在此文件

**修改文件：** `src/core/skills/types.ts`
```typescript
// 统一从 core/types.ts 导出
export {
  SkillScope,
  type SkillMetadata,
  type SkillError,
  type SkillLoadOutcome,
  type SkillRoot,
  type SkillInterface,
  type SkillDependencies,
  type SkillToolDependency,
} from "./core/types";
```

**修改文件：** 更新所有引用 `parsers/types.ts` 的文件
- `src/core/skills/parsers/base.ts`
- `src/core/skills/parsers/markdown.ts`
- `src/core/skills/parsers/yaml-metadata.ts`
- `src/core/skills/parsers/factory.ts`

#### 1.4 提取解析器公共逻辑

**修改文件：** `src/core/skills/parsers/base.ts`

添加公共方法到基类：
```typescript
export abstract class BaseSkillParser {
  // 现有抽象方法...

  // 新增公共方法
  protected extractString(obj: unknown, key: string): string | undefined { ... }
  protected extractBoolean(obj: unknown, key: string): boolean | undefined { ... }
  protected extractTags(obj: unknown): string[] | undefined { ... }
  protected resolveInterface(obj: unknown): SkillInterface | undefined { ... }
  protected resolveAssetPath(basePath: string, assetPath: string): string { ... }
  protected resolveDependencies(obj: unknown): SkillDependencies | undefined { ... }
}
```

**修改文件：**
- `src/core/skills/parsers/markdown.ts` - 删除重复方法，使用基类方法
- `src/core/skills/parsers/yaml-metadata.ts` - 删除重复方法，使用基类方法

---

### 阶段 2：错误处理和稳定性改进（高优先级）

#### 2.1 修复健康检查异常处理

**修改文件：** `src/core/mcp/health-checker.ts`

```typescript
// 第29-31行，添加 try-catch
start(serverName: string, client: Client, callbacks: { ... }): void {
  this.stop(serverName);

  const timer = setInterval(async () => {
    try {
      await this.check(serverName, client, callbacks);
    } catch (error) {
      // 防止未捕获的异常导致定时器异常
      callbacks.onUnhealthy?.(normalizeError(error, "Health check failed"));
    }
  }, this.interval);

  this.timers.set(serverName, timer);
}
```

#### 2.2 统一 Skills 模块错误处理

**修改文件：** `src/core/skills/loaders/skill-loader.ts`

```typescript
// 第46-56行，区分错误类型
loadMultiple(filePaths: string[], scope: SkillScope): {
  skills: SkillMetadata[];
  errors: SkillError[]
} {
  const skills: SkillMetadata[] = [];
  const errors: SkillError[] = [];

  for (const filePath of filePaths) {
    try {
      const skill = this.load(filePath, scope);
      if (skill) {
        skills.push(skill);
      }
    } catch (error) {
      // 区分系统错误和解析错误
      if (error instanceof SkillParseError || error instanceof SkillValidationError) {
        errors.push({
          path: filePath,
          message: error.message,
        });
      } else {
        // 系统错误应该向上抛出
        throw error;
      }
    }
  }

  return { skills, errors };
}
```

#### 2.3 修复静默失败问题

**修改文件：** `src/core/skills/parsers/markdown.ts`

```typescript
// 第94-96行，记录解析失败
private loadSkillMetadata(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = yaml.load(content);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch (error) {
    // 记录警告而不是静默失败
    console.warn(`Failed to parse YAML metadata: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}
```

---

### 阶段 3：性能优化（中优先级）

#### 3.1 优化错误分类算法

**修改文件：** `src/core/mcp/retry-strategy.ts`

```typescript
// 使用正则表达式替代字符串遍历
private static readonly RETRYABLE_PATTERNS =
  /econnrefused|etimedout|enotfound|socket hang up|network error|connection timeout|connection reset/i;

private static readonly NON_RETRYABLE_PATTERNS =
  /unauthorized|forbidden|authentication|invalid config|protocol error/i;

private classifyError(error: Error): ErrorType {
  const message = error.message;

  if (RetryStrategy.RETRYABLE_PATTERNS.test(message)) {
    return ErrorType.RETRYABLE;
  }

  if (RetryStrategy.NON_RETRYABLE_PATTERNS.test(message)) {
    return ErrorType.NON_RETRYABLE;
  }

  return ErrorType.RETRYABLE; // 默认可重试
}
```

#### 3.2 实现并行扫描

**修改文件：** `src/core/skills/discovery/index.ts`

```typescript
// 第33-65行，使用 Promise.all 并行扫描
public async discoverFromCwd(cwd: string): Promise<{
  skillFilePaths: string[];
  truncated: boolean;
}> {
  const roots = this.resolveRoots(cwd, this.codexHome, this.config.projectMarkers);

  // 并行扫描所有根目录
  const results = await Promise.all(
    roots.map(root => this.discoverFromRoot(root))
  );

  // 合并结果
  const allPaths: string[] = [];
  let anyTruncated = false;

  for (const result of results) {
    allPaths.push(...result.skillFilePaths);
    if (result.truncated) {
      anyTruncated = true;
    }
  }

  return {
    skillFilePaths: allPaths,
    truncated: anyTruncated,
  };
}
```

#### 3.3 添加缓存过期清理

**修改文件：** `src/core/skills/cache/memory-cache.ts`

```typescript
export class MemoryCache<T> implements CacheInterface<T> {
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(ttlMs: number = 300000) {
    this.ttl = ttlMs;
    this.startCleanup();
  }

  private startCleanup(): void {
    // 每分钟清理过期缓存
    this.cleanupTimer = setInterval(() => {
      this.clearExpired();
    }, 60000);
  }

  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
```

---

### 阶段 4：代码清理（中优先级）

#### 4.1 删除未使用的代码

**修改文件：** `src/core/skills/dependency/resolver.ts`
- 删除或实现 `resolveConflicts()` 方法（第133-161行）

**修改文件：** `src/core/skills/dependency/conflict-detector.ts`
- 在 `DependencyResolver.resolve()` 中调用 `detectToolNameConflicts()`

**修改文件：** `src/core/skills/cache/memory-cache.ts`
- 删除未使用的 `getTtl()` 和 `setTtl()` 方法
- 或者在配置更新时使用它们

**修改文件：** `src/core/skills/manager.ts`
- 使用或删除 `codexHome` 参数

#### 4.2 修复 `any` 类型

**修改文件：** `src/core/skills/parsers/types.ts`（合并前）或 `src/core/skills/core/types.ts`（合并后）

```typescript
// 替换 any 为 unknown 或具体类型
export interface SkillToolDependency {
  // ...
  config?: McpServerConfig; // 原: any
}
```

---

### 阶段 5：可维护性改进（低优先级）

#### 5.1 统一命名约定

建议统一使用 `Manager` 后缀：
- `DiscoveryCoordinator` → `DiscoveryManager`
- `ParserCoordinator` → `ParserManager`
- `ValidationCoordinator` → `ValidationManager`

或者统一使用 `Coordinator` 后缀（保持现状，只需文档说明）。

#### 5.2 添加 JSDoc 文档

为所有公共方法添加 JSDoc 注释，特别是：
- `src/core/mcp/connection-manager.ts`
- `src/core/mcp/retry-strategy.ts`
- `src/core/skills/manager.ts`
- `src/core/skills/dependency/resolver.ts`

---

## 关键文件清单

### 需要修改的文件

**MCP 模块（7个）：**
```
src/core/mcp/utils.ts              # 新建 - 工具函数
src/core/mcp/index.ts              # 修改 - 类型、工具函数
src/core/mcp/transport.ts          # 修改 - 类型、工具函数
src/core/mcp/connection-manager.ts # 修改 - 工具函数
src/core/mcp/retry-strategy.ts     # 修改 - 工具函数、正则优化
src/core/mcp/health-checker.ts     # 修改 - 异常处理
src/core/mcp/tool-cache.ts         # 修改 - 常量
```

**Skills 模块（12个）：**
```
src/core/skills/core/types.ts           # 修改 - 合并类型
src/core/skills/parsers/types.ts        # 删除 - 类型已合并
src/core/skills/types.ts                # 修改 - 更新导出
src/core/skills/parsers/base.ts         # 修改 - 添加公共方法
src/core/skills/parsers/markdown.ts     # 修改 - 使用基类方法
src/core/skills/parsers/yaml-metadata.ts # 修改 - 使用基类方法
src/core/skills/parsers/factory.ts      # 修改 - 更新导入
src/core/skills/loaders/skill-loader.ts # 修改 - 错误处理
src/core/skills/discovery/index.ts      # 修改 - 并行扫描
src/core/skills/cache/memory-cache.ts   # 修改 - 清理机制
src/core/skills/dependency/resolver.ts  # 修改 - 清理未使用代码
src/core/skills/manager.ts              # 修改 - 清理未使用参数
```

---

## 验证方案

### 1. TypeScript 编译检查
```bash
bun run --bun tsc --noEmit
```

### 2. 运行现有测试
```bash
bun run test-e2e.ts
```

### 3. 应用启动测试
```bash
bun run src/index.ts
# 验证 MCP 连接和 Skills 加载正常
```

### 4. 手动验证
- 验证 MCP 服务器连接和重连
- 验证 Skills 加载和缓存
- 验证错误处理和日志输出

---

## 预期成果

完成优化后：

✅ **类型安全** - 消除所有 `any` 类型
✅ **代码复用** - 减少约 100 行重复代码
✅ **稳定性** - 完善错误处理，避免静默失败
✅ **性能** - 并行扫描、正则优化、缓存清理
✅ **可维护性** - 统一类型定义、清理未使用代码

---

## 实施优先级

1. **高优先级**（阶段 1-2）：类型安全、代码重复、错误处理
2. **中优先级**（阶段 3-4）：性能优化、代码清理
3. **低优先级**（阶段 5）：命名统一、文档完善
