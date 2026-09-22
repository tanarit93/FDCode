import { useState } from "react";
import { isApiKeyAccess } from "@zcode/provider";
import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import {
  BIGMODEL_PROVIDER_ID,
  TID_LOGIN_API_KEY_CANCEL_BUTTON,
  TID_LOGIN_API_KEY_CONTINUE_BUTTON,
  TID_LOGIN_API_KEY_ERROR,
  TID_LOGIN_API_KEY_INPUT,
  TID_LOGIN_API_KEY_PROVIDER_ITEM,
  TID_LOGIN_API_KEY_PROVIDER_TRIGGER,
  TID_LOGIN_API_KEY_SKIP_BUTTON,
  ZAI_PROVIDER_ID,
  testId,
} from "@zcode/shared";
import { Alert, AlertDescription } from "@/components/ui/alert.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import { usePlatform } from "@/hooks/usePlatform.js";
import { useProviderSettingsView } from "@/hooks/useProviderSettingsView.js";
import { useServices } from "@/hooks/useServices.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { logger } from "@/logger.js";
import { renderOAuthProviderIcon } from "@/lib/oauthProviderIcon.js";
import {
  buildLoginApiKeyDefaultModelPreferenceFromSelection,
  buildLoginApiKeySkipSettings,
  OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
  OPENAI_COMPATIBLE_DEFAULT_MODEL,
  buildLoginApiKeyInitialConfig,
  isHttpUrl,
  isLoginApiKeyRequired,
  resolveLoginApiKeyDefaultProvider,
  resolveLoginApiKeyTemplateId,
  resolveLoginApiKeyProviderLabel,
  shouldShowLoginApiKeyLink,
  type ApiKeyProviderChoice,
} from "@/login/LoginApiKeyForm.helpers.js";
import { useZCodeStore } from "@/store/StoreProvider.js";

interface LoginApiKeyFormProps {
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
  onSkipped: () => void | Promise<void>;
}

