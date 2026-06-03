// Copyright (c) 2026 MeeJoy

const PROVIDER_DEFINITIONS = [
  { id: "nous", envPrefix: "NOUS", label: "Nous Portal", docsUrl: "https://portal.nousresearch.com/" },
  { id: "openai", envPrefix: "OPENAI", label: "OpenAI", docsUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", envPrefix: "ANTHROPIC", label: "Anthropic", docsUrl: "https://console.anthropic.com/" },
  { id: "dashscope", envPrefix: "DASHSCOPE", label: "DashScope (Qwen)", docsUrl: "https://modelstudio.console.alibabacloud.com/" },
  { id: "hermes-qwen", envPrefix: "HERMES_QWEN", label: "DashScope (Qwen)", docsUrl: "https://modelstudio.console.alibabacloud.com/" },
  { id: "deepseek", envPrefix: "DEEPSEEK", label: "DeepSeek", docsUrl: "https://platform.deepseek.com/api_keys" },
  { id: "google", envPrefix: "GOOGLE", label: "Gemini", docsUrl: "https://aistudio.google.com/app/apikey" },
  { id: "gemini", envPrefix: "GEMINI", label: "Gemini", docsUrl: "https://aistudio.google.com/app/apikey" },
  { id: "glm", envPrefix: "GLM", label: "GLM / Z.AI", docsUrl: "https://open.bigmodel.cn/" },
  { id: "zai", envPrefix: "ZAI", label: "GLM / Z.AI", docsUrl: "https://open.bigmodel.cn/" },
  { id: "z-ai", envPrefix: "Z_AI", label: "GLM / Z.AI", docsUrl: "https://open.bigmodel.cn/" },
  { id: "hf", envPrefix: "HF", label: "Hugging Face", docsUrl: "https://huggingface.co/settings/tokens" },
  { id: "kimi", envPrefix: "KIMI", label: "Kimi / Moonshot", docsUrl: "https://platform.moonshot.cn/console/api-keys" },
  { id: "minimax-cn", envPrefix: "MINIMAX_CN", label: "MiniMax (China)", docsUrl: "https://platform.minimaxi.com/" },
  { id: "minimax", envPrefix: "MINIMAX", label: "MiniMax", docsUrl: "https://www.minimax.io/platform/user-center/basic-information/interface-key" },
  { id: "openrouter", envPrefix: "OPENROUTER", label: "OpenRouter", docsUrl: "https://openrouter.ai/keys" },
  { id: "xiaomi", envPrefix: "XIAOMI", label: "Xiaomi MiMo", docsUrl: null },
  { id: "xai", envPrefix: "XAI", label: "xAI", docsUrl: "https://console.x.ai/" },
  { id: "stepfun", envPrefix: "STEPFUN", label: "StepFun", docsUrl: "https://stepfun.com/api" },
]

export const LOCAL_MODEL_PRESETS = [
  {
    id: "ollama",
    label: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
  },
  {
    id: "lm-studio",
    label: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
  },
  {
    id: "vllm",
    label: "vLLM / SGLang",
    baseUrl: "http://127.0.0.1:8000/v1",
  },
]

const CUSTOM_ENDPOINT_DOCS_URL =
  "https://hermes-agent.nousresearch.com/docs/integrations/providers/custom-endpoints"
const LOCAL_MODELS_DOCS_URL = "https://hermes-agent.nousresearch.com/docs/faq/general"
const IMAGE_ONLY_MODEL_IDS = new Set(["chatgpt-image-latest"])
const IMAGE_ONLY_MODEL_PREFIXES = ["gpt-image-", "dall-e-"]

function normalizeEnvValue(info) {
  return info?.value ?? info?.redacted_value ?? ""
}

function normalizeString(value) {
  if (typeof value === "string") return value.trim()
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function normalizeProviderLookupKey(value) {
  return normalizeString(value).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

export function isImageOnlyPrimaryModel(value) {
  const model = normalizeString(value).toLowerCase()
  if (!model) return false
  if (IMAGE_ONLY_MODEL_IDS.has(model)) return true
  return IMAGE_ONLY_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix))
}

export function getPrimaryModelValidationError(config) {
  const model = normalizeString(typeof config === "string" ? config : config?.model)
  if (!model || !isImageOnlyPrimaryModel(model)) return ""

  return `主对话模型不能使用 ${model}。如果你要调用 OpenAI 图片接口，请改用 gpt-image-1.5、gpt-image-1 或 gpt-image-1-mini；如果你要在 Responses API 里对话式出图，请把主模型改成 gpt-5 或 gpt-4.1，并调用 image_generation 工具。`
}

export function getPrimaryModelConfig(config) {
  const safeConfig = config || {}
  const nestedModel =
    safeConfig.model && typeof safeConfig.model === "object" && !Array.isArray(safeConfig.model)
      ? safeConfig.model
      : null

  const model =
    typeof safeConfig.model === "string"
      ? safeConfig.model
      : nestedModel?.default

  const contextLengthValue = safeConfig.model_context_length ?? nestedModel?.context_length

  return {
    model: normalizeString(model),
    provider: normalizeString(safeConfig.provider ?? nestedModel?.provider),
    baseUrl: normalizeString(safeConfig.baseUrl ?? safeConfig.base_url ?? nestedModel?.base_url),
    apiKey: normalizeString(safeConfig.apiKey ?? safeConfig.api_key ?? nestedModel?.api_key),
    apiMode: normalizeString(safeConfig.apiMode ?? safeConfig.api_mode ?? nestedModel?.api_mode),
    contextLength:
      (safeConfig.contextLength ?? contextLengthValue) === null ||
      (safeConfig.contextLength ?? contextLengthValue) === undefined
        ? ""
        : normalizeString(safeConfig.contextLength ?? contextLengthValue),
  }
}

function isLikelyLocalBaseUrl(baseUrl) {
  if (!baseUrl) return false

  try {
    const { hostname } = new URL(baseUrl)
    const normalizedHost = hostname.toLowerCase()
    return (
      normalizedHost === "localhost" ||
      normalizedHost === "127.0.0.1" ||
      normalizedHost === "0.0.0.0" ||
      normalizedHost === "::1" ||
      normalizedHost === "host.docker.internal" ||
      normalizedHost.startsWith("10.") ||
      normalizedHost.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHost)
    )
  } catch {
    return false
  }
}

