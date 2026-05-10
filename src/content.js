// content.js — Scans forms, extracts metadata, and applies AI values

(() => {
  if (window.__intelligentFormFillerLoaded) return;
  window.__intelligentFormFillerLoaded = true;

  const FILLABLE_SELECTORS = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"])',
    "textarea",
    "select",
    '[contenteditable="true"]',
  ].join(", ");

  function findLabel(el) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent.trim();
    }

    const parentLabel = el.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input, textarea, select").forEach((c) => c.remove());
      const text = clone.textContent.trim();
      if (text) return text;
    }

    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref) return ref.textContent.trim();
    }

    const prev = el.previousElementSibling;
    if (prev && ["LABEL", "SPAN", "P", "DIV"].includes(prev.tagName)) {
      const text = prev.textContent.trim();
      if (text.length < 100) return text;
    }

    return "";
  }

  function getSelectOptions(el) {
    if (el.tagName !== "SELECT") return [];
    return Array.from(el.options)
      .filter((o) => o.value && !o.disabled)
      .map((o) => ({ value: o.value, label: o.textContent.trim() }));
  }

  function getRadioOptions(el) {
    if (el.type !== "radio") return [];
    const name = el.name;
    if (!name) return [];
    const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
    return Array.from(radios).map((r) => ({
      value: r.value,
      label: findLabel(r) || r.value,
    }));
  }

  function scanFields() {
    const elements = document.querySelectorAll(FILLABLE_SELECTORS);
    const fields = [];
    const seenRadioNames = new Set();

    elements.forEach((el) => {
      if (el.offsetParent === null && el.type !== "hidden") return;
      if (el.disabled || el.readOnly) return;

      if (el.type === "radio") {
        if (seenRadioNames.has(el.name)) return;
        seenRadioNames.add(el.name);
      }

      fields.push({
        tagName: el.tagName.toLowerCase(),
        type: el.type || "",
        name: el.name || "",
        id: el.id || "",
        placeholder: el.placeholder || "",
        label: findLabel(el),
        ariaLabel: el.getAttribute("aria-label") || "",
        required: el.required || el.getAttribute("aria-required") === "true",
        min: el.min || "",
        max: el.max || "",
        pattern: el.pattern || "",
        options: el.tagName === "SELECT" ? getSelectOptions(el) : getRadioOptions(el),
        autocomplete: el.autocomplete || "",
      });
    });

    return fields;
  }

  function triggerInputEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setNativeValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (el.tagName === "TEXTAREA" && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(el, value);
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }
  }

  function applyValue(el, value) {
    if (!value && value !== false && value !== 0) return;
    const strValue = String(value);

    if (el.getAttribute("contenteditable") === "true") {
      el.textContent = strValue;
      triggerInputEvents(el);
      return;
    }

    switch (el.type) {
      case "checkbox": {
        const shouldCheck = strValue === "true" || strValue === "1";
        if (el.checked !== shouldCheck) {
          el.checked = shouldCheck;
          triggerInputEvents(el);
        }
        break;
      }
      case "radio": {
        const radios = document.querySelectorAll(
          `input[type="radio"][name="${CSS.escape(el.name)}"]`
        );
        radios.forEach((r) => {
          if (r.value === strValue) {
            r.checked = true;
            triggerInputEvents(r);
          }
        });
        break;
      }
      case "select-one":
      case "select-multiple": {
        const option = Array.from(el.options).find((o) => o.value === strValue);
        if (option) {
          el.value = strValue;
          triggerInputEvents(el);
        }
        break;
      }
      default: {
        setNativeValue(el, strValue);
        triggerInputEvents(el);
        break;
      }
    }

    el.classList.add("iff-filled");
    setTimeout(() => el.classList.remove("iff-filled"), 2000);
  }

  function applyValues(values) {
    const elements = document.querySelectorAll(FILLABLE_SELECTORS);
    const fillableEls = [];
    const seenRadioNames = new Set();

    elements.forEach((el) => {
      if (el.offsetParent === null && el.type !== "hidden") return;
      if (el.disabled || el.readOnly) return;

      if (el.type === "radio") {
        if (seenRadioNames.has(el.name)) return;
        seenRadioNames.add(el.name);
      }

      fillableEls.push(el);
    });

    values.forEach((v) => {
      const el = fillableEls[v.index];
      if (el) applyValue(el, v.value);
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCAN_FIELDS") {
      sendResponse({ fields: scanFields() });
      return true;
    }

    if (message.type === "APPLY_VALUES") {
      applyValues(message.values);
      sendResponse({ success: true });
      return true;
    }
  });
})();
