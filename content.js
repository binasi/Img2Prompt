// Load shared config from window.ImgPromptConfig (set by config.js)
const CONFIG = window.ImgPromptConfig || {};
const UI_STRINGS = CONFIG.UI_STRINGS;

function throttle(fn, wait) {
  let lastCall = 0;
  let timeoutId = null;

  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

const PANEL_ROOT_ID = "image-prompt-inspector-root";
const PANEL_Z_INDEX = "2147483647";
const HOVER_BUTTON_ROOT_ID = "picprompt-hover-button-root";
const MAX_IMAGE_EDGE = 1024;
const COMPRESSED_IMAGE_QUALITY = 0.86;

let lastContextImage = null;
let activeRequestId = "";
let activeLanguage = "zh";
let currentPrompts = { zh: "", en: "" };
let currentSource = { srcUrl: "", imageDataUrl: "" };
let currentTrigger = "unknown";
let isGenerating = false;
let dragState = null;
let hoverImage = null;
let isHoverButtonHovered = false;
let isHoverButtonDismissed = false;
let isHoverButtonEnabled = true;
let uiLanguage = "zh";
let preferredPromptLanguage = null;
let maxImageEdge = 1024;
let generationStartedAt = 0;
let progressTimerId = 0;
let currentProgressText = "";
let panelDismissed = false;

function isExtensionContextError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("Extension context invalidated") ||
    message.includes("Receiving end does not exist") ||
    message.includes("The message port closed before a response was received")
  );
}

function safeSendRuntimeMessage(payload, callback) {
  try {
    chrome.runtime.sendMessage(payload, callback);
    return true;
  } catch (error) {
    if (isExtensionContextError(error)) {
      return false;
    }
    throw error;
  }
}

document.addEventListener(
  "contextmenu",
  (event) => {
    const path = event.composedPath ? event.composedPath() : [];
    const matched = path.find(
      (node) =>
        node instanceof HTMLImageElement ||
        (node instanceof Element && node.closest?.("img"))
    );

    if (matched instanceof HTMLImageElement) {
      lastContextImage = matched;
      return;
    }

    if (matched instanceof Element) {
      lastContextImage = matched.closest("img");
    }
  },
  true
);

document.addEventListener("pointermove", throttle(handleDocumentPointerMove, 100), true);
document.addEventListener("scroll", () => updateHoverButtonPosition(), true);
window.addEventListener("resize", () => updateHoverButtonPosition());
chrome.storage.local.get({ hoverButtonEnabled: true, uiLanguage: "zh", maxImageEdge: 1024, preferredPromptLanguage: null }, (result) => {
  isHoverButtonEnabled = result.hoverButtonEnabled !== false;
  uiLanguage = result.uiLanguage || "zh";
  maxImageEdge = result.maxImageEdge || 1024;
  preferredPromptLanguage = result.preferredPromptLanguage || null;
  if (!isHoverButtonEnabled) {
    hoverImage = null;
    hideHoverButton();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.hoverButtonEnabled) {
    isHoverButtonEnabled = changes.hoverButtonEnabled.newValue !== false;
    isHoverButtonDismissed = false;
    if (!isHoverButtonEnabled) {
      hoverImage = null;
      isHoverButtonHovered = false;
      hideHoverButton();
    } else {
      updateHoverButtonPosition();
    }
  }

  if (changes.uiLanguage) {
    uiLanguage = changes.uiLanguage.newValue || "zh";
    preferredPromptLanguage = null;
    chrome.storage.local.remove('preferredPromptLanguage');
    
    // If panel exists, update it
    const panel = document.getElementById(PANEL_ROOT_ID);
    if (panel && panel.shadowRoot) {
      updatePanelLanguage(panel.shadowRoot);
    }
  }

  if (changes.maxImageEdge) {
    maxImageEdge = changes.maxImageEdge.newValue || 1024;
  }
});

// Reload settings when notified from options page
function handleSettingsUpdate() {
  chrome.storage.local.get({ hoverButtonEnabled: true, uiLanguage: "zh", maxImageEdge: 1024, preferredPromptLanguage: null }, (result) => {
    isHoverButtonEnabled = result.hoverButtonEnabled !== false;
    uiLanguage = result.uiLanguage || "zh";
    maxImageEdge = result.maxImageEdge || 1024;
    preferredPromptLanguage = result.preferredPromptLanguage || null;
    
    if (!isHoverButtonEnabled) {
      hoverImage = null;
      isHoverButtonHovered = false;
      hideHoverButton();
    }
    
    // Update panel language if it exists
    const panel = document.getElementById(PANEL_ROOT_ID);
    if (panel && panel.shadowRoot) {
      updatePanelLanguage(panel.shadowRoot);
    }
  });
}