function resolveLocalPreset(baseUrl) {
  const normalizedBaseUrl = normalizeString(baseUrl).replace(/\/+$/, "")
  if (!normalizedBaseUrl) return null

  const matchedPreset = LOCAL_MODEL_PRESETS.find(
    (preset) => preset.baseUrl.replace(/\/+$/, "") === normalizedBaseUrl
  )

  return matchedPreset?.id ?? null
}

function buildSpecialEntries(config) {
  const primary = getPrimaryModelConfig(config)
  const usesCustomEndpoint = primary.provider === "custom" && Boolean(primary.baseUrl)
  const usesLocalEndpoint = usesCustomEndpoint && isLikelyLocalBaseUrl(primary.baseUrl)
  const activeSpecialMode = usesLocalEndpoint ? "local" : usesCustomEndpoint ? "custom" : null

  const buildSpecialEntryValues = (mode) => {
    const ownsCurrentConfig = activeSpecialMode === mode

    return {
      ownsCurrentConfig,
      defaultModelValue: ownsCurrentConfig ? primary.model : "",
      baseUrlValue: ownsCurrentConfig ? primary.baseUrl : "",
      apiKeyValue: ownsCurrentConfig ? primary.apiKey : "",
      contextLengthValue: ownsCurrentConfig ? primary.contextLength : "",
      providerValue: ownsCurrentConfig ? primary.provider : "",
      presetId: ownsCurrentConfig && mode === "local" ? resolveLocalPreset(primary.baseUrl) : null,
    }
  }

  return [
    {
      id: "custom-endpoint",
      type: "custom",
      label: "Custom Endpoint",
      docsUrl: CUSTOM_ENDPOINT_DOCS_URL,
      configured: usesCustomEndpoint && !usesLocalEndpoint,
      ...buildSpecialEntryValues("custom"),
    },
    {
      id: "local-model",
      type: "local",
      label: "Local Models",
      docsUrl: LOCAL_MODELS_DOCS_URL,
      configured: usesLocalEndpoint,
      ...buildSpecialEntryValues("local"),
    },
  ]
}

