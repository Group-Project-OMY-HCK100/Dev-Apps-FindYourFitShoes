const { Op, literal } = require('sequelize');
const { Shoe, User } = require('../models');
const env = require('../config/env');
const { CATEGORIES, CONDITIONS, COLORS } = require('../validators/shoe');
const { shoeSummary } = require('../utils/serializers');

const FILTER_KEYS = [
  'brand', 'category', 'condition', 'minPrice', 'maxPrice', 'size', 'minSize', 'maxSize', 'colors', 'excludeColors', 'preferColors',
];
const sellerInclude = { model: User, as: 'seller', attributes: ['id', 'name'] };
const PRICE_WORDS = new Map([
  ['setengah', 0.5], ['satu', 1], ['dua', 2], ['tiga', 3], ['empat', 4], ['lima', 5],
  ['enam', 6], ['tujuh', 7], ['delapan', 8], ['sembilan', 9], ['sepuluh', 10],
]);
const PRICE_AMOUNT_SOURCE = String.raw`(?:rp\.?\s*)?(?:(?:\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(?:juta|jt|ribu|rb)?|(?:setengah|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*(?:juta|ribu)|sejuta|seribu)`;
const MAX_PRICE_MARKER = String.raw`(?:di\s*bawah|dibawah|kurang\s+dari|maksimal|maksimum|max(?:imum)?|tidak\s+lebih\s+dari|hingga|sampai|budget|anggaran)`;
const MIN_PRICE_MARKER = String.raw`(?:di\s*atas|diatas|lebih\s+dari|minimal|minimum|min(?:imum)?|mulai\s+dari)`;
const COLOR_ALIASES = new Map([
  ['abu abu', 'gray'], ['merah muda', 'pink'], ['multi color', 'multicolor'], ['multicolor', 'multicolor'],
  ['hitam', 'black'], ['black', 'black'], ['putih', 'white'], ['white', 'white'], ['abu', 'gray'], ['gray', 'gray'], ['grey', 'gray'],
  ['merah', 'red'], ['red', 'red'], ['biru', 'blue'], ['blue', 'blue'], ['hijau', 'green'], ['green', 'green'],
  ['kuning', 'yellow'], ['yellow', 'yellow'], ['cokelat', 'brown'], ['coklat', 'brown'], ['brown', 'brown'],
  ['krem', 'beige'], ['beige', 'beige'], ['ungu', 'purple'], ['purple', 'purple'], ['pink', 'pink'],
  ['oranye', 'orange'], ['orange', 'orange'], ['neon', 'neon'],
]);
const CATEGORY_ALIASES = new Map([
  ['basketball', 'basketball'], ['basket', 'basketball'], ['running', 'running'], ['lari', 'running'], ['jogging', 'running'],
  ['casual', 'casual'], ['kasual', 'casual'], ['santai', 'casual'], ['formal', 'formal'], ['kantor', 'formal'],
  ['sneakers', 'sneakers'], ['sneaker', 'sneakers'],
]);
const SEMANTIC_CATEGORY_RULES = [
  ['running', /\b(?:olahraga|sport|sports|gym|fitness|workout|latihan|aktivitas\s+fisik|aktif\s+bergerak)\b/u],
  ['formal', /\b(?:acara\s+resmi|rapat|meeting|wawancara|interview|pernikahan|nikahan)\b/u],
  ['sneakers', /\b(?:streetwear|street\s+style|gaya\s+jalanan)\b/u],
  ['casual', /\b(?:kampus|kuliah|harian|sehari\s+hari|daily|nongkrong|jalan\s+jalan|komuter|commute)\b/u],
];
const SHOE_SIZE_STRINGS = Array.from({ length: 31 }, (_, index) => String(35 + index * 0.5));
const EMPTY_QUERY_NOTICE = 'Sepatu tidak ditemukan. Masukkan prompt yang berkaitan dengan sepatu atau tuliskan kebutuhan sepatu Anda.';
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    brand: { type: 'STRING', description: 'Brand explicitly requested by the user, preserving its normal name. Omit when no brand is requested.' },
    category: { type: 'STRING', enum: CATEGORIES, description: 'Omit if the user does not imply a specific category; never use other as a default.' },
    condition: { type: 'STRING', enum: CONDITIONS, description: 'good means bagus/baik, like_new means seperti baru, fair means cukup/layak.' },
    minPrice: { type: 'INTEGER', minimum: 1, maximum: 100000000, description: 'Minimum price in whole Indonesian rupiah.' },
    maxPrice: { type: 'INTEGER', minimum: 1, maximum: 100000000, description: 'Maximum price in whole Indonesian rupiah.' },
    size: { type: 'STRING', enum: SHOE_SIZE_STRINGS, description: 'Exact EU shoe size. Omit for a range.' },
    minSize: { type: 'STRING', enum: SHOE_SIZE_STRINGS, description: 'Minimum EU size for di atas/minimal. Omit for exact size.' },
    maxSize: { type: 'STRING', enum: SHOE_SIZE_STRINGS, description: 'Maximum EU size for di bawah/maksimal. Omit for exact size.' },
    colors: { type: 'ARRAY', items: { type: 'STRING', enum: COLORS }, description: 'Hard color filter when the user explicitly names acceptable colors.' },
    excludeColors: { type: 'ARRAY', items: { type: 'STRING', enum: COLORS }, description: 'Hard-excluded colors explicitly rejected or reasonably implied by subjective wording.' },
    preferColors: { type: 'ARRAY', items: { type: 'STRING', enum: COLORS }, description: 'Preferred colors used only for ranking.' },
  },
};

