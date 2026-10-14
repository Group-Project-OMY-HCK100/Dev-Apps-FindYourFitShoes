const { Op, literal } = require('sequelize');
const { Shoe, User } = require('../models');
const env = require('../config/env');
const { CATEGORIES, COLORS } = require('../validators/shoe');
const { shoeSummary } = require('../utils/serializers');

const FILTER_KEYS = ['category', 'minPrice', 'maxPrice', 'size', 'excludeColors', 'preferColors'];
const sellerInclude = { model: User, as: 'seller', attributes: ['id', 'name'] };
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: CATEGORIES, description: 'Omit if the user does not imply a specific category; never use other as a default.' },
    minPrice: { type: 'INTEGER', minimum: 1, maximum: 100000000, description: 'Minimum price in whole Indonesian rupiah.' },
    maxPrice: { type: 'INTEGER', minimum: 1, maximum: 100000000, description: 'Maximum price in whole Indonesian rupiah.' },
    size: { type: 'NUMBER', minimum: 35, maximum: 50, description: 'EU shoe size, in increments of 0.5.' },
    excludeColors: { type: 'ARRAY', items: { type: 'STRING', enum: COLORS }, description: 'Hard-excluded colors explicitly rejected or reasonably implied by subjective wording.' },
    preferColors: { type: 'ARRAY', items: { type: 'STRING', enum: COLORS }, description: 'Preferred colors used only for ranking.' },
  },
};

function normalizeFilters(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  if (input.category === null || CATEGORIES.includes(input.category)) result.category = input.category;
  for (const key of ['minPrice', 'maxPrice']) {
    if (input[key] === null) result[key] = null;
    else if (Number.isInteger(Number(input[key])) && Number(input[key]) >= 1 && Number(input[key]) <= 100000000) result[key] = Number(input[key]);
  }
  if (input.size === null) result.size = null;
  else if (Number.isFinite(Number(input.size)) && Number(input.size) >= 35 && Number(input.size) <= 50 && Number(input.size) * 2 % 1 === 0) result.size = Number(input.size);
  for (const key of ['excludeColors', 'preferColors']) {
    if (Array.isArray(input[key])) result[key] = [...new Set(input[key].filter((color) => COLORS.includes(color)))];
  }
  if (result.minPrice && result.maxPrice && result.minPrice > result.maxPrice) {
    delete result.minPrice;
    delete result.maxPrice;
  }
  return result;
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
    if (key === 'category') valid = value === null || CATEGORIES.includes(value);
    if (key === 'minPrice' || key === 'maxPrice') valid = value === null || (Number.isInteger(value) && value >= 1 && value <= 100000000);
    if (key === 'size') valid = value === null || (typeof value === 'number' && value >= 35 && value <= 50 && value * 2 % 1 === 0);
    if (key === 'excludeColors' || key === 'preferColors') valid = Array.isArray(value) && value.every((color) => COLORS.includes(color));
    if (!valid) errors.push(key);
  }
  return errors;
}

function filterPrompt(query) {
  return [
    'Ekstrak filter pencarian sepatu bekas dari bahasa Indonesia.',
    `Enum category: ${CATEGORIES.join(', ')}.`,
    `Enum color: ${COLORS.join(', ')}.`,
    'Kembalikan hanya properti yang benar-benar tersirat: category, minPrice, maxPrice, size, excludeColors, preferColors.',
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
        maxOutputTokens: 256,
        thinkingConfig: { thinkingLevel: config.geminiThinkingLevel || 'low' },
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
    signal,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, request);
    if (response.ok) {
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
      if (!content) throw new Error('Invalid Gemini response');
      return sanitizeInterpretation(normalizeFilters(JSON.parse(content)), query);
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 1) throw new Error(`Gemini HTTP ${response.status}`);
  }
  throw new Error('Gemini request failed');
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
  if (filters.category && shoe.category === filters.category) facts.push(`kategori ${shoe.category}`);
  if (filters.maxPrice && shoe.price <= filters.maxPrice) facts.push(`harga Rp${shoe.price.toLocaleString('id-ID')} sesuai batas`);
  if (filters.size && Number(shoe.size) === filters.size) facts.push(`ukuran EU ${filters.size}`);
  if (filters.preferColors?.includes(shoe.color)) facts.push(`warna ${shoe.color} sesuai preferensi`);
  return facts.length ? `${facts.join(', ')}.` : null;
}

async function queryByFilters(filters, limit) {
  const where = { status: 'available' };
  if (filters.category) where.category = filters.category;
  if (filters.minPrice || filters.maxPrice) where.price = {
    ...(filters.minPrice ? { [Op.gte]: filters.minPrice } : {}),
    ...(filters.maxPrice ? { [Op.lte]: filters.maxPrice } : {}),
  };
  if (filters.size) where.size = filters.size;
  if (filters.excludeColors?.length) where.color = { [Op.notIn]: filters.excludeColors };
  const order = [];
  if (filters.preferColors?.length) {
    const quoted = filters.preferColors.map((color) => `'${color}'`).join(',');
    order.push([literal(`CASE WHEN "Shoe"."color" IN (${quoted}) THEN 0 ELSE 1 END`), 'ASC']);
  }
  order.push(['createdAt', 'DESC'], ['id', 'DESC']);
  return Shoe.findAll({ where, include: [sellerInclude], order, limit });
}

const STOP_WORDS = new Set(['sepatu', 'yang', 'dan', 'atau', 'dengan', 'untuk', 'dari', 'di', 'ke', 'saya', 'cari', 'mau', 'jangan', 'warna', 'harga']);
function relevantTerms(query) {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 2 && !STOP_WORDS.has(word)))].slice(0, 8);
}

async function fallbackSearch(query, limit) {
  const terms = relevantTerms(query);
  const where = { status: 'available' };
  if (terms.length) {
    where[Op.or] = terms.flatMap((term) => ['brand', 'article', 'description'].map((field) => ({ [field]: { [Op.iLike]: `%${term}%` } })));
  }
  return Shoe.findAll({ where, include: [sellerInclude], order: [['createdAt', 'DESC'], ['id', 'DESC']], limit });
}

async function search(query, overrides, limit) {
  try {
    const interpretedFilters = applyOverrides(await interpret(query), overrides);
    const shoes = await queryByFilters(interpretedFilters, limit);
    return {
      mode: 'ai', query, interpretedFilters,
      results: shoes.map((shoe) => ({ shoe: shoeSummary(shoe), reason: buildReason(shoe, interpretedFilters) })),
      notice: null,
      meta: { totalItems: shoes.length, limit },
    };
  } catch {
    const shoes = await fallbackSearch(query, limit);
    return {
      mode: 'fallback', query, interpretedFilters: null,
      results: shoes.map((shoe) => ({ shoe: shoeSummary(shoe), reason: null })),
      notice: 'Pencarian AI sedang tidak tersedia; hasil memakai pencarian teks biasa.',
      meta: { totalItems: shoes.length, limit },
    };
  }
}

module.exports = {
  FILTER_KEYS,
  GEMINI_RESPONSE_SCHEMA,
  normalizeFilters,
  sanitizeInterpretation,
  applyOverrides,
  validateOverrides,
  relevantTerms,
  interpretWithGemini,
  interpretWithOpenAiCompatible,
  interpret,
  queryByFilters,
  fallbackSearch,
  search,
};
