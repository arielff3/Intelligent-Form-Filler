# ⚡ Intelligent Form Filler

> Chrome extension that fills form fields with contextually intelligent data using AI, or instant offline fake data with valid CPF/CNPJ.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Intelligent_Form_Filler-7f5af0?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-2cb67d.svg)](./LICENSE) [![Manifest V3](https://img.shields.io/badge/Manifest-V3-242629?logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)

---

## The Problem

Testing form flows means typing the same fake data over and over. Name, email, CPF, address, phone — across 20+ fields, 15 times a day. The alternative is hardcoding random fills in your codebase that you'll forget to remove and that generate nonsense data anyway (invalid CPFs, nonexistent area codes, mismatched city/state).

## The Solution

One click. Every field. Two modes:

**⚡ AI Mode** — sends field metadata (labels, types, placeholders, validation rules) to an LLM. The AI understands what each field is asking and generates coherent data: the name matches the email, the city matches the state and zip code, and text fields get contextually relevant content. Supports Claude, GPT, and Gemini.

**🎲 Faker Mode** — instant offline fill, no API key, no cost. Built-in Brazilian data pools with real DDDs per city and CPF/CNPJ numbers with mathematically correct check digits that pass any client-side validation.

## Features

- **3 AI providers** — Anthropic (Claude Sonnet 4), OpenAI (GPT-4o-mini), Google (Gemini 2.0 Flash)
- **Valid document numbers** — CPF and CNPJ with correct check digits (both modes)
- **Coherent fake persons** — name, email, phone, address, city/state/CEP all match
- **Real DDDs** — 67 actual Brazilian area codes mapped to cities
- **Framework compatible** — React, Angular, Vue, vanilla JS (native value setters + event dispatch)
- **Locale support** — pt-BR, en-US, en-GB, es-ES, fr-FR, de-DE, ja-JP
- **Zero tracking** — no analytics, no telemetry, no data collection

## Install

### From Chrome Web Store

[Install Intelligent Form Filler →](https://chromewebstore.google.com/)

### From source

```bash
git clone https://github.com/SEU_USUARIO/intelligent-form-filler.git
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the cloned folder
4. Pin the extension from the toolbar

## Usage

1. Click the ⚡ icon in the toolbar
2. Choose your AI provider and paste your API key (optional — only for AI mode)
3. Select locale → **Save Settings**
4. Navigate to any page with a form
5. Click **⚡ Fill with AI** or **🎲 Fill with Faker**

## Architecture

```
intelligent-form-filler/
├── manifest.json          # Manifest V3 config
├── icons/                 # Extension icons (16/48/128px)
└── src/
    ├── background.js      # Service worker
    │                        ├── AI provider configs (Anthropic, OpenAI, Gemini)
    │                        ├── Prompt builder with CPF/CNPJ algorithms
    │                        └── FakerEngine (offline data generation)
    ├── content.js         # Content script
    │                        ├── DOM scanner (labels, types, options, ARIA)
    │                        ├── Native value setters (React compat)
    │                        └── Event dispatch (input, change, blur)
    ├── content.css        # Visual feedback (green highlight on fill)
    ├── popup.html         # Extension popup UI
    └── popup.js           # Popup logic & settings management
```

### How it works

1. **Scan** — Content script queries all fillable elements (`input`, `textarea`, `select`, `[contenteditable]`), extracts metadata (label, name, type, placeholder, options, min/max, pattern, required, aria-label), and deduplicates radio groups.

2. **Generate** — In AI mode, the background service worker builds a structured prompt with field metadata and sends it to the selected provider. In Faker mode, the `FakerEngine` generates a coherent person with matching data across all fields.

3. **Apply** — Values are applied using native property setters (`HTMLInputElement.prototype.value.set`) and dispatching `input`, `change`, and `blur` events so framework reactivity systems (React's controlled components, Angular's change detection, Vue's v-model) pick up the changes.

### CPF/CNPJ validation

Both generators compute check digits using the official algorithms:

- **CPF**: 9 random digits → weighted sum mod 11 → digit 10 → weighted sum mod 11 → digit 11
- **CNPJ**: 8 random digits + branch `0001` → weighted sums with `[5,4,3,2,9,8,7,6,5,4,3,2]` and `[6,5,4,3,2,9,8,7,6,5,4,3,2]` → digits 13 and 14

Validated against 1000 generated numbers — 100% pass rate on both.

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read form field metadata on the current page when you click the extension |
| `storage` | Save settings locally (provider, API key, locale) |
| `api.anthropic.com` | Send field metadata to Claude (AI mode, Anthropic) |
| `api.openai.com` | Send field metadata to GPT (AI mode, OpenAI) |
| `generativelanguage.googleapis.com` | Send field metadata to Gemini (AI mode, Google) |

## Privacy

- API key stored locally via `chrome.storage.local` — never shared
- AI mode sends only field metadata (labels, types, placeholders) — no page content
- Faker mode makes zero network requests
- No analytics, tracking, or telemetry

Full policy: [Privacy Policy](./PRIVACY.md)

## Contributing

Contributions are welcome. Some ideas:

- [ ] Add more locales (data pools for en-US, es-ES, etc. in Faker mode)
- [ ] Keyboard shortcut to fill without opening popup
- [ ] Field-by-field preview before applying
- [ ] Support for multi-step forms (wizard/stepper)
- [ ] Export/import generated person data

```bash
# Clone and load as unpacked extension
git clone https://github.com/SEU_USUARIO/intelligent-form-filler.git
# Make changes → reload extension in chrome://extensions/
```

No build step needed — it's plain JS.

## License

[MIT](./LICENSE)