function normalizeFilters(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  if (input.brand === null) result.brand = null;
  else if (typeof input.brand === 'string' && input.brand.trim().length >= 2 && input.brand.trim().length <= 60) result.brand = input.brand.trim();
  if (input.category === null || CATEGORIES.includes(input.category)) result.category = input.category;
  if (input.condition === null || CONDITIONS.includes(input.condition)) result.condition = input.condition;
  for (const key of ['minPrice', 'maxPrice']) {
    if (input[key] === null) result[key] = null;
    else if (Number.isInteger(Number(input[key])) && Number(input[key]) >= 1 && Number(input[key]) <= 100000000) result[key] = Number(input[key]);
  }
  for (const key of ['size', 'minSize', 'maxSize']) {
    if (input[key] === null) result[key] = null;
    else if (Number.isFinite(Number(input[key])) && Number(input[key]) >= 35 && Number(input[key]) <= 50 && Number(input[key]) * 2 % 1 === 0) {
      result[key] = Number(input[key]);
    }
  }
  for (const key of ['colors', 'excludeColors', 'preferColors']) {
    if (Array.isArray(input[key])) result[key] = [...new Set(input[key].filter((color) => COLORS.includes(color)))];
  }
  if (result.minPrice && result.maxPrice && result.minPrice > result.maxPrice) {
    delete result.minPrice;
    delete result.maxPrice;
  }
  if (result.size) {
    delete result.minSize;
    delete result.maxSize;
  } else if (result.minSize && result.maxSize && result.minSize > result.maxSize) {
    delete result.minSize;
    delete result.maxSize;
  }
  return result;
}

