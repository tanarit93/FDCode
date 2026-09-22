# `fdcode init` 配置向导与 OpenAI 兼容 Provider 种子

## 产品规则

- `fdcode init`（别名 `fdcode config`）交互式收集 Base URL、API Key、模型名并保存。仅支持交互式 TTY；非 TTY 时报错退出（退出码 1），不挂起。
- 保存位置二选一：
  1. 项目 `.env`：仅更新 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL` 三个键，已存在则原地替换，不重复追加；写入后若项目是 Git 仓库且 `.gitignore` 未忽略 `.env`，自动追加 `.env` 并提示。
  2. 用户级配置：`getDefaultConfigPath()`（当前为 `~/.zcode/cli/config.json`）。按旧 CLI 格式写入：`provider` 是以 providerId 为键的 map，`model.main` 为 `"<providerId>/<modelId>"` 字符串（旧格式 schema 拒绝对象形式）；保留文件中其他 Provider。文件权限 0600。
- 连通性检测只提示，不影响保存结果。

## Provider 来源优先级

Personal Provider 文件 > 旧 CLI 配置文件（`~/.zcode/cli/config.json`）> 环境变量种子。环境变量种子只在前两者都不存在时生效，此时向导会在提示中说明这一点。

## 环境变量

- `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`：OpenAI 生态通用变量，非本项目自有，不使用 `ZCODE_` 前缀。
- 不再支持 `FDCODE_API_KEY` / `FDCODE_BASE_URL` / `FDCODE_MODEL`。

## 状态所有者

- 环境变量种子由 `env-provider-config-seed.ts` 生成 `ProviderConfigLayerUpdate`，`legacy-cli-personal-provider-config-importer.ts` 仅在旧配置文件不存在时调用。
- 向导文案走 i18n（`init.*`）。

## 验收场景

1. 选择 `.env`：连续运行两次，文件里每个键只出现一次；已有其他键保持不变。
2. `.env` 未被 Git 忽略：向导追加忽略规则并提示。
3. 选择用户级配置：写出的文件能被旧 CLI importer 解析（`readLegacyCliPersonalProviderConfig` 得到对应的 Provider 与默认模型）；文件中 `provider` 为 map，`model.main` 以其中一个 key 开头，其他已有 Provider 保留。
4. 用户级配置文件已损坏（非法 JSON）：向导报错，不覆盖原文件。
5. 非 TTY 运行：输出错误并返回 1。
