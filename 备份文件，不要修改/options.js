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

  if (PRESETS && PRESETS[presetKey]) {
    form.userPrompt.value = PRESETS[presetKey];
    updateActiveChip(PRESETS[presetKey]);
    handleAutoSave();
    return;
  }

  if (presetKey.startsWith("custom_")) {
    const customId = presetKey;
    if (customTemplates[customId]) {
      form.userPrompt.value = customTemplates[customId].prompt;
      updateActiveChip(customTemplates[customId].prompt);
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
  form.userPrompt.value = "";
  showCustomCreateMode();
}

function updateActiveChip(currentPrompt) {
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

  if (!found) {
    showCustomCreateMode();
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
  const res = await chrome.storage.local.get("userPrompt");
  if (res.userPrompt) {
    form.userPrompt.value = res.userPrompt;
    updateActiveChip(res.userPrompt);
  } else {
    form.userPrompt.value = PRESETS["general"] || "";
    updateActiveChip(form.userPrompt.value);
  }
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
}

form.addEventListener("input", (e) => {
  if (e.target.name === "userPrompt") {
    updateActiveChip(e.target.value.trim());
  }
  handleAutoSave();
});
form.addEventListener("change", handleAutoSave);

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
  updateActiveChip(form.userPrompt.value);
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
  statusEl.textContent = text;
  window.clearTimeout(setStatus.timerId);
  setStatus.timerId = window.setTimeout(() => {
    statusEl.textContent = "";
  }, 2400);
}