function parseCurrencyAmount(value) {
  const normalized = String(value).toLowerCase().replace(/^rp\.?\s*/u, '').trim();
  if (normalized === 'sejuta') return 1_000_000;
  if (normalized === 'seribu') return 1_000;

  const wordMatch = normalized.match(/^(setengah|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*(juta|ribu)$/u);
  if (wordMatch) return PRICE_WORDS.get(wordMatch[1]) * (wordMatch[2] === 'juta' ? 1_000_000 : 1_000);

  const numericMatch = normalized.match(/^([\d.,\s]+?)\s*(juta|jt|ribu|rb)?$/u);
  if (!numericMatch) return null;
  const unit = numericMatch[2];
  let numberText = numericMatch[1].replace(/\s/g, '');
  let amount;
  if (unit) {
    numberText = numberText.replace(',', '.');
    if ((numberText.match(/\./g) || []).length > 1) numberText = numberText.replace(/\./g, '');
    amount = Number(numberText) * (unit === 'juta' || unit === 'jt' ? 1_000_000 : 1_000);
  } else {
    amount = Number(numberText.replace(/[.,]/g, ''));
  }
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 100_000_000 ? amount : null;
}

function extractExplicitPriceFilters(query) {
  const result = {};
  const patterns = [
    ['maxPrice', new RegExp(`${MAX_PRICE_MARKER}(?:\\s+harga)?\\s*(${PRICE_AMOUNT_SOURCE})`, 'iu')],
    ['minPrice', new RegExp(`${MIN_PRICE_MARKER}(?:\\s+harga)?\\s*(${PRICE_AMOUNT_SOURCE})`, 'iu')],
  ];
  for (const [field, pattern] of patterns) {
    const match = String(query).match(pattern);
    const hasPriceSignal = match && /(?:harga|budget|anggaran|rp\.?|juta|jt|ribu|rb)/iu.test(match[0]);
    if (!hasPriceSignal) continue;
    const amount = match ? parseCurrencyAmount(match[1]) : null;
    if (amount !== null) result[field] = amount;
  }
  return result;
}

function enforceExplicitPriceFilters(filters, query) {
  return normalizeFilters({ ...filters, ...extractExplicitPriceFilters(query) });
}

function normalizeQueryText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2').replace(/[^a-z0-9.]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function includesPhrase(normalizedQuery, phrase) {
  return ` ${normalizedQuery} `.includes(` ${normalizeQueryText(phrase)} `);
}

function parseShoeSize(value) {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 35 && parsed <= 50 && parsed * 2 % 1 === 0 ? parsed : null;
}

function extractExplicitListingFilters(query, knownBrands = []) {
  const normalized = normalizeQueryText(query);
  const result = { ...extractExplicitPriceFilters(query) };
  const brand = [...knownBrands]
    .filter((value) => typeof value === 'string' && value.trim())
    .sort((left, right) => right.length - left.length)
    .find((value) => includesPhrase(normalized, value));
  if (brand) result.brand = brand;

  const exactSize = normalized.match(/\b(?:ukuran|size|nomor|eu)\s*(\d{2}(?:[.,]5)?)\b/u);
  const aboveSize = normalized.match(/\b(?:ukuran\s*)?(?:di\s*atas|diatas|lebih\s+dari|>)\s*(\d{2}(?:[.,]5)?)\b/u);
  const belowSize = normalized.match(/\b(?:ukuran\s*)?(?:di\s*bawah|dibawah|kurang\s+dari|<)\s*(\d{2}(?:[.,]5)?)\b/u);
  const minimumSize = normalized.match(/\b(?:ukuran\s*)?(?:minimal|minimum|min)\s*(\d{2}(?:[.,]5)?)\b/u);
  const maximumSize = normalized.match(/\b(?:ukuran\s*)?(?:maksimal|maksimum|max)\s*(\d{2}(?:[.,]5)?)\b/u);
  if (exactSize) result.size = parseShoeSize(exactSize[1]);
  else if (aboveSize) {
    const value = parseShoeSize(aboveSize[1]);
    if (value !== null && value < 50) result.minSize = value + 0.5;
  } else if (belowSize) {
    const value = parseShoeSize(belowSize[1]);
    if (value !== null && value > 35) result.maxSize = value - 0.5;
  } else if (minimumSize) result.minSize = parseShoeSize(minimumSize[1]);
  else if (maximumSize) result.maxSize = parseShoeSize(maximumSize[1]);

  for (const [phrase, category] of CATEGORY_ALIASES) {
    if (includesPhrase(normalized, phrase)) { result.category = category; break; }
  }
  if (/\b(?:seperti baru|like new|hampir baru)\b/u.test(normalized)) result.condition = 'like_new';
  else if (/\b(?:kondisi\s+)?(?:bagus|baik|good)\b/u.test(normalized)) result.condition = 'good';
  else if (/\b(?:kondisi\s+)?(?:cukup|fair|layak)\b/u.test(normalized)) result.condition = 'fair';

  const colors = [];
  for (const [phrase, color] of COLOR_ALIASES) {
    if (includesPhrase(normalized, phrase) && !colors.includes(color)) colors.push(color);
  }
  if (colors.length) result.colors = colors;
  return normalizeFilters(result);
}

function extractSemanticFilters(query) {
  const normalized = normalizeQueryText(query);
  for (const [category, pattern] of SEMANTIC_CATEGORY_RULES) {
    if (pattern.test(normalized)) return { category };
  }
  return {};
}

