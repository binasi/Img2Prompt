// config.js is loaded before this file, providing window.ImgPromptConfig
const DEFAULT_SETTINGS = window.ImgPromptConfig.DEFAULT_SETTINGS;
const SETTINGS_I18N = window.ImgPromptConfig.SETTINGS_I18N;
const TRANSLATIONS = SETTINGS_I18N;

const PRESETS = window.ImgPromptConfig.USER_PROMPT_PRESETS;

const form = document.getElementById("settings-form");
const statusEl = document.getElementById("status");
const resetButton = document.getElementById("reset-defaults");

const customModeView = document.getElementById("custom-mode-view");
const customTitleInput = document.getElementById("customTitle");
const customPromptArea = document.getElementById("userPrompt");
const customSaveBtn = document.getElementById("btn-custom-save");
const customCancelBtn = document.getElementById("btn-custom-cancel");
const customDeleteBtn = document.getElementById("btn-custom-delete");
const addCustomBtn = document.getElementById("btn-add-custom");

let isHydrating = true;
let customTemplates = {};
let currentEditingId = null;

init();

const presetChipsContainer = document.querySelector(".preset-chips");
presetChipsContainer.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const chip = e.target.closest(".preset-chip");
  if (!chip) return;
  
  if (isHydrating) return;
  const presetKey = chip.getAttribute("data-preset");

  if (presetKey === "+add") {
    enterCreateCustomMode();
    return;
  }

  // Smart stacking logic
  const basePrompt = ImgPromptConfig.BASE_USER_PROMPT;
  
  if (PRESETS && PRESETS[presetKey]) {
    if (presetKey === "general") {
      // General: only base prompt
      form.userPrompt.value = basePrompt;
    } else {
      // Scene preset: base + scene focus
      form.userPrompt.value = basePrompt + PRESETS[presetKey];
    }
    
    // Directly highlight the clicked preset button
    const allChips = document.querySelectorAll(".preset-chip");
    allChips.forEach(chip => chip.classList.remove("active"));
    chip.classList.add("active");
    
    // Hide custom mode view
    showBuiltinMode();
    
    handleAutoSave();
    return;
  }

  if (presetKey.startsWith("custom_")) {
    const customId = presetKey;
    if (customTemplates[customId]) {
      form.userPrompt.value = customTemplates[customId].prompt;
      
      // Directly highlight the clicked custom preset button
      const allChips = document.querySelectorAll(".preset-chip");
      allChips.forEach(chip => chip.classList.remove("active"));
      chip.classList.add("active");
      
      // Show custom edit mode
      showCustomEditMode(customId);
      
      handleAutoSave();
    }
  }
});

function showBuiltinMode() {
  customModeView.style.display = "none";
  currentEditingId = null;
}

function showCustomEditMode(id) {
  customModeView.style.display = "flex";
  customDeleteBtn.style.display = "block";
  const tpl = customTemplates[id];
  if (tpl) {
    customTitleInput.value = tpl.title || "";
    currentEditingId = id;
  }
}

function showCustomCreateMode() {
  customModeView.style.display = "flex";
  customDeleteBtn.style.display = "none";
}

function enterCreateCustomMode() {
  const allChips = document.querySelectorAll(".preset-chip");
  allChips.forEach(chip => chip.classList.remove("active"));
  
  currentEditingId = null;
  customTitleInput.value = "";
  // 默认使用通用预设的提示词
  form.userPrompt.value = PRESETS["general"] || "";
  showCustomCreateMode();
  
  // 同步更新标题输入框，让用户知道这是通用预设
  const lang = document.querySelector('input[name="uiLanguage"]:checked')?.value || 'zh';
  customTitleInput.placeholder = lang === 'zh' ? '基于通用预设的自定义提示词...' : 'Custom prompt based on General preset...';
}

