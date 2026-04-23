// Load shared config
importScripts('config.js');

const CONFIG = globalThis.ImgPromptConfig || {};
const DEFAULT_SETTINGS = CONFIG.DEFAULT_SETTINGS;
const UI_STRINGS = CONFIG.UI_STRINGS;
const POSTHOG_PROJECT_KEY = CONFIG.POSTHOG_PROJECT_KEY;
const POSTHOG_HOST = CONFIG.POSTHOG_HOST;
const ERROR_CODES = CONFIG.ERROR_CODES;
const ERROR_MESSAGES = CONFIG.ERROR_MESSAGES;
const ANALYTICS_CONFIG_KEY = CONFIG.ANALYTICS_CONFIG_KEY;

const MENU_ID = "image-prompt-inspector.generate";
const CLIENT_ID_KEY = "clientId";
const MAX_HISTORY_ITEMS = 50;

// IndexedDB configuration
const DB_NAME = 'ImgPromptDB';
const DB_VERSION = 1;
const HISTORY_STORE = 'history';
let dbInstance = null;
const activeRequests = new Map();

// Initialize IndexedDB when service worker starts
initIndexedDB().catch(error => {
  console.error('[ImgPrompt] Failed to initialize IndexedDB on startup:', error);
});

chrome.runtime.onInstalled.addListener(async (details) => {
  const clientId = await ensureClientId();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "ImgPrompt",
    contexts: ["image"]
  });

  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  }

  const current = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const nextValues = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[key] === undefined) {
      nextValues[key] = value;
    }
  }
  if (Object.keys(nextValues).length) {
    await chrome.storage.local.set(nextValues);
  }

  // Initialize IndexedDB for history
  try {
    await initIndexedDB();
  } catch (error) {
    console.error('[ImgPrompt] Failed to initialize IndexedDB:', error);
  }

  const installReason = details?.reason || "unknown";
  if (installReason === "install") {
    void safeTrackAnalyticsEvent("extension_installed", {
      clientId,
      installReason
    });
  } else if (installReason === "update") {
    void safeTrackAnalyticsEvent("extension_updated", {
      clientId,
      installReason,
      previousVersion: details?.previousVersion || ""
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  const requestId = crypto.randomUUID();
  await sendTabMessage(tab.id, {
    type: "prompt:start-analysis",
    requestId,
    srcUrl: info.srcUrl || "",
    pageUrl: info.pageUrl || "",
    trigger: "context_menu"
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture_screenshot") return;

  const settings = await loadSettings();
  if (settings.snippingShortcutEnabled === false) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await sendTabMessage(tab.id, {
      type: "prompt:start-snipping",
      dataUrl
    });
  } catch (err) {
    console.error("Failed to capture screenshot:", err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "analytics:track") {
    safeTrackAnalyticsEvent(message.event, {
      ...(message.properties || {}),
      ...buildAnalyticsContext(message.properties?.pageUrl || sender.tab?.url || "")
    })
      .then((sent) => sendResponse({ ok: true, sent }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return true;
  }

  if (message?.type === "prompt:open-options") {
    openSidePanelForSender(sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return true;
  }

  if (message?.type === "prompt:cancel-generation") {
    const controller = activeRequests.get(message.requestId);
    if (controller) {
      controller.abort();
      activeRequests.delete(message.requestId);
      sendResponse({ ok: true, canceled: true });
      return false;
    }
    sendResponse({ ok: true, canceled: false });
    return false;
  }

  if (message?.type === "settings:updated") {
    // Relay settings update to all active tabs to ensure immediate UI updates
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: "settings:updated" }).catch(() => {
            // Ignore errors for tabs where content script is not injected or responsive
          });
        }
      });
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "history:get") {
    getHistory()
      .then((history) => sendResponse({ ok: true, history }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "history:delete") {
    deleteHistoryItem(message.id)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "history:clear") {
    clearHistory()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "api:test-connection") {
    testApiConnection(message.settings)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message?.type !== "prompt:begin-generation") {
    return false;
  }

  processGeneration(message, sender)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  return true;
});

async function openSidePanelForSender(sender) {
  if (!chrome.sidePanel?.open) {
    throw new Error("当前浏览器不支持侧边栏 API。");
  }

  if (sender.tab?.windowId) {
    await chrome.sidePanel.open({
      windowId: sender.tab.windowId
    });
    return;
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!activeTab?.windowId) {
    throw new Error("未找到可用窗口来打开侧边栏。");
  }

  await chrome.sidePanel.open({
    windowId: activeTab.windowId
  });
}

async function processGeneration(message, sender) {
  const tabId = sender.tab?.id;
  if (!tabId) {
    throw new Error("Missing tab id.");
  }

  const { requestId, srcUrl, imageDataUrl, pageContext = {}, trigger = "unknown" } = message;
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  const startedAt = Date.now();
  const settings = await loadSettings();
  const lang = settings.uiLanguage || "zh";
  const dict = UI_STRINGS[lang] || UI_STRINGS.zh;

  try {
    await sendProgress(tabId, requestId, 8, dict.preparing, "config");
    void safeTrackAnalyticsEvent("generation_started", {
      requestId,
      trigger,
      model: settings.model,
      ...buildAnalyticsContext(pageContext.pageUrl || sender.tab?.url || "")
    });
    validateSettings(settings, lang);

    await sendProgress(tabId, requestId, 22, dict.fetchingImage, "image");
    
    // Always fetch and compress in background (unified logic)
    const imageInput = await fetchAndCompressImage(imageDataUrl || srcUrl, settings.maxImageEdge || 1024, controller.signal);
    
    if (!imageInput) {
      throw new Error(dict.base64Failed);
    }

    await sendProgress(tabId, requestId, 48, dict.callingModel, "request");
    const rawResult = await requestPromptFromModel({
      settings,
      imageInput,
      pageContext,
      signal: controller.signal
    });

    await sendProgress(tabId, requestId, 88, dict.organizingPrompts, "parse");
    const prompts = normalizePromptResult(rawResult, lang);

    await sendTabMessage(tabId, {
      type: "prompt:result",
      requestId,
      progress: 100,
      prompts,
      source: {
        srcUrl
      }
    });
    void safeTrackAnalyticsEvent("generation_succeeded", {
      requestId,
      trigger,
      model: settings.model,
      durationMs: Date.now() - startedAt,
      ...buildAnalyticsContext(pageContext.pageUrl || sender.tab?.url || "")
    });
    void saveToHistory({
      prompts,
      srcUrl,
      imageDataUrl: imageInput,
      pageUrl: pageContext.pageUrl || sender.tab?.url || "",
      model: settings.model,
      trigger
    }).then(() => {
      // Notify options page to refresh history
      chrome.runtime.sendMessage({ type: "history:updated" }).catch(() => {});
    });
  } catch (error) {
    if (controller.signal.aborted) {
      await sendTabMessage(tabId, {
        type: "prompt:canceled",
        requestId,
        errorCode: ERROR_CODES.CANCELED
      });
      void safeTrackAnalyticsEvent("generation_canceled", {
        requestId,
        trigger,
        durationMs: Date.now() - startedAt,
        ...buildAnalyticsContext(pageContext.pageUrl || sender.tab?.url || "")
      });
      return;
    }
    
    // Classify error
    const errorCode = classifyError(error);
    const userMessage = getUserErrorMessage(errorCode, lang);
    
    await sendTabMessage(tabId, {
      type: "prompt:error",
      requestId,
      errorCode,
      message: userMessage
    });
    
    void safeTrackAnalyticsEvent("generation_failed", {
      requestId,
      trigger,
      model: (await loadSettings()).model,
      durationMs: Date.now() - startedAt,
      errorCode,
      errorMessage: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      ...buildAnalyticsContext(pageContext.pageUrl || sender.tab?.url || "")
    });
    throw error;
  } finally {
    activeRequests.delete(requestId);
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return {
    ...DEFAULT_SETTINGS,
    ...stored
  };
}

async function ensureClientId() {
  const stored = await chrome.storage.local.get(CLIENT_ID_KEY);
  if (stored[CLIENT_ID_KEY]) {
    return stored[CLIENT_ID_KEY];
  }

  const clientId = crypto.randomUUID();
  await chrome.storage.local.set({
    [CLIENT_ID_KEY]: clientId
  });
  return clientId;
}

function buildAnalyticsContext(rawUrl) {
  if (!rawUrl) {
    return {};
  }

  try {
    const url = new URL(rawUrl);
    return {
      pageHost: url.host,
      pageProtocol: url.protocol.replace(":", "")
    };
  } catch (error) {
    return {};
  }
}

async function trackAnalyticsEvent(eventName, properties = {}) {
  if (!eventName) {
    return false;
  }

  // Check if analytics is enabled
  const analyticsConfig = await chrome.storage.local.get(ANALYTICS_CONFIG_KEY);
  const analyticsEnabled = analyticsConfig[ANALYTICS_CONFIG_KEY] !== false;
  if (!analyticsEnabled) {
    return false;
  }

  if (!POSTHOG_PROJECT_KEY || !POSTHOG_HOST) {
    return false;
  }

  const clientId = properties.clientId || (await ensureClientId());
  const captureUrl = `${String(POSTHOG_HOST).replace(/\/+$/, "")}/capture/`;
  const response = await fetch(captureUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: POSTHOG_PROJECT_KEY,
      event: eventName,
      distinct_id: clientId,
      timestamp: new Date().toISOString(),
      properties: {
        ...properties,
        distinct_id: clientId,
        $lib: "imgprompt-extension",
        $lib_version: chrome.runtime.getManifest().version,
        extensionVersion: chrome.runtime.getManifest().version
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Analytics request failed (${response.status})`);
  }

  return true;
}

async function safeTrackAnalyticsEvent(eventName, properties = {}) {
  try {
    return await trackAnalyticsEvent(eventName, properties);
  } catch (error) {
    return false;
  }
}

async function saveToHistory(record) {
  try {
    console.log('[ImgPrompt] Saving to history:', { prompts: record.prompts?.zh?.substring(0, 50) });
    const db = await getDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    
    const item = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...record
    };
    
    await new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => {
        console.log('[ImgPrompt] History item saved successfully');
        resolve();
      };
      request.onerror = (event) => {
        console.error('[ImgPrompt] Failed to save history item:', event.target.error);
        reject(event.target.error);
      };
    });
    
    // Check if we exceed max items and delete oldest if needed
    const count = await new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
    
    if (count > MAX_HISTORY_ITEMS) {
      const index = store.index('timestamp');
      const oldestRequest = index.openCursor();
      oldestRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
        }
      };
    }
    
    return true;
  } catch (error) {
    console.error('[ImgPrompt] Failed to save history:', error);
    return false;
  }
}

async function getHistory() {
  try {
    const db = await getDB();
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev');
      const results = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < MAX_HISTORY_ITEMS) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          console.log('[ImgPrompt] Retrieved history items:', results.length);
          resolve(results);
        }
      };
      request.onerror = (event) => {
        console.error('[ImgPrompt] Failed to retrieve history:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('[ImgPrompt] Failed to get history:', error);
    return [];
  }
}

async function deleteHistoryItem(id) {
  try {
    const db = await getDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = resolve;
      request.onerror = reject;
    });
    
    return true;
  } catch (error) {
    console.error('[ImgPrompt] Failed to delete history item:', error);
    return false;
  }
}

async function clearHistory() {
  try {
    const db = await getDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = resolve;
      request.onerror = reject;
    });
    
    return true;
  } catch (error) {
    console.error('[ImgPrompt] Failed to clear history:', error);
    return false;
  }
}

// IndexedDB helper functions
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

function getDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  return initIndexedDB();
}

function validateSettings(settings, lang = "zh") {
  const isEn = lang === "en";
  if (!settings.apiEndpoint) {
    throw new Error(isEn ? "Please fill in the API Endpoint in the settings panel." : "请先在插件设置页填写 API Endpoint。");
  }
  if (!settings.apiKey) {
    throw new Error(isEn ? "Please fill in the API Key in the settings panel." : "请先在插件设置页填写 API Key。");
  }
  if (!settings.model) {
    throw new Error(isEn ? "Please fill in the Model name in the settings panel." : "请先在插件设置页填写模型名称。");
  }
}

async function requestPromptFromModel({ settings, imageInput, pageContext, signal }) {
  const pageHints = [
    pageContext.altText ? `Image alt: ${pageContext.altText}` : "",
    pageContext.title ? `Page title: ${pageContext.title}` : "",
    pageContext.pageUrl ? `Page URL: ${pageContext.pageUrl}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const requestFormat = resolveRequestFormat(settings);
  if (requestFormat === "anthropic") {
    return await requestViaAnthropic({
      settings,
      imageInput,
      pageHints,
      signal
    });
  }

  return await requestViaOpenAICompatible({
    settings,
    imageInput,
    pageHints,
    signal
  });
}

function resolveRequestFormat(settings) {
  if (settings.requestFormat && settings.requestFormat !== "auto") {
    return settings.requestFormat;
  }

  if (String(settings.model || "").toLowerCase().startsWith("claude")) {
    return "anthropic";
  }

  return "openai";
}

function buildSystemPrompt(settings = {}) {
  const baseSystemPrompt = ImgPromptConfig.DEFAULT_SETTINGS.systemPrompt;
  const recreateModeSystemOverlay = ImgPromptConfig.RECREATE_MODE_SYSTEM_OVERLAY;
  const parts = [baseSystemPrompt];

  if (settings.recreateMode && recreateModeSystemOverlay) {
    parts.push(recreateModeSystemOverlay);
  }

  return parts.filter(Boolean).join("\n\n");
}

// Build user prompt with smart stacking logic
function buildUserPrompt(userPrompt, pageHints, settings = {}) {
  const basePrompt = ImgPromptConfig.BASE_USER_PROMPT;
  const genericUserConstraints = ImgPromptConfig.GENERIC_USER_CONSTRAINTS;
  const recreateModeUserOverlay = ImgPromptConfig.RECREATE_MODE_USER_OVERLAY;
  const englishPromptRequirement = ImgPromptConfig.ENGLISH_PROMPT_REQUIREMENT;
  const presets = ImgPromptConfig.USER_PROMPT_PRESETS;
  
  // Check if userPrompt matches a preset (not general)
  let scenePrompt = "";
  if (userPrompt && presets) {
    for (const [key, presetText] of Object.entries(presets)) {
      if (key !== "general" && userPrompt === basePrompt + presetText) {
        // User selected a specific scene preset
        scenePrompt = presetText;
        break;
      }
    }
  }
  
  // Build final prompt: base + scene focus (if any) + page hints
  const parts = [basePrompt];
  if (scenePrompt) {
    parts.push(scenePrompt);
  }
  if (pageHints) {
    parts.push(pageHints);
  }
  if (genericUserConstraints) {
    parts.push(genericUserConstraints);
  }
  if (settings.recreateMode && recreateModeUserOverlay) {
    parts.push(recreateModeUserOverlay);
  }
  if (englishPromptRequirement) {
    parts.push(englishPromptRequirement);
  }
  
  return parts.filter(Boolean).join("\n\n");
}

async function requestViaOpenAICompatible({ settings, imageInput, pageHints, signal }) {
  const modelName = String(settings.model || "").toLowerCase();
  if (modelName.startsWith("deepseek")) {
    const isEn = (settings.uiLanguage || "zh") === "en";
    throw new Error(isEn 
      ? "DeepSeek currently doesn't support the image format used by this extension. Please use gpt-*, gemini-*, or claude-* models instead."
      : "当前 DeepSeek 接口不支持这个插件使用的图片输入格式，无法用于图片提示词生成。请改用 gpt-*、gemini-* 或 claude-* 模型。");
  }

  const requestBody = {
    model: settings.model,
    temperature: Number(settings.temperature) || 1,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(settings)
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildUserPrompt(settings.userPrompt, pageHints, settings)
          },
          {
            type: "image_url",
            image_url: {
              url: imageInput
            }
          }
        ]
      }
    ]
  };

  const response = await fetch(settings.apiEndpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const isEn = (settings.uiLanguage || "zh") === "en";
    const status = response.status;
    
    // Provide more specific error messages based on status code
    let statusMsg;
    if (status === 401) {
      statusMsg = isEn ? "Authentication failed (invalid API key)" : "认证失败（API 密钥无效）";
    } else if (status === 403) {
      statusMsg = isEn ? "Access forbidden (check API permissions)" : "访问被拒绝（检查 API 权限）";
    } else if (status === 429) {
      statusMsg = isEn ? "Rate limit exceeded" : "调用次数超限";
    } else if (status === 408 || status >= 500) {
      statusMsg = isEn ? "Server error" : "服务器错误";
    } else {
      statusMsg = isEn ? "Request failed" : "请求失败";
    }
    
    throw new Error(`${statusMsg} (${status}): ${errorText.slice(0, 240)}`);
  }

  const payload = await response.json();
  const content = extractOpenAICompatibleContent(payload);
  if (!content) {
    const isEn = (settings.uiLanguage || "zh") === "en";
    throw new Error(isEn ? "Model returned empty content." : "模型返回内容为空，无法生成提示词。");
  }

  return content;
}

async function requestViaAnthropic({ settings, imageInput, pageHints, signal }) {
  const endpoint = normalizeAnthropicEndpoint(settings.apiEndpoint);
  const imageSource = toAnthropicImageSource(imageInput);
  if (!imageSource) {
    const isEn = (settings.uiLanguage || "zh") === "en";
    throw new Error(isEn 
      ? "Claude mode requires base64 image data. This image could not be safely read. Please try another image or use an OpenAI compatible model."
      : "Claude 模式要求可直接上传的 base64 图片数据。当前图片无法安全读取，请换一张图或改用 OpenAI 兼容模型。");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": settings.anthropicVersion || "2023-06-01"
    },
    body: JSON.stringify({
      model: settings.model,
      system: buildSystemPrompt(settings),
      max_tokens: settings.recreateMode ? 2600 : 1400,
      temperature: Number(settings.temperature) || 1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildUserPrompt(settings.userPrompt, pageHints, settings)
            },
            {
              type: "image",
              source: imageSource
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const isEn = (settings.uiLanguage || "zh") === "en";
    const status = response.status;
    
    let statusMsg;
    if (status === 401) {
      statusMsg = isEn ? "Authentication failed (invalid API key)" : "认证失败（API 密钥无效）";
    } else if (status === 403) {
      statusMsg = isEn ? "Access forbidden" : "访问被拒绝";
    } else if (status === 429) {
      statusMsg = isEn ? "Rate limit exceeded" : "调用次数超限";
    } else if (status >= 500) {
      statusMsg = isEn ? "Server error" : "服务器错误";
    } else {
      statusMsg = isEn ? "Request failed" : "请求失败";
    }
    
    throw new Error(`${statusMsg} (${status}): ${errorText.slice(0, 280)}`);
  }

  const payload = await response.json();
  const textBlock = Array.isArray(payload?.content)
    ? payload.content.find((item) => item?.type === "text")
    : null;
  const content = textBlock?.text || "";
  if (!content) {
    throw new Error("模型返回内容为空，无法生成提示词。");
  }

  return content;
}

function normalizeAnthropicEndpoint(apiEndpoint) {
  if (apiEndpoint.endsWith("/v1/messages")) {
    return apiEndpoint;
  }
  if (apiEndpoint.endsWith("/v1/chat/completions")) {
    return apiEndpoint.replace(/\/v1\/chat\/completions$/, "/v1/messages");
  }
  return apiEndpoint;
}

function toAnthropicImageSource(imageInput) {
  if (typeof imageInput !== "string" || !imageInput.startsWith("data:")) {
    return null;
  }

  const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    type: "base64",
    media_type: match[1],
    data: match[2]
  };
}

function normalizePromptResult(rawResult, lang = "zh") {
  const dict = UI_STRINGS[lang] || UI_STRINGS.zh;
  let parsed = rawResult;
  if (typeof rawResult === "string") {
    try {
      parsed = JSON.parse(rawResult);
    } catch (error) {
      const cleaned = sanitizeJsonLikeText(rawResult);
      if (!cleaned) {
        throw new Error(dict.noJson);
      }

      try {
        parsed = JSON.parse(cleaned);
      } catch (innerError) {
        throw new Error(dict.noJson);
      }
    }
  }

  // Require at least one structured field to be present
  const hasStructuredContent = parsed?.image_type || parsed?.background || parsed?.subject ||
    parsed?.style || parsed?.lighting || parsed?.color_palette || parsed?.zh || parsed?.en;

  if (!hasStructuredContent) {
    throw new Error(dict.missingFields);
  }

  // Build result - pass through ALL fields from AI response
  const result = {};

  // Copy structured visual analysis fields directly
  if (parsed?.image_type) result.image_type = parsed.image_type;
  if (parsed?.aspect_ratio) result.aspect_ratio = parsed.aspect_ratio;
  if (parsed?.background) result.background = parsed.background;
  if (parsed?.subject) result.subject = parsed.subject;
  if (parsed?.surrounding_elements) result.surrounding_elements = parsed.surrounding_elements;
  if (parsed?.composition) result.composition = parsed.composition;
  if (parsed?.text_content) result.text_content = parsed.text_content;
  if (parsed?.style) result.style = parsed.style;
  if (parsed?.lighting) result.lighting = parsed.lighting;
  if (parsed?.color_palette) result.color_palette = parsed.color_palette;
  if (parsed?.negative) result.negative = parsed.negative;
  if (parsed?.parameters) result.parameters = parsed.parameters;

  // For backward compatibility: if AI still returns zh/en, preserve them
  // but DO NOT generate them from structured fields (avoid redundancy)
  if (parsed?.zh) result.zh = String(parsed.zh).trim();
  if (parsed?.en) result.en = String(parsed.en).trim();

  return result;
}

function extractOpenAICompatibleContent(payload) {
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    const textParts = messageContent
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item?.type === "text") {
          return item.text || "";
        }
        return "";
      })
      .filter(Boolean);

    if (textParts.length) {
      return textParts.join("\n");
    }
  }

  return "";
}