function extractGroundedFilters(query, knownBrands = []) {
  return normalizeFilters({
    ...extractSemanticFilters(query),
    ...extractExplicitListingFilters(query, knownBrands),
  });
}

function enforceExplicitListingFilters(filters, query, knownBrands) {
  return normalizeFilters({ ...filters, ...extractExplicitListingFilters(query, knownBrands) });
}

function enforceGroundedFilters(filters, query, knownBrands) {
  return normalizeFilters({ ...filters, ...extractGroundedFilters(query, knownBrands) });
}

function sanitizeInterpretation(filters, query) {
  const result = { ...filters };
  if (result.category === 'other' && !/\b(other|lain|lainnya)\b/i.test(query)) delete result.category;
  return result;
}

function applyOverrides(filters, overrides) {
  const result = { ...filters };
  for (const key of FILTER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const normalized = normalizeFilters({ [key]: overrides[key] });
      if (Object.prototype.hasOwnProperty.call(normalized, key)) result[key] = normalized[key];
      else delete result[key];
    }
  }
  return result;
}

function validateOverrides(overrides) {
  const errors = [];
  for (const [key, value] of Object.entries(overrides)) {
    let valid = FILTER_KEYS.includes(key);
    if (key === 'brand') valid = value === null || (typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 60);
    if (key === 'category') valid = value === null || CATEGORIES.includes(value);
    if (key === 'condition') valid = value === null || CONDITIONS.includes(value);
    if (key === 'minPrice' || key === 'maxPrice') valid = value === null || (Number.isInteger(value) && value >= 1 && value <= 100000000);
    if (key === 'size' || key === 'minSize' || key === 'maxSize') valid = value === null || (typeof value === 'number' && value >= 35 && value <= 50 && value * 2 % 1 === 0);
    if (key === 'colors' || key === 'excludeColors' || key === 'preferColors') valid = Array.isArray(value) && value.every((color) => COLORS.includes(color));
    if (!valid) errors.push(key);
  }
  return errors;
}

function filterPrompt(query) {
  return [
    'Ekstrak filter pencarian sepatu bekas dari bahasa Indonesia.',
    'Brand harus diambil bila disebut eksplisit. Kondisi bagus/baik berarti good; seperti baru berarti like_new; cukup/layak berarti fair.',
    `Enum category: ${CATEGORIES.join(', ')}.`,
    `Enum condition: ${CONDITIONS.join(', ')}.`,
    `Enum color: ${COLORS.join(', ')}.`,
    'Kembalikan hanya properti yang benar-benar tersirat: brand, category, condition, minPrice, maxPrice, size, minSize, maxSize, colors, excludeColors, preferColors.',
    'Warna yang disebut eksplisit masuk ke colors sebagai filter keras. Gunakan preferColors hanya untuk preferensi subjektif.',
    'Ukuran di atas X berarti minSize lebih besar dari X; ukuran di bawah X berarti maxSize lebih kecil dari X. Gunakan size hanya untuk ukuran persis.',
    'Pahami kebutuhan penggunaan: olahraga/gym/latihan umumnya running, aktivitas harian/kampus umumnya casual, dan kebutuhan gabungan harian plus olahraga diprioritaskan ke running.',
    'Jangan menghasilkan SQL. Angka harga dalam rupiah. preferColors adalah ranking; excludeColors adalah larangan keras.',
    'Untuk frasa subjektif seperti warna kalem atau norak, interpretasikan sebagai preferensi warna secara wajar tanpa mengarang atribut listing.',
    `Query pengguna: ${JSON.stringify(query)}`,
  ].join('\n');
}