function updatePanelLanguage(shadow) {
  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
  
  // Update static text in the panel
  const nameEl = shadow.querySelector(".ipi-name");
  const subtitleEl = shadow.querySelector(".ipi-subtitle");
  const dragEl = shadow.querySelector(".ipi-drag");
  const stopEl = shadow.querySelector(".ipi-stop");
  const textareaEl = shadow.querySelector(".ipi-textarea");
  const zhBtn = shadow.querySelector('[data-lang="zh"]');
  const enBtn = shadow.querySelector('[data-lang="en"]');
  const copyBtn = shadow.querySelector('[data-action="copy"]');
  const stageLoadingEl = shadow.querySelector(".ipi-stage-loading");

  if (nameEl) nameEl.textContent = "ImgPrompt";
  if (subtitleEl) subtitleEl.textContent = dict.subtitle;
  if (dragEl) dragEl.setAttribute("aria-label", dict.dragCard);
  if (stopEl) stopEl.setAttribute("aria-label", dict.stopButton);
  if (textareaEl) textareaEl.placeholder = dict.placeholder;
  if (zhBtn) zhBtn.textContent = dict.zhBtn;
  if (enBtn) enBtn.textContent = dict.enBtn;
  if (stageLoadingEl) stageLoadingEl.textContent = dict.imageLoading;
  if (copyBtn && copyBtn.getAttribute("data-state") === "idle") {
    copyBtn.textContent = dict.copyBtn;
  } else if (copyBtn && copyBtn.getAttribute("data-state") === "done") {
    copyBtn.textContent = dict.copied;
  }

  // Update status if not currently generating (or update based on current state)
  const statusEl = shadow.querySelector(".ipi-status");
  if (statusEl) {
    const currentStatus = statusEl.textContent;
    // Simple heuristic to translate current status if it matches a known one
    for (const lang in UI_STRINGS) {
      for (const key in UI_STRINGS[lang]) {
        if (UI_STRINGS[lang][key] === currentStatus) {
          statusEl.textContent = dict[key];
          break;
        }
      }
    }
  }
}

chrome.runtime.onMessage.addListener((message) => {
  switch (message?.type) {
    case "prompt:start-snipping":
      startSnipper(message.dataUrl);
      break;
    case "prompt:start-analysis":
      handleStartAnalysis(message);
      break;
    case "prompt:load-history-item":
      handleLoadHistoryItem(message);
      break;
    case "prompt:progress":
      if (message.requestId === activeRequestId) {
        updateProgress(message.progress, message.text);
      }
      break;
    case "prompt:result":
      if (message.requestId === activeRequestId) {
        handleResult(message);
      }
      break;
    case "prompt:canceled":
      if (message.requestId === activeRequestId) {
        handleCanceled();
      }
      break;
    case "prompt:error":
      if (message.requestId === activeRequestId) {
        handleError(message);
      }
      break;
    case "settings:updated":
      // Reload settings from storage
      handleSettingsUpdate();
      break;
    default:
      break;
  }
});

async function handleStartAnalysis(message) {
  activeRequestId = message.requestId;
  panelDismissed = false;
  currentTrigger = message.trigger || "unknown";
  currentSource = {
    srcUrl: message.srcUrl || "",
    imageDataUrl: message.imageDataUrl || ""
  };
  currentPrompts = { zh: "", en: "" };

  const panel = ensurePanel();
  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;

  activeLanguage = preferredPromptLanguage || uiLanguage || "zh";
  const zhBtn = panel.querySelector('[data-lang="zh"]');
  const enBtn = panel.querySelector('[data-lang="en"]');
  if (zhBtn && enBtn) {
    if (activeLanguage === "en") {
      zhBtn.style.order = "1";
      enBtn.style.order = "0";
    } else {
      zhBtn.style.order = "0";
      enBtn.style.order = "1";
    }
  }

  setPreview(panel, message.imageDataUrl || message.srcUrl || "");
  setTextareaValue(panel, "");
  setStatus(panel, dict.preparing);
  startProgressTimer();
  updateProgress(6, dict.locatingImage);
  setLoadingState(panel, true);
  setError(panel, "");
  syncLanguageButtons(panel);
  resetCopyButton(panel);
  setContentVisibility(panel, false);
  setStopButtonState(panel, true);
  setScannerVisibility(panel, true);
  isGenerating = true;

  // Simply pass srcUrl; background will handle image fetching and compression
  const sent = safeSendRuntimeMessage({
    type: "prompt:begin-generation",
    requestId: message.requestId,
    srcUrl: message.srcUrl || "",
    imageDataUrl: message.imageDataUrl || "",
    trigger: currentTrigger,
    pageContext: {
      altText: lastContextImage?.alt || "",
      title: document.title,
      pageUrl: window.location.href
    }
  }, (response) => {
    if (activeRequestId !== message.requestId) {
      return;
    }

    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) {
      const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
      showGenerationError(panel, runtimeError.message || dict.unknownError);
      return;
    }

    if (!response?.ok) {
      const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
      showGenerationError(panel, response?.error || dict.generationFailed);
    }
  });

  if (!sent) {
    isGenerating = false;
    stopProgressTimer();
    setLoadingState(panel, false);
    setStopButtonState(panel, false);
    shadowSafeHidePanel(panel);
  }
}

function startAnalysisForImage(image) {
  if (!(image instanceof HTMLImageElement)) {
    return;
  }

  const srcUrl = image.currentSrc || image.src || "";
  if (!srcUrl) {
    return;
  }

  lastContextImage = image;
  hideHoverButton();
  handleStartAnalysis({
    requestId: crypto.randomUUID(),
    srcUrl,
    trigger: "hover_button"
  });
}