function sanitizeJsonLikeText(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return "";
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return "";
}

async function fetchAndCompressImage(srcUrl, maxEdge = 1024, signal) {
  if (!srcUrl) {
    return "";
  }
  
  // If already a data URL, compress it
  if (srcUrl.startsWith("data:")) {
    return await compressImageDataUrl(srcUrl, maxEdge);
  }

  // Fetch the image
  const response = await fetch(srcUrl, {
    method: "GET",
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.startsWith("image/")) {
    console.warn("[ImgPrompt] Fetched source is not an image:", contentType);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("Fetched image blob is empty.");
  }
  
  return await compressImageBlob(blob, maxEdge);
}

async function compressImageDataUrl(dataUrl, maxEdge = 1024) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return await compressImageBlob(blob, maxEdge);
}

async function compressImageBlob(blob, maxEdge = 1024) {
  const imgBitmap = await createImageBitmap(blob);
  const { width: sw, height: sh } = imgBitmap;
  
  let tw = sw;
  let th = sh;
  if (Math.max(sw, sh) > maxEdge) {
    const scale = maxEdge / Math.max(sw, sh);
    tw = Math.round(sw * scale);
    th = Math.round(sh * scale);
  }

  const canvas = new OffscreenCanvas(tw, th);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get OffscreenCanvas context");
  
  ctx.drawImage(imgBitmap, 0, 0, tw, th);
  imgBitmap.close();

  const jpegBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.92
  });
  
  return await blobToDataUrl(jpegBlob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read blob."));
    reader.readAsDataURL(blob);
  });
}