function updateActiveChip(currentPrompt, isFromPresetClick = false) {
  const allChips = document.querySelectorAll(".preset-chip");
  allChips.forEach(chip => chip.classList.remove("active"));
  
  let found = false;
  if (PRESETS) {
    const match = Object.entries(PRESETS).find(([_, text]) => text === currentPrompt);
    if (match) {
      const chipToActivate = document.querySelector(`.preset-chip[data-preset="${match[0]}"]`);
      if (chipToActivate) chipToActivate.classList.add("active");
      showBuiltinMode();
      found = true;
      return;
    }
  }

  const customMatch = Object.entries(customTemplates).find(([_, tpl]) => tpl.prompt === currentPrompt);
  if (customMatch) {
    const chipToActivate = document.querySelector(`.preset-chip[data-preset="${customMatch[0]}"]`);
    if (chipToActivate) chipToActivate.classList.add("active");
    showCustomEditMode(customMatch[0]);
    found = true;
    return;
  }

  // Only enter create mode if explicitly requested (e.g., from +add button)
  // Don't auto-enter create mode when clicking presets
  if (!found && !isFromPresetClick) {
    showCustomCreateMode();
  } else if (!found && isFromPresetClick) {
    showBuiltinMode();
  }
}

customSaveBtn.addEventListener("click", async () => {
  const uiLang = form.uiLanguage ? form.uiLanguage.value : "zh";
  const title = customTitleInput.value.trim() || TRANSLATIONS[uiLang]["custom-title-label"] || "Template";
  const text = form.userPrompt.value.trim();
  
  if (!text) {
    setStatus("⚠️");
    return;
  }

  const id = currentEditingId || "custom_" + Date.now();
  customTemplates[id] = { title, prompt: text };
  
  await chrome.storage.local.set({ customTemplates });
  renderCustomChips();
  updateActiveChip(text);
  handleAutoSave();
  setStatus("✅ Saved");
});

customDeleteBtn.addEventListener("click", async () => {
  if (currentEditingId && customTemplates[currentEditingId]) {
    delete customTemplates[currentEditingId];
    await chrome.storage.local.set({ customTemplates });
    renderCustomChips();
    form.userPrompt.value = PRESETS["general"] || "";
    updateActiveChip(form.userPrompt.value);
    handleAutoSave();
    setStatus("🗑️ Deleted");
  }
});

customCancelBtn.addEventListener("click", async () => {
  // 隐藏自定义编辑视图
  customModeView.style.display = "none";
  
  // 恢复到通用预设
  form.userPrompt.value = PRESETS["general"] || "";
  updateActiveChip(form.userPrompt.value);
  
  // 重置编辑状态
  currentEditingId = null;
  customDeleteBtn.style.display = "none";
  
  // 保存恢复后的设置
  await handleAutoSave();
});

function renderCustomChips() {
  const currentCustomChips = document.querySelectorAll(".preset-chip[data-preset^='custom_']");
  currentCustomChips.forEach(chip => chip.remove());

  const container = document.querySelector(".preset-chips");
  const addBtn = document.getElementById("btn-add-custom");

  Object.entries(customTemplates).forEach(([id, tpl]) => {
     const btn = document.createElement("button");
     btn.type = "button";
     btn.className = "preset-chip";
     btn.setAttribute("data-preset", id);
     btn.textContent = `⚙️ ${tpl.title}`;
     if (container && addBtn) {
       container.insertBefore(btn, addBtn);
     }
  });
}


async function init() {
  const stored = await chrome.storage.local.get(["customTemplates"]);
  if (stored.customTemplates) {
    customTemplates = stored.customTemplates;
  }
  renderCustomChips();

  const settings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const merged = {
    ...DEFAULT_SETTINGS,
    ...settings
  };
  fillForm(merged);
  applyLanguage(merged.uiLanguage || "zh");
  
  // Display extension version
  const versionEl = document.getElementById("version-display");
  if (versionEl) {
    const version = chrome.runtime.getManifest().version;
    versionEl.textContent = `v${version}`;
  }
  
  isHydrating = false;
  
  loadHistory();
  
  // Listen for history updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "history:updated") {
      loadHistory();
    }
  });
  
  // Initialize custom dropdown
  initCustomDropdown();
}