function handleResult(message) {
  if (panelDismissed) {
    isGenerating = false;
    stopProgressTimer();
    return;
  }

  currentPrompts = {
    zh: message.prompts?.zh || "",
    en: message.prompts?.en || ""
  };
  currentSource = message.source || currentSource;

  const panel = ensurePanel();
  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
  isGenerating = false;
  stopProgressTimer();
  setLoadingState(panel, false);
  updateProgress(100, dict.generationComplete);
  setStatus(panel, dict.completed);
  setError(panel, "");
  setTextareaValue(panel, currentPrompts[activeLanguage] || "");
  resetCopyButton(panel);
  setScannerVisibility(panel, false);
  setContentVisibility(panel, true);
  setStopButtonState(panel, false);
  if (currentSource.imageDataUrl || currentSource.srcUrl) {
    setPreview(panel, currentSource.imageDataUrl || currentSource.srcUrl);
  }
}

function handleLoadHistoryItem(message) {
  const historyData = message.data;
  if (!historyData?.prompts) {
    return;
  }

  panelDismissed = false;
  currentPrompts = {
    zh: historyData.prompts?.zh || "",
    en: historyData.prompts?.en || ""
  };
  currentSource = {
    srcUrl: historyData.srcUrl || "",
    imageDataUrl: historyData.imageDataUrl || ""
  };
  currentTrigger = "history";

  const panel = ensurePanel();
  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
  
  // Reset state
  isGenerating = false;
  stopProgressTimer();
  
  // Set language preference
  activeLanguage = preferredPromptLanguage || uiLanguage || "zh";
  const zhBtn = panel.querySelector('[data-lang="zh"]');
  const enBtn = panel.querySelector('[data-lang="en"]');
  if (zhBtn && enBtn) {
    if (activeLanguage === "en") {
      zhBtn.style.order = "1";
      enBtn.style.order = "0";
    } else {
      zhBtn.style.order = "0";
      enBtn.style.order = "1";
    }
  }
  
  // Display the content
  setLoadingState(panel, false);
  updateProgress(100, dict.generationComplete);
  setStatus(panel, dict.completed);
  setError(panel, "");
  setTextareaValue(panel, currentPrompts[activeLanguage] || "");
  resetCopyButton(panel);
  setScannerVisibility(panel, false);
  setContentVisibility(panel, true);
  setStopButtonState(panel, false);
  
  // Set preview image
  if (currentSource.imageDataUrl || currentSource.srcUrl) {
    setPreview(panel, currentSource.imageDataUrl || currentSource.srcUrl);
  }
}

function handleCanceled() {
  if (panelDismissed) {
    isGenerating = false;
    stopProgressTimer();
    return;
  }

  const panel = ensurePanel();
  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
  isGenerating = false;
  stopProgressTimer();
  setLoadingState(panel, false);
  updateProgress(0, dict.stopped);
  setStatus(panel, dict.stopped);
  setScannerVisibility(panel, false);
  setStopButtonState(panel, false);
  setError(panel, dict.stopGeneration);
}

function showGenerationError(panel, message) {
  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
  isGenerating = false;
  stopProgressTimer();
  setLoadingState(panel, false);
  updateProgress(0, dict.generationFailed);
  setStatus(panel, dict.failed);
  setScannerVisibility(panel, false);
  setStopButtonState(panel, false);
  setError(panel, message || dict.generationFailed);
}

function handleError(message) {
  if (panelDismissed) {
    isGenerating = false;
    stopProgressTimer();
    return;
  }

  const panel = ensurePanel();
  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
  
  isGenerating = false;
  stopProgressTimer();
  setLoadingState(panel, false);
  updateProgress(0, dict.generationFailed);
  setStatus(panel, dict.failed);
  setScannerVisibility(panel, false);
  setStopButtonState(panel, false);
  
  // Use the user-friendly message from background if available
  const errorMessage = message.message || dict.generationFailed;
  setError(panel, errorMessage);
  
  console.warn('[PicPrompt] Generation error:', message.errorCode, errorMessage);
}

function startSnipper(dataUrl) {
  trackEvent("snipping_tool_opened", {
    pageUrl: window.location.href,
    pageTitle: document.title
  });
  const overlay = document.createElement("div");
  overlay.id = "picprompt-snipper-overlay";
  Object.assign(overlay.style, {
    position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
    zIndex: "2147483647", cursor: "crosshair", backgroundColor: "rgba(0,0,0,0.4)",
    userSelect: "none"
  });

  // We use a hole-punch effect via box-shadow or clip-path. Box-shadow is easier here.
  const selection = document.createElement("div");
  Object.assign(selection.style, {
    position: "absolute", border: "2px dashed #fff", pointerEvents: "none",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", background: "transparent",
    display: "none"
  });

  overlay.appendChild(selection);
  document.body.appendChild(overlay);

  let isDrawing = false;
  let startX, startY;

  overlay.addEventListener("mousedown", (e) => {
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    // Remove the dimming from the overlay itself so the holepunch isn't double dimmed.
    overlay.style.backgroundColor = "transparent";
    Object.assign(selection.style, {
      left: startX + "px", top: startY + "px",
      width: "0px", height: "0px", display: "block"
    });
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    Object.assign(selection.style, {
      left: left + "px", top: top + "px",
      width: width + "px", height: height + "px"
    });
  });

  overlay.addEventListener("mouseup", async (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    
    const dpr = window.devicePixelRatio || 1;
    const left = Math.min(startX, e.clientX);
    const top = Math.min(startY, e.clientY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);

    overlay.remove();

    if (width < 10 || height < 10) return;

    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => img.onload = resolve);
      
      const canvas = document.createElement("canvas");
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d");
      
      ctx.drawImage(img, left * dpr, top * dpr, width * dpr, height * dpr, 0, 0, canvas.width, canvas.height);
      const croppedBase64 = canvas.toDataURL("image/jpeg", 0.92);

      trackEvent("snipping_crop_completed", {
        width,
        height,
        pageUrl: window.location.href
      });

      handleStartAnalysis({
        requestId: crypto.randomUUID(),
        srcUrl: "",
        imageDataUrl: croppedBase64,
        trigger: "shortcut_snipping"
      });
    } catch(err) {
      console.error("[PicPrompt] Snipping crop failed", err);
    }
  });

  // Cancel on Esc
  const keyHandler = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", keyHandler);
    }
  };
  document.addEventListener("keydown", keyHandler);
}