async function sendProgress(tabId, requestId, progress, text, stage) {
  await sendTabMessage(tabId, {
    type: "prompt:progress",
    requestId,
    progress,
    text,
    stage
  });
}

async function sendTabMessage(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (!messageText.includes("Receiving end does not exist")) {
      throw error;
    }
  }
}

// Error classification
function classifyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  
  // Network errors
  if (lowerMessage.includes('failed to fetch') || 
      lowerMessage.includes('networkerror') ||
      lowerMessage.includes('network error')) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  
  // Image fetch errors
  if (lowerMessage.includes('fetch') && (lowerMessage.includes('image') || lowerMessage.includes('404'))) {
    return ERROR_CODES.IMAGE_FETCH_FAILED;
  }
  
  // Image processing
  if (lowerMessage.includes('base64') || 
      lowerMessage.includes('image processing') ||
      lowerMessage.includes('bitmap')) {
    return ERROR_CODES.IMAGE_PROCESSING_FAILED;
  }
  
  // API auth errors (401, 403)
  if (message.includes('(401)') || message.includes('(403)') ||
      lowerMessage.includes('authentication') || 
      lowerMessage.includes('api key') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden')) {
    return ERROR_CODES.API_AUTH_FAILED;
  }
  
  // Rate limiting (429)
  if (message.includes('(429)') || 
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests')) {
    return ERROR_CODES.API_RATE_LIMITED;
  }
  
  // Timeout
  if (lowerMessage.includes('timeout') || 
      lowerMessage.includes('timed out') ||
      message.includes('(408)')) {
    return ERROR_CODES.API_TIMEOUT;
  }
  
  // JSON parse errors
  if (lowerMessage.includes('json') || 
      lowerMessage.includes('parse') ||
      lowerMessage.includes('invalid json')) {
    return ERROR_CODES.JSON_PARSE_FAILED;
  }
  
  // Missing fields
  if (lowerMessage.includes('zh/en') || 
      lowerMessage.includes('missing') ||
      lowerMessage.includes('field')) {
    return ERROR_CODES.MISSING_FIELDS;
  }
  
  // API errors (4xx, 5xx)
  if (/\(\d{3}\)/.test(message)) {
    return ERROR_CODES.API_INVALID_RESPONSE;
  }
  
  return ERROR_CODES.UNKNOWN;
}

function getUserErrorMessage(errorCode, lang = 'zh') {
  const messages = ERROR_MESSAGES[lang] || ERROR_MESSAGES.zh;
  return messages[errorCode] || messages[ERROR_CODES.UNKNOWN];
}

async function testApiConnection(settings) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const format = resolveRequestFormat(settings);
    const requestBody = {
      model: settings.model,
      max_tokens: 100,
      messages: [{ role: "user", content: "Hi" }]
    };
    
    const response = await fetch(settings.apiEndpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(format === "anthropic" 
          ? { "x-api-key": settings.apiKey, "anthropic-version": settings.anthropicVersion || "2023-06-01" }
          : { Authorization: `Bearer ${settings.apiKey}` })
      },
      body: JSON.stringify(requestBody)
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { success: true, message: "连接成功!" };
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: "请求超时(10秒)" };
    }
    return { success: false, error: error.message };
  }
}