async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ type: "history:get" });
  if (response?.ok && response.history) {
    renderHistory(response.history);
  }
}

function renderHistory(history) {
  const container = document.getElementById("history-list");
  const emptyEl = document.getElementById("history-empty");
  const clearBtn = document.getElementById("btn-clear-history");
  
  if (!history || history.length === 0) {
    emptyEl.style.display = "block";
    clearBtn.style.display = "none";
    const items = container.querySelectorAll(".history-item");
    items.forEach(item => item.remove());
    return;
  }
  
  emptyEl.style.display = "none";
  clearBtn.style.display = "block";
  
  const items = container.querySelectorAll(".history-item");
  items.forEach(item => item.remove());
  
  history.forEach(item => {
    const el = createHistoryItem(item);
    container.appendChild(el);
  });
}

function createHistoryItem(item) {
  const div = document.createElement("div");
  div.className = "history-item";
  div.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; display: flex; gap: 12px; cursor: pointer; transition: all 150ms ease;";
  
  const time = new Date(item.timestamp).toLocaleString();
  const zhPrompt = item.prompts?.zh || "";
  const enPrompt = item.prompts?.en || "";
  const hasImage = item.imageDataUrl && item.imageDataUrl.startsWith("data:image");
  
  const imageHtml = hasImage
    ? `<div style="width: 80px; height: 80px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.05);">
        <img src="${escapeHtml(item.imageDataUrl)}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\"font-size: 24px; display: flex; align-items: center; justify-content: center; height: 100%;\">🖼️</span>';" />
       </div>`
    : `<div style="width: 80px; height: 80px; flex-shrink: 0; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 24px;">🖼️</span>
       </div>`;
  
  div.innerHTML = `
    ${imageHtml}
    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <div style="font-size: 11px; color: rgba(255,255,255,0.4);">${time}</div>
        <div style="display: flex; gap: 4px;">
          <button type="button" class="history-copy-btn" data-id="${item.id}" style="border: 0; border-radius: 4px; padding: 3px 8px; font-size: 10px; font-weight: 600; cursor: pointer; background: rgba(139,211,255,0.15); color: #8bd3ff; transition: all 150ms ease;" data-i18n="historyCopy">复制</button>
          <button type="button" class="history-delete-btn" data-id="${item.id}" style="border: 0; border-radius: 4px; padding: 3px 8px; font-size: 10px; font-weight: 600; cursor: pointer; background: rgba(255,107,107,0.15); color: #ff6b6b; transition: all 150ms ease;" data-i18n="historyDelete">删除</button>
        </div>
      </div>
      <div style="font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
        <span style="color: #8bd3ff; font-weight: 600;">中文:</span> ${escapeHtml(zhPrompt.substring(0, 100))}${zhPrompt.length > 100 ? '...' : ''}
      </div>
      <div style="font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
        <span style="color: #f09cc0; font-weight: 600;">EN:</span> ${escapeHtml(enPrompt.substring(0, 100))}${enPrompt.length > 100 ? '...' : ''}
      </div>
    </div>
  `;
  
  div.addEventListener("click", (e) => {
    if (e.target.closest(".history-copy-btn") || e.target.closest(".history-delete-btn")) return;
    loadHistoryItem(item);
  });
  
  div.addEventListener("mouseenter", () => {
    div.style.background = "rgba(255,255,255,0.06)";
    div.style.borderColor = "rgba(255,255,255,0.15)";
  });
  
  div.addEventListener("mouseleave", () => {
    div.style.background = "rgba(255,255,255,0.03)";
    div.style.borderColor = "rgba(255,255,255,0.08)";
  });
  
  div.querySelector(".history-copy-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    const text = item.prompts?.zh || item.prompts?.en || "";
    try {
      await navigator.clipboard.writeText(text);
      const btn = div.querySelector(".history-copy-btn");
      btn.textContent = TRANSLATIONS[form.uiLanguage.value]?.historyCopied || "已复制";
      btn.style.background = "rgba(154,230,180,0.2)";
      btn.style.color = "#9ae6b4";
      setTimeout(() => {
        btn.textContent = TRANSLATIONS[form.uiLanguage.value]?.historyCopy || "复制";
        btn.style.background = "rgba(139,211,255,0.15)";
        btn.style.color = "#8bd3ff";
      }, 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  });
  
  div.querySelector(".history-delete-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: "history:delete", id: item.id });
    loadHistory();
  });
  
  return div;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function loadHistoryItem(item) {
  // Send message to content script to display this history item in the main panel
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: "prompt:load-history-item",
        data: {
          prompts: item.prompts,
          srcUrl: item.srcUrl || "",
          imageDataUrl: item.imageDataUrl || ""
        }
      });
      setStatus("✓ 已在主面板加载历史记录");
    } else {
      setStatus("⚠️ 未找到活动标签页");
    }
  } catch (err) {
    console.error("Failed to send history item to content script:", err);
    setStatus("⚠️ 请在网页中打开面板后重试");
  }
}

