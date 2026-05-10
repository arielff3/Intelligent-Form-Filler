// background.js — Service Worker for Intelligent Form Filler

// ─── AI Providers ───────────────────────────────────────────────────────────

const PROVIDERS = {
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    buildRequest: (apiKey, prompt) => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    }),
    parseResponse: (data) => {
      const textBlock = data.content?.find((b) => b.type === "text");
      return textBlock?.text || "";
    },
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    buildRequest: (apiKey, prompt) => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
      }),
    }),
    parseResponse: (data) => {
      return data.choices?.[0]?.message?.content || "";
    },
  },
  gemini: {
    url: (apiKey) =>
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    buildRequest: (_apiKey, prompt) => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }),
    parseResponse: (data) => {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    },
  },
};

// ─── Prompt Builder ─────────────────────────────────────────────────────────

function buildPrompt(fields, locale) {
  const fieldDescriptions = fields
    .map((f, i) => {
      const parts = [`[${i}]`];
      if (f.label) parts.push(`label="${f.label}"`);
      if (f.name) parts.push(`name="${f.name}"`);
      if (f.placeholder) parts.push(`placeholder="${f.placeholder}"`);
      if (f.type) parts.push(`type="${f.type}"`);
      if (f.tagName) parts.push(`tag="${f.tagName}"`);
      if (f.options?.length) parts.push(`options=${JSON.stringify(f.options)}`);
      if (f.min) parts.push(`min="${f.min}"`);
      if (f.max) parts.push(`max="${f.max}"`);
      if (f.pattern) parts.push(`pattern="${f.pattern}"`);
      if (f.required) parts.push("required");
      if (f.ariaLabel) parts.push(`aria-label="${f.ariaLabel}"`);
      return parts.join(" ");
    })
    .join("\n");

  return `You are an intelligent form filler. Given form field metadata, generate realistic, contextually appropriate fake data for each field. The data should be coherent (e.g., same person's name, matching city/state/zip, etc.) and locale-appropriate for "${locale}".

RULES:
- For email fields: generate a plausible fake email
- For phone fields: use locale-appropriate format (e.g. (34) 99876-5432 for pt-BR)
- For name fields: generate realistic names for the locale
- For date fields: use ISO format YYYY-MM-DD
- For number fields: respect min/max if provided
- For select/radio: pick one of the available options (return the option VALUE, not label)
- For checkbox: return "true" or "false"
- For textarea/long text: write 1-2 realistic sentences relevant to the field context
- For password fields: generate a strong password (12+ chars, mixed case, numbers, symbols)
- For URL fields: generate a plausible URL
- NEVER leave a required field empty

CRITICAL — DOCUMENT NUMBERS WITH VALID CHECK DIGITS:
When a field asks for CPF, CNPJ, RG, SSN, or any document number with check digits, you MUST generate a number that passes validation. Follow the exact algorithms:

CPF (###.###.###-##):
1. Generate 9 random digits.
2. Compute digit 10: sum = d1*10+d2*9+d3*8+d4*7+d5*6+d6*5+d7*4+d8*3+d9*2; remainder = sum % 11; digit10 = remainder < 2 ? 0 : 11 - remainder.
3. Compute digit 11: sum = d1*11+d2*10+d3*9+d4*8+d5*7+d6*6+d7*5+d8*4+d9*3+d10*2; remainder = sum % 11; digit11 = remainder < 2 ? 0 : 11 - remainder.
4. Format: ###.###.###-##

CNPJ (##.###.###/####-##):
1. Generate 8 digits for the base + "0001" for branch = 12 digits total.
2. Compute digit 13: weights [5,4,3,2,9,8,7,6,5,4,3,2]; sum of digit*weight; remainder = sum % 11; digit13 = remainder < 2 ? 0 : 11 - remainder.
3. Compute digit 14: weights [6,5,4,3,2,9,8,7,6,5,4,3,2]; sum of digit*weight; remainder = sum % 11; digit14 = remainder < 2 ? 0 : 11 - remainder.
4. Format: ##.###.###/####-##

Do NOT invent numbers without computing the check digits. Invalid documents make the form reject.

Also handle these if detected:
- CEP (Brazilian zip): format #####-### with a real-looking code for the generated city/state
- CNAE, Inscrição Estadual: plausible formats for the locale
- SSN (US): format ###-##-#### (use 900-999 range for first group to avoid real numbers)
- EIN (US): format ##-#######

FIELDS:
${fieldDescriptions}

Respond ONLY with a valid JSON array where each element is:
{"index": <number>, "value": "<generated value>"}

No markdown, no explanation, no backticks. Only the raw JSON array.`;
}

