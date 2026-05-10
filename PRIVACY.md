# Privacy Policy — Intelligent Form Filler

**Last updated:** May 10, 2026

## Overview

Intelligent Form Filler is a Chrome extension that fills web form fields with realistic fake data, either using AI or an offline faker engine. This policy describes what data the extension accesses, how it's used, and what is transmitted externally.

**TL;DR** — The extension does not collect, store, or share any personal data. Your API key stays on your device. In Faker mode, nothing leaves your browser.

## Data the extension accesses

When you click a fill button, the extension reads **form field metadata** from the active tab. This includes field labels, input types, placeholder text, select options, validation attributes (min, max, pattern), and ARIA labels.

The extension does **not** read page content, cookies, browsing history, passwords, personal information, or any data outside of form field attributes.

## How data is used

**In AI mode**, the field metadata listed above is sent to the AI provider you selected (Anthropic, OpenAI, or Google) so the model can generate contextually appropriate values. The extension sends only field metadata — never page content, URLs, or personal data. The AI provider's own privacy policy governs how they handle this request.

**In Faker mode**, all data generation happens locally in your browser. Zero network requests are made. Nothing leaves your device.

## Data stored on your device

The extension uses `chrome.storage.local` to save your preferences:

- Selected AI provider (Anthropic, OpenAI, or Google)
- Your API key for the selected provider
- Selected locale (e.g., pt-BR, en-US)

This data is stored locally on your device and is **never transmitted** to any server other than the AI provider you explicitly choose when clicking "Fill with AI".

## Permissions

| Permission | Why it's needed |
|---|---|
| `activeTab` | Access the current page's form fields when you click the extension icon. No page content is read without your action. |
| `storage` | Persist your settings (provider, API key, locale) locally on your device. |
| `api.anthropic.com` | Send field metadata to Claude when you select Anthropic and click "Fill with AI". |
| `api.openai.com` | Send field metadata to GPT when you select OpenAI and click "Fill with AI". |
| `generativelanguage.googleapis.com` | Send field metadata to Gemini when you select Google and click "Fill with AI". |

## Third-party services

The extension only communicates with the AI provider you explicitly select. No other third-party services, analytics platforms, tracking pixels, or telemetry systems are used.

## Data sharing

The extension does **not** sell, share, or transfer any user data to third parties for any purpose, including but not limited to advertising, analytics, or credit assessment.

## Children's privacy

The extension is not directed at children under 13 and does not knowingly collect any data from children.

## Changes to this policy

If this policy is updated, the changes will be reflected on this page with an updated date. Continued use of the extension after changes constitutes acceptance of the revised policy.

## Contact

If you have questions about this privacy policy, reach out at [GitHub](https://github.com/arielff3)