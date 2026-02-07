# Always Allow 功能

## 概述

为 hataraku 添加了 `autoAllowedTools` 配置选项，允许在特定项目中指定某些工具无需用户确认即可自动执行。

## 修改的文件

### 1. `src/core/internal/config/schema.ts`
- 在 `ClaudeSettings.safety` 类型中添加了 `autoAllowedTools?: string[]` 选项

### 2. `src/core/internal/policy/safety/types.ts`
- 在 `SafetyPolicyConfig` 类型中添加了 `autoAllowedTools?: string[]` 配置

### 3. `src/core/internal/policy/safety/policy.ts`
- 在 `decide()` 方法中添加了对 `autoAllowedTools` 的检查
- 如果工具名称在 `autoAllowedTools` 列表中，则无需确认自动允许

### 4. `src/core/internal/sdk/agent/agent.ts`
- 在初始化 `SafetyPolicy` 时传入 `autoAllowedTools` 配置

### 5. `README.md`
- 添加了配置章节，说明如何使用 `autoAllowedTools`
- 提供了配置示例和安全警告

### 6. `.claude/config.example.yml`
- 创建了配置示例文件

## 使用方法

### 1. 创建配置文件

在项目根目录创建 `.claude/config.yml`：

```yaml
safety:
  autoAllowedTools:
    - fileRead
    - fileEdit
    - todo_write
    - grep
```

### 2. 支持的工具名称

以下工具可以添加到 `autoAllowedTools` 列表：

| 工具名称 | 功能 | 建议 |
|----------|------|------|
| `fileRead` | 读取文件 | ✅ 安全 |
| `fileEdit` | 编辑文件 | ⚠️ 谨慎 |
| `listFiles` | 列出目录 | ✅ 安全 |
| `grep` | 搜索内容 | ✅ 安全 |
| `glob` | 查找文件 | ✅ 安全 |
| `bash` | 执行命令 | ⚠️ 谨慎 |
| `todo_read` | 读取待办 | ✅ 安全 |
| `todo_write` | 更新待办 | ✅ 安全 |
| `fetch` | 获取 URL | ⚠️ 谨慎 |
| `architect` | 生成计划 | ✅ 安全 |
| `skills` | 技能管理 | ✅ 安全 |

### 3. 默认行为

以下工具默认总是自动允许（无需配置）：
- `fileRead`
- `listFiles`
- `grep`
- `glob`
- `architect`
- `todo_read`
- `skills`

## 安全建议

### ✅ 推荐自动允许
- 只读工具（`fileRead`、`listFiles`、`grep`、`glob`）
- 信息类工具（`architect`、`skills`）
- 低风险写入工具（`todo_write`）

### ⚠️ 谨慎自动允许
- `fileEdit` - 可能意外修改文件
- `bash` - 可能执行危险命令
- `fetch` - 可能访问外部资源

## 示例配置

### 保守配置（推荐）
```yaml
safety:
  autoAllowedTools:
    - todo_write
    # fileEdit 需要确认
```

### 针对可信项目
```yaml
safety:
  autoAllowedTools:
    - fileEdit
    - todo_write
    - fetch
```

### 完全自动（不推荐）
```yaml
safety:
  autoAllowedTools:
    - fileEdit
    - bash
    - todo_write
    - fetch
```

## 工作原理

1. 配置加载器从 `.claude/config.yml` 读取配置
`2. Agent 初始化时将 `autoAllowedTools` 传递给 SafetyPolicy
3. 当尝试执行工具时，SafetyPolicy 检查工具是否在 `autoAllowedTools` 列表中
4. 如果在列表中，返回 `requiresConfirm: false`，工具自动执行
5. 否则，根据现有规则决定是否需要确认

## 测试

运行类型检查确保修改正确：

```bash
bunbunx tsc -p tsconfig.json --noEmit
```

## 未来改进

- 支持通配符工具匹配（如 `mcp:*` 匹配所有 MCP 工具）
- 支持基于工具输入的更细粒度控制
- 支持配置继承和覆盖
