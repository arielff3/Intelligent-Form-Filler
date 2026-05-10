// popup.js — UI logic for Intelligent Form Filler

const providerEl = document.getElementById("provider");
const apiKeyEl = document.getElementById("apiKey");
const localeEl = document.getElementById("locale");
const fillAiBtn = document.getElementById("fillAiBtn");
const fillAiBtnText = document.getElementById("fillAiBtnText");
const fillFakerBtn = document.getElementById("fillFakerBtn");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const fieldCountEl = document.getElementById("fieldCount");
const toggleKeyEl = document.getElementById("toggleKey");

let scannedFields = [];
let activeTabId = null;

// ── Init ──
chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
  if (settings?.provider) providerEl.value = settings.provider;
  if (settings?.apiKey) apiKeyEl.value = settings.apiKey;
  if (settings?.locale) localeEl.value = settings.locale;
  scanCurrentPage();
});

// ── Toggle API key visibility ──
toggleKeyEl.addEventListener("click", () => {
  const isHidden = apiKeyEl.type === "password";
  apiKeyEl.type = isHidden ? "text" : "password";
  toggleKeyEl.textContent = isHidden ? "🙈" : "👁";
});

// ── Save settings ──
saveBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage(
    {
      type: "SAVE_SETTINGS",
      provider: providerEl.value,
      apiKey: apiKeyEl.value,
      locale: localeEl.value,
    },
    () => {
      showStatus("Settings saved!", "success");
      updateButtons();
    }
  );
});

// ── Fill with AI ──
fillAiBtn.addEventListener("click", () => {
  if (!apiKeyEl.value) {
    showStatus("Enter an API key for AI mode.", "error");
    return;
  }

  // Auto-save
  chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    provider: providerEl.value,
    apiKey: apiKeyEl.value,
    locale: localeEl.value,
  });

  setFilling(true);
  showStatus("Analyzing fields with AI...", "loading");

  chrome.runtime.sendMessage(
    { type: "FILL_FORM", fields: scannedFields, tabId: activeTabId, mode: "ai" },
    handleFillResponse
  );
});

// ── Fill with Faker ──
fillFakerBtn.addEventListener("click", () => {
  setFilling(true);
  showStatus("Generating fake data...", "loading");

  chrome.runtime.sendMessage(
    { type: "FILL_FORM", fields: scannedFields, tabId: activeTabId, mode: "faker" },
    handleFillResponse
  );
});

// ── Helpers ──

function handleFillResponse(result) {
  setFilling(false);
  if (result?.error) {
    showStatus(result.error, "error");
  } else if (result?.success) {
    showStatus(`Filled ${result.count} field${result.count !== 1 ? "s" : ""} successfully!`, "success");
  }
}

function setFilling(busy) {
  fillAiBtn.disabled = busy || !apiKeyEl.value || scannedFields.length === 0;
  fillFakerBtn.disabled = busy || scannedFields.length === 0;
  fillAiBtnText.textContent = busy ? "⏳ Generating..." : "⚡ Fill with AI";
}

function scanCurrentPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    activeTabId = tabs[0].id;

    const url = tabs[0].url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
      fieldCountEl.textContent = "Cannot scan browser internal pages.";
      return;
    }

    chrome.tabs.sendMessage(activeTabId, { type: "SCAN_FIELDS" }, (response) => {
      if (chrome.runtime.lastError) {
        fieldCountEl.textContent = "Reload the page to enable scanning.";
        return;
      }

      scannedFields = response?.fields || [];
      const n = scannedFields.length;
      fieldCountEl.textContent = n === 0
        ? "No fillable fields found on this page."
        : `${n} fillable field${n !== 1 ? "s" : ""} detected.`;
      updateButtons();
    });
  });
}

function updateButtons() {
  fillAiBtn.disabled = scannedFields.length === 0 || !apiKeyEl.value;
  fillFakerBtn.disabled = scannedFields.length === 0;
}

function showStatus(message, type) {
  statusEl.className = `status ${type}`;
  statusEl.innerHTML = type === "loading"
    ? `<div class="spinner"></div>${message}`
    : message;
}

apiKeyEl.addEventListener("input", updateButtons);