// ─── Offline Faker Engine ───────────────────────────────────────────────────

const FakerEngine = {
  rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  digits(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += this.rand(0, 9);
    return s;
  },

  // Real Brazilian DDDs
  ddds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99],

  firstNamesMale: ["Lucas", "Gabriel", "Matheus", "Pedro", "Rafael", "Bruno", "Gustavo", "Felipe", "André", "Diego", "Thiago", "Leonardo", "Henrique", "Carlos", "Ricardo", "Fernando", "Marcos", "João", "Daniel", "Eduardo"],
  firstNamesFemale: ["Ana", "Maria", "Juliana", "Camila", "Fernanda", "Patrícia", "Larissa", "Beatriz", "Carolina", "Amanda", "Isabela", "Letícia", "Mariana", "Bruna", "Gabriela", "Raquel", "Natália", "Vanessa", "Aline", "Tatiana"],
  lastNames: ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Ferreira", "Rodrigues", "Almeida", "Nascimento", "Araújo", "Melo", "Barbosa", "Ribeiro", "Martins", "Carvalho", "Gomes", "Rocha", "Dias"],
  cities: [
    { city: "São Paulo", state: "SP", ddd: 11, cep: "01" },
    { city: "Rio de Janeiro", state: "RJ", ddd: 21, cep: "20" },
    { city: "Belo Horizonte", state: "MG", ddd: 31, cep: "30" },
    { city: "Uberlândia", state: "MG", ddd: 34, cep: "38" },
    { city: "Curitiba", state: "PR", ddd: 41, cep: "80" },
    { city: "Porto Alegre", state: "RS", ddd: 51, cep: "90" },
    { city: "Salvador", state: "BA", ddd: 71, cep: "40" },
    { city: "Brasília", state: "DF", ddd: 61, cep: "70" },
    { city: "Fortaleza", state: "CE", ddd: 85, cep: "60" },
    { city: "Recife", state: "PE", ddd: 81, cep: "50" },
    { city: "Campinas", state: "SP", ddd: 19, cep: "13" },
    { city: "Goiânia", state: "GO", ddd: 62, cep: "74" },
  ],
  streets: ["Rua das Flores", "Av. Brasil", "Rua São Paulo", "Rua XV de Novembro", "Av. Presidente Vargas", "Rua da Consolação", "Av. Paulista", "Rua dos Andradas", "Rua Sete de Setembro", "Av. Rio Branco"],
  domains: ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "uol.com.br"],
  companies: ["Tech Solutions Ltda", "Comércio Digital S.A.", "Inova Serviços ME", "Brasil Logística Ltda", "Alfa Consultoria", "Nova Era Tecnologia"],
  loremPhrases: [
    "Solicito análise do processo conforme documentação anexa.",
    "Segue informação complementar para avaliação.",
    "Dados preenchidos para fins de teste e homologação do sistema.",
    "Registro realizado conforme procedimento padrão interno.",
    "Favor desconsiderar este cadastro, utilizado apenas para testes.",
    "Informações fictícias geradas automaticamente para validação.",
  ],

  _cachedPerson: null,

  getPerson() {
    if (this._cachedPerson) return this._cachedPerson;
    const isMale = Math.random() > 0.5;
    const firstName = this.pick(isMale ? this.firstNamesMale : this.firstNamesFemale);
    const lastName = this.pick(this.lastNames);
    const loc = this.pick(this.cities);
    const cleanFirst = firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanLast = lastName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    this._cachedPerson = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: `${cleanFirst}.${cleanLast}${this.rand(1, 99)}@${this.pick(this.domains)}`,
      phone: `(${loc.ddd}) 9${this.digits(4)}-${this.digits(4)}`,
      city: loc.city,
      state: loc.state,
      cep: `${loc.cep}${this.digits(3)}-${this.digits(3)}`,
      street: `${this.pick(this.streets)}, ${this.rand(1, 3000)}`,
      birthDate: `${this.rand(1970, 2004)}-${String(this.rand(1, 12)).padStart(2, "0")}-${String(this.rand(1, 28)).padStart(2, "0")}`,
      cpf: this.generateCPF(),
      cnpj: this.generateCNPJ(),
      rg: `${this.rand(10, 99)}.${this.digits(3)}.${this.digits(3)}-${this.rand(0, 9)}`,
      company: this.pick(this.companies),
    };
    return this._cachedPerson;
  },

  generateCPF() {
    const d = [];
    for (let i = 0; i < 9; i++) d.push(this.rand(0, 9));
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += d[i] * (10 - i);
    let rem = sum % 11;
    d.push(rem < 2 ? 0 : 11 - rem);
    sum = 0;
    for (let i = 0; i < 10; i++) sum += d[i] * (11 - i);
    rem = sum % 11;
    d.push(rem < 2 ? 0 : 11 - rem);
    return `${d[0]}${d[1]}${d[2]}.${d[3]}${d[4]}${d[5]}.${d[6]}${d[7]}${d[8]}-${d[9]}${d[10]}`;
  },

  generateCNPJ() {
    const d = [];
    for (let i = 0; i < 8; i++) d.push(this.rand(0, 9));
    d.push(0, 0, 0, 1);
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += d[i] * w1[i];
    let rem = sum % 11;
    d.push(rem < 2 ? 0 : 11 - rem);
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) sum += d[i] * w2[i];
    rem = sum % 11;
    d.push(rem < 2 ? 0 : 11 - rem);
    return `${d[0]}${d[1]}.${d[2]}${d[3]}${d[4]}.${d[5]}${d[6]}${d[7]}/${d[8]}${d[9]}${d[10]}${d[11]}-${d[12]}${d[13]}`;
  },

  generatePassword() {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let pw = "";
    for (let i = 0; i < 14; i++) pw += chars[this.rand(0, chars.length - 1)];
    return pw;
  },

  matchField(field) {
    const p = this.getPerson();
    const hint = [field.label, field.name, field.placeholder, field.ariaLabel, field.autocomplete]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // ── Document numbers (highest priority) ──
    if (/cnpj/.test(hint)) return p.cnpj;
    if (/cpf/.test(hint)) return p.cpf;
    if (/\brg\b|identidade/.test(hint)) return p.rg;
    if (/\bcep\b|zip|postal/.test(hint)) return p.cep;
    if (/inscricao.?estadual/.test(hint)) return this.digits(12);

    // ── Person info ──
    if (/sobrenome|last[_\-\s]?name|surname/.test(hint)) return p.lastName;
    if (/primeiro[_\-\s]?nome|first[_\-\s]?name|given[_\-\s]?name/.test(hint)) return p.firstName;
    // "nome" but NOT "username", "filename", "hostname", etc.
    if (/\bnome\b|full[_\-\s]?name/.test(hint) && !/user|file|host|path|class|module|table|field|column|domain/.test(hint)) return p.fullName;
    if (/\bname\b/.test(hint) && !/user|file|host|path|class|module|table|field|column|domain|company|brand|fantasia|razao/.test(hint)) return p.fullName;
    if (/e[\-_]?mail/.test(hint) || field.type === "email") return p.email;
    if (/telefone|celular|\bphone\b|\bfone\b|whats/.test(hint) || field.type === "tel") return p.phone;

    // ── Address ──
    if (/cidade|city/.test(hint)) return p.city;
    if (/\bestado\b|\bstate\b|\buf\b/.test(hint)) return p.state;
    if (/endereco|address|logradouro|\brua\b/.test(hint)) return p.street;
    if (/bairro|neighborhood|distrito/.test(hint)) return this.pick(["Centro", "Jardim América", "Santa Mônica", "Vila Nova", "Saraiva", "Copacabana", "Moema"]);
    if (/\bnumero\b|\bnumber\b|\bnro\b/.test(hint) && !/telefone|phone|cel|cpf|cnpj|rg|document/.test(hint)) return String(this.rand(1, 3000));
    if (/complemento|complement|\bapto\b/.test(hint)) return this.pick(["Apto 101", "Bloco B", "Sala 3", "Casa", ""]);
    if (/\bpais\b|\bcountry\b/.test(hint)) return "Brasil";

    // ── Company ──
    if (/empresa|company|razao[_\-\s]?social|corporat/.test(hint)) return p.company;
    if (/fantasia|trade[_\-\s]?name/.test(hint)) return p.company.split(" ")[0];

    // ── Dates ──
    if (field.type === "date") return p.birthDate;
    if (/nascimento|birth|data[_\-\s]?nasc/.test(hint)) return p.birthDate;

    // ── Select / radio ──
    if (field.options?.length > 0) {
      const validOpts = field.options.filter((o) => o.value);
      if (validOpts.length) return this.pick(validOpts).value;
    }

    // ── Checkbox ──
    if (field.type === "checkbox") return String(Math.random() > 0.5);

    // ── Password ──
    if (field.type === "password" || /senha|password/.test(hint)) return this.generatePassword();

    // ── URL ──
    if (field.type === "url" || /\bsite\b|\bwebsite\b|\burl\b|\bhomepage\b/.test(hint)) return "https://www.exemplo.com.br";

    // ── Number ──
    if (field.type === "number" || field.type === "range") {
      const min = parseInt(field.min) || 0;
      const max = parseInt(field.max) || 100;
      return String(this.rand(min, max));
    }

    // ── Textarea / long text ──
    if (field.tagName === "textarea" || /motivo|descri|observ|comment|mensagem|message|\bnota\b|\babout\b/.test(hint)) {
      return this.pick(this.loremPhrases);
    }

    // ── Fallback ──
    return `Teste ${this.rand(100, 999)}`;
  },

  fillAll(fields) {
    this._cachedPerson = null;
    return fields.map((f, i) => ({ index: i, value: this.matchField(f) }));
  },
};