function ensurePanel() {
  let host = document.getElementById(PANEL_ROOT_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = PANEL_ROOT_ID;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.top = "20px";
    host.style.right = "20px";
    host.style.left = "auto";
    host.style.zIndex = PANEL_Z_INDEX;
    document.documentElement.appendChild(host);
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = buildPanelMarkup();
    bindPanelEvents(shadow);
  }

  const panel = shadow.querySelector(".ipi-panel");
  panel.hidden = false;
  return shadow;
}

function ensureHoverButton() {
  let host = document.getElementById(HOVER_BUTTON_ROOT_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOVER_BUTTON_ROOT_ID;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    host.style.zIndex = PANEL_Z_INDEX;
    document.documentElement.appendChild(host);
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        .pp-hover-wrap {
          position: fixed;
          display: inline-flex;
          align-items: center;
          opacity: 0;
          visibility: hidden;
          transition: opacity 160ms ease, visibility 160ms ease;
          pointer-events: none;
        }
        .pp-hover-wrap[data-visible="true"] {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }
        .pp-hover {
          position: relative;
          display: inline-flex;
          align-items: center;
          border: 0;
          border-radius: 999px;
          padding: 8px 12px;
          background: linear-gradient(90deg, #8bd3ff, #ffc85f 55%, #f09cc0);
          color: #111014;
          font: 600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
          cursor: pointer;
        }
        .pp-hover-close {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 14px;
          height: 14px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 999px;
          background: rgba(17, 16, 20, 0.82);
          color: rgba(255, 255, 255, 0.9);
          font: 700 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
        }
      </style>
      <div class="pp-hover-wrap" data-visible="false">
        <button class="pp-hover" type="button">
          <span>ImgPrompt</span>
        </button>
        <button class="pp-hover-close" type="button" aria-label="${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).closeHover}">×</button>
      </div>
    `;

    const wrap = shadow.querySelector(".pp-hover-wrap");
    const button = shadow.querySelector(".pp-hover");
    const closeButton = shadow.querySelector(".pp-hover-close");
    wrap.addEventListener("pointerenter", () => {
      isHoverButtonHovered = true;
    });
    wrap.addEventListener("pointerleave", () => {
      isHoverButtonHovered = false;
      if (!hoverImage) {
        hideHoverButton();
      }
    });
    button.addEventListener("click", () => {
      if (hoverImage) {
        startAnalysisForImage(hoverImage);
      }
    });
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      isHoverButtonDismissed = true;
      hoverImage = null;
      isHoverButtonHovered = false;
      hideHoverButton();
    });
  }

  return shadow;
}

function buildPanelMarkup() {
  return `
    <style>
      :host {
        all: initial;
      }
      .ipi-panel {
        width: 392px;
        max-width: calc(100vw - 20px);
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: transparent;
        border: 0;
        box-shadow: none;
        overflow: visible;
        position: relative;
      }
      .ipi-close {
        position: absolute;
        top: 18px;
        right: 18px;
        z-index: 6;
        border: 0;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.88);
        width: 34px;
        height: 34px;
        border-radius: 999px;
        cursor: pointer;
        backdrop-filter: blur(10px);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }
      .ipi-drag {
        position: absolute;
        top: 8px;
        left: 50%;
        z-index: 6;
        width: 44px;
        height: 8px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        cursor: grab;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
        transform: translateX(-50%);
      }
      .ipi-drag:active {
        cursor: grabbing;
      }
      .ipi-drag::before {
        content: "";
        position: absolute;
        inset: 50% auto auto 50%;
        width: 36px;
        height: 4px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.42);
        transform: translate(-50%, -50%);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
      }
      .ipi-body {
        padding: 0 12px 12px;
      }
      .ipi-stage {
        position: relative;
        margin: 0 10px;
        min-height: 150px;
        border-radius: 28px;
        overflow: hidden;
        background: transparent;
      }
      .ipi-preview {
        width: 101%;
        height: 101%;
        position: absolute;
        top: -0.5%;
        left: -0.5%;
        object-fit: cover;
        border-radius: 28px;
        background: rgba(15, 23, 42, 0.9);
        display: block;
        filter: saturate(0.95) contrast(1.05);
        opacity: 1;
        transition: opacity 180ms ease;
        visibility: hidden;
      }
      .ipi-preview[data-loaded="true"] {
        visibility: visible;
      }
      .ipi-preview-shade {
        position: absolute;
        inset: 0;
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(0, 0, 0, 0.06), transparent 28%, rgba(0, 0, 0, 0.55)),
          linear-gradient(180deg, transparent 52%, rgba(5, 5, 7, 0.95));
        pointer-events: none;
        visibility: hidden;
      }
      .ipi-preview[data-loaded="true"] + .ipi-preview-shade {
        visibility: visible;
      }
      .ipi-stage-loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.25);
        font-size: 13px;
        letter-spacing: 0.02em;
        pointer-events: none;
        z-index: 1;
      }
      .ipi-preview[data-loaded="true"] ~ .ipi-stage-loading {
        display: none;
      }
      @keyframes ipi-scan {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .ipi-scanner {
        position: absolute;
        inset: 0;
        z-index: 3;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: none;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0) 30%,
          rgba(255, 255, 255, 0.25) 50%,
          rgba(255, 255, 255, 0) 70%,
          transparent
        );
      }
      .ipi-stage[data-scanning="true"] .ipi-scanner {
        display: block;
        animation: ipi-scan 2.4s infinite ease-in-out alternate;
      }
      .ipi-card {
        position: relative;
        z-index: 5;
        margin: -22px 10px 0;
        padding: 18px;
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(18, 18, 22, 0.92), rgba(10, 10, 14, 0.96)),
          rgba(12, 12, 16, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow:
          0 18px 48px rgba(0, 0, 0, 0.36),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        cursor: default;
      }
      .ipi-card:active {
        cursor: grabbing;
      }
      /* 排除按钮和文本框，它们应该保持自己的光标 */
      .ipi-card button, 
      .ipi-card textarea,
      .ipi-card select {
        cursor: auto;
      }
      .ipi-card .ipi-action,
      .ipi-card .ipi-switch,
      .ipi-card .ipi-close,
      .ipi-card .ipi-stop {
        cursor: pointer;
      }
      .ipi-card textarea {
        cursor: text;
      }
      .ipi-meta {
        display: grid;
        gap: 12px;
      }
      .ipi-headline {
        display: grid;
        gap: 4px;
      }
      .ipi-name {
        font-size: 32px;
        line-height: 0.95;
        font-weight: 600;
        letter-spacing: -0.05em;
      }
      .ipi-subtitle {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.54);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .ipi-progress {
        position: relative;
        height: 38px;
        padding: 0 14px;
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.07);
        backdrop-filter: blur(10px);
      }
      .ipi-progress-bar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0%;
        background: linear-gradient(90deg, #8bd3ff, #ffd777, #f8a3c0, #ffd777, #8bd3ff);
        background-size: 200% 100%;
        animation: ipi-flow 2s linear infinite;
        transition: width 280ms ease;
        box-shadow: 0 0 28px rgba(248, 163, 192, 0.32);
      }
      @keyframes ipi-flow {
        0% { background-position: 200% 0; }
        100% { background-position: 0 0; }
      }
      .ipi-progress-content {
        position: relative;
        z-index: 1;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .ipi-progress-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-size: 12px;
        color: #111014;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ipi-progress-dot {
        width: 8px;
        height: 8px;
        flex: 0 0 auto;
        border-radius: 999px;
        background: linear-gradient(135deg, #ffd777, #f78fb6);
        box-shadow: 0 0 18px rgba(247, 143, 182, 0.42);
      }
      .ipi-status {
        font-size: 12px;
        color: #111014;
        letter-spacing: 0.01em;
      }
      .ipi-stop {
        border: 0;
        cursor: pointer;
        width: 30px;
        height: 30px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.86);
      }
      .ipi-stop::before {
        content: "";
        width: 10px;
        height: 10px;
        border-radius: 3px;
        background: #111014;
      }
      .ipi-stop[hidden] {
        display: none;
      }
      .ipi-stop[disabled] {
        opacity: 0.45;
        cursor: default;
      }
      .ipi-sheet {
        display: grid;
        gap: 12px;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transform: translateY(-24px) scaleY(0.92);
        transform-origin: top center;
        transition:
          max-height 420ms ease,
          opacity 320ms ease,
          transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
          margin-top 320ms ease;
        margin-top: -4px;
      }
      .ipi-sheet[data-visible="true"] {
        max-height: 520px;
        opacity: 1;
        transform: translateY(0) scaleY(1);
        margin-top: 0;
      }
      .ipi-textarea {
        width: 100%;
        min-height: 176px;
        resize: vertical;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.04);
        color: #f8fafc;
        padding: 14px 12px 18px 18px;
        box-sizing: border-box;
        font-size: 13px;
        line-height: 1.6;
        outline: none;
        backdrop-filter: blur(8px);
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.55) rgba(255, 255, 255, 0.06);
      }
      .ipi-textarea::-webkit-resizer {
        background: transparent;
        border: none;
      }
      .ipi-sheet {
        display: flex;
        flex-direction: column;
        gap: 10px;
        position: relative;
      }
      .ipi-textarea-wrapper {
        position: relative;
        border-radius: 22px;
        overflow: hidden;
      }
      .ipi-resize-handle {
        position: absolute;
        bottom: -24px;
        right: 10px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(148, 163, 184, 0.35);
        cursor: ns-resize;
        pointer-events: auto;
        transition: color 160ms ease;
        z-index: 2;
      }
      .ipi-resize-handle:hover {
        color: rgba(148, 163, 184, 0.7);
      }
      .ipi-textarea::-webkit-scrollbar {
        width: 6px;
      }
      .ipi-textarea::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 999px;
        margin: 4px 0;
      }
      .ipi-textarea::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.5);
        border-radius: 999px;
      }
      .ipi-textarea::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.72);
      }
      .ipi-textarea:focus {
        border-color: rgba(255, 255, 255, 0.14);
        box-shadow: 0 0 0 3px rgba(139, 211, 255, 0.12);
      }
      .ipi-switches,
      .ipi-actions {
        display: flex;
        gap: 10px;
      }
      .ipi-switch,
      .ipi-action {
        border: 0;
        cursor: pointer;
        border-radius: 999px;
        padding: 9px 13px;
        font-size: 12px;
        font-weight: 600;
      }
      .ipi-switch {
        color: rgba(255, 255, 255, 0.7);
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(10px);
      }
      .ipi-switch[data-active="true"] {
        background: rgba(255, 255, 255, 0.96);
        color: #0f0f14;
      }
      .ipi-actions {
        align-items: center;
        justify-content: space-between;
        margin-top: 4px;
      }
      .ipi-action {
        min-width: 112px;
        color: #111014;
        background: linear-gradient(90deg, #8bd3ff, #ffc85f 55%, #f09cc0);
        box-shadow: 0 14px 30px rgba(255, 193, 94, 0.18);
      }
      .ipi-action[data-state="done"] {
        color: #07140b;
        background: linear-gradient(90deg, #91f2c0, #cbf7da);
        box-shadow: 0 14px 30px rgba(145, 242, 192, 0.2);
      }
      .ipi-error {
        color: #f8b4c8;
        font-size: 12px;
        padding-left: 2px;
        display: none;
      }
      .ipi-error[data-visible="true"] {
        display: block;
      }
    </style>
    <section class="ipi-panel" hidden>
      <div class="ipi-body">
        <div class="ipi-stage" data-scanning="false">
          <img class="ipi-preview" alt="Selected image preview" />
          <div class="ipi-preview-shade"></div>
          <div class="ipi-stage-loading">${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).imageLoading}</div>
          <div class="ipi-scanner"></div>
        </div>
        <div class="ipi-card">
          <button class="ipi-drag" type="button" aria-label="${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).dragCard}"></button>
          <button class="ipi-close" type="button" aria-label="Close">×</button>
          <div class="ipi-meta">
            <div class="ipi-headline">
              <div class="ipi-name">ImgPrompt</div>
              <div class="ipi-subtitle">${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).subtitle}</div>
            </div>
            <div class="ipi-progress">
              <div class="ipi-progress-bar"></div>
              <div class="ipi-progress-content">
                <div class="ipi-progress-label">
                  <span class="ipi-progress-dot"></span>
                  <span class="ipi-status ipi-loading">${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).waitingToStart}</span>
                </div>
                <button class="ipi-stop" type="button" data-action="stop" aria-label="${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).stopButton}"></button>
              </div>
            </div>
            <div class="ipi-error"></div>
            <div class="ipi-sheet" data-visible="false">
              <div class="ipi-textarea-wrapper">
                <textarea class="ipi-textarea" spellcheck="false" placeholder="${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).placeholder}"></textarea>
              </div>
              <div class="ipi-resize-handle" title="拖动调整大小">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10L10 2M5 10L10 5M8 10L10 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="ipi-actions">
                <div class="ipi-switches">
                  <button class="ipi-switch" type="button" data-lang="zh" data-active="true">${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).zhBtn}</button>
                  <button class="ipi-switch" type="button" data-lang="en" data-active="false">${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).enBtn}</button>
                </div>
                <button class="ipi-action" type="button" data-action="copy" data-state="idle">${(UI_STRINGS[uiLanguage] || UI_STRINGS.zh).copyBtn}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function handleDocumentPointerMove(event) {
  if (!isHoverButtonEnabled || isHoverButtonDismissed) {
    return;
  }

  const target = event.target;
  const image =
    target instanceof HTMLImageElement
      ? target
      : target instanceof Element
        ? target.closest("img")
        : null;

  if (!image || !(image instanceof HTMLImageElement)) {
    if (!isHoverButtonHovered) {
      hoverImage = null;
      hideHoverButton();
    }
    return;
  }

  const rect = image.getBoundingClientRect();
  if (rect.width < 48 || rect.height < 48) {
    if (!isHoverButtonHovered) {
      hoverImage = null;
      hideHoverButton();
    }
    return;
  }

  hoverImage = image;
  showHoverButtonForImage(image);
}

