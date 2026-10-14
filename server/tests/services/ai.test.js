const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeFilters,
  sanitizeInterpretation,
  applyOverrides,
  validateOverrides,
  relevantTerms,
  interpretWithGemini,
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
    assert.equal(request.generationConfig.maxOutputTokens, 256);
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