// ─── Message Handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FILL_FORM") {
    handleFillForm(message.fields, message.tabId, message.mode)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    chrome.storage.local.get(["provider", "apiKey", "locale"], (settings) =>
      sendResponse(settings)
    );
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    chrome.storage.local.set(
      { provider: message.provider, apiKey: message.apiKey, locale: message.locale },
      () => sendResponse({ success: true })
    );
    return true;
  }
});

// ─── Fill Handler ───────────────────────────────────────────────────────────

async function handleFillForm(fields, tabId, mode) {
  if (mode === "faker") {
    const values = FakerEngine.fillAll(fields);
    chrome.tabs.sendMessage(tabId, { type: "APPLY_VALUES", values });
    return { success: true, count: values.length };
  }

  const settings = await chrome.storage.local.get(["provider", "apiKey", "locale"]);

  if (!settings.apiKey) {
    return { error: "API key not configured. Open the extension popup to set it up." };
  }

  const providerKey = settings.provider || "anthropic";
  const provider = PROVIDERS[providerKey];
  if (!provider) {
    return { error: `Unknown provider: ${providerKey}` };
  }

  const locale = settings.locale || "pt-BR";
  const prompt = buildPrompt(fields, locale);

  try {
    const url =
      typeof provider.url === "function"
        ? provider.url(settings.apiKey)
        : provider.url;

    const response = await fetch(url, provider.buildRequest(settings.apiKey, prompt));

    if (!response.ok) {
      const errBody = await response.text();
      console.error("AI API error:", response.status, errBody);
      return { error: `API error (${response.status}): ${errBody.substring(0, 200)}` };
    }

    const data = await response.json();
    const rawText = provider.parseResponse(data);

    let values;
    try {
      const cleaned = rawText.replace(/```json\s*|```\s*/g, "").trim();
      values = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", rawText);
      return { error: "AI returned invalid JSON. Try again." };
    }

    chrome.tabs.sendMessage(tabId, { type: "APPLY_VALUES", values });
    return { success: true, count: values.length };
  } catch (err) {
    console.error("Fill form error:", err);
    return { error: err.message };
  }
}