function showHoverButtonForImage(image) {
  if (!isHoverButtonEnabled || isHoverButtonDismissed) {
    return;
  }

  const shadow = ensureHoverButton();
  const wrap = shadow.querySelector(".pp-hover-wrap");
  const button = shadow.querySelector(".pp-hover");
  if (!wrap || !button) {
    return;
  }

  // 先确保按钮在定位期间不可见，防止从旧位置跳变到新位置
  if (wrap.getAttribute("data-visible") !== "true") {
    wrap.style.opacity = "0";
    wrap.style.visibility = "hidden";
  }

  const rect = image.getBoundingClientRect();
  // 基础可见性检查
  if (rect.top < 0 || rect.top > window.innerHeight || rect.width <= 0 || rect.height <= 0) {
    if (!isHoverButtonHovered) {
      hideHoverButton();
    }
    return;
  }

  // 遮挡检测：检查图片右上角（按钮位置）是否被导航栏等元素遮挡
  const checkX = rect.right - 5;
  const checkY = rect.top + 5;
  const topEl = document.elementFromPoint(checkX, checkY);
  if (topEl && topEl !== image && !image.contains(topEl)) {
    if (!isHoverButtonHovered) {
      hideHoverButton();
    }
    return;
  }

  const top = rect.top + 10;
  const left = Math.min(
    window.innerWidth - wrap.offsetWidth - 8,
    rect.right - wrap.offsetWidth - 10
  );

  wrap.style.top = `${top}px`;
  wrap.style.left = `${Math.max(8, left)}px`;
  
  // 关键：在设置完位置后，标记显形
  wrap.setAttribute("data-visible", "true");
  wrap.style.opacity = ""; // 移除内联透明度，让 CSS transition 生效
  wrap.style.visibility = ""; 
}

