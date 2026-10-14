const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeFilters,
  sanitizeInterpretation,
  applyOverrides,
  validateOverrides,
  relevantTerms,
  interpretWithGemini,
  parseCurrencyAmount,
  extractExplicitPriceFilters,
  enforceExplicitPriceFilters,
  extractExplicitListingFilters,
  buildFilterWhere,
  hasMeaningfulFilters,
} = require('../../services/ai-service');

test('normalizeFilters hanya mempertahankan filter allowlist yang valid', () => {
  assert.deepEqual(normalizeFilters({ category: 'running', maxPrice: '500000', evil: 'DROP', excludeColors: ['neon', 'invalid'] }), {
    category: 'running', maxPrice: 500000, excludeColors: ['neon'],
  });
});

test('override array kosong menggantikan interpretasi sebelumnya', () => {
  assert.deepEqual(applyOverrides({ excludeColors: ['neon'] }, { excludeColors: [] }), { excludeColors: [] });
});

test('category other tidak dipakai sebagai default tanpa intent eksplisit', () => {
  assert.deepEqual(sanitizeInterpretation({ category: 'other', size: 42 }, 'sepatu hitam ukuran 42'), { size: 42 });
  assert.deepEqual(sanitizeInterpretation({ category: 'other' }, 'kategori lainnya'), { category: 'other' });
});

test('override invalid dapat ditolak controller', () => {
  assert.deepEqual(validateOverrides({ size: 99, maxPrice: 500000 }), ['size']);
});

test('fallback mengambil kata relevan tanpa stop words', () => {
  assert.deepEqual(relevantTerms('cari sepatu lari hitam untuk saya'), ['lari', 'hitam']);
  assert.deepEqual(relevantTerms('Nike harga di bawah 1 juta'), ['nike']);
  assert.deepEqual(relevantTerms('harga di bawah Rp1.000.000'), []);
});

test('nominal rupiah natural dinormalisasi menjadi integer', () => {
  assert.equal(parseCurrencyAmount('1 juta'), 1_000_000);
  assert.equal(parseCurrencyAmount('1,5 juta'), 1_500_000);
  assert.equal(parseCurrencyAmount('Rp1.000.000'), 1_000_000);
  assert.equal(parseCurrencyAmount('750 ribu'), 750_000);
  assert.equal(parseCurrencyAmount('satu juta'), 1_000_000);
});

test('batas harga eksplisit diekstrak tanpa salah membaca ukuran', () => {
  assert.deepEqual(extractExplicitPriceFilters('cari harga dibawah 1 juta'), { maxPrice: 1_000_000 });
  assert.deepEqual(extractExplicitPriceFilters('sepatu di bawah Rp1.000.000'), { maxPrice: 1_000_000 });
  assert.deepEqual(extractExplicitPriceFilters('budget maksimal satu juta'), { maxPrice: 1_000_000 });
  assert.deepEqual(extractExplicitPriceFilters('harga di atas 500 ribu'), { minPrice: 500_000 });
  assert.deepEqual(extractExplicitPriceFilters('sepatu ukuran 42'), {});
  assert.deepEqual(extractExplicitPriceFilters('cari sepatu diatas 40'), {});
});

test('batas harga eksplisit mengoreksi interpretasi LLM', () => {
  assert.deepEqual(
    enforceExplicitPriceFilters({ category: 'casual', maxPrice: 1_500_000 }, 'casual dibawah 1 juta'),
    { category: 'casual', maxPrice: 1_000_000 },
  );
});

test('filter listing eksplisit mengenali brand, kondisi, rentang ukuran, dan warna', () => {
  const brands = ['Nike', 'New Balance', 'Adidas'];
  assert.deepEqual(
    extractExplicitListingFilters('saya cari sepatu brand new balance, ukuran 42 kondisi bagus', brands),
    { brand: 'New Balance', size: 42, condition: 'good' },
  );
  assert.deepEqual(extractExplicitListingFilters('cari sepatu diatas 40', brands), { minSize: 40.5 });
  assert.deepEqual(extractExplicitListingFilters('cari sepatu ukuran di bawah 42', brands), { maxSize: 41.5 });
  assert.deepEqual(extractExplicitListingFilters('cari sepatu warna putih', brands), { colors: ['white'] });
});

test('filter query database memakai batas keras untuk seluruh atribut eksplisit', () => {
  const filters = {
    brand: 'New Balance', condition: 'good', minSize: 40.5, colors: ['white'], excludeColors: ['red'],
  };
  const where = buildFilterWhere(filters);
  assert.equal(where.status, 'available');
  assert.equal(typeof where.brand, 'object');
  assert.equal(where.condition, 'good');
  assert.equal(typeof where.size, 'object');
  assert.equal(typeof where.color, 'object');
  assert.equal(hasMeaningfulFilters(filters), true);
  assert.equal(hasMeaningfulFilters({}), false);
});

test('adapter Gemini meminta structured JSON dan menormalisasi respons', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"category":"running","maxPrice":500000}' }] } }],
      }),
    };
  };
  try {
    const result = await interpretWithGemini(
      'sepatu lari di bawah 500 ribu',
      new AbortController().signal,
      { geminiApiKey: 'test-key', geminiModel: 'gemini-test', geminiBaseUrl: 'https://example.test/v1beta' },
    );
    assert.deepEqual(result, { category: 'running', maxPrice: 500000 });
    const request = JSON.parse(captured.options.body);
    assert.equal(request.generationConfig.responseMimeType, 'application/json');
    assert.equal(request.generationConfig.responseSchema.type, 'OBJECT');
    assert.equal(request.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.equal(request.generationConfig.maxOutputTokens, 512);
    assert.equal(request.generationConfig.responseSchema.properties.size.type, 'STRING');
    assert.equal(request.generationConfig.responseSchema.properties.size.enum.includes('42.5'), true);
    assert.equal(captured.options.headers['x-goog-api-key'].length > 0, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('adapter Gemini retry sekali untuk error provider sementara', async () => {
  const originalFetch = global.fetch;
  let attempts = 0;
  global.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return { ok: false, status: 503 };
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"category":"casual"}' }] } }] }),
    };
  };
  try {
    const result = await interpretWithGemini(
      'sepatu santai',
      new AbortController().signal,
      { geminiApiKey: 'test-key', geminiModel: 'gemini-test', geminiBaseUrl: 'https://example.test/v1beta' },
    );
    assert.deepEqual(result, { category: 'casual' });
    assert.equal(attempts, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('adapter Gemini retry sekali ketika structured JSON provider rusak', async () => {
  const originalFetch = global.fetch;
  let attempts = 0;
  global.fetch = async () => {
    attempts += 1;
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: attempts === 1 ? '{"brand":"New Balance"' : '{"brand":"New Balance","size":42}' }] } }],
      }),
    };
  };
  try {
    const result = await interpretWithGemini(
      'New Balance ukuran 42',
      new AbortController().signal,
      { geminiApiKey: 'test-key', geminiModel: 'gemini-test', geminiBaseUrl: 'https://example.test/v1beta' },
    );
    assert.deepEqual(result, { brand: 'New Balance', size: 42 });
    assert.equal(attempts, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