document.getElementById("btn-clear-history").addEventListener("click", async () => {
  if (confirm(TRANSLATIONS[form.uiLanguage.value]?.historyClearConfirm || "确定要清空所有历史记录吗?")) {
    await chrome.runtime.sendMessage({ type: "history:clear" });
    loadHistory();
  }
});

// Export history
document.getElementById("btn-export-history").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "history:get" });
  if (response?.ok && response.history?.length > 0) {
    const exportData = {
      version: chrome.runtime.getManifest().version,
      exportDate: new Date().toISOString(),
      totalItems: response.history.length,
      history: response.history
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imgprompt-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setStatus("✅ 历史记录已导出");
  } else {
    setStatus("⚠️ 没有可导出的历史记录");
  }
});

form.addEventListener("input", (e) => {
  if (e.target.name === "userPrompt") {
    updateActiveChip(e.target.value.trim());
  }
  handleAutoSave();
});
form.addEventListener("change", handleAutoSave);

// Export settings
document.getElementById("export-settings").addEventListener("click", async () => {
  const settings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const exportData = {
    version: chrome.runtime.getManifest().version,
    exportDate: new Date().toISOString(),
    settings
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `imgprompt-settings-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  setStatus("✅ 设置已导出");
});

// Import settings
document.getElementById("import-settings").addEventListener("click", () => {
  document.getElementById("import-file-input").click();
});

document.getElementById("import-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (data.settings) {
      await chrome.storage.local.set(data.settings);
      fillForm({ ...DEFAULT_SETTINGS, ...data.settings });
      setStatus("✅ 设置已导入");
      
      chrome.runtime.sendMessage({ type: "settings:updated" }).catch(() => {});
    } else {
      setStatus("❌ 导入失败: 文件格式错误");
    }
  } catch (err) {
    setStatus("❌ 导入失败: 文件格式错误");
  }
  
  e.target.value = ''; // Reset input
});

// Toggle API key visibility
const toggleApiKeyBtn = document.getElementById("toggle-api-key");
const apiKeyInput = document.getElementById("apiKey");
const eyeIconShow = document.getElementById("eye-icon-show");
const eyeIconHide = document.getElementById("eye-icon-hide");

toggleApiKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  eyeIconShow.style.display = isPassword ? "block" : "none";
  eyeIconHide.style.display = isPassword ? "none" : "block";
});

// Test API connection
document.getElementById("test-connection").addEventListener("click", async () => {
  const statusEl = document.getElementById("test-connection-status");
  statusEl.textContent = "⏳ 测试中...";
  statusEl.style.color = "var(--muted)";
  
  const settings = buildPayload();
  
  if (!settings.apiEndpoint || !settings.apiKey || !settings.model) {
    statusEl.textContent = "⚠️ 请先填写完整信息";
    statusEl.style.color = "#ffc85f";
    return;
  }
  
  const result = await chrome.runtime.sendMessage({ 
    type: "api:test-connection", 
    settings 
  });
  
  if (result?.success) {
    statusEl.textContent = "✅ " + result.message;
    statusEl.style.color = "var(--success)";
  } else {
    statusEl.textContent = "❌ " + (result?.error || "连接失败");
    statusEl.style.color = "#ff6b6b";
  }
  
  setTimeout(() => { statusEl.textContent = ""; }, 5000);
});

resetButton.addEventListener("click", async () => {
  fillForm(DEFAULT_SETTINGS);
  await chrome.storage.local.set(DEFAULT_SETTINGS);
  trackSettingsSaved("restored_defaults");
  setStatus("已恢复默认值。");
  
  // Notify other parts of the extension
  chrome.runtime.sendMessage({ type: "settings:updated" }).catch(() => {});
});

function handleAutoSave() {
  if (isHydrating) {
    return;
  }

  window.clearTimeout(handleAutoSave.timerId);
  handleAutoSave.timerId = window.setTimeout(async () => {
    const payload = buildPayload();
    await chrome.storage.local.set(payload);
    applyLanguage(payload.uiLanguage);
    trackSettingsSaved("auto_save");
    
    
    // Notify other parts of the extension that settings have changed
    chrome.runtime.sendMessage({ type: "settings:updated" }).catch(() => {
      // Ignore errors when no other listeners are available
    });
  }, 220);
}

function buildPayload() {
  return {
    apiEndpoint: form.apiEndpoint.value.trim(),
    apiKey: form.apiKey.value.trim(),
    model: form.model.value.trim(),
    requestFormat: DEFAULT_SETTINGS.requestFormat,
    anthropicVersion: DEFAULT_SETTINGS.anthropicVersion,
    hoverButtonEnabled: form.hoverButtonEnabled.checked,
    snippingShortcutEnabled: form.snippingShortcutEnabled.checked,
    uiLanguage: form.uiLanguage.value,
    maxImageEdge: parseInt(form.maxImageEdge.value, 10) || 1024,
    systemPrompt: DEFAULT_SETTINGS.systemPrompt,
    userPrompt: form.userPrompt.value.trim(),
    temperature: DEFAULT_SETTINGS.temperature
  };
}

function applyLanguage(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.zh;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // Update toggle button visual state
  document.querySelectorAll('input[name="uiLanguage"]').forEach(input => {
    const btn = input.nextElementSibling;
    if (input.value === lang) {
      input.checked = true;
      btn?.classList.add("active");
    } else {
      btn?.classList.remove("active");
    }
  });

  // Update status messages if needed
  if (lang === "en") {
    if (statusEl.textContent === "已恢复默认值。") statusEl.textContent = "Restored defaults.";
  } else {
    if (statusEl.textContent === "Restored defaults.") statusEl.textContent = "已恢复默认值。";
  }
}

function fillForm(settings) {
  form.apiEndpoint.value = settings.apiEndpoint || "";
  form.apiKey.value = settings.apiKey || "";
  form.model.value = settings.model || "";

  form.userPrompt.value = settings.userPrompt || "";
  
  // Try to match and highlight the corresponding preset button
  const basePrompt = ImgPromptConfig.BASE_USER_PROMPT;
  let matched = false;
  
  // Check if it matches any custom template
  for (const [id, tpl] of Object.entries(customTemplates)) {
    if (tpl.prompt === form.userPrompt.value) {
      const allChips = document.querySelectorAll(".preset-chip");
      allChips.forEach(chip => chip.classList.remove("active"));
      const customChip = document.querySelector(`.preset-chip[data-preset="${id}"]`);
      if (customChip) {
        customChip.classList.add("active");
        showCustomEditMode(id);
      }
      matched = true;
      break;
    }
  }
  
  // Check if it matches any built-in preset
  if (!matched && PRESETS) {
    for (const [key, text] of Object.entries(PRESETS)) {
      // For general: exact match with base prompt
      if (key === "general" && form.userPrompt.value === basePrompt) {
        const allChips = document.querySelectorAll(".preset-chip");
        allChips.forEach(chip => chip.classList.remove("active"));
        const generalChip = document.querySelector('.preset-chip[data-preset="general"]');
        if (generalChip) generalChip.classList.add("active");
        showBuiltinMode();
        matched = true;
        break;
      }
      // For scene presets: match base + scene
      if (key !== "general" && form.userPrompt.value === basePrompt + text) {
        const allChips = document.querySelectorAll(".preset-chip");
        allChips.forEach(chip => chip.classList.remove("active"));
        const sceneChip = document.querySelector(`.preset-chip[data-preset="${key}"]`);
        if (sceneChip) sceneChip.classList.add("active");
        showBuiltinMode();
        matched = true;
        break;
      }
    }
  }
  
  // If no match found, default to general
  if (!matched) {
    form.userPrompt.value = basePrompt;
    const allChips = document.querySelectorAll(".preset-chip");
    allChips.forEach(chip => chip.classList.remove("active"));
    const generalChip = document.querySelector('.preset-chip[data-preset="general"]');
    if (generalChip) generalChip.classList.add("active");
    showBuiltinMode();
  }
  
  form.hoverButtonEnabled.checked = settings.hoverButtonEnabled !== false;
  form.snippingShortcutEnabled.checked = settings.snippingShortcutEnabled !== false;
  form.uiLanguage.value = settings.uiLanguage || "zh";
  form.maxImageEdge.value = settings.maxImageEdge || 1024;
}

function trackSettingsSaved(source) {
  chrome.runtime.sendMessage({
    type: "analytics:track",
    event: "settings_saved",
    properties: {
      source,
      model: form.model.value.trim(),
      hasApiEndpoint: Boolean(form.apiEndpoint.value.trim()),
      hasApiKey: Boolean(form.apiKey.value.trim()),
      hoverButtonEnabled: form.hoverButtonEnabled.checked
    }
  }, () => {
    void chrome.runtime.lastError;
  });
}

function setStatus(text) {
  statusEl.style.transition = "opacity 200ms ease, transform 200ms ease";
  statusEl.style.opacity = "0";
  statusEl.style.transform = "translateY(-5px)";
  
  setTimeout(() => {
    statusEl.textContent = text;
    statusEl.style.opacity = "1";
    statusEl.style.transform = "translateY(0)";
  }, 100);
  
  window.clearTimeout(setStatus.timerId);
  setStatus.timerId = window.setTimeout(() => {
    statusEl.style.opacity = "0";
    statusEl.style.transform = "translateY(5px)";
  }, 2400);
}

// Custom Dropdown Implementation
function initCustomDropdown() {
  const customSelect = document.getElementById('resolution-select');
  if (!customSelect) return;
  
  const trigger = customSelect.querySelector('.custom-select-trigger');
  const dropdown = customSelect.querySelector('.custom-select-dropdown');
  const options = customSelect.querySelectorAll('.custom-select-option');
  const hiddenSelect = document.getElementById('maxImageEdge');
  
  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    customSelect.classList.toggle('open');
  });
  
  // Handle option selection
  options.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = option.getAttribute('data-value');
      const text = option.textContent;
      
      // Update visual state
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      trigger.textContent = text;
      
      // Update hidden select
      if (hiddenSelect) {
        hiddenSelect.value = value;
        // Trigger change event for auto-save
        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Close dropdown
      customSelect.classList.remove('open');
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    customSelect.classList.remove('open');
  });
  
  // Sync with hidden select initial value
  if (hiddenSelect && hiddenSelect.value) {
    const currentValue = hiddenSelect.value;
    options.forEach(opt => {
      if (opt.getAttribute('data-value') === currentValue) {
        opt.classList.add('selected');
        trigger.textContent = opt.textContent;
      } else {
        opt.classList.remove('selected');
      }
    });
  }
}