function updateHoverButtonPosition() {
  if (!isHoverButtonEnabled || isHoverButtonDismissed || !hoverImage) {
    if (!isHoverButtonEnabled) {
      hideHoverButton();
    }
    return;
  }

  const rect = hoverImage.getBoundingClientRect();
  // 统一判断逻辑：图片顶部不可见或图片还未进入视口时隐藏
  if (rect.width <= 0 || rect.height <= 0 || rect.top < 0 || rect.top > window.innerHeight) {
    if (!isHoverButtonHovered) {
      hideHoverButton();
    }
    return;
  }

  showHoverButtonForImage(hoverImage);
}

function hideHoverButton() {
  const host = document.getElementById(HOVER_BUTTON_ROOT_ID);
  const wrap = host?.shadowRoot?.querySelector(".pp-hover-wrap");
  if (wrap) {
    wrap.setAttribute("data-visible", "false");
  }
}

function bindPanelEvents(shadowRoot) {
  const preview = shadowRoot.querySelector(".ipi-preview");
  preview?.addEventListener("load", () => {
    preview.setAttribute("data-loaded", "true");
  });
  preview?.addEventListener("error", () => {
    preview.removeAttribute("data-loaded");
    preview.removeAttribute("src");
  });

  shadowRoot.querySelector(".ipi-close")?.addEventListener("click", () => {
    panelDismissed = true;
    if (activeRequestId && isGenerating) {
      void cancelActiveGeneration(shadowRoot);
    }
    shadowRoot.querySelector(".ipi-panel").hidden = true;
  });

  shadowRoot.querySelector(".ipi-card")?.addEventListener("pointerdown", (event) => {
    startDragging(event);
  });

  // Custom resize handle
  const resizeHandle = shadowRoot.querySelector(".ipi-resize-handle");
  const textarea = shadowRoot.querySelector(".ipi-textarea");
  if (resizeHandle && textarea) {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener("pointerdown", (event) => {
      isResizing = true;
      startY = event.clientY;
      startHeight = textarea.offsetHeight;
      textarea.style.userSelect = "none";
      event.preventDefault();
      event.stopPropagation();
    });

    window.addEventListener("pointermove", (event) => {
      if (!isResizing) return;
      const deltaY = event.clientY - startY;
      const newHeight = Math.max(176, startHeight + deltaY);
      textarea.style.height = newHeight + "px";
    });

    window.addEventListener("pointerup", () => {
      if (isResizing) {
        isResizing = false;
        textarea.style.userSelect = "";
      }
    });
  }

  shadowRoot.querySelectorAll(".ipi-switch").forEach((button) => {
    button.addEventListener("click", () => {
      activeLanguage = button.getAttribute("data-lang") || "zh";
      
      preferredPromptLanguage = activeLanguage;
      chrome.storage.local.set({ preferredPromptLanguage: activeLanguage });

      syncLanguageButtons(shadowRoot);
      setTextareaValue(shadowRoot, currentPrompts[activeLanguage] || "");
      trackEvent("prompt_language_switched", {
        language: activeLanguage,
        trigger: currentTrigger,
        pageUrl: window.location.href,
        pageTitle: document.title
      });
    });
  });

  shadowRoot.querySelector(".ipi-textarea")?.addEventListener("input", (event) => {
    const value = event.target.value;
    currentPrompts[activeLanguage] = value;
  });

  shadowRoot.querySelector('[data-action="copy"]')?.addEventListener("click", async () => {
    const text = currentPrompts[activeLanguage] || "";
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyButtonState(shadowRoot, "done");
      trackEvent("prompt_copied", {
        language: activeLanguage,
        trigger: currentTrigger,
        textLength: text.length,
        pageUrl: window.location.href,
        pageTitle: document.title
      });
    } catch (error) {
      const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
      setCopyButtonState(shadowRoot, "idle");
      setError(shadowRoot, dict.copyFailed);
    }
  });

  shadowRoot.querySelector('[data-action="stop"]')?.addEventListener("click", async () => {
    if (!activeRequestId || !isGenerating) {
      return;
    }
    await cancelActiveGeneration(shadowRoot);
  });
}