function buildProviderConfig(definition, envVars) {
  const entries = Object.entries(envVars).filter(([key, info]) => {
    return key.startsWith(definition.envPrefix + "_") && info?.category === "provider"
  })

  const byKey = Object.fromEntries(entries)
  const apiKeyKey = entries.find(([key, info]) => info?.is_password || key.endsWith("_API_KEY"))?.[0] ?? null
  const baseUrlKey = entries.find(([key]) => key.endsWith("_BASE_URL"))?.[0] ?? null
  const defaultModelKey = entries.find(([key]) => key.endsWith("_DEFAULT_MODEL"))?.[0] ?? null
  const parameterKeys = entries
    .map(([key]) => key)
    .filter((key) => /(_TEMPERATURE|_MAX_TOKENS|_TOP_P|_REASONING)/.test(key))

  const configured = apiKeyKey ? Boolean(byKey[apiKeyKey]?.is_set) : false
  const defaultModelValue = defaultModelKey ? normalizeEnvValue(byKey[defaultModelKey]) : ""
  const advancedKeys = entries
    .map(([key, info]) => ({ key, info }))
    .filter(({ key, info }) => info?.advanced || parameterKeys.includes(key))
    .map(({ key }) => key)

  return {
    id: definition.id,
    type: "provider",
    label: definition.label,
    docsUrl: definition.docsUrl,
    envPrefix: definition.envPrefix,
    configured,
    apiKeyKey,
    baseUrlKey,
    defaultModelKey,
    parameterKeys,
    advancedKeys,
    defaultModelValue,
    entries: byKey,
  }
}

export function buildModelConfigState(envVars, dashboardConfig = null) {
  const safeEnvVars = envVars || {}
  const providers = PROVIDER_DEFINITIONS
    .map((definition) => buildProviderConfig(definition, safeEnvVars))
    .filter((provider) => Object.keys(provider.entries).length > 0 || provider.apiKeyKey)
  const primaryModel = getPrimaryModelConfig(dashboardConfig)
  const specialEntries = buildSpecialEntries(dashboardConfig)

  const configuredProviders = providers.filter((provider) => provider.configured).length
  const defaultProvider =
    providers.find((provider) => provider.defaultModelValue) ||
    providers.find((provider) => provider.configured) ||
    null

  return {
    providers,
    specialEntries,
    primaryModel,
    configuredProviders,
    totalProviders: providers.length,
    defaultProviderId: defaultProvider?.id ?? null,
    defaultModelLabel: primaryModel.model || defaultProvider?.defaultModelValue || "",
  }
}

export function buildSelectableModelOptions(envVars, dashboardConfig = null, sessionModels = []) {
  const state = buildModelConfigState(envVars, dashboardConfig)
  const options = []
  const seen = new Set()

  const pushOption = (value, source, label) => {
    const normalizedValue = normalizeString(value)
    if (!normalizedValue || seen.has(normalizedValue)) return
    seen.add(normalizedValue)
    options.push({
      value: normalizedValue,
      source,
      label: label || normalizedValue,
    })
  }

  state.providers.forEach((provider) => {
    pushOption(provider.defaultModelValue, "provider", `${provider.defaultModelValue} · ${provider.label}`)
  })

  state.specialEntries
    .filter((entry) => entry.ownsCurrentConfig)
    .forEach((entry) => {
      pushOption(
        entry.defaultModelValue,
        entry.type,
        `${entry.defaultModelValue} · ${entry.label}`
      )
    })

  pushOption(state.primaryModel.model, "default", state.primaryModel.model)
  sessionModels.forEach((model) => {
    pushOption(model, "session", model)
  })

  return options
}