export function LoginApiKeyForm({ onCancel, onSaved, onSkipped }: LoginApiKeyFormProps) {
  const { intl } = useZCodeIntl();
  const platform = usePlatform();
  const { modelSelectionService, providerSettingsService, settingService } = useServices();
  const markApiKeyLoginSuccess = useZCodeStore((state) => state.markApiKeyLoginSuccess);
  const [providerChoice, setProviderChoice] = useState<ApiKeyProviderChoice>(
    resolveLoginApiKeyDefaultProvider,
  );
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [baseUrlValue, setBaseUrlValue] = useState(OPENAI_COMPATIBLE_DEFAULT_BASE_URL);
  const [modelValue, setModelValue] = useState(OPENAI_COMPATIBLE_DEFAULT_MODEL);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providerSettingsRead = useProviderSettingsView();
  const providerSettingsView =
    providerSettingsRead.state.status === "ready" ? providerSettingsRead.state.view : null;

  const providerLabel = resolveLoginApiKeyProviderLabel(providerChoice);
  const templateId = resolveLoginApiKeyTemplateId(providerChoice);
  const templateAccess = providerSettingsView?.providerTemplates.find(
    (template) => template.templateId === templateId,
  )?.config.access;
  const apiKeyUrl = isApiKeyAccess(templateAccess) ? templateAccess.apiKeyManagementUrl : undefined;
  // 用户已经输入或回填 API Key 后，右侧获取入口会挤占密码输入区域。
  const showApiKeyLink = shouldShowLoginApiKeyLink(apiKeyValue, apiKeyUrl ?? undefined);

  const saveApiKeyProvider = async () => {
    const apiKey = apiKeyValue.trim();
    if (!apiKey && isLoginApiKeyRequired(providerChoice)) {
      setError(intl.formatMessage({ id: "login.apiKey.emptyError" }));
      return;
    }
    const baseUrl = baseUrlValue.trim();
    if (providerChoice === "openai-compatible" && baseUrl && !isHttpUrl(baseUrl)) {
      setError(intl.formatMessage({ id: "login.apiKey.invalidBaseUrl" }));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const template = (await providerSettingsService.getView()).providerTemplates.find(
        (item) => item.templateId === templateId,
      );
      if (!template || !isApiKeyAccess(template.config.access)) {
        setError(
          intl.formatMessage(
            { id: "login.apiKey.providerMissingError" },
            { provider: providerLabel },
          ),
        );
        return;
      }

      const initialConfig = buildLoginApiKeyInitialConfig({
        choice: providerChoice,
        accessType: template.config.access.type,
        apiKey,
        baseUrl,
        model: modelValue.trim(),
      });

      const created = await providerSettingsService.createPersonalProvider({
        templateId,
        providerName: providerChoice === "openai-compatible" ? providerLabel : undefined,
        initialConfig,
      });
      const defaultModelPreference = buildLoginApiKeyDefaultModelPreferenceFromSelection(
        await modelSelectionService.getView(),
        created.providerId,
      );
      markApiKeyLoginSuccess(defaultModelPreference);
      await onSaved();
    } catch (saveError) {
      logger.error("[LoginEntry] 保存 API Key provider 失败", {
        templateId,
        error: saveError,
      });
      setError(
        intl.formatMessage(
          { id: "login.apiKey.saveError" },
          {
            error: saveError instanceof Error ? saveError.message : String(saveError),
          },
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const skipApiKeyProvider = async () => {
    setSkipping(true);
    setError(null);
    try {
      // 跳过只表示用户确认当前 provider family 运行域，不能写入空 API Key
      // 或触发 API Key 登录成功事件，否则后续模型选择会误以为已有可用凭据。
      await settingService.update(buildLoginApiKeySkipSettings(providerChoice, Date.now()));
      await onSkipped();
    } catch (skipError) {
      logger.error("[LoginEntry] 跳过 API Key 登录失败", {
        providerChoice,
        error: skipError,
      });
      setError(
        intl.formatMessage(
          { id: "login.apiKey.skipError" },
          {
            error: skipError instanceof Error ? skipError.message : String(skipError),
          },
        ),
      );
    } finally {
      setSkipping(false);
    }
  };

  const busy = saving || skipping;
  const canSubmit =
    !busy && (Boolean(apiKeyValue.trim()) || !isLoginApiKeyRequired(providerChoice));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-ui-base font-medium text-foreground">
          {intl.formatMessage({ id: "login.apiKey.title" })}
        </h2>
        <div className="space-y-2">
          <div>
            <Select
              value={providerChoice}
              onValueChange={(value) => setProviderChoice(value as ApiKeyProviderChoice)}
              disabled={busy}
            >
              <SelectTrigger
                id="login-api-key-provider"
                size="lg"
                className="h-10 w-full text-ui-base"
                data-testid={TID_LOGIN_API_KEY_PROVIDER_TRIGGER}
                aria-label={intl.formatMessage({
                  id: "login.apiKey.providerLabel",
                })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-lg">
                <SelectItem
                  value="openai-compatible"
                  className="rounded-md"
                  data-testid={testId(TID_LOGIN_API_KEY_PROVIDER_ITEM, "openai-compatible")}
                >
                  <span className="font-medium">OpenAI Compatible (BYOK)</span>
                </SelectItem>
                <SelectItem
                  value="zai"
                  className="rounded-md"
                  data-testid={testId(TID_LOGIN_API_KEY_PROVIDER_ITEM, "zai")}
                >
                  {renderOAuthProviderIcon(ZAI_PROVIDER_ID, "size-4")}
                  {intl.formatMessage({ id: "login.apiKey.provider.zai" })}
                </SelectItem>
                <SelectItem
                  value="bigmodel"
                  className="rounded-md"
                  data-testid={testId(TID_LOGIN_API_KEY_PROVIDER_ITEM, "bigmodel")}
                >
                  {renderOAuthProviderIcon(BIGMODEL_PROVIDER_ID, "size-4")}
                  {intl.formatMessage({
                    id: "login.apiKey.provider.bigmodel",
                  })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {providerChoice === "openai-compatible" && (
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-foreground-subtle"
                htmlFor="login-base-url"
              >
                {intl.formatMessage({ id: "login.apiKey.baseUrlLabel" })}
              </label>
              <Input
                id="login-base-url"
                type="text"
                size="lg"
                className="h-10 w-full text-ui-base"
                value={baseUrlValue}
                placeholder={OPENAI_COMPATIBLE_DEFAULT_BASE_URL}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setBaseUrlValue(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            {providerChoice === "openai-compatible" && (
              <label className="text-xs font-medium text-foreground-subtle" htmlFor="login-api-key">
                {intl.formatMessage({ id: "login.apiKey.label" })}
              </label>
            )}
            <div className="relative">
              <Input
                id="login-api-key"
                type="password"
                size="lg"
                className={`h-10 w-full text-ui-base ${showApiKeyLink ? "pr-28" : ""}`}
                data-testid={TID_LOGIN_API_KEY_INPUT}
                aria-label={intl.formatMessage({
                  id: "login.apiKey.placeholder",
                })}
                value={apiKeyValue}
                placeholder={intl.formatMessage({
                  id: isLoginApiKeyRequired(providerChoice)
                    ? "login.apiKey.placeholder"
                    : "login.apiKey.placeholderOptional",
                })}
                autoComplete="off"
                onChange={(event) => {
                  setApiKeyValue(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSubmit) {
                    void saveApiKeyProvider();
                  }
                }}
              />
              {showApiKeyLink ? (
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ui-base font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    if (apiKeyUrl) {
                      platform.openExternal(apiKeyUrl);
                    }
                  }}
                >
                  {intl.formatMessage({ id: "login.apiKey.getApiKey" })}
                </button>
              ) : null}
            </div>
          </div>

          {providerChoice === "openai-compatible" && (
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-foreground-subtle"
                htmlFor="login-model-name"
              >
                {intl.formatMessage({ id: "login.apiKey.modelLabel" })}
              </label>
              <Input
                id="login-model-name"
                type="text"
                size="lg"
                className="h-10 w-full text-ui-base"
                value={modelValue}
                placeholder={OPENAI_COMPATIBLE_DEFAULT_MODEL}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setModelValue(event.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" data-testid={TID_LOGIN_API_KEY_ERROR}>
          <TriangleAlertIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Button
          type="button"
          className="h-10 w-full text-ui-base"
          size="lg"
          data-testid={TID_LOGIN_API_KEY_CONTINUE_BUTTON}
          disabled={!canSubmit}
          onClick={() => void saveApiKeyProvider()}
        >
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {intl.formatMessage({ id: "login.apiKey.continue" })}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full text-ui-base"
          size="lg"
          data-testid={TID_LOGIN_API_KEY_CANCEL_BUTTON}
          disabled={busy}
          onClick={onCancel}
        >
          {intl.formatMessage({ id: "login.apiKey.cancel" })}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-7 w-full text-ui-base text-foreground-subtle hover:text-foreground"
          data-testid={TID_LOGIN_API_KEY_SKIP_BUTTON}
          disabled={busy}
          onClick={() => void skipApiKeyProvider()}
        >
          {skipping ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {intl.formatMessage({ id: "login.skip" })}
        </Button>
      </div>
    </div>
  );
}