async function cancelActiveGeneration(shadowRoot) {
  if (!activeRequestId || !isGenerating) {
    return;
  }

  setStopButtonState(shadowRoot, false);
  const sent = safeSendRuntimeMessage({
    type: "prompt:cancel-generation",
    requestId: activeRequestId
  });
  if (!sent) {
    isGenerating = false;
    stopProgressTimer();
  }
}

function syncLanguageButtons(shadowRoot) {
  shadowRoot.querySelectorAll(".ipi-switch").forEach((button) => {
    button.setAttribute(
      "data-active",
      String(button.getAttribute("data-lang") === activeLanguage)
    );
  });
}

function updateProgress(progress, text) {
  const shadowRoot = ensurePanel();
  const progressBar = shadowRoot.querySelector(".ipi-progress-bar");
  const status = shadowRoot.querySelector(".ipi-status");
  currentProgressText = text || "";
  progressBar.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
  status.textContent = formatProgressText(currentProgressText);
}

function setLoadingState(shadowRoot, isLoading) {
  const status = shadowRoot.querySelector(".ipi-status");
  status.classList.toggle("ipi-loading", isLoading);
  shadowRoot.querySelector(".ipi-textarea").readOnly = isLoading;
}

function setStatus(shadowRoot, text) {
  shadowRoot.querySelector(".ipi-status").textContent = text;
}