async function interpretWithGemini(query, signal, config = env.llm) {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
  const endpoint = `${config.geminiBaseUrl}/models/${encodeURIComponent(config.geminiModel)}:generateContent`;
  const request = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: filterPrompt(query) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 512,
        thinkingConfig: { thinkingLevel: config.geminiThinkingLevel || 'low' },
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
    signal,
  };
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, request);
    if (response.ok) {
      try {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
        if (!content) throw new Error('Invalid Gemini response');
        return sanitizeInterpretation(normalizeFilters(JSON.parse(content)), query);
      } catch (error) {
        lastError = error;
        if (attempt === 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.floor(Math.random() * 250)));
        continue;
      }
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 1) throw new Error(`Gemini HTTP ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.floor(Math.random() * 250)));
  }
  throw lastError || new Error('Gemini request failed');
}

async function interpretWithOpenAiCompatible(query, signal, config = env.llm) {
  if (!config.apiKey) throw new Error('LLM_API_KEY is not configured');
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Anda adalah parser filter JSON yang aman.' }, { role: 'user', content: filterPrompt(query) }],
    }),
    signal,
  });
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Invalid LLM response');
  return sanitizeInterpretation(normalizeFilters(JSON.parse(content)), query);
}

async function interpret(query) {
  if (!env.llm.provider) throw new Error('LLM_PROVIDER is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.llm.timeoutMs);
  try {
    if (env.llm.provider === 'gemini') return await interpretWithGemini(query, controller.signal);
    if (env.llm.provider === 'openai' || env.llm.provider === 'openai-compatible') {
      return await interpretWithOpenAiCompatible(query, controller.signal);
    }
    throw new Error(`Unsupported LLM provider: ${env.llm.provider}`);
  } finally { clearTimeout(timer); }
}

function buildReason(shoe, filters) {
  const facts = [];
  if (filters.brand && shoe.brand.toLowerCase() === filters.brand.toLowerCase()) facts.push(`brand ${shoe.brand}`);
  if (filters.category && shoe.category === filters.category) facts.push(`kategori ${shoe.category}`);
  if (filters.condition && shoe.condition === filters.condition) facts.push(`kondisi ${shoe.condition}`);
  if (filters.maxPrice && shoe.price <= filters.maxPrice) facts.push(`harga Rp${shoe.price.toLocaleString('id-ID')} sesuai batas`);
  if (filters.size && Number(shoe.size) === filters.size) facts.push(`ukuran EU ${filters.size}`);
  if ((filters.minSize || filters.maxSize) && (!filters.minSize || Number(shoe.size) >= filters.minSize) && (!filters.maxSize || Number(shoe.size) <= filters.maxSize)) facts.push(`ukuran EU ${Number(shoe.size)} sesuai rentang`);
  if (filters.colors?.includes(shoe.color)) facts.push(`warna ${shoe.color}`);
  if (filters.preferColors?.includes(shoe.color)) facts.push(`warna ${shoe.color} sesuai preferensi`);
  return facts.length ? `${facts.join(', ')}.` : null;
}

function buildFilterWhere(filters) {
  const where = { status: 'available' };
  if (filters.brand) where.brand = { [Op.iLike]: filters.brand };
  if (filters.category) where.category = filters.category;
  if (filters.condition) where.condition = filters.condition;
  if (filters.minPrice || filters.maxPrice) where.price = {
    ...(filters.minPrice ? { [Op.gte]: filters.minPrice } : {}),
    ...(filters.maxPrice ? { [Op.lte]: filters.maxPrice } : {}),
  };
  if (filters.size) where.size = filters.size;
  else if (filters.minSize || filters.maxSize) where.size = {
    ...(filters.minSize ? { [Op.gte]: filters.minSize } : {}),
    ...(filters.maxSize ? { [Op.lte]: filters.maxSize } : {}),
  };
  if (filters.colors?.length || filters.excludeColors?.length) where.color = {
    ...(filters.colors?.length ? { [Op.in]: filters.colors } : {}),
    ...(filters.excludeColors?.length ? { [Op.notIn]: filters.excludeColors } : {}),
  };
  return where;
}

function hasMeaningfulFilters(filters) {
  return Object.values(filters).some((value) => value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0));
}

async function queryByFilters(filters, limit) {
  const where = buildFilterWhere(filters);
  const order = [];
  if (filters.preferColors?.length) {
    const quoted = filters.preferColors.map((color) => `'${color}'`).join(',');
    order.push([literal(`CASE WHEN "Shoe"."color" IN (${quoted}) THEN 0 ELSE 1 END`), 'ASC']);
  }
  order.push(['createdAt', 'DESC'], ['id', 'DESC']);
  return Shoe.findAll({ where, include: [sellerInclude], order, limit });
}

const STOP_WORDS = new Set([
  'sepatu', 'yang', 'dan', 'atau', 'dengan', 'untuk', 'dari', 'di', 'ke', 'saya', 'cari', 'mau', 'jangan', 'warna', 'harga',
  'bawah', 'dibawah', 'atas', 'diatas', 'kurang', 'lebih', 'maksimal', 'maksimum', 'max', 'minimal', 'minimum', 'min', 'hingga',
  'sampai', 'mulai', 'tidak', 'budget', 'anggaran', 'rp', 'juta', 'jt', 'ribu', 'rb', 'setengah', 'satu', 'dua', 'tiga', 'empat',
  'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sejuta', 'seribu',
  'brand', 'merek', 'ukuran', 'size', 'nomor', 'eu', 'kondisi', 'bagus', 'baik', 'good', 'seperti', 'baru', 'hampir', 'cukup', 'fair', 'layak',
]);
function relevantTerms(query) {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2 && !/^\d+$/u.test(word) && !/^rp\d+$/u.test(word) && !STOP_WORDS.has(word)))].slice(0, 8);
}

async function fallbackSearch(query, limit, explicitFilters = {}, requireTextMatch = false) {
  const terms = requireTextMatch || !hasMeaningfulFilters(explicitFilters) ? relevantTerms(query) : [];
  const where = buildFilterWhere(explicitFilters);
  if (terms.length) {
    where[Op.or] = terms.flatMap((term) => ['brand', 'article', 'description'].map((field) => ({ [field]: { [Op.iLike]: `%${term}%` } })));
  }
  return Shoe.findAll({ where, include: [sellerInclude], order: [['createdAt', 'DESC'], ['id', 'DESC']], limit });
}

async function search(query, overrides, limit) {
  const brandRows = await Shoe.findAll({ attributes: ['brand'], group: ['brand'], raw: true });
  const knownBrands = brandRows.map(({ brand }) => brand);
  const groundedFilters = extractGroundedFilters(query, knownBrands);
  try {
    const interpretedFilters = applyOverrides(enforceGroundedFilters(await interpret(query), query, knownBrands), overrides);
    const hasGroundedFilters = hasMeaningfulFilters(groundedFilters) || hasMeaningfulFilters(overrides);
    const shoes = hasGroundedFilters
      ? await queryByFilters(interpretedFilters, limit)
      : await fallbackSearch(query, limit, interpretedFilters, true);
    return {
      mode: 'ai', query, interpretedFilters,
      results: shoes.map((shoe) => ({ shoe: shoeSummary(shoe), reason: buildReason(shoe, interpretedFilters) })),
      notice: shoes.length ? null : EMPTY_QUERY_NOTICE,
      meta: { totalItems: shoes.length, limit },
    };
  } catch {
    const fallbackFilters = applyOverrides(groundedFilters, overrides);
    const shoes = await fallbackSearch(query, limit, fallbackFilters);
    return {
      mode: 'fallback', query, interpretedFilters: null,
      results: shoes.map((shoe) => ({ shoe: shoeSummary(shoe), reason: null })),
      notice: shoes.length
        ? 'Pencarian AI sedang tidak tersedia; hasil memakai pencarian terstruktur lokal.'
        : `Pencarian AI sedang tidak tersedia. ${EMPTY_QUERY_NOTICE}`,
      meta: { totalItems: shoes.length, limit },
    };
  }
}

module.exports = {
  FILTER_KEYS,
  GEMINI_RESPONSE_SCHEMA,
  normalizeFilters,
  parseCurrencyAmount,
  extractExplicitPriceFilters,
  enforceExplicitPriceFilters,
  normalizeQueryText,
  parseShoeSize,
  extractExplicitListingFilters,
  extractSemanticFilters,
  extractGroundedFilters,
  enforceExplicitListingFilters,
  enforceGroundedFilters,
  sanitizeInterpretation,
  applyOverrides,
  validateOverrides,
  filterPrompt,
  relevantTerms,
  interpretWithGemini,
  interpretWithOpenAiCompatible,
  interpret,
  queryByFilters,
  buildFilterWhere,
  hasMeaningfulFilters,
  fallbackSearch,
  search,
};
