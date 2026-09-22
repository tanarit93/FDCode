# RTK Bash 命令改写

## 产品规则

- Bash 工具执行前，若本机安装了 `rtk`，先调用 `rtk hook check <command>` 取得等价的 token 优化命令并执行。
- 没有安装、被禁用、命令无对应改写、`rtk` 超时或失败时，原样执行原命令，不向用户报错。
- 权限判定、遥测和 UI 展示始终使用模型提交的原始命令；只有实际执行的命令被改写。
- 已经以 `rtk` 开头的命令不再改写。

## 状态所有者与接口

- 开关由环境变量 `ZCODE_DISABLE_RTK`（`1` 或 `true` 表示禁用）决定，只在 Bootstrap 的 `resolveBashRtkPolicy(env)` 读取一次。
- 结果为 `BashRtkPolicy { enabled: boolean }`，经 `AgentRuntimeConfig.bashRtkPolicy` → `registerBuiltInTools` → `createBashToolEntry` 传入 Bash handler，Core 内不再读取 `process.env`。
- `rtk` 可执行文件固定从 `PATH` 查找，不提供路径覆盖变量。
- 可用性探测结果在进程内缓存；`rtk hook check` 每次调用一次子进程（本机实测约 80ms）。

## 只读策略

- `rtk gain` / `discover` / `cc-economics` / `session` 及 `--version` / `--help` 视为只读。
- `rtk proxy <cmd>` 与 `rtk <cmd>` 按被包装的 `<cmd>` 判定。
- 只读判定基于已拆分的 argv，不再对 token 做 `;|&` 字符串检查。

## 验收场景

1. 未安装 `rtk`：命令原样执行。
2. `ZCODE_DISABLE_RTK=1`：命令原样执行，不探测 `rtk`。
3. `rtk hook check` 退出码非 0（无改写）：命令原样执行。
4. `rtk hook check` 输出改写命令：执行改写后的命令。
5. 命令以 `rtk ` 开头：不调用 `rtk hook check`。