function shadowSafeHidePanel(shadowRoot) {
  shadowRoot.querySelector(".ipi-panel")?.setAttribute("hidden", "");
}

function startProgressTimer() {
  generationStartedAt = Date.now();
  currentProgressText = "";
  window.clearInterval(progressTimerId);
  progressTimerId = window.setInterval(() => {
    if (!isGenerating) {
      return;
    }

    const panel = document.getElementById(PANEL_ROOT_ID)?.shadowRoot;
    const status = panel?.querySelector(".ipi-status");
    if (status) {
      status.textContent = formatProgressText(currentProgressText);
    }
  }, 100);
}

function stopProgressTimer() {
  window.clearInterval(progressTimerId);
  progressTimerId = 0;
}

function formatProgressText(text) {
  if (!text) {
    return "";
  }

  if (!generationStartedAt) {
    return text;
  }

  const elapsedSeconds = ((Date.now() - generationStartedAt) / 1000).toFixed(1);
  return `${text} · ${elapsedSeconds}s`;
}

function setError(shadowRoot, text) {
  const errorEl = shadowRoot.querySelector(".ipi-error");
  if (!errorEl) return;
  
  if (text) {
    errorEl.textContent = text;
    errorEl.setAttribute("data-visible", "true");
  } else {
    errorEl.textContent = "";
    errorEl.removeAttribute("data-visible");
  }
}

function setTextareaValue(shadowRoot, value) {
  shadowRoot.querySelector(".ipi-textarea").value = value;
}

function setPreview(shadowRoot, src) {
  const preview = shadowRoot.querySelector(".ipi-preview");
  if (!preview) {
    return;
  }

  preview.removeAttribute("data-loaded");
  if (!src) {
    preview.removeAttribute("src");
    return;
  }

  preview.src = src;
}

function setCopyButtonState(shadowRoot, state) {
  const button = shadowRoot.querySelector('[data-action="copy"]');
  if (!button) {
    return;
  }

  const dict = UI_STRINGS[uiLanguage] || UI_STRINGS.zh;
  window.clearTimeout(setCopyButtonState.timerId);
  button.dataset.state = state;
  button.textContent = state === "done" ? dict.copied : dict.copyBtn;

  if (state === "done") {
    setCopyButtonState.timerId = window.setTimeout(() => {
      button.dataset.state = "idle";
      button.textContent = dict.copyBtn;
    }, 1600);
  }
}

function resetCopyButton(shadowRoot) {
  setCopyButtonState(shadowRoot, "idle");
}

function setContentVisibility(shadowRoot, visible) {
  const sheet = shadowRoot.querySelector(".ipi-sheet");
  if (!sheet) {
    return;
  }
  sheet.setAttribute("data-visible", String(visible));
}

function setStopButtonState(shadowRoot, enabled) {
  const button = shadowRoot.querySelector('[data-action="stop"]');
  if (!button) {
    return;
  }
  button.hidden = !enabled;
  button.disabled = !enabled;
}

function setScannerVisibility(shadowRoot, visible) {
  const stage = shadowRoot.querySelector(".ipi-stage");
  if (stage) {
    stage.setAttribute("data-scanning", String(visible));
  }
}

function startDragging(event) {
  const host = document.getElementById(PANEL_ROOT_ID);
  if (!host) {
    return;
  }

  // Don't start dragging if clicking on interactive elements like buttons or textareas
  const target = event.target;
  if (
    target.tagName === "BUTTON" ||
    target.tagName === "TEXTAREA" ||
    target.closest("button") ||
    target.closest("textarea")
  ) {
    return;
  }

  const rect = host.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };

  host.style.right = "auto";
  host.style.left = `${rect.left}px`;
  host.style.top = `${rect.top}px`;

  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", stopDragging);
  window.addEventListener("pointercancel", stopDragging);
  event.preventDefault();
}

function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  const host = document.getElementById(PANEL_ROOT_ID);
  if (!host) {
    return;
  }

  const nextLeft = Math.min(
    Math.max(8, event.clientX - dragState.offsetX),
    window.innerWidth - host.offsetWidth - 8
  );
  const nextTop = Math.min(
    Math.max(8, event.clientY - dragState.offsetY),
    window.innerHeight - host.offsetHeight - 8
  );

  host.style.left = `${nextLeft}px`;
  host.style.top = `${nextTop}px`;
}

function stopDragging(event) {
  if (!dragState || (event && event.pointerId !== dragState.pointerId)) {
    return;
  }

  dragState = null;
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", stopDragging);
  window.removeEventListener("pointercancel", stopDragging);
}

function trackEvent(event, properties = {}) {
  safeSendRuntimeMessage({
    type: "analytics:track",
    event,
    properties
  }, () => {
    void chrome.runtime.lastError;
  });
}