export function getProviderModelSuggestions(provider, modelOptionsResponse) {
  const providerId = normalizeString(typeof provider === "string" ? provider : provider?.id)
  const providerLabel = normalizeString(typeof provider === "object" ? provider?.label : "")
  const targetKeys = new Set(
    [providerId, providerLabel].map(normalizeProviderLookupKey).filter(Boolean)
  )

  if (targetKeys.size === 0) return []

  const providers = Array.isArray(modelOptionsResponse?.providers)
    ? modelOptionsResponse.providers
    : []
  const suggestions = []
  const seen = new Set()

  providers.forEach((providerEntry) => {
    const entryKeys = [
      providerEntry?.id,
      providerEntry?.label,
      providerEntry?.name,
    ]
      .map(normalizeProviderLookupKey)
      .filter(Boolean)

    if (!entryKeys.some((key) => targetKeys.has(key))) return

    const models = Array.isArray(providerEntry?.models) ? providerEntry.models : []
    models.forEach((modelEntry) => {
      const id = normalizeString(modelEntry?.id ?? modelEntry?.model ?? modelEntry?.value)
      if (!id || seen.has(id)) return
      seen.add(id)
      suggestions.push({
        id,
        label: normalizeString(modelEntry?.label ?? modelEntry?.name) || id,
      })
    })
  })

  return suggestions
}

function envEntryHasValue(entry) {
  return Boolean(entry?.is_set || normalizeString(entry?.value) || normalizeString(entry?.redacted_value))
}

export function buildProviderSavePlan(provider, draft = {}) {
  const safeProvider = provider || {}
  const entries = safeProvider.entries || {}
  const apiKeyKey = normalizeString(safeProvider.apiKeyKey)
  const baseUrlKey = normalizeString(safeProvider.baseUrlKey)
  const defaultModelKey = normalizeString(safeProvider.defaultModelKey)
  const apiKeyEntry = apiKeyKey ? entries[apiKeyKey] : null
  const baseUrlEntry = baseUrlKey ? entries[baseUrlKey] : null
  const defaultModelEntry = defaultModelKey ? entries[defaultModelKey] : null

  const apiKey = normalizeString(draft.apiKey)
  const baseUrl = normalizeString(draft.baseUrl)
  const model = normalizeString(draft.model) || normalizeString(safeProvider.defaultModelValue)

  const maskedApiKey =
    apiKeyEntry?.is_password && !normalizeString(apiKeyEntry?.value)
      ? normalizeString(apiKeyEntry?.redacted_value)
      : ""
  const reusesStoredApiKey = Boolean(maskedApiKey) && apiKey === maskedApiKey
  const hasStoredApiKey = Boolean(apiKeyEntry?.is_set)

  const envUpdates = []
  if (apiKeyKey && apiKey && !reusesStoredApiKey) {
    envUpdates.push({ action: "set", key: apiKeyKey, value: apiKey })
  }
  if (baseUrlKey) {
    if (baseUrl) {
      envUpdates.push({ action: "set", key: baseUrlKey, value: baseUrl })
    } else if (envEntryHasValue(baseUrlEntry)) {
      envUpdates.push({ action: "delete", key: baseUrlKey })
    }
  }
  if (defaultModelKey) {
    if (model) {
      envUpdates.push({ action: "set", key: defaultModelKey, value: model })
    } else if (envEntryHasValue(defaultModelEntry)) {
      envUpdates.push({ action: "delete", key: defaultModelKey })
    }
  }

  return {
    canSave: Boolean(apiKey) || hasStoredApiKey,
    envUpdates,
    clearFields: ["baseUrl", "apiKey", "apiMode"],
    primaryConfig: {
      provider: normalizeString(safeProvider.id),
      model,
      baseUrl: "",
      apiKey: "",
      apiMode: "",
    },
  }
}
